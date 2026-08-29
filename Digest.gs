'use strict';

// ═══════════════════════════════════════════════════════════════════════════
// DIGEST QUOTIDIEN
// ═══════════════════════════════════════════════════════════════════════════
//
// Construit et envoie l'e-mail de résumé quotidien du tri, avec un rendu
// HTML façon notification Google Workspace.
//
// TriGénie · Fabrice Faucheux · https://faucheux.bzh

/**
 * Génère et envoie le résumé quotidien de tri par email, avec une présentation
 * proche des notifications Google Workspace (carte blanche, en-tête de marque,
 * texte pédagogique).
 * Liste les threads classés dans chaque catégorie depuis la dernière exécution.
 * @returns {{ok: boolean, envoye?: boolean, totalConnu?: number, ignore?: boolean, erreur?: string}}
 */
function envoyerDigest() {
    if (reinitialisationEnCours_()) {
        journaliser_(
            'INFO',
            'Digest ignoré : une réinitialisation est en cours.'
        );
        return { ok: false, ignore: true, raison: 'REINITIALISATION' };
    }

    try {
        const destinataire = obtenirComptePrincipal_();
        const sections = construireSectionsDigest_();
        const date = new Date();
        const dateLongue = formaterDateLongueFr_(date);

        let webAppUrl = '';
        try {
            webAppUrl = ScriptApp.getService().getUrl() || '';
        } catch (e) {
            webAppUrl = '';
        }

        // Phase 1 : on interroge Gmail pour chaque catégorie et on prépare le
        // contenu (HTML + texte brut) sans encore assembler l'email complet,
        // afin de pouvoir résumer le total dans l'introduction.
        let totalGlobal = 0;
        const rendus = sections.map(section => {
            const limite = CONFIG.DIGEST.LIMITE_COMPTAGE_PAR_SECTION;
            const threads = GmailApp.search(
                section.requete,
                0,
                limite + 1
            );

            const depasseLimite = threads.length > limite;
            const nombreConnu = Math.min(threads.length, limite);
            const badge = depasseLimite ? `${limite}+` : String(nombreConnu);
            const visibles = threads.slice(
                0,
                CONFIG.DIGEST.MAX_AFFICHES_PAR_SECTION
            );
            const messagesVisibles = visibles.length > 0
                ? GmailApp.getMessagesForThreads(visibles)
                : [];

            totalGlobal += nombreConnu;

            const texteLignes = [`${section.titreTexte} : ${badge}`];

            if (visibles.length === 0) {
                texteLignes.push('  Rien à signaler.', '');
                return {
                    section,
                    badge,
                    estVide: true,
                    lignesHtml: '',
                    texteLignes
                };
            }

            let lignesHtml = '';

            visibles.forEach((thread, index) => {
                const messages = messagesVisibles[index] || [];
                const dernier = messages.length > 0
                    ? messages[messages.length - 1]
                    : null;

                const expediteur = dernier
                    ? obtenirNomExpediteur_(dernier.getFrom())
                    : '(expéditeur inconnu)';

                const sujet = dernier
                    ? dernier.getSubject()
                    : thread.getFirstMessageSubject();

                const dateMessage = dernier
                    ? dernier.getDate()
                    : thread.getLastMessageDate();

                const lien = thread.getPermalink();

                lignesHtml += [
                    '<tr style="border-bottom:1px solid #e8eaed">',
                    '<td style="padding:10px 12px 10px 0;white-space:nowrap;color:#5f6368;vertical-align:top;font-size:12px">',
                    escapeHtml_(tronquer_(expediteur, 28)),
                    '<br><span style="font-size:11px;color:#9aa0a6">',
                    escapeHtml_(formaterDateHeureCourte_(dateMessage)),
                    '</span></td>',
                    '<td style="padding:10px 0;vertical-align:top">',
                    `<a href="${escapeHtml_(lien)}" `,
                    'style="color:#1a73e8;text-decoration:none;font-size:13px">',
                    escapeHtml_(tronquer_(sujet || '(sans objet)', 80)),
                    '</a></td>',
                    '</tr>'
                ].join('');

                texteLignes.push(
                    `  - ${tronquer_(expediteur, 40)} | ` +
                    `${tronquer_(sujet || '(sans objet)', 100)} | ${lien}`
                );
            });

            const autresMinimum = Math.max(
                0,
                nombreConnu - visibles.length
            );

            if (depasseLimite) {
                texteLignes.push(`  … et au moins ${autresMinimum} autres.`);
            } else if (autresMinimum > 0) {
                texteLignes.push(`  … et ${autresMinimum} autres.`);
            }

            texteLignes.push('');

            return {
                section,
                badge,
                estVide: false,
                lignesHtml,
                autresMinimum,
                depasseLimite,
                texteLignes
            };
        });

        if (!CONFIG.DIGEST.ENVOYER_SI_VIDE && totalGlobal === 0) {
            journaliser_('INFO', 'Digest vide non envoyé.');
            return { ok: true, envoye: false, total: 0 };
        }

        // Phase 2 : assemblage de l'email, dans un style proche des
        // notifications Google Workspace (carte blanche sur fond gris clair,
        // en-tête de marque, description pédagogique par catégorie).
        const policeTitre = "'Google Sans',Roboto,Arial,sans-serif";
        const policeTexte = 'Roboto,Arial,sans-serif';
        const introduction = totalGlobal > 0
            ? `Voici les emails triés automatiquement au cours des dernières 24 heures, ` +
              `classés par catégorie. Cliquez sur un email pour l'ouvrir directement dans Gmail.`
            : `Aucun nouvel email n'a été trié au cours des dernières 24 heures.`;

        let html = [
            '<!DOCTYPE html>',
            '<html lang="fr">',
            '<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>',
            `<body style="margin:0;padding:0;background-color:#f1f3f4">`,
            `<div style="background-color:#f1f3f4;padding:24px 12px;font-family:${policeTexte}">`,
            `<div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(60,64,67,0.25)">`,
            `<div style="background:#1a73e8;padding:18px 32px">`,
            `<span style="color:#ffffff;font-size:14px;font-weight:500;font-family:${policeTitre};letter-spacing:.2px">TriGénie</span>`,
            '</div>',
            '<div style="padding:28px 32px 4px">',
            `<h1 style="margin:0 0 4px;font-size:20px;font-weight:500;font-family:${policeTitre};color:#202124">`,
            'Résumé de tri Gmail',
            '</h1>',
            `<p style="margin:0 0 18px;font-size:13px;color:#5f6368">${escapeHtml_(dateLongue)}</p>`,
            `<p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#3c4043">${escapeHtml_(introduction)}</p>`,
            '</div>'
        ].join('');

        const texte = [
            `Résumé de tri Gmail — ${dateLongue}`,
            '',
            introduction,
            ''
        ];

        rendus.forEach(rendu => {
            const section = rendu.section;

            html += [
                '<div style="padding:20px 32px 0">',
                '<table role="presentation" width="100%" style="border-collapse:collapse">',
                '<tr>',
                `<td style="font-size:15px;font-weight:500;font-family:${policeTitre};color:${section.couleur}">`,
                section.titre,
                '</td>',
                '<td align="right">',
                `<span style="display:inline-block;background:${section.couleur};color:#ffffff;`,
                'border-radius:10px;padding:2px 10px;font-size:12px;font-weight:600">',
                escapeHtml_(rendu.badge),
                '</span></td>',
                '</tr>',
                '</table>',
                `<p style="margin:2px 0 12px;font-size:12px;color:#80868b">${escapeHtml_(section.description)}</p>`
            ].join('');

            texte.push(`${section.titreTexte} : ${rendu.badge}`);
            texte.push(`  ${section.description}`);

            if (rendu.estVide) {
                html +=
                    '<p style="color:#5f6368;font-style:italic;font-size:13px;margin:0 0 4px">' +
                    'Rien à signaler.</p>';
                texte.push('  Rien à signaler.', '');
            } else {
                html += [
                    '<table style="width:100%;border-collapse:collapse">',
                    rendu.lignesHtml,
                    '</table>'
                ].join('');

                if (rendu.depasseLimite) {
                    html +=
                        `<p style="color:#5f6368;font-size:12px;margin:8px 0 0">` +
                        `… et au moins ${rendu.autresMinimum} autres.</p>`;
                } else if (rendu.autresMinimum > 0) {
                    html +=
                        `<p style="color:#5f6368;font-size:12px;margin:8px 0 0">` +
                        `… et ${rendu.autresMinimum} autres.</p>`;
                }

                rendu.texteLignes.slice(1).forEach(ligne => texte.push(ligne));
            }

            html += [
                '</div>',
                '<div style="margin:20px 32px 0;border-top:1px solid #e8eaed"></div>'
            ].join('');
        });

        html += [
            '<div style="padding:20px 32px;background:#f8f9fa;margin-top:4px">',
            '<p style="margin:0;font-size:11px;line-height:1.6;color:#80868b">',
            'Cet e-mail a été généré automatiquement par <strong>TriGénie</strong> ',
            "à partir du tri effectué sur votre boîte Gmail.",
            webAppUrl
                ? ` Retrouvez l'historique complet et les réglages depuis ` +
                  `<a href="${escapeHtml_(webAppUrl)}" style="color:#1a73e8;text-decoration:none">l'application de tri</a>.`
                : '',
            '</p>',
            '<p style="margin:10px 0 0;font-size:11px;color:#80868b">',
            'TriGénie · <a href="https://faucheux.bzh" target="_blank" style="color:#80868b;text-decoration:none;font-weight:600">Fabrice Faucheux</a>',
            '</p></div></div></div></body></html>'
        ].join('');

        texte.push(
            '—',
            'TriGénie · Fabrice Faucheux · https://faucheux.bzh'
        );

        GmailApp.sendEmail(
            destinataire,
            `Résumé de tri Gmail — ${dateLongue}`,
            texte.join('\n'),
            {
                htmlBody: html,
                name: 'TriGénie'
            }
        );

        const purges = purgerAnciensCompteursEchec_();

        journaliser_('INFO', 'Digest envoyé.', {
            destinataire,
            totalConnu: totalGlobal,
            compteursEchecPurges: purges > 0 ? purges : undefined
        });

        return {
            ok: true,
            envoye: true,
            totalConnu: totalGlobal
        };
    } catch (e) {
        journaliser_('ERREUR', 'Échec du digest.', {
            erreur: nettoyerMessageErreur_(e)
        });
        notifierErreurGlobale_(e);
        return {
            ok: false,
            erreur: nettoyerMessageErreur_(e)
        };
    }
}


