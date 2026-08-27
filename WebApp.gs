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
    
    // Langue par défaut
    template.lang = (e && e.parameter && e.parameter.lang || 'fr').toLowerCase();
    
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
    
    // Nettoyage et sauvegarde des tableaux avec validation syntaxique des règles
    if (Array.isArray(settings.vip)) {
        props.setProperty(CONFIG.PROPRIETES.VIP, JSON.stringify(cleanArray_(settings.vip)));
    }
    if (Array.isArray(settings.noIa)) {
        props.setProperty(CONFIG.PROPRIETES.NO_IA, JSON.stringify(cleanArray_(settings.noIa)));
    }
    if (Array.isArray(settings.aucune)) {
        props.setProperty(CONFIG.PROPRIETES.AUCUNE, JSON.stringify(cleanArray_(settings.aucune)));
    }
    
    return true;
}

/**
 * Lance un tri manuel depuis la WebApp (déclencheur one-off en arrière-plan).
 */
function lancerTriManuel() {
    try {
        ScriptApp.newTrigger('executerTriManuelBackground')
            .timeBased()
            .after(100)
            .create();
        return { success: true, messageKey: "msg_sort_bg" };
    } catch (e) {
        journaliser_('ERREUR', 'Erreur lors du tri manuel depuis l\'UI : ' + e.message, { error: e.message });
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
 */
function cleanArray_(arr) {
    if (!Array.isArray(arr)) return [];
    return arr
        .map(s => String(s || '').trim().toLowerCase())
        .filter(s => s.length > 0 && estRegleValide_(s));
}
