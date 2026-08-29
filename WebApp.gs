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
    if (e && e.parameter && e.parameter.action) {
        return executerActionRapideWeb_(e.parameter.action, e.parameter.id || e.parameter.threadId);
    }

    const template = HtmlService.createTemplateFromFile('Index');
    
    // Langue par défaut avec liste blanche stricte
    const langBrute = String(e && e.parameter && e.parameter.lang || 'fr').toLowerCase();
    template.lang = ['fr', 'en'].includes(langBrute) ? langBrute : 'fr';
    
    return template.evaluate()
        .setTitle('Tri Gmail — Configuration')
        .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Exécute une action rapide 1-clic reçue depuis le Digest (Archiver / Fait)
 * et renvoie une page de confirmation épurée Material Design 3.
 */
function executerActionRapideWeb_(action, threadId) {
    let messageResultat = '';
    let success = false;
    let titreSujet = '';

    try {
        if (!threadId || !/^[a-zA-Z0-9_-]+$/.test(String(threadId).trim())) {
            throw new Error("Identifiant de thread invalide.");
        }

        const idPropre = String(threadId).trim();
        const thread = GmailApp.getThreadById(idPropre);
        if (!thread) {
            throw new Error("E-mail introuvable ou déjà supprimé.");
        }

        titreSujet = thread.getFirstMessageSubject() || '(sans objet)';

        // Retirer tous les libellés de tri colorés
        const libellesRetirer = [
            CONFIG.LABELS.RAPIDE,
            CONFIG.LABELS.ATTENTION,
            CONFIG.LABELS.AUCUNE,
            CONFIG.LABELS.URGENT,
            CONFIG.LABELS.ERREUR
        ];

        libellesRetirer.forEach(nom => {
            try {
                const l = GmailApp.getUserLabelByName(nom);
                if (l) thread.removeLabel(l);
            } catch (e) {}
        });

        if (action === 'archiver') {
            thread.moveToArchive();
            messageResultat = "L'e-mail a été archivé et ses libellés de tri ont été retirés.";
            success = true;
        } else if (action === 'traite') {
            messageResultat = "L'e-mail a été marqué comme traité (libellés de tri retirés). Il reste dans votre boîte de réception.";
            success = true;
        } else {
            throw new Error(`Action non reconnue : "${action}".`);
        }
    } catch (e) {
        success = false;
        messageResultat = e.message;
    }

    let webAppUrl = '#';
    try {
        webAppUrl = ScriptApp.getService().getUrl() || '#';
    } catch (e) {}

    const htmlOutput = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Tri Gmail — ${success ? 'Action confirmée' : 'Erreur'}</title>
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&display=swap" rel="stylesheet">
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" />
        <style>
            :root {
                --primary: #0b57d0;
                --surface: #f8fafd;
                --text: #1f1f1f;
                --text-secondary: #444746;
                --success: #137333;
                --error: #c5221f;
            }
            body {
                font-family: 'Outfit', sans-serif;
                background: linear-gradient(135deg, #f0f4f9 0%, #e1e9f4 100%);
                color: var(--text);
                margin: 0;
                padding: 24px;
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 90vh;
            }
            .card {
                background: rgba(255, 255, 255, 0.95);
                backdrop-filter: blur(12px);
                border-radius: 24px;
                padding: 36px 32px;
                max-width: 480px;
                width: 100%;
                text-align: center;
                box-shadow: 0 16px 40px rgba(11, 87, 208, 0.1);
                border: 1px solid rgba(255, 255, 255, 0.8);
            }
            .icon-circle {
                width: 72px;
                height: 72px;
                border-radius: 50%;
                margin: 0 auto 20px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 36px;
                background: ${success ? 'rgba(24, 128, 56, 0.12)' : 'rgba(217, 48, 37, 0.12)'};
                color: ${success ? 'var(--success)' : 'var(--error)'};
            }
            h1 { font-size: 1.4rem; font-weight: 700; margin-bottom: 8px; }
            .subject { font-size: 0.95rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 16px; background: rgba(0,0,0,0.03); padding: 8px 12px; border-radius: 8px; word-break: break-word; }
            p { font-size: 0.95rem; color: var(--text-secondary); line-height: 1.5; margin-bottom: 24px; }
            .btn {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                padding: 12px 24px;
                background: var(--primary);
                color: #ffffff;
                text-decoration: none;
                font-weight: 600;
                font-size: 0.9rem;
                border-radius: 100px;
                transition: transform 0.2s, box-shadow 0.2s;
            }
            .btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 8px 20px rgba(11, 87, 208, 0.25);
            }
        </style>
    </head>
    <body>
        <div class="card">
            <div class="icon-circle">
                <span class="material-symbols-outlined">${success ? 'check_circle' : 'error'}</span>
            </div>
            <h1>${success ? (action === 'archiver' ? 'E-mail archivé !' : 'Marqué comme traité !') : 'Une erreur est survenue'}</h1>
            ${titreSujet ? `<div class="subject">${escapeHtml_(titreSujet)}</div>` : ''}
            <p>${escapeHtml_(messageResultat)}</p>
            <a href="${escapeHtml_(webAppUrl)}" class="btn">
                <span class="material-symbols-outlined">dashboard</span>
                Ouvrir le Dashboard
            </a>
        </div>
    </body>
    </html>
    `;

    return HtmlService.createHtmlOutput(htmlOutput)
        .setTitle(success ? 'Action confirmée' : 'Erreur')
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
        reglesAlias: _loadArrayProp(CONFIG.PROPRIETES.REGLES_ALIAS, []),
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

    if (Array.isArray(settings.reglesAlias)) {
        const parsed = parseReglesAlias_(settings.reglesAlias);
        const formatees = parsed.map(r => `${r.alias}:${r.categorie}`);
        props.setProperty(CONFIG.PROPRIETES.REGLES_ALIAS, JSON.stringify(formatees));
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

        // Calculs analytiques sur 7 jours
        const historique7j = obtenirHistoriqueTri7j_();
        let total7j = 0;
        let rapide7j = 0;
        let attention7j = 0;
        let aucune7j = 0;
        let urgent7j = 0;

        historique7j.forEach(j => {
            total7j += Number(j.traites || 0);
            rapide7j += Number(j.rapide || 0);
            attention7j += Number(j.attention || 0);
            aucune7j += Number(j.aucune || 0);
            urgent7j += Number(j.urgent || 0);
        });

        const tempsGagneMin = total7j * 2;
        const heures = Math.floor(tempsGagneMin / 60);
        const minutes = tempsGagneMin % 60;
        const tempsGagneFormatte = heures > 0
            ? `${heures}h ${minutes > 0 ? (minutes < 10 ? '0' : '') + minutes + 'min' : ''}`.trim()
            : `${minutes}min`;

        const totalAuto = rapide7j + aucune7j;
        const tauxAuto = total7j > 0 ? Math.round((totalAuto / total7j) * 100) : null;

        const analytics = {
            historique: historique7j,
            total7j,
            tempsGagneFormatte,
            tauxAuto,
            rapide7j,
            attention7j,
            aucune7j,
            urgent7j
        };

        return {
            success: true,
            dernierTri,
            quarantaineCount,
            autoSortActive,
            resetEnCours,
            suggestions,
            analytics,
            hasApiKey: Boolean(cleApi && cleApi.trim().length > 0)
        };
    } catch (e) {
        journaliser_('ERREUR', 'Erreur récupération statut dashboard : ' + e.message, { error: e.message });
        return { success: false, message: e.message };
    }
}

/**
 * Extrait les expéditeurs récurrents récents non encore configurés dans les règles.
 * Utilise CacheService pour éviter des requêtes Gmail répétées lors de chaque affichage du Dashboard.
 */
function getSenderSuggestions_() {
    try {
        let cache = null;
        try {
            cache = CacheService.getUserCache();
            if (cache) {
                const cacheData = cache.get('SUGGESTIONS_EXPEDITEURS_CACHE');
                if (cacheData) {
                    return JSON.parse(cacheData);
                }
            }
        } catch (e) {
            // Cache non bloquant
        }

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
        const top = liste.slice(0, 4);

        if (cache) {
            try {
                cache.put('SUGGESTIONS_EXPEDITEURS_CACHE', JSON.stringify(top), 300); // 5 min TTL
            } catch (e) {}
        }

        return top;
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

    // Invalider le cache des suggestions
    try {
        const cache = CacheService.getUserCache();
        if (cache) cache.remove('SUGGESTIONS_EXPEDITEURS_CACHE');
    } catch (e) {}

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
