'use strict';

// ═══════════════════════════════════════════════════════════════════════════
// IDENTITÉS, ADRESSES ET RÈGLES
// ═══════════════════════════════════════════════════════════════════════════

function obtenirComptePrincipal_() {
    const props = PropertiesService.getScriptProperties();
    const effective = normaliserEmail_(
        Session.getEffectiveUser().getEmail()
    );
    const secours = normaliserEmail_(
        props.getProperty(CONFIG.PROPRIETES.COMPTE_EMAIL)
    );

    const compte = effective || secours;

    if (!compte || !estEmailValide_(compte)) {
        throw creerErreurTri_(
            'Impossible de déterminer l’adresse du compte exécutant. ' +
            'Ajoutez COMPTE_EMAIL dans les propriétés du script.',
            {
                globale: true,
                retriable: false,
                code: 'COMPTE_INCONNU'
            }
        );
    }

    return compte;
}


function obtenirIdentitesCompte_(comptePrincipal) {
    const identites = new Set();
    // comptePrincipal intègre déjà l'adresse effective — pas d'appel Session supplémentaire.
    identites.add(normaliserEmail_(comptePrincipal));

    GmailApp.getAliases().forEach(alias => {
        const normalise = normaliserEmail_(alias);
        if (estEmailValide_(normalise)) {
            identites.add(normalise);
        }
    });

    const supplementaires =
        PropertiesService.getScriptProperties()
            .getProperty(CONFIG.PROPRIETES.ADRESSES_PERSONNELLES) || '';

    supplementaires
        .split(/[;,\n]/)
        .map(normaliserEmail_)
        .filter(estEmailValide_)
        .forEach(email => identites.add(email));

    return identites;
}


function extraireAdresses_(entete) {
    const texte = String(entete || '').toLowerCase();

    const correspondances = texte.match(
        /[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+/g
    ) || [];

    return Array.from(
        new Set(correspondances.map(normaliserEmail_))
    );
}


function contientUneIdentite_(adresses, identites) {
    return adresses.some(adresse => identites.has(adresse));
}


function correspondAUneRegle_(adresses, regles) {
    if (!Array.isArray(regles) || regles.length === 0) {
        return false;
    }

    return adresses.some(adresse =>
        regles.some(regle => adresseCorrespondARegle_(adresse, regle))
    );
}


function adresseCorrespondARegle_(adresse, regleBrute) {
    const email = normaliserEmail_(adresse);
    let regle = String(regleBrute || '')
        .trim()
        .toLowerCase();

    if (!email || !regle) {
        return false;
    }

    if (regle.startsWith('*@')) {
        regle = regle.slice(1);
    }

    if (regle.endsWith('@*')) {
        regle = regle.slice(0, -1);
    }

    if (regle.startsWith('@')) {
        return email.endsWith(regle);
    }

    if (regle.endsWith('@')) {
        return email.startsWith(regle);
    }

    if (regle.includes('@')) {
        return email === regle;
    }

    const domaine = email.split('@')[1] || '';
    const regleNorm = regle.replace(/^\./, '');
    // Le domaine de la règle correspond au domaine exact ou à un sous-domaine.
    return domaine === regleNorm || domaine.endsWith('.' + regleNorm);
}


function normaliserEmail_(valeur) {
    return String(valeur || '').trim().toLowerCase();
}


function estEmailValide_(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ''));
}


/**
 * Vérifie si une règle d'adresse saisie (email, domaine, préfixe) est syntaxiquement valide.
 * @param {string} regleBrute
 * @returns {boolean}
 */
function estRegleValide_(regleBrute) {
    const regle = String(regleBrute || '').trim().toLowerCase();
    if (!regle || regle.length < 3) return false;

    let r = regle;
    if (r.startsWith('*@')) r = r.slice(1);
    if (r.endsWith('@*')) r = r.slice(0, -1);

    // 1. Domaine avec @: '@domaine.fr'
    if (r.startsWith('@')) {
        const dom = r.slice(1);
        return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(dom);
    }

    // 2. Préfixe: 'direction@'
    if (r.endsWith('@')) {
        const prefix = r.slice(0, -1);
        return /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(prefix);
    }

    // 3. Email complet: 'user@domaine.fr'
    if (r.includes('@')) {
        return /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(r);
    }

    // 4. Domaine sans @: 'domaine.fr'
    return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(r);
}


