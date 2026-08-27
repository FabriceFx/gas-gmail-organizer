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
        raison: 'Demande simple.'
    };
    const analyseParsed = validerAnalyseGemini_(JSON.stringify(analyseValide));
    affirmer(analyseParsed && analyseParsed.action === 'REPONDRE', 'Validation analyse conforme');
    affirmerEgal(analyseParsed && analyseParsed.raison, 'Demande simple.', 'Conservation du champ raison');
    affirmerEgal(mapperAnalyseVersCategorie_(analyseValide), 'RAPIDE', 'Mapping vers RAPIDE');

    const analyseUrgente = {
        action: 'DECIDER',
        effort: 'APPROFONDI',
        urgence: 'ELEVEE',
        raison: 'Urgence critique.'
    };
    affirmerEgal(mapperAnalyseVersCategorie_(analyseUrgente), 'ATTENTION', 'Mapping urgence/décision vers ATTENTION');

    const analyseAucune = {
        action: 'AUCUNE',
        effort: 'AUCUN',
        urgence: 'FAIBLE',
        raison: 'Information seule.'
    };
    affirmerEgal(mapperAnalyseVersCategorie_(analyseAucune), 'AUCUNE', 'Mapping information vers AUCUNE');

    // ── 5. Tests de troncature (tronquer_) ──
    affirmerEgal(tronquer_('Court', 10), 'Court', 'Tronquer texte court inchangé');
    affirmerEgal(tronquer_('Un texte beaucoup trop long pour la limite', 10), 'Un texte …', 'Tronquer texte long avec ellipse');

    // ── 6. Tests de parsing Retry-After (lireRetryAfterMs_) ──
    affirmerEgal(lireRetryAfterMs_({ 'retry-after': '120' }), 120000, 'Retry-After en secondes');

    // ── 7. Tests de nettoyage de listes (cleanArray_) ──
    const reglesTest = ['  jean@domaine.fr  ', 'INVALID STRING', '@valide.org', '', '  '];
    const rejetees = [];
    const reglesNettoyees = cleanArray_(reglesTest, rejetees);
    affirmerEgal(reglesNettoyees.length, 2, 'cleanArray_ filtre les vides et les invalides');
    affirmer(reglesNettoyees.includes('jean@domaine.fr') && reglesNettoyees.includes('@valide.org'), 'cleanArray_ conserve les valides');
    affirmerEgal(rejetees.length, 1, 'cleanArray_ collecte les règles rejetées');
    affirmerEgal(rejetees[0], 'INVALID STRING', 'cleanArray_ identifie la règle rejetée exacte');

    // ── 8. Test d'intégrité de la configuration (verifierConfiguration_) ──
    try {
        const configCheck = verifierConfiguration_({ testerGemini: false });
        affirmer(configCheck && configCheck.ok === true, 'verifierConfiguration_ sans Gemini retourne ok=true');
        affirmer(typeof configCheck.compte === 'string', 'verifierConfiguration_ extrait un compte email');
    } catch (e) {
        if (e && (e.code === 'CLE_API_ABSENTE' || (e.message && e.message.includes('GEMINI_API_KEY')))) {
            console.log('[TESTS] Test verifierConfiguration_ ignoré : clé API non configurée dans cet environnement.');
        } else {
            affirmer(false, 'verifierConfiguration_ sans Gemini a levé une exception : ' + e.message);
        }
    }

    // ── 9. Test des handlers de déclencheurs gérés (HANDLERS_GERES_) ──
    affirmer(HANDLERS_GERES_.includes('trierBoiteReception'), 'HANDLERS_GERES_ contient trierBoiteReception');
    affirmer(HANDLERS_GERES_.includes('executerTriManuelBackground'), 'HANDLERS_GERES_ contient executerTriManuelBackground');
    affirmer(HANDLERS_GERES_.includes('retraiterErreurs'), 'HANDLERS_GERES_ contient retraiterErreurs');
    affirmer(HANDLERS_GERES_.includes('retraiterErreursBackground'), 'HANDLERS_GERES_ contient retraiterErreursBackground');
    affirmer(typeof retraiterErreursBackground === 'function', 'retraiterErreursBackground est bien définie');
    affirmer(typeof executerTriManuelBackground === 'function', 'executerTriManuelBackground est bien définie');

    // ── 10. Tests des nouveautés Lot 1 (Recherche, Urgent, Statut) ──
    affirmer(Boolean(CONFIG.LABELS.URGENT), 'Le libellé URGENT est défini dans CONFIG.LABELS');
    const req = construireRequeteRecherche_();
    affirmer(req.includes('in:inbox'), 'construireRequeteRecherche_ inclut in:inbox');
    affirmer(req.includes(CONFIG.LABELS.MARQUEUR), 'construireRequeteRecherche_ exclut le marqueur');

    // Test assainissement entier de fenetreJours
    saveSettings({ fenetreJours: 7.8 });
    const propsApres = PropertiesService.getScriptProperties().getProperty(CONFIG.PROPRIETES.FENETRE_JOURS);
    affirmerEgal(propsApres, '7', 'saveSettings convertit fenetreJours flottant en entier');

    // Test exclusion d'urgence dans le Digest pour éviter double comptage
    const digestSections = construireSectionsDigest_();
    const sectionAttention = digestSections.find(s => s.titreTexte === 'Attention requise');
    const sectionRapide = digestSections.find(s => s.titreTexte === 'Actions rapides');
    affirmer(sectionAttention && sectionAttention.requete.includes(`-label:"${CONFIG.LABELS.URGENT}"`), 'Digest Attention requise exclut le libellé Urgent');
    affirmer(sectionRapide && sectionRapide.requete.includes(`-label:"${CONFIG.LABELS.URGENT}"`), 'Digest Actions rapides exclut le libellé Urgent');

    const testInfo = {
        dateIso: '2026-08-27T10:00:00.000Z',
        ok: true,
        trouves: 12,
        traites: 12,
        urgent: 2
    };
    enregistrerDernierTriInfo_(testInfo);
    const luInfo = obtenirDernierTriInfo_();
    affirmer(luInfo && luInfo.urgent === 2, 'enregistrerDernierTriInfo_ / obtenirDernierTriInfo_ enregistre et restitue les données');

    const dashStatus = getDashboardStatus();
    affirmer(dashStatus && dashStatus.success === true, 'getDashboardStatus retourne un statut avec succès');

    // ── 11. Tests des nouveautés Lot 2 (Mots-clés, En-têtes, Ajout rapide) ──
    // A. Mots-clés dans le sujet
    const motsTest = ['Facture', 'Reçu', 'Confirmation'];
    const match1 = contientUnMotCle_('Votre facture n°12345 est disponible', motsTest);
    affirmer(match1 && match1.match === true && match1.motCle === 'Facture', 'contientUnMotCle_ détecte le mot-clé Facture');
    const match2 = contientUnMotCle_('CONFIRMATION DE COMMANDE #998', motsTest);
    affirmer(match2 && match2.match === true && match2.motCle === 'Confirmation', 'contientUnMotCle_ insensible à la casse');
    const matchNul = contientUnMotCle_('Bonjour, réunion urgente demain', motsTest);
    affirmer(matchNul === null, 'contientUnMotCle_ retourne null en l\'absence de mot-clé');
    const matchBroker = contientUnMotCle_('Négociation avec le broker', ['ok']);
    affirmer(matchBroker === null, 'contientUnMotCle_ respecte les frontières de mots (rejette ok dans broker)');
    const matchOk = contientUnMotCle_('Statut du rapport : OK', ['ok']);
    affirmer(matchOk && matchOk.match === true, 'contientUnMotCle_ valide un mot isolé');

    // B. Détection des en-têtes RFC Newsletter
    const mockMsgNewsletter = {
        getSubject: () => 'Nos promotions de printemps',
        getHeader: (h) => h === 'List-Unsubscribe' ? '<mailto:unsubscribe@domain.com>' : null
    };
    const resNews = estUneNewsletterOuAuto_(mockMsgNewsletter);
    affirmer(resNews && resNews.isAuto === true, 'estUneNewsletterOuAuto_ détecte List-Unsubscribe standard');

    const mockMsgSecurite = {
        getSubject: () => '[Alerte de sécurité] Nouvelle connexion détectée',
        getHeader: (h) => h === 'List-Unsubscribe' ? '<mailto:unsub@domain.com>' : null
    };
    const resSecurite = estUneNewsletterOuAuto_(mockMsgSecurite);
    affirmer(resSecurite === null, 'estUneNewsletterOuAuto_ ne court-circuite pas une alerte de sécurité portant List-Unsubscribe');

    const mockMsgBulk = {
        getSubject: () => 'Notification',
        getHeader: (h) => h === 'Precedence' ? 'bulk' : null
    };
    const resBulk = estUneNewsletterOuAuto_(mockMsgBulk);
    affirmer(resBulk && resBulk.isAuto === true, 'estUneNewsletterOuAuto_ détecte Precedence: bulk');

    const mockMsgAuto = {
        getSubject: () => 'Réponse automatique',
        getHeader: (h) => h === 'Auto-Submitted' ? 'auto-generated' : null
    };
    const resAuto = estUneNewsletterOuAuto_(mockMsgAuto);
    affirmer(resAuto && resAuto.isAuto === true, 'estUneNewsletterOuAuto_ détecte Auto-Submitted: auto-generated');

    const mockMsgNormal = {
        getSubject: () => 'Message ordinaire',
        getHeader: () => null
    };
    affirmer(estUneNewsletterOuAuto_(mockMsgNormal) === null, 'estUneNewsletterOuAuto_ ignore un email normal');

    // Vérification du gel de CONFIG
    affirmer(Object.isFrozen(CONFIG), 'CONFIG est bien gelé avec Object.freeze');
    affirmer(Object.isFrozen(CONFIG.TRI), 'CONFIG.TRI est bien gelé avec Object.freeze');

    // C. Ajout rapide de règle (quickAddRule)
    const quickResVip = quickAddRule('vip', 'president@directoire.com');
    affirmer(quickResVip && quickResVip.success === true, 'quickAddRule ajoute une règle VIP');
    const quickResAucune = quickAddRule('aucune', '@alertes-automatiques.fr');
    affirmer(quickResAucune && quickResAucune.success === true, 'quickAddRule ajoute une règle Aucune Action');
    
    let quickErreur = false;
    try {
        quickAddRule('vip', 'not an email');
    } catch (e) {
        quickErreur = true;
    }
    affirmer(quickErreur, 'quickAddRule rejette un pattern invalide');

    // D. Sauvegarde et chargement des paramètres Lot 2
    saveSettings({
        detecterNewsletters: true,
        motsClesAucune: ['Facture', 'Newsletter', 'Reçu'],
        motsClesRapide: ['À signer', 'Urgent']
    });
    const s = getSettings();
    affirmer(s.detecterNewsletters === true, 'getSettings restitue detecterNewsletters');
    affirmer(s.motsClesAucune.includes('Facture'), 'getSettings restitue motsClesAucune');
    affirmer(s.motsClesRapide.includes('À signer'), 'getSettings restitue motsClesRapide');

    // E. Classification déterministe via classerThreadAvecIA_
    const testIdentites = new Set(['me@example.com']);
    const mockThreadKw = { getFirstMessageSubject: () => 'Votre facture SFR' };
    const mockMsgKw = {
        getFrom: () => 'service-client@sfr.fr',
        getTo: () => 'me@example.com',
        getCc: () => '',
        getSubject: () => 'Votre facture SFR',
        getHeader: () => null
    };
    const resClasserKw = classerThreadAvecIA_(mockThreadKw, [mockMsgKw], testIdentites, 'FAKE_KEY', 'model', Date.now() + 10000);
    affirmer(resClasserKw.categorie === 'AUCUNE' && resClasserKw.source === 'REGLE', 'classerThreadAvecIA_ classe par mot-clé objet sans appel IA');

    const mockThreadNews = { getFirstMessageSubject: () => 'Offres de la semaine' };
    const mockMsgNews = {
        getFrom: () => 'marketing@eshop.com',
        getTo: () => 'me@example.com',
        getCc: () => '',
        getSubject: () => 'Offres de la semaine',
        getHeader: (h) => h === 'List-Unsubscribe' ? '<mailto:unsub@eshop.com>' : null
    };
    const resClasserNews = classerThreadAvecIA_(mockThreadNews, [mockMsgNews], testIdentites, 'FAKE_KEY', 'model', Date.now() + 10000);
    affirmer(resClasserNews.categorie === 'AUCUNE' && resClasserNews.source === 'REGLE', 'classerThreadAvecIA_ classe par en-tête newsletter sans appel IA');

    // ═══════════════════════════════════════════════════════════════════════
    // 12. TESTS LOT 3 (ACTIONS 1-CLIC, ANALYTICS 7J & RÈGLES D'ALIAS)
    // ═══════════════════════════════════════════════════════════════════════

    // A. Parsing des règles d'alias
    const reglesBrutesAlias = [
        'support@entreprise.com:RAPIDE',
        'compta@entreprise.com:AUCUNE',
        'direction@*:ATTENTION',
        'invalid_rule',
        'test@domaine.fr:CATEGORIE_INVALIDE'
    ];
    const parsedAlias = parseReglesAlias_(reglesBrutesAlias);
    affirmer(parsedAlias.length === 3, 'parseReglesAlias_ filtre les règles invalides (obtenu: ' + parsedAlias.length + ')');
    affirmer(parsedAlias[0].alias === 'support@entreprise.com' && parsedAlias[0].categorie === 'RAPIDE', 'parseReglesAlias_ extrait alias et catégorie');

    // B. Correspondance règle d'alias
    const matchAlias = trouverRegleAliasCorrespondante_(['support@entreprise.com'], parsedAlias);
    affirmer(matchAlias && matchAlias.categorie === 'RAPIDE', 'trouverRegleAliasCorrespondante_ trouve la règle correspondante');

    const matchAliasNul = trouverRegleAliasCorrespondante_(['inconnu@autre.com'], parsedAlias);
    affirmer(matchAliasNul === null, 'trouverRegleAliasCorrespondante_ renvoie null si aucune règle');

    // C. Classification par alias dans classerThreadAvecIA_
    saveSettings({
        reglesAlias: ['support@entreprise.com:RAPIDE']
    });
    const mockThreadAlias = { getFirstMessageSubject: () => 'Demande de dépannage' };
    const mockMsgAlias = {
        getFrom: () => 'client@externe.fr',
        getTo: () => 'support@entreprise.com',
        getCc: () => '',
        getSubject: () => 'Demande de dépannage',
        getHeader: () => null
    };
    const resClasserAlias = classerThreadAvecIA_(mockThreadAlias, [mockMsgAlias], testIdentites, 'FAKE_KEY', 'model', Date.now() + 10000);
    affirmer(resClasserAlias.categorie === 'RAPIDE' && resClasserAlias.source === 'REGLE', 'classerThreadAvecIA_ classe par règle d’alias sans appel IA');

    const mockMsgAliasNews = {
        getFrom: () => 'automated-service@domain.com',
        getTo: () => 'support@entreprise.com',
        getCc: () => '',
        getSubject: () => 'Notification avec List-Unsubscribe',
        getHeader: (h) => h === 'List-Unsubscribe' ? '<mailto:unsub@domain.com>' : null
    };
    const resAliasNews = classerThreadAvecIA_(mockThreadAlias, [mockMsgAliasNews], testIdentites, 'FAKE_KEY', 'model', Date.now() + 10000);
    affirmer(resAliasNews.categorie === 'RAPIDE', 'La règle d’alias a priorité sur la détection de newsletter');

    // D. Gestion de l'historique sur 7 jours (Analytics)
    enregistrerHistoriqueTri_({
        ok: true,
        dateIso: '2026-08-25T10:00:00Z',
        traites: 15,
        rapide: 5,
        attention: 2,
        aucune: 8,
        urgent: 1
    });
    enregistrerHistoriqueTri_({
        ok: true,
        dateIso: '2026-08-25T14:00:00Z',
        traites: 10,
        rapide: 2,
        attention: 1,
        aucune: 7,
        urgent: 0
    });
    const hist = obtenirHistoriqueTri7j_();
    const entry25 = hist.find(e => e.dateStr === '2026-08-25');
    affirmer(entry25 && entry25.traites === 25, 'enregistrerHistoriqueTri_ cumule les exécutions du même jour (obtenu: ' + (entry25 ? entry25.traites : 0) + ')');
    affirmer(entry25 && entry25.aucune === 15, 'enregistrerHistoriqueTri_ cumule les catégories');

    // E. Statut Dashboard avec Analytics
    const dashStatusLot3 = getDashboardStatus();
    affirmer(dashStatusLot3.success === true, 'getDashboardStatus retourne un statut avec succès (Lot 3)');
    affirmer(dashStatusLot3.analytics && dashStatusLot3.analytics.total7j >= 25, 'getDashboardStatus inclut analytics.total7j');
    affirmer(dashStatusLot3.analytics && typeof dashStatusLot3.analytics.tempsGagneFormatte === 'string', 'getDashboardStatus inclut tempsGagneFormatte');

    // F. Exécution d'actions 1-clic directes WebApp (executerActionRapideWeb_)
    const resArchiver = executerActionRapideWeb_('archiver', 'mock-thread-id-1');
    affirmer(resArchiver && typeof resArchiver.getContent === 'function', 'executerActionRapideWeb_(archiver) renvoie une sortie HTML');
    const resTraite = executerActionRapideWeb_('traite', 'mock-thread-id-2');
    affirmer(resTraite && typeof resTraite.getContent === 'function', 'executerActionRapideWeb_(traite) renvoie une sortie HTML');
    const resActionInvalide = executerActionRapideWeb_('invalide', 'mock-thread-id-3');
    affirmer(resActionInvalide && resActionInvalide.title === 'Erreur', 'executerActionRapideWeb_ gère les actions inconnues');

    // Log récapitulatif
    console.log(`[TESTS] ${resultats.reussis}/${resultats.total} tests réussis (${resultats.echecs} échecs).`);
    resultats.details.forEach(d => console.log(d));

    return resultats;
}