function construireSectionsDigest_() {
    const sections = [];
    const exclusionUrgent = CONFIG.LABELS.URGENT
        ? ` -label:"${echapperRechercheGmail_(CONFIG.LABELS.URGENT)}"`
        : '';

    if (CONFIG.LABELS.URGENT) {
        sections.push({
            titre: '&#x23F0; Priorité haute (Urgents)',
            titreTexte: 'Priorité haute (Urgents)',
            description: 'Emails identifiés comme urgents : à traiter en priorité.',
            couleur: '#D93025',
            requete:
                `in:inbox label:"${echapperRechercheGmail_(CONFIG.LABELS.URGENT)}"`
        });
    }

    sections.push(
        {
            titre: '&#x26A0;&#xFE0F; Erreurs de tri',
            titreTexte: 'Erreurs de tri',
            description: "Le tri automatique n'a pas pu classer ces emails avec certitude : une vérification manuelle est recommandée.",
            couleur: '#B06000',
            requete:
                `in:inbox label:"${echapperRechercheGmail_(CONFIG.LABELS.ERREUR)}"`
        },
        {
            titre: '&#x1F534; Attention requise',
            titreTexte: 'Attention requise',
            description: "Emails à examiner avant de décider d'une action.",
            couleur: '#C5221F',
            requete:
                `in:inbox label:"${echapperRechercheGmail_(CONFIG.LABELS.ATTENTION)}"${exclusionUrgent}`
        },
        {
            titre: '&#x1F7E0; Actions rapides',
            titreTexte: 'Actions rapides',
            description: 'Emails ne nécessitant qu\'une action simple : archivez-les ou marquez-les comme traités en un clic.',
            couleur: '#E8710A',
            requete:
                `in:inbox label:"${echapperRechercheGmail_(CONFIG.LABELS.RAPIDE)}"${exclusionUrgent}`
        }
    );

    if (CONFIG.DIGEST.INCLURE_AUCUNE_ACTION) {
        const requeteAucune = CONFIG.TRI.ARCHIVER_AUCUNE_ACTION
            ? `label:"${echapperRechercheGmail_(CONFIG.LABELS.AUCUNE)}" newer_than:1d`
            : `in:inbox label:"${echapperRechercheGmail_(CONFIG.LABELS.AUCUNE)}"`;

        sections.push({
            titre: CONFIG.TRI.ARCHIVER_AUCUNE_ACTION
                ? '&#x1F7E2; Aucune action classée sur les dernières 24 h'
                : '&#x1F7E2; Aucune action',
            titreTexte: CONFIG.TRI.ARCHIVER_AUCUNE_ACTION
                ? 'Aucune action classée sur les dernières 24 h'
                : 'Aucune action',
            description: CONFIG.TRI.ARCHIVER_AUCUNE_ACTION
                ? 'Emails classés sans action nécessaire, archivés automatiquement.'
                : 'Emails classés sans action nécessaire.',
            couleur: '#188038',
            requete: requeteAucune
        });
    }

    return sections;
}


