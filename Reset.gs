'use strict';

// ═══════════════════════════════════════════════════════════════════════════
// RÉINITIALISATION COMPLÈTE AVEC REPRISE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Réinitialise le tri en supprimant tous les libellés de toutes les conversations.
 * Opération longue exécutée en plusieurs passes avec reprise automatique sur trigger.
 * @returns {{ok: boolean, termine?: boolean, retraitsDeLibelles?: number, reporte?: boolean}}
 */
function reinitialiserTri() {
    const lock = LockService.getScriptLock();

    if (!lock.tryLock(10000)) {
        journaliser_(
            'INFO',
            'Réinitialisation reportée : une autre exécution est active.'
        );
        programmerRepriseUnique_(
            'reinitialiserTri',
            CONFIG.REINITIALISATION.DELAI_REPRISE_MS
        );
        return { ok: false, reporte: true };
    }

    const props = PropertiesService.getScriptProperties();
    const debut = Date.now();
    const deadline =
        debut +
        CONFIG.REINITIALISATION.DUREE_MAX_MS -
        CONFIG.REINITIALISATION.MARGE_FINALISATION_MS;

    let index = Number(
        props.getProperty(CONFIG.PROPRIETES.RESET_INDEX) || 0
    );
    let total = Number(
        props.getProperty(CONFIG.PROPRIETES.RESET_TOTAL) || 0
    );

    const nomsLibelles = Object.keys(CONFIG.LABELS)
        .map(cle => CONFIG.LABELS[cle]);

    try {
        props.setProperty(CONFIG.PROPRIETES.RESET_ACTIF, '1');

        while (index < nomsLibelles.length && Date.now() < deadline) {
            const nom = nomsLibelles[index];
            const label = GmailApp.getUserLabelByName(nom);

            if (!label) {
                index++;
                sauvegarderEtatReset_(index, total);
                continue;
            }

            const threads = label.getThreads(
                0,
                CONFIG.REINITIALISATION.LOT
            );

            if (threads.length === 0) {
                index++;
                sauvegarderEtatReset_(index, total);
                continue;
            }

            if (
                nom === CONFIG.LABELS.AUCUNE &&
                CONFIG.REINITIALISATION.REPLACER_AUCUNE_ARCHIVEE_DANS_INBOX
            ) {
                const archives = threads.filter(thread => !thread.isInInbox());

                if (archives.length > 0) {
                    GmailApp.moveThreadsToInbox(archives);
                }
            }

            label.removeFromThreads(threads);
            total += threads.length;
            sauvegarderEtatReset_(index, total);
        }

        if (index >= nomsLibelles.length) {
            effacerEtatReinitialisation_();
            effacerTousLesCompteursEchec_();
            supprimerDeclencheursParFonctions_(['reinitialiserTri']);

            journaliser_('INFO', 'Réinitialisation terminée.', {
                retraitsDeLibelles: total,
                archivesReplaceesDansInbox:
                    CONFIG.REINITIALISATION.REPLACER_AUCUNE_ARCHIVEE_DANS_INBOX,
                note: CONFIG.REINITIALISATION.REPLACER_AUCUNE_ARCHIVEE_DANS_INBOX
                    ? 'Les anciens threads AUCUNE archivés pourront être retraités.'
                    : 'Les anciens threads archivés restent hors de la boîte de réception.'
            });

            return {
                ok: true,
                termine: true,
                retraitsDeLibelles: total
            };
        }

        sauvegarderEtatReset_(index, total);
        programmerRepriseUnique_(
            'reinitialiserTri',
            CONFIG.REINITIALISATION.DELAI_REPRISE_MS
        );

        journaliser_('INFO', 'Réinitialisation mise en pause et planifiée.', {
            indexLibelle: index,
            retraitsDeLibelles: total
        });

        return {
            ok: true,
            termine: false,
            indexLibelle: index,
            retraitsDeLibelles: total
        };
    } catch (e) {
        sauvegarderEtatReset_(index, total);
        programmerRepriseUnique_(
            'reinitialiserTri',
            CONFIG.REINITIALISATION.DELAI_REPRISE_MS
        );

        journaliser_('ERREUR', 'Échec pendant la réinitialisation.', {
            indexLibelle: index,
            retraitsDeLibelles: total,
            erreur: nettoyerMessageErreur_(e)
        });

        return {
            ok: false,
            termine: false,
            erreur: nettoyerMessageErreur_(e)
        };
    } finally {
        lock.releaseLock();
    }
}


/**
 * Annule une réinitialisation en cours et supprime le déclencheur de reprise.
 * @returns {{ok: boolean, declencheursSupprimes: number}}
 * @throws {Error} Si le verrou est occupé.
 */
function annulerReinitialisation() {
    const lock = LockService.getScriptLock();

    if (!lock.tryLock(10000)) {
        throw new Error(
            'Impossible d’annuler : une autre exécution est active.'
        );
    }

    try {
        effacerEtatReinitialisation_();
        const supprimes =
            supprimerDeclencheursParFonctions_(['reinitialiserTri']);

        journaliser_('INFO', 'Réinitialisation annulée.', {
            declencheursSupprimes: supprimes
        });

        return { ok: true, declencheursSupprimes: supprimes };
    } finally {
        lock.releaseLock();
    }
}


function sauvegarderEtatReset_(index, total) {
    PropertiesService.getScriptProperties().setProperties({
        [CONFIG.PROPRIETES.RESET_ACTIF]: '1',
        [CONFIG.PROPRIETES.RESET_INDEX]: String(index),
        [CONFIG.PROPRIETES.RESET_TOTAL]: String(total)
    });
}


function effacerEtatReinitialisation_() {
    const props = PropertiesService.getScriptProperties();

    [
        CONFIG.PROPRIETES.RESET_ACTIF,
        CONFIG.PROPRIETES.RESET_INDEX,
        CONFIG.PROPRIETES.RESET_TOTAL
    ].forEach(cle => props.deleteProperty(cle));
}


function reinitialisationEnCours_() {
    return PropertiesService.getScriptProperties()
        .getProperty(CONFIG.PROPRIETES.RESET_ACTIF) === '1';
}


