'use strict';

// ═══════════════════════════════════════════════════════════════════════════
// TRI PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Fonction appelée par le déclencheur one-off du Dashboard.
 * Supprime son propre déclencheur éphémère puis lance le tri.
 */
function executerTriManuelBackground() {
    const triggers = ScriptApp.getProjectTriggers();
    triggers.forEach(trigger => {
        if (trigger.getHandlerFunction() === 'executerTriManuelBackground') {
            ScriptApp.deleteTrigger(trigger);
        }
    });
    
    trierBoiteReception();
}

/**
 * Déclenche le triage de la boîte de réception.
 * Acquiert un verrou pour éviter les exécutions concurrentes.
 * @returns {{ok: boolean, stats?: Object, dureeMs?: number, ignore?: boolean, raison?: string}}
 */
function trierBoiteReception() {
    // Court-circuit rapide sans verrou : évite l'attente si une réinitialisation
    // est manifestement en cours. La race condition résiduelle est couverte par
    // le double-check effectué sous verrou plus bas.
    if (reinitialisationEnCours_()) {
        journaliser_('INFO', 'Tri ignoré : une réinitialisation est en cours.');
        return { ok: false, ignore: true, raison: 'REINITIALISATION' };
    }

    const lock = LockService.getScriptLock();

    if (!lock.tryLock(CONFIG.TRI.VERROU_TIMEOUT_MS)) {
        journaliser_('INFO', 'Tri ignoré : une autre exécution est déjà active.');
        return { ok: false, ignore: true, raison: 'VERROU' };
    }

    try {
        if (reinitialisationEnCours_()) {
            journaliser_('INFO', 'Tri ignoré : une réinitialisation vient de démarrer.');
            return { ok: false, ignore: true, raison: 'REINITIALISATION' };
        }

        return trierBoiteReceptionInterne_();
    } catch (e) {
        journaliser_('ERREUR', 'Échec global du tri.', {
            erreur: nettoyerMessageErreur_(e)
        });

        notifierErreurGlobale_(e);
        return {
            ok: false,
            erreur: nettoyerMessageErreur_(e)
        };
    } finally {
        lock.releaseLock();
    }
}


function trierBoiteReceptionInterne_() {
    const debut = Date.now();
    const deadline = debut + CONFIG.TRI.DUREE_MAX_MS;

    const compte = obtenirComptePrincipal_();
    const identites = obtenirIdentitesCompte_(compte);
    const apiKey = obtenirCleGemini_();
    const modele = obtenirModeleGemini_();
    const labels = obtenirTousLesLibelles_();

    const requete =
        `in:inbox -label:"${echapperRechercheGmail_(CONFIG.LABELS.MARQUEUR)}"`;

    const threads = GmailApp.search(requete, 0, CONFIG.TRI.LOT_MAX);

    const stats = {
        TROUVES: threads.length,
        TRAITES: 0,
        REGLES: 0,
        IA: 0,
        RAPIDE: 0,
        ATTENTION: 0,
        AUCUNE: 0,
        ERREURS: 0,
        QUARANTAINE: 0,
        ECRITURE_ECHECS: 0,
        ARRET_TEMPS: false,
        ERREUR_GLOBALE: false
    };

    if (threads.length === 0) {
        const purges = purgerAnciensCompteursEchec_();

        journaliser_('INFO', 'Aucun thread à analyser.', {
            dureeMs: Date.now() - debut,
            compteursEchecPurges: purges > 0 ? purges : undefined
        });

        return {
            ok: true,
            stats,
            dureeMs: Date.now() - debut
        };
    }

    const messagesParThread = GmailApp.getMessagesForThreads(threads);
    const resultats = [];
    let erreurGlobale = null;

    for (let i = 0; i < threads.length; i++) {
        if (Date.now() >= deadline - CONFIG.TRI.MARGE_FINALISATION_MS) {
            stats.ARRET_TEMPS = true;
            break;
        }

        const thread = threads[i];
        const threadId = thread.getId();
        const nbEchecsAvant = obtenirNombreEchecsThread_(threadId);

        if (nbEchecsAvant >= CONFIG.TRI.NB_ECHECS_AVANT_QUARANTAINE) {
            resultats.push({
                thread,
                categorie: 'ERREUR',
                source: 'QUARANTAINE',
                raison: 'Seuil d’échecs déjà atteint.'
            });
            stats.QUARANTAINE++;
            continue;
        }

        try {
            const resultat = classerThreadAvecIA_(
                thread,
                messagesParThread[i] || [],
                identites,
                apiKey,
                modele,
                deadline
            );

            resultats.push({
                thread,
                categorie: resultat.categorie,
                source: resultat.source,
                raison: resultat.raison || '',
                analyse: resultat.analyse || null
            });

            stats.TRAITES++;
            stats[resultat.categorie]++;

            if (resultat.source === 'IA') {
                stats.IA++;
            } else {
                stats.REGLES++;
            }

            if (CONFIG.TRI.JOURNALISER_RAISONS_IA &&
                resultat.source === 'IA' &&
                resultat.raison) {
                journaliser_('INFO', 'Décision IA.', {
                    threadId,
                    categorie: resultat.categorie,
                    raison: tronquer_(resultat.raison, 220)
                });
            }
        } catch (e) {
            stats.ERREURS++;

            if (e && e.globale) {
                erreurGlobale = e;
                stats.ERREUR_GLOBALE = true;
                break;
            }

            const nombreEchecs = incrementerEchecThread_(threadId);

            journaliser_('ERREUR', 'Échec sur un thread.', {
                threadId,
                sujet: sujetPourJournal_(thread, messagesParThread[i] || []),
                nombreEchecs,
                erreur: nettoyerMessageErreur_(e)
            });

            if (nombreEchecs >= CONFIG.TRI.NB_ECHECS_AVANT_QUARANTAINE) {
                resultats.push({
                    thread,
                    categorie: 'ERREUR',
                    source: 'QUARANTAINE',
                    raison: nettoyerMessageErreur_(e)
                });
                stats.QUARANTAINE++;
            }
        }
    }

    const application = appliquerResultats_(resultats, labels);
    stats.ECRITURE_ECHECS = application.echecs;
    stats.APPLIQUES = application.appliques;

    if (erreurGlobale) {
        journaliser_('ERREUR', 'Arrêt anticipé après une erreur globale.', {
            erreur: nettoyerMessageErreur_(erreurGlobale)
        });
        notifierErreurGlobale_(erreurGlobale);
    } else if (stats.ARRET_TEMPS || stats.TROUVES === CONFIG.TRI.LOT_MAX) {
        journaliser_('INFO', 'Backlog détecté : planification d’une reprise rapide dans 1 minute.', {
            trouves: stats.TROUVES,
            arretTemps: stats.ARRET_TEMPS
        });
        // Reprise via le wrapper auto-nettoyant : ne touche pas au déclencheur
        // horaire récurrent qui porte le handler trierBoiteReception.
        programmerRepriseUnique_('executerTriManuelBackground', 60 * 1000);
    }

    const purges = purgerAnciensCompteursEchec_();

    const resume = {
        ok: !erreurGlobale,
        stats,
        dureeMs: Date.now() - debut,
        compteursEchecPurges: purges > 0 ? purges : undefined,
        modele
    };

    journaliser_('INFO', 'Tri terminé.', resume);
    return resume;
}


