'use strict';

// ═══════════════════════════════════════════════════════════════════════════
// QUARANTAINE ET REPRISE DES ERREURS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Fonction appelée par les déclencheurs one-off de reprise.
 * Supprime son propre déclencheur éphémère puis relance le retraitement,
 * sans toucher au déclencheur hebdomadaire récurrent de retraiterErreurs.
 */
function retraiterErreursBackground() {
    supprimerDeclencheursParFonctions_(['retraiterErreursBackground']);
    retraiterErreurs();
}

/**
 * Remet en file de triage les threads placés en quarantaine (libellé Erreur).
 * Efface leurs compteurs d'échec pour qu'ils soient retraités au prochain cycle.
 * Peut être déclenché manuellement ou planifié automatiquement.
 * @returns {{ok: boolean, termine?: boolean, total?: number, reporte?: boolean, ignore?: boolean}}
 */
function retraiterErreurs() {
    if (reinitialisationEnCours_()) {
        journaliser_(
            'INFO',
            'Reprise des erreurs ignorée : réinitialisation en cours.'
        );
        return { ok: false, ignore: true };
    }

    const lock = LockService.getScriptLock();

    if (!lock.tryLock(10000)) {
        journaliser_(
            'INFO',
            'Reprise des erreurs reportée : une autre exécution est active.'
        );
        programmerRepriseUnique_(
            'retraiterErreursBackground',
            CONFIG.REINITIALISATION.DELAI_REPRISE_MS
        );
        return { ok: false, reporte: true };
    }

    const debut = Date.now();
    const deadline =
        debut +
        CONFIG.REINITIALISATION.DUREE_MAX_MS -
        CONFIG.REINITIALISATION.MARGE_FINALISATION_MS;

    let total = 0;

    try {
        const labelErreur = getOrCreateLabel_(CONFIG.LABELS.ERREUR);
        const labelMarqueur = getOrCreateLabel_(CONFIG.LABELS.MARQUEUR);

        while (Date.now() < deadline) {
            const threads = labelErreur.getThreads(
                0,
                CONFIG.REINITIALISATION.LOT
            );

            if (threads.length === 0) {
                // Ne nettoie que les reprises one-off : le déclencheur
                // hebdomadaire récurrent (handler retraiterErreurs) est conservé.
                supprimerDeclencheursParFonctions_(['retraiterErreursBackground']);

                journaliser_('INFO', 'Tous les threads en erreur sont retraitables.', {
                    total
                });

                return { ok: true, termine: true, total };
            }

            labelErreur.removeFromThreads(threads);
            labelMarqueur.removeFromThreads(threads);

            threads.forEach(thread => {
                effacerEchecThread_(thread.getId());
            });

            total += threads.length;
        }

        programmerRepriseUnique_(
            'retraiterErreursBackground',
            CONFIG.REINITIALISATION.DELAI_REPRISE_MS
        );

        journaliser_('INFO', 'Reprise des erreurs planifiée.', {
            totalTraiteCetteExecution: total
        });

        return { ok: true, termine: false, total };
    } catch (e) {
        programmerRepriseUnique_(
            'retraiterErreursBackground',
            CONFIG.REINITIALISATION.DELAI_REPRISE_MS
        );

        journaliser_('ERREUR', 'Échec pendant la reprise des erreurs.', {
            total,
            erreur: nettoyerMessageErreur_(e)
        });

        return {
            ok: false,
            total,
            erreur: nettoyerMessageErreur_(e)
        };
    } finally {
        lock.releaseLock();
    }
}


// ═══════════════════════════════════════════════════════════════════════════
// COMPTEURS D'ERREUR ET ALERTES
// ═══════════════════════════════════════════════════════════════════════════

function obtenirCleEchecThread_(threadId) {
    return CONFIG.PROPRIETES.PREFIXE_ECHEC_THREAD + threadId;
}


function obtenirNombreEchecsThread_(threadId) {
    const valeur = PropertiesService.getScriptProperties()
        .getProperty(obtenirCleEchecThread_(threadId));

    if (!valeur) {
        return 0;
    }

    // Nouveau format JSON {"n": compteur, "t": horodatage}.
    // Rétro-compatibilité : l'ancienne valeur numérique brute est relue correctement.
    try {
        const objet = JSON.parse(valeur);
        const nombre = Number(objet.n);
        return Number.isFinite(nombre) ? nombre : 0;
    } catch (e) {
        const nombre = Number(valeur);
        return Number.isFinite(nombre) ? nombre : 0;
    }
}


