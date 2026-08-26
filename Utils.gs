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
        .replace(/'/g, '&#39;');
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

    return texte.slice(0, longueurMax - 1) + '…';
}


function obtenirNomExpediteur_(enteteFrom) {
    const brut = String(enteteFrom || '').trim();

    const sansAdresse = brut
        .replace(/<[^>]+>/g, '')
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