// ═══════════════════════════════════════════════════════════════════════════
// APPLICATION DES LIBELLÉS
// ═══════════════════════════════════════════════════════════════════════════

function appliquerResultats_(resultats, labels) {
    if (!Array.isArray(resultats) || resultats.length === 0) {
        return { appliques: 0, echecs: 0 };
    }

    const threads = resultats.map(resultat => resultat.thread);

    try {
        LIBELLES_EXCLUSIFS_.forEach(cle => {
            labels[cle].removeFromThreads(threads);
        });

        LIBELLES_EXCLUSIFS_.forEach(cle => {
            const groupe = resultats
                .filter(resultat => resultat.categorie === cle)
                .map(resultat => resultat.thread);

            if (groupe.length > 0) {
                labels[cle].addToThreads(groupe);
            }
        });

        // Le marqueur est ajouté en dernier : un échec d'écriture laisse le thread
        // retraitable au prochain passage.
        labels.MARQUEUR.addToThreads(threads);

        const aArchiver = resultats
            .filter(resultat =>
                resultat.categorie === 'AUCUNE' &&
                CONFIG.TRI.ARCHIVER_AUCUNE_ACTION
            )
            .map(resultat => resultat.thread);

        if (aArchiver.length > 0) {
            GmailApp.moveThreadsToArchive(aArchiver);
        }

        resultats.forEach(resultat => {
            if (resultat.categorie !== 'ERREUR') {
                effacerEchecThread_(resultat.thread.getId());
            }
        });

        return {
            appliques: resultats.length,
            echecs: 0
        };
    } catch (e) {
        journaliser_(
            'ERREUR',
            'Échec de l’application groupée des libellés, reprise thread par thread.',
            { erreur: nettoyerMessageErreur_(e) }
        );

        return appliquerResultatsUnParUn_(resultats, labels);
    }
}


function appliquerResultatsUnParUn_(resultats, labels) {
    let appliques = 0;
    let echecs = 0;

    resultats.forEach(resultat => {
        try {
            LIBELLES_EXCLUSIFS_.forEach(cle => {
                labels[cle].removeFromThread(resultat.thread);
            });

            labels[resultat.categorie].addToThread(resultat.thread);
            labels.MARQUEUR.addToThread(resultat.thread);

            if (
                resultat.categorie === 'AUCUNE' &&
                CONFIG.TRI.ARCHIVER_AUCUNE_ACTION
            ) {
                resultat.thread.moveToArchive();
            }

            if (resultat.categorie !== 'ERREUR') {
                effacerEchecThread_(resultat.thread.getId());
            }

            appliques++;
        } catch (e) {
            echecs++;
            journaliser_('ERREUR', 'Échec d’écriture sur un thread.', {
                threadId: resultat.thread.getId(),
                erreur: nettoyerMessageErreur_(e)
            });
        }
    });

    return { appliques, echecs };
}