function incrementerEchecThread_(threadId) {
    const props = PropertiesService.getScriptProperties();
    const cle = obtenirCleEchecThread_(threadId);
    const suivant = obtenirNombreEchecsThread_(threadId) + 1;

    props.setProperty(cle, JSON.stringify({ n: suivant, t: Date.now() }));
    return suivant;
}


function effacerEchecThread_(threadId) {
    PropertiesService.getScriptProperties()
        .deleteProperty(obtenirCleEchecThread_(threadId));
}


function effacerTousLesCompteursEchec_() {
    const props = PropertiesService.getScriptProperties();
    const toutes = props.getProperties();

    Object.keys(toutes)
        .filter(cle =>
            cle.startsWith(CONFIG.PROPRIETES.PREFIXE_ECHEC_THREAD)
        )
        .forEach(cle => props.deleteProperty(cle));
}


/**
 * Supprime les compteurs d'échec par thread dont le dernier enregistrement
 * dépasse CONFIG.TRI.DUREE_VIE_COMPTEUR_ECHEC_JOURS.
 * Protège contre le dépassement du quota PropertiesService (500 propriétés max).
 * Les entrées au format numérique (ancienne version) sont migrées par suppression.
 * @returns {number} Nombre de clés supprimées.
 */
function purgerAnciensCompteursEchec_() {
    const props = PropertiesService.getScriptProperties();
    const toutes = props.getProperties();
    const limiteMs =
        CONFIG.TRI.DUREE_VIE_COMPTEUR_ECHEC_JOURS * 24 * 60 * 60 * 1000;
    const maintenant = Date.now();
    let supprimes = 0;

    Object.keys(toutes)
        .filter(cle => cle.startsWith(CONFIG.PROPRIETES.PREFIXE_ECHEC_THREAD))
        .forEach(cle => {
            try {
                const objet = JSON.parse(toutes[cle]);
                const age = maintenant - Number(objet.t || 0);

                if (!Number.isFinite(age) || age > limiteMs) {
                    props.deleteProperty(cle);
                    supprimes++;
                }
            } catch (e) {
                // Ancien format numérique sans horodatage : supprimer pour migrer.
                props.deleteProperty(cle);
                supprimes++;
            }
        });

    return supprimes;
}


function notifierErreurGlobale_(erreur) {
    if (!CONFIG.ALERTES.ACTIVES) {
        return;
    }

    try {
        const props = PropertiesService.getScriptProperties();
        const maintenant = Date.now();
        const derniere = Number(
            props.getProperty(CONFIG.PROPRIETES.DERNIERE_ALERTE) || 0
        );

        const delaiMinimum =
            CONFIG.ALERTES.DELAI_MINIMUM_HEURES * 60 * 60 * 1000;

        if (derniere && maintenant - derniere < delaiMinimum) {
            return;
        }

        const destinataire = obtenirComptePrincipal_();
        const message = nettoyerMessageErreur_(erreur);
        const modele = obtenirModeleGemini_();

        GmailApp.sendEmail(
            destinataire,
            'Tri Gmail IA — erreur nécessitant une vérification',
            [
                'Le tri Gmail a rencontré une erreur globale.',
                '',
                `Date : ${new Date().toISOString()}`,
                `Modèle : ${modele}`,
                `Erreur : ${message}`,
                '',
                'Aucun contenu d’email n’est inclus dans cette alerte.',
                'Vérifiez les exécutions Apps Script, la clé API, les quotas et le modèle.'
            ].join('\n'),
            {
                name: 'Tri Gmail IA'
            }
        );

        props.setProperty(
            CONFIG.PROPRIETES.DERNIERE_ALERTE,
            String(maintenant)
        );
    } catch (e) {
        journaliser_('ERREUR', 'Impossible d’envoyer l’alerte globale.', {
            erreur: nettoyerMessageErreur_(e)
        });
    }
}


