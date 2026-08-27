'use strict';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * TRI GMAIL V3.1 — Triage hybride Gmail + Gemini
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Principes :
 *   1. Quelques règles déterministes sûres évitent les appels IA inutiles.
 *   2. Les cas ambigus sont analysés par Gemini avec une sortie JSON structurée.
 *   3. Un verrou empêche deux exécutions de traiter les mêmes conversations.
 *   4. Les libellés sont appliqués par lots et les anciennes catégories retirées.
 *   5. Les erreurs répétées sont placées en quarantaine au lieu de boucler.
 *   6. Le contenu des emails est considéré comme une donnée non fiable :
 *      Gemini ne doit jamais suivre les instructions présentes dans un email.
 *
 * Préparation :
 *   - Ajouter GEMINI_API_KEY dans les propriétés du script.
 *   - Facultatif : ajouter COMPTE_EMAIL si Session.getEffectiveUser() ne renvoie
 *     aucune adresse.
 *   - Facultatif : ajouter ADRESSES_PERSONNELLES, séparées par des virgules.
 *   - Exécuter setup() une fois manuellement.
 *
 * Attention :
 *   Le sujet, une partie du corps et les métadonnées des pièces jointes sont
 *   envoyés à l'API Gemini pour les emails qui ne correspondent pas à une règle
 *   locale. Utilisez NE_PAS_ENVOYER_A_IA pour les expéditeurs sensibles.
 */

const CLES_PROPRIETES_ = Object.freeze({
    API_KEY: 'GEMINI_API_KEY',
    MODELE: 'GEMINI_MODEL',
    COMPTE_EMAIL: 'COMPTE_EMAIL',
    ADRESSES_PERSONNELLES: 'ADRESSES_PERSONNELLES',

    RESET_ACTIF: 'TRI_GMAIL_RESET_ACTIF',
    RESET_INDEX: 'TRI_GMAIL_RESET_INDEX',
    RESET_TOTAL: 'TRI_GMAIL_RESET_TOTAL',

    DERNIERE_ALERTE: 'TRI_GMAIL_DERNIERE_ALERTE',
    PREFIXE_ECHEC_THREAD: 'TRI_GMAIL_ECHEC_THREAD_',

    // Clés pour la configuration WebApp
    API_KEY_FREE_TIER: 'TRI_GMAIL_API_FREE_TIER',
    VIP: 'TRI_GMAIL_VIP',
    NO_IA: 'TRI_GMAIL_NO_IA',
    AUCUNE: 'TRI_GMAIL_AUCUNE',
    FENETRE_JOURS: 'TRI_GMAIL_FENETRE_JOURS',
    CATEGORY_PRIMARY_ONLY: 'TRI_GMAIL_CATEGORY_PRIMARY',
    DERNIER_TRI_INFO: 'TRI_GMAIL_DERNIER_TRI_INFO'
});

let _PROPS_SNAPSHOT_ = null;

function _getPropsSnapshot_() {
    if (!_PROPS_SNAPSHOT_) {
        try {
            _PROPS_SNAPSHOT_ = PropertiesService.getScriptProperties().getProperties() || {};
        } catch (e) {
            _PROPS_SNAPSHOT_ = {};
        }
    }
    return _PROPS_SNAPSHOT_;
}

function _loadArrayProp(key, defaultArr) {
    try {
        const props = _getPropsSnapshot_();
        const val = props[key];
        return val ? JSON.parse(val) : defaultArr;
    } catch (e) {
        return defaultArr;
    }
}

function _loadBooleanProp(key, defaultVal) {
    try {
        const props = _getPropsSnapshot_();
        const val = props[key];
        return val !== undefined && val !== null ? (val === 'true') : defaultVal;
    } catch (e) {
        return defaultVal;
    }
}

function _loadNumberProp(key, defaultVal) {
    try {
        const props = _getPropsSnapshot_();
        const val = props[key];
        if (val !== undefined && val !== null && val !== '') {
            const num = Number(val);
            return Number.isFinite(num) && num >= 0 ? Math.floor(num) : defaultVal;
        }
        return defaultVal;
    } catch (e) {
        return defaultVal;
    }
}