/**
 * Analyse et valide une liste de règles d'alias au format 'adresse:CATEGORIE'.
 * @param {string[]} reglesBrutes
 * @returns {Array<{alias: string, categorie: string}>}
 */
function parseReglesAlias_(reglesBrutes) {
    if (!Array.isArray(reglesBrutes)) return [];

    const parsed = [];
    reglesBrutes.forEach(brute => {
        const str = String(brute || '').trim();
        if (!str) return;

        const sepIndex = str.indexOf(':') !== -1 ? str.indexOf(':') : str.indexOf('=');
        if (sepIndex === -1) return;

        const alias = str.slice(0, sepIndex).trim().toLowerCase();
        const catBrute = str.slice(sepIndex + 1).trim().toUpperCase();

        if (estRegleValide_(alias) && CATEGORIES_TRI_.includes(catBrute)) {
            parsed.push({ alias, categorie: catBrute });
        }
    });

    return parsed;
}


/**
 * Vérifie si l'une des adresses destinataires (To/Cc) correspond à une règle d'alias.
 * @param {string[]} adressesDestinataires
 * @param {string[]|Array<{alias: string, categorie: string}>} reglesAlias
 * @returns {{alias: string, categorie: string}|null}
 */
function trouverRegleAliasCorrespondante_(adressesDestinataires, reglesAlias) {
    if (!Array.isArray(adressesDestinataires) || adressesDestinataires.length === 0) {
        return null;
    }

    const regles = Array.isArray(reglesAlias) && reglesAlias.length > 0 && typeof reglesAlias[0] === 'object'
        ? reglesAlias
        : parseReglesAlias_(reglesAlias);

    if (regles.length === 0) return null;

    for (let i = 0; i < regles.length; i++) {
        const regle = regles[i];
        if (correspondAUneRegle_(adressesDestinataires, [regle.alias])) {
            return regle;
        }
    }

    return null;
}


/**
 * Vérifie si un texte (sujet d'email) contient l'un des mots-clés configurés,
 * avec respect des frontières de mots pour éviter les faux positifs (ex: "ok" vs "broker").
 * @param {string} texte
 * @param {string[]} listeMotsCles
 * @returns {{match: boolean, motCle: string}|null}
 */
function contientUnMotCle_(texte, listeMotsCles) {
    if (!texte || !Array.isArray(listeMotsCles) || listeMotsCles.length === 0) {
        return null;
    }

    const sujet = String(texte).trim();
    if (!sujet) return null;

    for (let i = 0; i < listeMotsCles.length; i++) {
        const motCle = String(listeMotsCles[i] || '').trim();
        if (motCle.length === 0) continue;

        // Échappement regex sécurisé
        const motCleEchappe = motCle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // Frontières de mot adaptées aux caractères accentués et à la ponctuation
        const regex = new RegExp('(?:^|[^a-zA-Z0-9À-ÿ])' + motCleEchappe + '(?=[^a-zA-Z0-9À-ÿ]|$)', 'i');
        
        if (regex.test(sujet)) {
            return { match: true, motCle };
        }
    }

    return null;
}


/**
 * Analyse les en-têtes RFC standards d'un message pour détecter s'il s'agit d'une newsletter ou d'un envoi automatisé.
 * Pour List-Unsubscribe, on vérifie que l'objet ne contient pas de signal d'alerte / action requise (sécurité, code, réinitialisation).
 * @param {GoogleAppsScript.Gmail.GmailMessage} message
 * @returns {{isAuto: boolean, entete: string}|null}
 */
function estUneNewsletterOuAuto_(message) {
    if (!message || typeof message.getHeader !== 'function') {
        return null;
    }

    try {
        // 1. En-tête de priorité en masse (signal fort)
        const precedence = String(message.getHeader('Precedence') || '').trim().toLowerCase();
        if (precedence === 'bulk' || precedence === 'list' || precedence === 'junk') {
            return { isAuto: true, entete: 'Precedence: ' + precedence };
        }

        // 2. En-tête de génération automatique (RFC 3834)
        const autoSubmitted = String(message.getHeader('Auto-Submitted') || '').trim().toLowerCase();
        if (autoSubmitted.includes('auto-generated') || autoSubmitted.includes('auto-replied')) {
            return { isAuto: true, entete: 'Auto-Submitted: ' + autoSubmitted };
        }

        // 3. En-tête de désinscription : n'est appliqué que si l'objet ne signale pas une alerte ou une action attendue
        const listUnsubscribe = message.getHeader('List-Unsubscribe');
        if (listUnsubscribe && String(listUnsubscribe).trim().length > 0) {
            const sujet = String((typeof message.getSubject === 'function' ? message.getSubject() : '') || '').toLowerCase();
            const estAlerteOuAction = /\b(urgent|urgence|alerte|alert|incident|échec|echec|failed|failure|bloqué|blocked|sécurité|security|expiration|expire|rejeté|rejected|action|review|code|verification|vérification|connexion|login|facture|invoice|paiement|payment|mot de passe|password)\b/i.test(sujet);

            if (!estAlerteOuAction) {
                return { isAuto: true, entete: 'List-Unsubscribe' };
            }
        }
    } catch (e) {
        // En cas d'erreur de lecture d'en-tête, continuer normalement
    }

    return null;
}


