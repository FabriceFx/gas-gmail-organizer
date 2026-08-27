# Post LinkedIn — Gmail Organizer AI

## 🇫🇷 Version française

J'ai confié le tri de ma boîte Gmail à une IA. Sans jamais lui faire confiance aveuglément.

Chaque email exige une micro-décision : répondre maintenant ? approfondir ? ignorer ?
Multipliée des dizaines de fois par jour, cette charge mentale finit par coûter plus cher que les emails eux-mêmes.

J'ai donc développé Gmail Organizer AI, un side project 100 % Google Apps Script + Gemini, qui trie automatiquement ma boîte en 3 libellés :

🔴 Attention requise — décision, urgence, dossier de fond
🟠 Action rapide — traitable en ~2 minutes
🟢 Aucune action — à lire en diagonale, puis archiver

Ce qui m'a le plus intéressé, ce n'est pas l'IA. C'est tout ce qu'il faut construire autour pour qu'elle soit digne de confiance :

✅ Des règles déterministes d'abord : VIP, expéditeurs sensibles et newsletters sont classés localement, sans aucun appel IA.
✅ Une défense anti prompt-injection : le contenu des emails est traité comme une donnée non fiable, jamais comme une instruction.
✅ Une liste « ne jamais envoyer à l'IA » pour les expéditeurs confidentiels.
✅ Une sortie JSON strictement contrainte par schéma, revalidée localement.
✅ Verrous, quarantaine des threads en échec, retry avec backoff, quotas protégés.
✅ 34 tests unitaires exécutables en local (Node.js) comme dans Apps Script.

Le tout piloté par un dashboard web bilingue, sans serveur à maintenir, sans qu'aucune donnée ne quitte le compte Google.

La leçon que j'en retire : dans un produit IA, le modèle représente 10 % du travail. Les 90 % restants, c'est l'ingénierie qui l'entoure — sécurité, robustesse, observabilité.

Et vous, combien de micro-décisions votre boîte mail vous vole-t-elle chaque jour ?

👉 Détails en carrousel ci-dessous.

#GoogleAppsScript #Gemini #IA #Productivité #InboxZero

---

## 🇬🇧 English version

I handed my Gmail inbox triage over to an AI. Without ever trusting it blindly.

Every email demands a micro-decision: reply now? dig deeper? ignore?
Multiplied dozens of times a day, that mental load ends up costing more than the emails themselves.

So I built Gmail Organizer AI, a side project running on 100% Google Apps Script + Gemini, which automatically sorts my inbox into 3 labels:

🔴 Needs attention — a decision, an urgent issue, deep work
🟠 Quick action — done in ~2 minutes
🟢 No action — skim it, then archive

What interested me most wasn't the AI. It was everything you have to build around it to make it trustworthy:

✅ Deterministic rules first: VIPs, sensitive senders and newsletters are classified locally, with zero AI calls.
✅ Prompt-injection defense: email content is treated as untrusted data, never as instructions.
✅ A "never send to AI" list for confidential senders.
✅ A strictly schema-constrained JSON output, revalidated locally.
✅ Locks, quarantine for failing threads, retry with backoff, protected quotas.
✅ 34 unit tests runnable both locally (Node.js) and inside Apps Script.

All driven by a bilingual web dashboard — no server to maintain, and no data ever leaves the Google account.

My takeaway: in an AI product, the model is 10% of the work. The other 90% is the engineering around it — security, robustness, observability.

How many micro-decisions does your inbox steal from you every day?

👉 Details in the carousel below.

#GoogleAppsScript #Gemini #AI #Productivity #InboxZero