const CONFIG = Object.freeze({
    LABELS: Object.freeze({
        RAPIDE: '\uD83D\uDFE0 Action rapide',
        ATTENTION: '\uD83D\uDD34 Attention requise',
        AUCUNE: '\uD83D\uDFE2 Aucune action',
        URGENT: '\u23F0 Urgent',
        ERREUR: '\u26A0\uFE0F Erreur de tri',
        MARQUEUR: '· analysé'
    }),

    /**
     * Règles d'adresse acceptées :
     *   - 'personne@domaine.fr' : adresse exacte
     *   - '@domaine.fr' ou '*@domaine.fr' : tout le domaine
     *   - 'direction@' ou 'direction@*' : tout email commençant ainsi
     *   - 'domaine.fr' : domaine exact
     */
    VIP: _loadArrayProp(CLES_PROPRIETES_.VIP, []),

    /**
     * Ces expéditeurs sont classés ATTENTION localement.
     * Leur sujet, corps et pièces jointes ne sont jamais envoyés à Gemini.
     */
    NE_PAS_ENVOYER_A_IA: _loadArrayProp(CLES_PROPRIETES_.NO_IA, []),

    /**
     * Liste blanche explicite d'expéditeurs toujours sans action.
     * N'ajoutez ici que des sources réellement sûres et connues.
     */
    EXPEDITEURS_AUCUNE_ACTION: _loadArrayProp(CLES_PROPRIETES_.AUCUNE, []),

    TRI: Object.freeze({
        LOT_MAX: 30,
        DUREE_MAX_MS: 4.5 * 60 * 1000,
        MARGE_FINALISATION_MS: 20 * 1000,
        VERROU_TIMEOUT_MS: 1000,

        // Périmètre de recherche dans la boîte de réception
        FENETRE_JOURS: _loadNumberProp(CLES_PROPRIETES_.FENETRE_JOURS, 30),
        CATEGORY_PRIMARY_ONLY: _loadBooleanProp(CLES_PROPRIETES_.CATEGORY_PRIMARY_ONLY, true),

        ARCHIVER_AUCUNE_ACTION: false,

        // Valeur prudente par défaut : un email reçu seulement en Cc passe par l'IA.
        CLASSER_CC_SEUL_EN_AUCUNE: false,

        // Après ce nombre d'échecs propres à un thread, il est mis en quarantaine.
        NB_ECHECS_AVANT_QUARANTAINE: 3,

        // Durée de vie des compteurs d'échec par thread dans PropertiesService.
        // Au-delà, ils sont purgés automatiquement pour éviter le dépassement
        // du quota de 500 propriétés par store.
        DUREE_VIE_COMPTEUR_ECHEC_JOURS: 30,

        // Désactivé par défaut pour ne pas écrire de données métier dans les logs.
        JOURNALISER_SUJETS: false,
        JOURNALISER_RAISONS_IA: false
    }),

    GEMINI: Object.freeze({
        IS_FREE_TIER: _loadBooleanProp(CLES_PROPRIETES_.API_KEY_FREE_TIER, true),
        DELAI_FREE_TIER_MS: 4000,
        MODELE: 'gemini-3.7-flash',
        NIVEAU_REFLEXION: 'low',
        MAX_OUTPUT_TOKENS: 2048,

        NB_TENTATIVES: 4,
        DELAI_RETRY_INITIAL_MS: 600,
        DELAI_RETRY_MAX_MS: 8000,

        NB_MESSAGES_CONTEXTE: 3,
        CORPS_DERNIER_MAX_CARACTERES: 3500,
        CORPS_PRECEDENT_MAX_CARACTERES: 1200,
        SUJET_MAX_CARACTERES: 300,

        PIECES_JOINTES_MAX_PAR_MESSAGE: 10,
        INCLURE_NOMS_PIECES_JOINTES: true
    }),

    DIGEST: Object.freeze({
        HEURE: 8,
        MAX_AFFICHES_PAR_SECTION: 10,
        LIMITE_COMPTAGE_PAR_SECTION: 100,
        INCLURE_AUCUNE_ACTION: true,
        ENVOYER_SI_VIDE: true
    }),

    ALERTES: Object.freeze({
        ACTIVES: true,
        DELAI_MINIMUM_HEURES: 12
    }),

    REINITIALISATION: Object.freeze({
        DUREE_MAX_MS: 4.5 * 60 * 1000,
        MARGE_FINALISATION_MS: 15 * 1000,
        LOT: 100,
        DELAI_REPRISE_MS: 60 * 1000,

        /**
         * false : les messages AUCUNE déjà archivés restent archivés et ne seront
         *         pas retraités automatiquement.
         * true  : ils sont remis dans la boîte de réception avant retraitement.
         */
        REPLACER_AUCUNE_ARCHIVEE_DANS_INBOX: false
    }),

    PROPRIETES: CLES_PROPRIETES_
});

const CATEGORIES_TRI_ = Object.freeze(['RAPIDE', 'ATTENTION', 'AUCUNE']);
const LIBELLES_EXCLUSIFS_ = Object.freeze([
    'RAPIDE',
    'ATTENTION',
    'AUCUNE',
    'ERREUR'
]);
const HANDLERS_GERES_ = Object.freeze([
    'trierBoiteReception',
    'executerTriManuelBackground',
    'envoyerDigest',
    'reinitialiserTri',
    'retraiterErreurs',
    'retraiterErreursBackground'
]);

const ENUM_ACTION_ = Object.freeze([
    'AUCUNE',
    'REPONDRE',
    'VERIFIER',
    'DECIDER'
]);
const ENUM_EFFORT_ = Object.freeze([
    'AUCUN',
    'RAPIDE',
    'APPROFONDI'
]);
const ENUM_URGENCE_ = Object.freeze([
    'FAIBLE',
    'NORMALE',
    'ELEVEE'
]);


