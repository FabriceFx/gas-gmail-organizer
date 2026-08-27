'use strict';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * TESTS UNITAIRES — Fonctions pures du projet Tri Gmail
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * Exécute l'ensemble des tests unitaires dans Google Apps Script.
 * @returns {{total: number, reussis: number, echecs: number, details: Array<string>}}
 */
function executerTestsUnitaires() {
    const resultats = {
        total: 0,
        reussis: 0,
        echecs: 0,
        details: []
    };

    function affirmer(condition, nomTest) {
        resultats.total++;
        if (condition) {
            resultats.reussis++;
            resultats.details.push(`✅ ${nomTest}`);
        } else {
            resultats.echecs++;
            resultats.details.push(`❌ ÉCHEC : ${nomTest}`);
        }
    }

    function affirmerEgal(obtenu, attendu, nomTest) {
        affirmer(obtenu === attendu, `${nomTest} (obtenu: ${JSON.stringify(obtenu)}, attendu: ${JSON.stringify(attendu)})`);
    }

    // ── 1. Tests de correspondance d'adresses (adresseCorrespondARegle_) ──
    affirmer(adresseCorrespondARegle_('jean@domaine.fr', 'jean@domaine.fr'), 'Matching adresse exacte');
    affirmer(adresseCorrespondARegle_('JEAN@DOMAINE.FR', 'jean@domaine.fr'), 'Matching adresse exacte insensible à la casse');
    affirmer(adresseCorrespondARegle_('contact@domaine.fr', '@domaine.fr'), 'Matching domaine avec @');
    affirmer(adresseCorrespondARegle_('contact@domaine.fr', '*@domaine.fr'), 'Matching domaine avec *@');
    affirmer(!adresseCorrespondARegle_('contact@autre.fr', '@domaine.fr'), 'Non-matching domaine différent');
    affirmer(adresseCorrespondARegle_('direction@entreprise.fr', 'direction@'), 'Matching préfixe direction@');
    affirmer(adresseCorrespondARegle_('direction@autre.com', 'direction@*'), 'Matching préfixe direction@*');
    affirmer(!adresseCorrespondARegle_('employe@entreprise.fr', 'direction@'), 'Non-matching préfixe différent');
    affirmer(adresseCorrespondARegle_('user@domaine.fr', 'domaine.fr'), 'Matching domaine sans @');
    affirmer(adresseCorrespondARegle_('user@sub.domaine.fr', 'domaine.fr'), 'Matching sous-domaine avec domaine parent');
    affirmer(!adresseCorrespondARegle_('user@fauxdomaine.fr', 'domaine.fr'), 'Non-matching faux domaine similaire');

    // ── 2. Tests de validation de règles d'adresses (estRegleValide_) ──
    affirmer(estRegleValide_('patron@entreprise.com'), 'Règle email valide');
    affirmer(estRegleValide_('@domaine.fr'), 'Règle @domaine valide');
    affirmer(estRegleValide_('*@domaine.fr'), 'Règle *@domaine valide');
    affirmer(estRegleValide_('direction@'), 'Règle préfixe direction@ valide');
    affirmer(estRegleValide_('domaine.fr'), 'Règle domaine.fr valide');
    affirmer(!estRegleValide_(''), 'Règle vide invalide');
    affirmer(!estRegleValide_('ab'), 'Règle trop courte invalide');
    affirmer(!estRegleValide_('jean exemple com'), 'Règle avec espaces invalide');

    // ── 3. Tests de nettoyage de corps (nettoyerCorpsMessage_) ──
    const messageAvecCitation = "Bonjour,\nMerci pour votre retour.\n\nLe mer. 12 mai 2024 à 10:00, Paul a écrit :\n> Citation précédente";
    const corpsNettoye = nettoyerCorpsMessage_(messageAvecCitation);
    affirmer(!corpsNettoye.includes('Citation précédente'), 'Suppression de la citation Gmail');
    affirmer(corpsNettoye.includes('Merci pour votre retour'), 'Conservation du texte principal');

    // ── 4. Tests de validation et mapping d'analyse Gemini ──
    const analyseValide = {
        action: 'REPONDRE',
        effort: 'RAPIDE',
        urgence: 'NORMALE',
        raisonCourt: 'Demande simple.'
    };
    const analyseParsed = validerAnalyseGemini_(JSON.stringify(analyseValide));
    affirmer(analyseParsed && analyseParsed.action === 'REPONDRE', 'Validation analyse conforme');
    affirmerEgal(mapperAnalyseVersCategorie_(analyseValide), 'RAPIDE', 'Mapping vers RAPIDE');

    const analyseUrgente = {
        action: 'DECIDER',
        effort: 'APPROFONDI',
        urgence: 'ELEVEE',
        raisonCourt: 'Urgence critique.'
    };
    affirmerEgal(mapperAnalyseVersCategorie_(analyseUrgente), 'ATTENTION', 'Mapping urgence/décision vers ATTENTION');

    const analyseAucune = {
        action: 'AUCUNE',
        effort: 'AUCUN',
        urgence: 'FAIBLE',
        raisonCourt: 'Information seule.'
    };
    affirmerEgal(mapperAnalyseVersCategorie_(analyseAucune), 'AUCUNE', 'Mapping information vers AUCUNE');

    // ── 5. Tests de troncature (tronquer_) ──
    affirmerEgal(tronquer_('Court', 10), 'Court', 'Tronquer texte court inchangé');
    affirmerEgal(tronquer_('Un texte beaucoup trop long pour la limite', 10), 'Un texte …', 'Tronquer texte long avec ellipse');

    // ── 6. Tests de parsing Retry-After (lireRetryAfterMs_) ──
    affirmerEgal(lireRetryAfterMs_({ 'retry-after': '120' }), 120000, 'Retry-After en secondes');

    // ── 7. Tests de nettoyage de listes (cleanArray_) ──
    const reglesTest = ['  jean@domaine.fr  ', 'INVALID STRING', '@valide.org', '', '  '];
    const reglesNettoyees = cleanArray_(reglesTest);
    affirmerEgal(reglesNettoyees.length, 2, 'cleanArray_ filtre les vides et les invalides');
    // ── 8. Test d'intégrité de la configuration (verifierConfiguration_) ──
    const configCheck = verifierConfiguration_({ testerGemini: false });
    affirmer(configCheck && configCheck.ok === true, 'verifierConfiguration_ sans Gemini retourne ok=true');
    affirmer(typeof configCheck.compte === 'string', 'verifierConfiguration_ extrait un compte email');

    // Log récapitulatif
    console.log(`[TESTS] ${resultats.reussis}/${resultats.total} tests réussis (${resultats.echecs} échecs).`);
    resultats.details.forEach(d => console.log(d));

    return resultats;
}
