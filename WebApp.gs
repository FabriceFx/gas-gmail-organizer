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
    template.lang = (e.parameter.lang || 'fr').toLowerCase();
    
    return template.evaluate()
        .setTitle('Tri Gmail — Configuration')
        .addMetaTag('viewport', 'width=device-width, initial-scale=1')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Injecte le contenu d'un fichier HTML dans un autre (utilisé pour CSS/JS).
 */
function include(filename) {
    return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Récupère les paramètres actuels pour l'interface.
 */
function getSettings() {
    const props = PropertiesService.getScriptProperties();
    return {
        apiKey: props.getProperty(CONFIG.PROPRIETES.API_KEY) || '',
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
    
    if (settings.apiKey !== undefined && settings.apiKey.trim() !== '') {
        if (settings.apiKey === '__CLEAR__') {
             props.deleteProperty(CONFIG.PROPRIETES.API_KEY);
        } else {
             props.setProperty(CONFIG.PROPRIETES.API_KEY, settings.apiKey.trim());
        }
    }
    
    // Nettoyage et sauvegarde des tableaux
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
 * Lance un tri manuel depuis la WebApp
 */
function lancerTriManuel() {
    try {
        trierBoiteReception();
        return { success: true, message: "Tri terminé avec succès." };
    } catch (e) {
        journaliser_('Erreur lors du tri manuel depuis l\'UI : ' + e.message, true);
        return { success: false, message: e.message };
    }
}

/**
 * Fonction utilitaire pour nettoyer les tableaux avant sauvegarde.
 */
function cleanArray_(arr) {
    return arr
        .map(s => String(s).trim().toLowerCase())
        .filter(s => s.length > 0);
}
