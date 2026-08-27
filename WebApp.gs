'use strict';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * WEBAPP ET BACKEND UI
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * Point d'entrée de la WebApp.
 */
function doGet(e) {
    const template = HtmlService.createTemplateFromFile('Index');
    
    // Langue par défaut avec liste blanche stricte
    const langBrute = String(e && e.parameter && e.parameter.lang || 'fr').toLowerCase();
    template.lang = ['fr', 'en'].includes(langBrute) ? langBrute : 'fr';
    
    return template.evaluate()
        .setTitle('Tri Gmail — Configuration')
        .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Injecte le contenu d'un fichier HTML dans un autre (utilisé pour CSS/JS).
 */
function include(filename) {
    return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Récupère les paramètres actuels pour l'interface.
 * La clé API n'est jamais renvoyée en clair au navigateur (hasApiKey booléen).
 */
function getSettings() {
    const props = PropertiesService.getScriptProperties();
    const cleApi = props.getProperty(CONFIG.PROPRIETES.API_KEY);
    return {
        hasApiKey: Boolean(cleApi && cleApi.trim().length > 0),
        isFreeTier: _loadBooleanProp(CONFIG.PROPRIETES.API_KEY_FREE_TIER, true),
        fenetreJours: _loadNumberProp(CONFIG.PROPRIETES.FENETRE_JOURS, 30),
        categoryPrimaryOnly: _loadBooleanProp(CONFIG.PROPRIETES.CATEGORY_PRIMARY_ONLY, true),
        detecterNewsletters: _loadBooleanProp(CONFIG.PROPRIETES.DETECTER_NEWSLETTERS, true),
        motsClesAucune: _loadArrayProp(CONFIG.PROPRIETES.MOTS_CLES_AUCUNE, []),
        motsClesRapide: _loadArrayProp(CONFIG.PROPRIETES.MOTS_CLES_RAPIDE, []),
        vip: _loadArrayProp(CONFIG.PROPRIETES.VIP, []),
        noIa: _loadArrayProp(CONFIG.PROPRIETES.NO_IA, []),
        aucune: _loadArrayProp(CONFIG.PROPRIETES.AUCUNE, [])
    };
}

/**
 * Sauvegarde les paramètres depuis l'interface.
 */
function saveSettings(settings) {
    // Revalidation stricte côté serveur
    if (typeof settings !== 'object' || settings === null) {
        throw new Error("Format de paramètres invalide.");
    }
    
    const props = PropertiesService.getScriptProperties();
    
    if (typeof settings.apiKey === 'string') {
        const cleNettoyee = settings.apiKey.trim();
        if (cleNettoyee === '__CLEAR__') {
            props.deleteProperty(CONFIG.PROPRIETES.API_KEY);
        } else if (cleNettoyee.length > 0) {
            props.setProperty(CONFIG.PROPRIETES.API_KEY, cleNettoyee);
        }
    }
    
    if (settings.isFreeTier !== undefined) {
        props.setProperty(CONFIG.PROPRIETES.API_KEY_FREE_TIER, String(Boolean(settings.isFreeTier)));
    }
    
    if (settings.categoryPrimaryOnly !== undefined) {
        props.setProperty(CONFIG.PROPRIETES.CATEGORY_PRIMARY_ONLY, String(Boolean(settings.categoryPrimaryOnly)));
    }

    if (settings.detecterNewsletters !== undefined) {
        props.setProperty(CONFIG.PROPRIETES.DETECTER_NEWSLETTERS, String(Boolean(settings.detecterNewsletters)));
    }
    
    if (settings.fenetreJours !== undefined) {
        const jours = Number(settings.fenetreJours);
        const entierJours = Number.isFinite(jours) && jours >= 0 ? Math.floor(jours) : 30;
        props.setProperty(CONFIG.PROPRIETES.FENETRE_JOURS, String(entierJours));
    }

    if (Array.isArray(settings.motsClesAucune)) {
        const mots = settings.motsClesAucune.map(m => String(m || '').trim()).filter(m => m.length >= 2);
        props.setProperty(CONFIG.PROPRIETES.MOTS_CLES_AUCUNE, JSON.stringify(mots));
    }

    if (Array.isArray(settings.motsClesRapide)) {
        const mots = settings.motsClesRapide.map(m => String(m || '').trim()).filter(m => m.length >= 2);
        props.setProperty(CONFIG.PROPRIETES.MOTS_CLES_RAPIDE, JSON.stringify(mots));
    }
    
    const reglesRejetees = [];

    if (Array.isArray(settings.vip)) {
        props.setProperty(CONFIG.PROPRIETES.VIP, JSON.stringify(cleanArray_(settings.vip, reglesRejetees)));
    }
    if (Array.isArray(settings.noIa)) {
        props.setProperty(CONFIG.PROPRIETES.NO_IA, JSON.stringify(cleanArray_(settings.noIa, reglesRejetees)));
    }
    if (Array.isArray(settings.aucune)) {
        props.setProperty(CONFIG.PROPRIETES.AUCUNE, JSON.stringify(cleanArray_(settings.aucune, reglesRejetees)));
    }

    _invaliderPropsSnapshot_();
    
    return {
        success: true,
        reglesRejetees
    };
}

/**
 * Récupère le statut complet et les métriques pour le Dashboard.
 */
function getDashboardStatus() {
    try {
        const dernierTri = obtenirDernierTriInfo_();
        const autoSortActive = getAutoSortStatus();
        const resetEnCours = reinitialisationEnCours_();
        const props = PropertiesService.getScriptProperties();
        const cleApi = props.getProperty(CONFIG.PROPRIETES.API_KEY);
        
        let quarantaineCount = '0';
        try {
            const limiteQuarantaine = 50;
            const threadsErreur = GmailApp.search(
                `in:inbox label:"${echapperRechercheGmail_(CONFIG.LABELS.ERREUR)}"`,
                0,
                limiteQuarantaine + 1
            );
            quarantaineCount = threadsErreur.length > limiteQuarantaine
                ? `${limiteQuarantaine}+`
                : String(threadsErreur.length);
        } catch (e) {
            // Lecture non bloquante
        }

        const suggestions = getSenderSuggestions_();

        return {
            success: true,
            dernierTri,
            quarantaineCount,
            autoSortActive,
            resetEnCours,
            suggestions,
            hasApiKey: Boolean(cleApi && cleApi.trim().length > 0)
        };
    } catch (e) {
        journaliser_('ERREUR', 'Erreur récupération statut dashboard : ' + e.message, { error: e.message });
        return { success: false, message: e.message };
    }
}

/**
 * Extrait les expéditeurs récurrents récents non encore configurés dans les règles.
 */
function getSenderSuggestions_() {
    try {
        const vips = _loadArrayProp(CONFIG.PROPRIETES.VIP, []);
        const noIas = _loadArrayProp(CONFIG.PROPRIETES.NO_IA, []);
        const aucunes = _loadArrayProp(CONFIG.PROPRIETES.AUCUNE, []);
        const reglesExistantes = [].concat(vips, noIas, aucunes);

        const compte = obtenirComptePrincipal_();
        const identites = obtenirIdentitesCompte_(compte);

        const threads = GmailApp.search('in:inbox', 0, 30);
        if (!threads || threads.length === 0) return [];

        const messagesParThread = GmailApp.getMessagesForThreads(threads);
        const compteurs = {};

        messagesParThread.forEach(messages => {
            if (!messages || messages.length === 0) return;
            const dernier = messages[messages.length - 1];
            const brute = dernier.getFrom() || '';
            const adresses = extraireAdresses_(brute);
            if (adresses.length === 0) return;

            const email = adresses[0].toLowerCase();
            if (contientUneIdentite_([email], identites)) return;
            if (correspondAUneRegle_([email], reglesExistantes)) return;

            const nom = obtenirNomExpediteur_(brute) || email;
            const domaine = email.split('@')[1] || '';

            if (!compteurs[email]) {
                compteurs[email] = {
                    email,
                    nom,
                    domaine,
                    count: 0
                };
            }
            compteurs[email].count++;
        });

        const liste = Object.values(compteurs);
        liste.sort((a, b) => b.count - a.count);
        return liste.slice(0, 4);
    } catch (e) {
        return [];
    }
}

/**
 * Ajout rapide d'un expéditeur ou domaine à une règle depuis le Dashboard.
 */
function quickAddRule(type, pattern) {
    if (!type || !pattern) {
        throw new Error("Paramètres de règle invalides.");
    }

    const regleNettoyee = String(pattern).trim().toLowerCase();
    if (!estRegleValide_(regleNettoyee)) {
        throw new Error(`Règle invalide : "${pattern}"`);
    }

    const props = PropertiesService.getScriptProperties();
    let cleProp = null;

    if (type === 'vip') {
        cleProp = CONFIG.PROPRIETES.VIP;
    } else if (type === 'noIa') {
        cleProp = CONFIG.PROPRIETES.NO_IA;
    } else if (type === 'aucune') {
        cleProp = CONFIG.PROPRIETES.AUCUNE;
    } else {
        throw new Error(`Type de règle non reconnu : ${type}`);
    }

    const existantes = _loadArrayProp(cleProp, []);
    if (!existantes.includes(regleNettoyee)) {
        existantes.push(regleNettoyee);
        props.setProperty(cleProp, JSON.stringify(existantes));
        _invaliderPropsSnapshot_();
    }

    return {
        success: true,
        type,
        pattern: regleNettoyee,
        suggestions: getSenderSuggestions_()
    };
}

/**
 * Teste la connexion Gemini depuis l'interface avec mesure de latence.
 */
function testerConnexionGemini() {
    const debut = Date.now();
    try {
        const validation = verifierConfiguration_({ testerGemini: true });
        const latenceMs = Date.now() - debut;
        return {
            success: true,
            latenceMs,
            compte: validation.compte,
            modele: validation.modele,
            testGemini: validation.testGemini
        };
    } catch (e) {
        return {
            success: false,
            message: nettoyerMessageErreur_(e),
            latenceMs: Date.now() - debut
        };
    }
}

/**
 * Lance un tri manuel depuis la WebApp (déclencheur unique en arrière-plan).
 */
function lancerTriManuel() {
    try {
        programmerRepriseUnique_('executerTriManuelBackground', 100);
        return { success: true, messageKey: "msg_sort_bg" };
    } catch (e) {
        journaliser_('ERREUR', 'Erreur lors du tri manuel depuis l\'UI : ' + e.message, { error: e.message });
        return { success: false, message: e.message };
    }
}

/**
 * Lance le retraitement des erreurs/quarantaine depuis la WebApp.
 */
function lancerRetraitementErreurs() {
    try {
        programmerRepriseUnique_('retraiterErreursBackground', 100);
        return { success: true, messageKey: "msg_retry_errors_bg" };
    } catch (e) {
        journaliser_('ERREUR', 'Erreur lors du retraitement des erreurs depuis l\'UI : ' + e.message, { error: e.message });
        return { success: false, message: e.message };
    }
}

/**
 * Annule une réinitialisation en cours depuis la WebApp.
 */
function annulerReinitialisationTri() {
    try {
        annulerReinitialisation();
        return { success: true, messageKey: "msg_reset_cancelled" };
    } catch (e) {
        journaliser_('ERREUR', 'Erreur lors de l\'annulation de la réinitialisation : ' + e.message, { error: e.message });
        return { success: false, message: e.message };
    }
}

/**
 * Vérifie si le déclencheur de tri automatique est actif.
 */
function getAutoSortStatus() {
    const triggers = ScriptApp.getProjectTriggers();
    for (let i = 0; i < triggers.length; i++) {
        if (triggers[i].getHandlerFunction() === 'trierBoiteReception') {
            return true;
        }
    }
    return false;
}

/**
 * Active ou désactive le tri automatique (déclencheurs).
 */
function toggleAutoSort(enable) {
    try {
        if (enable) {
            setup({ testerGemini: false });
            return { success: true, message: "Tri automatique activé avec succès." };
        } else {
            teardown();
            return { success: true, message: "Tri automatique désactivé." };
        }
    } catch (e) {
        journaliser_('ERREUR', 'Erreur lors du toggle auto sort : ' + e.message, { error: e.message });
        return { success: false, message: e.message };
    }
}

/**
 * Fonction utilitaire pour nettoyer et valider les règles d'adresses avant sauvegarde.
 * @param {Array} arr Tableau de règles brutes
 * @param {Array=} reglesRejetees Tableau optionnel recevant les règles rejetées
 * @returns {Array<string>} Tableau de règles valides en minuscules
 */
function cleanArray_(arr, reglesRejetees) {
    if (!Array.isArray(arr)) return [];
    const valides = [];
    arr.forEach(entree => {
        const brute = String(entree || '').trim();
        if (!brute) return;
        if (estRegleValide_(brute)) {
            valides.push(brute.toLowerCase());
        } else if (Array.isArray(reglesRejetees)) {
            reglesRejetees.push(brute);
        }
    });
    return valides;
}