// ═══════════════════════════════════════════════════════════════════════════
// UTILITAIRES D'AFFICHAGE, JOURNAL ET ERREURS
// ═══════════════════════════════════════════════════════════════════════════

function obtenirModeleGemini_() {
    const surcharge = PropertiesService.getScriptProperties()
        .getProperty(CONFIG.PROPRIETES.MODELE);

    return String(surcharge || CONFIG.GEMINI.MODELE).trim();
}


function obtenirCleGemini_() {
    const cle = String(
        PropertiesService.getScriptProperties()
            .getProperty(CONFIG.PROPRIETES.API_KEY) || ''
    ).trim();

    if (!cle) {
        throw creerErreurTri_(
            `Propriété ${CONFIG.PROPRIETES.API_KEY} absente.`,
            {
                globale: true,
                retriable: false,
                code: 'CLE_API_ABSENTE'
            }
        );
    }

    return cle;
}


function creerErreurTri_(message, options) {
    const erreur = new Error(message);
    const opts = options || {};

    erreur.name = 'ErreurTri';
    erreur.globale = Boolean(opts.globale);
    erreur.retriable = Boolean(opts.retriable);
    erreur.code = opts.code || '';

    return erreur;
}


function normaliserEnum_(valeur) {
    return String(valeur || '').trim().toUpperCase();
}


function nettoyerMessageErreur_(erreur) {
    let texte = erreur && erreur.message
        ? String(erreur.message)
        : String(erreur || 'Erreur inconnue');

    try {
        const cle = PropertiesService.getScriptProperties()
            .getProperty(CONFIG.PROPRIETES.API_KEY);

        if (cle) {
            texte = texte.split(cle).join('[CLÉ MASQUÉE]');
        }
    } catch (e) {
        // Aucun traitement supplémentaire.
    }

    return tronquer_(
        texte
            .replace(/key=[^&\s]+/gi, 'key=[MASQUÉE]')
            .replace(/x-goog-api-key\s*[:=]\s*[^\s]+/gi, 'x-goog-api-key=[MASQUÉE]'),
        1000
    );
}


function sujetPourJournal_(thread, messages) {
    if (!CONFIG.TRI.JOURNALISER_SUJETS) {
        return undefined;
    }

    const dernier =
        Array.isArray(messages) && messages.length > 0
            ? messages[messages.length - 1]
            : null;

    return tronquer_(
        dernier
            ? dernier.getSubject()
            : thread.getFirstMessageSubject(),
        160
    );
}


function journaliser_(niveau, message, details) {
    const entree = {
        horodatage: new Date().toISOString(),
        niveau,
        message
    };

    if (details && typeof details === 'object') {
        Object.keys(details).forEach(cle => {
            if (typeof details[cle] !== 'undefined') {
                entree[cle] = details[cle];
            }
        });
    }

    console.log(JSON.stringify(entree));
}


function echapperRechercheGmail_(valeur) {
    return String(valeur || '')
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"');
}


function escapeHtml_(valeur) {
    return String(valeur == null ? '' : valeur)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        // GmailApp.sendEmail corrompt les caractères hors BMP (emoji sur 4 octets) dans le htmlBody :
        // on les convertit en entités hexadécimales, comme déjà fait pour les emoji d'en-tête du digest.
        .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, (paire) => `&#x${paire.codePointAt(0).toString(16).toUpperCase()};`);
}


