'use strict';

// ═══════════════════════════════════════════════════════════════════════════
// DIGEST QUOTIDIEN
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Génère et envoie le digest quotidien par email.
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

        let html = [
            '<!DOCTYPE html>',
            '<html>',
            '<head><meta charset="UTF-8"></head>',
            '<body>',
            '<div style="font-family:Roboto,Arial,sans-serif;max-width:700px;margin:auto;color:#202124">',
            '<h2 style="border-bottom:3px solid #1a73e8;padding-bottom:8px">',
            `Digest de tri Gmail — ${escapeHtml_(dateLongue)}`,
            '</h2>'
        ].join('');

        const texte = [
            `Digest de tri Gmail — ${dateLongue}`,
            ''
        ];

        let totalGlobal = 0;

        sections.forEach(section => {
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

            html += [
                `<h3 style="color:${section.couleur};margin:20px 0 6px">`,
                `${section.titre} `,
                `<span style="background:${section.couleur};color:#fff;`,
                'border-radius:12px;padding:2px 10px;font-size:13px">',
                escapeHtml_(badge),
                '</span></h3>'
            ].join('');

            texte.push(`${section.titreTexte} : ${badge}`);

            if (visibles.length === 0) {
                html +=
                    '<p style="color:#5f6368;font-style:italic;margin-top:2px">' +
                    'Rien à signaler.</p>';
                texte.push('  Rien à signaler.', '');
                return;
            }

            html +=
                '<table style="width:100%;border-collapse:collapse;font-size:13px">';

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

                html += [
                    '<tr style="border-bottom:1px solid #e8eaed">',
                    '<td style="padding:7px 8px;white-space:nowrap;color:#5f6368;vertical-align:top">',
                    escapeHtml_(tronquer_(expediteur, 30)),
                    '<br><span style="font-size:11px;color:#9aa0a6">',
                    escapeHtml_(formaterDateHeureCourte_(dateMessage)),
                    '</span></td>',
                    '<td style="padding:7px 8px;vertical-align:top">',
                    `<a href="${escapeHtml_(lien)}" `,
                    'style="color:#1a73e8;text-decoration:none">',
                    escapeHtml_(tronquer_(sujet || '(sans objet)', 90)),
                    '</a></td>',
                    '</tr>'
                ].join('');

                texte.push(
                    `  - ${tronquer_(expediteur, 40)} | ` +
                    `${tronquer_(sujet || '(sans objet)', 100)} | ${lien}`
                );
            });

            html += '</table>';

            const autresMinimum = Math.max(
                0,
                nombreConnu - visibles.length
            );

            if (depasseLimite) {
                html +=
                    `<p style="color:#5f6368;font-size:12px">` +
                    `… et au moins ${autresMinimum} autres.</p>`;
                texte.push(`  … et au moins ${autresMinimum} autres.`);
            } else if (autresMinimum > 0) {
                html +=
                    `<p style="color:#5f6368;font-size:12px">` +
                    `… et ${autresMinimum} autres.</p>`;
                texte.push(`  … et ${autresMinimum} autres.`);
            }

            texte.push('');
        });

        html += [
            '<p style="color:#9aa0a6;font-size:11px;margin-top:24px;',
            'border-top:1px solid #e8eaed;padding-top:8px">',
            'Généré automatiquement par Tri Gmail IA.',
            '</p></div></body></html>'
        ].join('');

        if (!CONFIG.DIGEST.ENVOYER_SI_VIDE && totalGlobal === 0) {
            journaliser_('INFO', 'Digest vide non envoyé.');
            return { ok: true, envoye: false, total: 0 };
        }

        GmailApp.sendEmail(
            destinataire,
            `Digest de tri Gmail — ${dateLongue}`,
            texte.join('\n'),
            {
                htmlBody: html,
                name: 'Tri Gmail IA'
            }
        );

        journaliser_('INFO', 'Digest envoyé.', {
            destinataire,
            totalConnu: totalGlobal
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
    const sections = [
        {
            titre: '\u26A0\uFE0F Erreurs de tri',
            titreTexte: 'Erreurs de tri',
            couleur: '#B06000',
            requete:
                `in:inbox label:"${echapperRechercheGmail_(CONFIG.LABELS.ERREUR)}"`
        },
        {
            titre: '\uD83D\uDD34 Attention requise',
            titreTexte: 'Attention requise',
            couleur: '#C5221F',
            requete:
                `in:inbox label:"${echapperRechercheGmail_(CONFIG.LABELS.ATTENTION)}"`
        },
        {
            titre: '\uD83D\uDFE0 Actions rapides',
            titreTexte: 'Actions rapides',
            couleur: '#E8710A',
            requete:
                `in:inbox label:"${echapperRechercheGmail_(CONFIG.LABELS.RAPIDE)}"`
        }
    ];

    if (CONFIG.DIGEST.INCLURE_AUCUNE_ACTION) {
        const requeteAucune = CONFIG.TRI.ARCHIVER_AUCUNE_ACTION
            ? `label:"${echapperRechercheGmail_(CONFIG.LABELS.AUCUNE)}" newer_than:1d`
            : `in:inbox label:"${echapperRechercheGmail_(CONFIG.LABELS.AUCUNE)}"`;

        sections.push({
            titre: CONFIG.TRI.ARCHIVER_AUCUNE_ACTION
                ? '\uD83D\uDFE2 Aucune action classée sur les dernières 24 h'
                : '\uD83D\uDFE2 Aucune action',
            titreTexte: CONFIG.TRI.ARCHIVER_AUCUNE_ACTION
                ? 'Aucune action classée sur les dernières 24 h'
                : 'Aucune action',
            couleur: '#188038',
            requete: requeteAucune
        });
    }

    return sections;
}


