'use strict';

// ═══════════════════════════════════════════════════════════════════════════
// INSTALLATION ET CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Installe les libellés et les déclencheurs.
 * La clé Gemini est testée avant toute création de déclencheur (sauf si testerGemini=false).
 * @param {Object=} options Options d'installation (ex: { testerGemini: false })
 * @returns {{ok: boolean, compte: string, nombreIdentites: number, modele: string, testGemini: ?Object}}
 * @throws {Error} Si le verrou est occupé, la configuration est invalide ou la clé API absente.
 */
function setup(options) {
    if (reinitialisationEnCours_()) {
        throw new Error('Réinitialisation en cours : réessayez quand elle sera terminée, ou annulez-la d’abord.');
    }

    const opts = options || {};
    const lock = LockService.getScriptLock();

    if (!lock.tryLock(10000)) {
        throw new Error('Installation impossible : une autre exécution est active.');
    }

    try {
        const testerGemini = opts.testerGemini !== undefined ? Boolean(opts.testerGemini) : true;
        const validation = verifierConfiguration_({ testerGemini });

        creerTousLesLibelles_();
        supprimerDeclencheursParFonctions_(HANDLERS_GERES_);
        effacerEtatReinitialisation_();

        ScriptApp.newTrigger('trierBoiteReception')
            .timeBased()
            .everyHours(1)
            .create();

        ScriptApp.newTrigger('envoyerDigest')
            .timeBased()
            .everyDays(1)
            .atHour(CONFIG.DIGEST.HEURE)
            .create();

        ScriptApp.newTrigger('retraiterErreurs')
            .timeBased()
            .onWeekDay(ScriptApp.WeekDay.SUNDAY)
            .atHour(3)
            .create();

        journaliser_('INFO', 'Installation terminée.', {
            compte: validation.compte,
            modele: validation.modele,
            aliasEtAdresses: validation.nombreIdentites,
            fuseauHoraire: Session.getScriptTimeZone(),
            noteDigest: 'Le déclencheur quotidien s’exécute dans la plage de l’heure configurée.',
            noteQuarantaine: 'Retraitement hebdomadaire des erreurs configuré chaque dimanche à 3h.'
        });

        return validation;
    } finally {
        lock.releaseLock();
    }
}


/**
 * Supprime les déclencheurs gérés par ce script.
 * Les libellés et les emails ne sont pas modifiés.
 * @returns {{ok: boolean, declencheursSupprimes: number}}
 * @throws {Error} Si le verrou est occupé.
 */
function teardown() {
    const lock = LockService.getScriptLock();

    if (!lock.tryLock(10000)) {
        throw new Error('Désinstallation impossible : une autre exécution est active.');
    }

    try {
        const nombre = supprimerDeclencheursParFonctions_(HANDLERS_GERES_);
        effacerEtatReinitialisation_();

        journaliser_('INFO', 'Déclencheurs supprimés.', {
            nombre
        });

        return { ok: true, declencheursSupprimes: nombre };
    } finally {
        lock.releaseLock();
    }
}


/**
 * Teste la configuration et l'accès à l'API Gemini sans modifier les déclencheurs.
 * @returns {{ok: boolean, compte: string, nombreIdentites: number, modele: string, testGemini: ?Object}}
 */
function testerConfiguration() {
    const resultat = verifierConfiguration_({ testerGemini: true });

    journaliser_('INFO', 'Configuration valide.', resultat);
    return resultat;
}


function verifierConfiguration_(options) {
    const opts = options || {};
    const compte = obtenirComptePrincipal_();
    const identites = obtenirIdentitesCompte_(compte);
    const apiKey = obtenirCleGemini_();
    const modele = obtenirModeleGemini_();

    if (!Number.isInteger(CONFIG.DIGEST.HEURE) ||
        CONFIG.DIGEST.HEURE < 0 ||
        CONFIG.DIGEST.HEURE > 23) {
        throw creerErreurTri_(
            'CONFIG.DIGEST.HEURE doit être un entier compris entre 0 et 23.',
            { globale: true, code: 'CONFIG_HEURE' }
        );
    }

    let testGemini = null;

    if (opts.testerGemini) {
        const donneesTest = {
            typeDonnee: 'EMAIL_PROFESSIONNEL_NON_FIABLE',
            thread: {
                nombreMessages: 1,
                important: false,
                contientMessageEtoile: false
            },
            routage: {
                compteDansTo: true,
                compteDansCc: false,
                uniquementEnCc: false
            },
            signauxAutomatiques: {
                expediteurTechnique: false,
                listUnsubscribe: false,
                listId: false,
                precedence: '',
                autoSubmitted: '',
                xAutoResponseSuppress: false,
                objetSembleAlerte: false,
                objetSembleNewsletter: false
            },
            messagesContexte: [{
                estDernier: true,
                dateIso: new Date().toISOString(),
                de: ['collegue@example.com'],
                a: ['utilisateur@example.com'],
                cc: [],
                sujet: 'Confirmation reçue',
                corps: 'Merci, la demande est bien prise en compte. Aucune action attendue.',
                piecesJointes: {
                    nombre: 0,
                    elements: []
                }
            }]
        };

        const analyse = appelerGemini_(
            donneesTest,
            apiKey,
            modele,
            Date.now() + 60 * 1000
        );

        testGemini = {
            action: analyse.action,
            effort: analyse.effort,
            urgence: analyse.urgence,
            categorieCalculee: mapperAnalyseVersCategorie_(analyse)
        };
    }

    return {
        ok: true,
        compte,
        nombreIdentites: identites.size,
        modele,
        testGemini
    };
}


function creerTousLesLibelles_() {
    Object.keys(CONFIG.LABELS).forEach(cle => {
        getOrCreateLabel_(CONFIG.LABELS[cle]);
    });
}


// ═══════════════════════════════════════════════════════════════════════════
// LIBELLÉS ET DÉCLENCHEURS
// ═══════════════════════════════════════════════════════════════════════════

function obtenirTousLesLibelles_() {
    const labels = {};

    Object.keys(CONFIG.LABELS).forEach(cle => {
        labels[cle] = getOrCreateLabel_(CONFIG.LABELS[cle]);
    });

    return labels;
}


function getOrCreateLabel_(nom) {
    return GmailApp.getUserLabelByName(nom) ||
        GmailApp.createLabel(nom);
}


function supprimerDeclencheursParFonctions_(fonctions) {
    const ensemble = new Set(fonctions || []);
    let nombre = 0;

    ScriptApp.getProjectTriggers().forEach(trigger => {
        if (ensemble.has(trigger.getHandlerFunction())) {
            ScriptApp.deleteTrigger(trigger);
            nombre++;
        }
    });

    return nombre;
}


function programmerRepriseUnique_(handler, delaiMs) {
    supprimerDeclencheursParFonctions_([handler]);

    ScriptApp.newTrigger(handler)
        .timeBased()
        .after(Math.max(1000, delaiMs))
        .create();
}