function tronquer_(valeur, longueurMax) {
    const texte = String(valeur == null ? '' : valeur);

    if (!Number.isFinite(longueurMax) || longueurMax < 1) {
        return '';
    }

    if (texte.length <= longueurMax) {
        return texte;
    }

    if (longueurMax === 1) {
        return '…';
    }

    let coupe = longueurMax - 1;
    // évite de couper au milieu d'une paire de substitution (emoji sur 4 octets), ce qui
    // laisserait un demi-caractère invalide dans le résultat.
    if (/[\uDC00-\uDFFF]/.test(texte.charAt(coupe))) {
        coupe -= 1;
    }

    return texte.slice(0, coupe) + '…';
}


function obtenirNomExpediteur_(enteteFrom) {
    const brut = String(enteteFrom || '').trim();

    const sansAdresse = brut
        .replace(/<[^>]+>/g, '')
        .trim()
        .replace(/^"+|"+$/g, '')
        .trim();

    if (sansAdresse) {
        return sansAdresse;
    }

    const adresses = extraireAdresses_(brut);
    return adresses[0] || '(expéditeur inconnu)';
}


function formaterDateLongueFr_(date) {
    const fuseau = Session.getScriptTimeZone();

    const jours = [
        'lundi',
        'mardi',
        'mercredi',
        'jeudi',
        'vendredi',
        'samedi',
        'dimanche'
    ];

    const mois = [
        'janvier',
        'février',
        'mars',
        'avril',
        'mai',
        'juin',
        'juillet',
        'août',
        'septembre',
        'octobre',
        'novembre',
        'décembre'
    ];

    const numeroJourSemaine = Number(
        Utilities.formatDate(date, fuseau, 'u')
    );
    const jour = Number(
        Utilities.formatDate(date, fuseau, 'd')
    );
    const moisIndex = Number(
        Utilities.formatDate(date, fuseau, 'M')
    ) - 1;
    const annee = Utilities.formatDate(date, fuseau, 'yyyy');

    const nomJour = jours[numeroJourSemaine - 1] || '';
    const nomMois = mois[moisIndex] || '';

    return `${nomJour} ${jour} ${nomMois} ${annee}`;
}


function formaterDateHeureCourte_(date) {
    return Utilities.formatDate(
        date,
        Session.getScriptTimeZone(),
        'dd/MM HH:mm'
    );
}

function enregistrerDernierTriInfo_(info) {
    try {
        if (!info || typeof info !== 'object') return;
        PropertiesService.getScriptProperties().setProperty(
            CONFIG.PROPRIETES.DERNIER_TRI_INFO,
            JSON.stringify(info)
        );
        enregistrerHistoriqueTri_(info);
    } catch (e) {
        // Enregistrement non bloquant
    }
}

function enregistrerHistoriqueTri_(info) {
    try {
        if (!info || typeof info !== 'object' || !info.ok) return;

        const props = PropertiesService.getScriptProperties();
        const cle = CONFIG.PROPRIETES.HISTORIQUE_7J;
        let historique = [];
        try {
            const raw = props.getProperty(cle);
            if (raw) historique = JSON.parse(raw);
        } catch (e) {
            historique = [];
        }

        if (!Array.isArray(historique)) historique = [];

        const dateIso = info.dateIso || new Date().toISOString();
        const dateStr = dateIso.slice(0, 10);

        let entree = historique.find(h => h.dateStr === dateStr);
        if (!entree) {
            entree = {
                dateStr,
                traites: 0,
                rapide: 0,
                attention: 0,
                aucune: 0,
                urgent: 0
            };
            historique.push(entree);
        }

        entree.traites += Number(info.traites || 0);
        entree.rapide += Number(info.rapide || 0);
        entree.attention += Number(info.attention || 0);
        entree.aucune += Number(info.aucune || 0);
        entree.urgent += Number(info.urgent || 0);

        historique.sort((a, b) => a.dateStr.localeCompare(b.dateStr));
        if (historique.length > 7) {
            historique = historique.slice(historique.length - 7);
        }

        props.setProperty(cle, JSON.stringify(historique));
    } catch (e) {
        // Non bloquant
    }
}

function obtenirHistoriqueTri7j_() {
    try {
        const val = PropertiesService.getScriptProperties().getProperty(
            CONFIG.PROPRIETES.HISTORIQUE_7J
        );
        return val ? JSON.parse(val) : [];
    } catch (e) {
        return [];
    }
}

function obtenirDernierTriInfo_() {
    try {
        const val = PropertiesService.getScriptProperties().getProperty(
            CONFIG.PROPRIETES.DERNIER_TRI_INFO
        );
        return val ? JSON.parse(val) : null;
    } catch (e) {
        return null;
    }
}

