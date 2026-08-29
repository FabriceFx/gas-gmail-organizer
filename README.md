# TriGénie

[![CI Unit Tests](https://github.com/FabriceFx/gas-gmail-organizer/actions/workflows/test.yml/badge.svg)](https://github.com/FabriceFx/gas-gmail-organizer/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Google Apps Script](https://img.shields.io/badge/Google%20Apps%20Script-V8-4285F4?logo=google)](https://script.google.com)

> Triage automatique de la boîte de réception Gmail : règles déterministes d'abord, Gemini pour les cas ambigus, pilotage complet par un Dashboard web. Aucun serveur, aucune donnée hors de votre compte Google.
>
> Automatic Gmail inbox triage: deterministic rules first, Gemini for ambiguous cases, fully driven by a web Dashboard. No server, no data ever leaves your Google account.

Développé par / Developed by [Fabrice Faucheux](https://faucheux.bzh).

<!--
  📸 TODO captures d'écran (docs/) :
  - docs/dashboard.png  : le Dashboard avec des données réelles
  - docs/labels.png     : la boîte Gmail avec les libellés colorés
  Puis décommenter :
<p align="center">
  <img src="docs/dashboard.png" alt="Dashboard TriGénie" width="720">
</p>
<p align="center">
  <img src="docs/labels.png" alt="Libellés de tri dans Gmail" width="720">
</p>
-->

---

## 🇫🇷 Guide français

### 1. Ce que fait l'outil

Chaque email arrivant dans votre boîte est classé dans l'un de ces libellés, directement dans Gmail :

| Libellé | Signification |
|---------|---------------|
| 🔴 Attention requise | Décision, tâche complexe ou effort approfondi attendu |
| 🟠 Action rapide | Réponse ou vérification simple (≈ 2 min) |
| 🟢 Aucune action | Email informatif ou clôturé, sans suivi attendu |
| ⏰ Urgent | Marqueur transversal : incident, échéance, blocage |
| ⚠️ Erreur de tri | Thread mis en quarantaine après plusieurs échecs de traitement |

### 2. Comment ça marche

Le moteur est **hybride** et applique les règles dans cet ordre — l'IA n'est appelée qu'en dernier recours :

1. **Vos règles d'expéditeur** : VIP, expéditeurs sensibles (« ne jamais envoyer à l'IA »), liste « à ignorer ».
2. **Vos règles d'alias destinataire** : `support@domaine.fr:RAPIDE`.
3. **Vos mots-clés d'objet** : classement direct sans IA (factures, reçus…).
4. **Détection des newsletters** par en-têtes RFC (`List-Unsubscribe`, `Precedence: bulk`, `Auto-Submitted`), avec garde-fou : un objet ressemblant à une alerte (sécurité, incident, expiration…) échappe au raccourci et passe par l'IA.
5. **Gemini** pour les cas restants, avec une sortie JSON strictement contrainte par schéma (`action` / `effort` / `urgence`) et revalidée localement.

**Ce qui est envoyé à Gemini** (uniquement pour les emails qu'aucune règle locale n'a classés) : le sujet, un extrait du corps du dernier message (citations et signatures retirées), les adresses De/À/Cc et les métadonnées des pièces jointes (nom, type, taille — jamais le contenu). Les expéditeurs de la liste « ne jamais envoyer à l'IA » ne quittent **jamais** votre compte.

### 3. Installation (~10 minutes)

**Prérequis** : un compte Google, une clé API Gemini gratuite, et pour la méthode recommandée : [Node.js](https://nodejs.org) + [clasp](https://github.com/google/clasp).

#### Étape 1 — Obtenir la clé API Gemini (gratuite)

1. Allez sur [Google AI Studio](https://aistudio.google.com), connectez-vous.
2. Cliquez sur **Get API key** → **Create API key**, copiez la clé.

#### Étape 2 — Créer le projet Apps Script

Méthode recommandée (clasp) :

```bash
git clone https://github.com/FabriceFx/gas-gmail-organizer.git
cd gas-gmail-organizer
npm install -g @google/clasp
clasp login
clasp create --type standalone --title "TriGénie"
clasp push
```

> Sans clasp : créez un projet sur [script.google.com](https://script.google.com/create), puis recopiez chaque fichier `.gs` et `.html` du dépôt (et le contenu d'`appsscript.json` via *Paramètres du projet → Afficher le fichier manifeste*). C'est fastidieux — clasp est vraiment la bonne voie.

> ⏰ **Fuseau horaire** : `appsscript.json` est réglé sur `Europe/Paris` (le digest quotidien part à 8 h dans ce fuseau). Adaptez `timeZone` si besoin avant le push.

#### Étape 3 — Déployer le Dashboard

1. Dans l'éditeur Apps Script : **Déployer → Nouveau déploiement → Application Web**.
2. Paramétrez : *Exécuter en tant que* : **Moi** — *Qui a accès* : **Moi uniquement** (essentiel pour la confidentialité de vos emails).
3. **Déployer**, autorisez les accès demandés, puis ouvrez l'URL générée : c'est votre Dashboard. **Mettez-la en favori.**

#### Étape 4 — Configurer et activer

1. Dashboard → **Paramètres** : collez votre clé API Gemini, laissez « Clé API Gratuite » activé (limite le rythme à ~15 requêtes/min), enregistrez.
2. Dashboard → **Vue d'ensemble** : activez le toggle **Tri automatique**. Cela crée les libellés et les déclencheurs (tri horaire, digest quotidien, retraitement hebdomadaire de la quarantaine).
3. Vérifiez avec **Tester la clé** : latence affichée = tout fonctionne.

> 💡 Après toute **mise à jour du code** (`clasp push`) : mettez à jour le déploiement *en place* (`clasp deploy -i <deploymentId>` ou éditeur → Gérer les déploiements → Modifier → Nouvelle version). Ne créez pas un nouveau déploiement à chaque fois. Voir aussi [Dépannage](#7-dépannage).

### 4. Le Dashboard au quotidien

- **Vue d'ensemble** : état du tri automatique, bilan du dernier passage (volumes par catégorie), quarantaine avec bouton de retraitement, test de la clé Gemini avec latence, tri manuel immédiat.
- **Analytics 7 jours** : volumes quotidiens en barres empilées, temps économisé estimé, taux de traitement automatique.
- **Suggestions 1-clic** : les expéditeurs récurrents non configurés sont détectés, avec boutons `+ VIP`, `+ Ignorer`, `+ Ne pas envoyer à l'IA`.
- **Paramètres** : périmètre d'analyse (fenêtre temporelle, onglet Principal uniquement), détection newsletters, mots-clés d'objet, règles d'alias (`adresse@domaine.fr:CATEGORIE` — une par ligne, catégories `RAPIDE`, `ATTENTION`, `AUCUNE`), listes VIP / sensibles / à ignorer (adresse exacte, `@domaine.fr`, `prefixe@`, ou `domaine.fr`).

### 5. La méthode Inbox Zero — 3 gestes par jour

1. **Agir** : videz 🟠 *Action rapide* (2 min par email), puis ouvrez 🔴 *Attention requise* au calme.
2. **Archiver** : email traité = libellé retiré ou email archivé. Sinon il restera en attente dans votre rapport quotidien.
3. **Ignorer** : les 🟢 *Aucune action* se lisent en diagonale, puis s'archivent en masse.

### 6. Le digest quotidien et ses actions 1-clic

Chaque matin à 8 h, un email récapitulatif liste ce qui attend, classé par priorité (urgents en tête). Chaque ligne propose deux boutons directs :

- **📥 Archiver** : archive l'email et retire ses libellés de tri, en un clic depuis le digest.
- **✅ Fait** : retire les libellés de tri, l'email reste dans la boîte de réception.

### 7. Dépannage

| Symptôme | Cause probable et remède |
|----------|--------------------------|
| Les modifications du code ne semblent pas prises en compte par le tri automatique | **Piège Apps Script** : un déclencheur créé depuis une WebApp déployée reste épinglé sur *la version du déploiement de l'époque*, pour toujours. Remède : supprimez tous les déclencheurs sur [script.google.com/home/triggers](https://script.google.com/home/triggers), puis exécutez `setup()` **depuis l'éditeur** — les déclencheurs créés là suivent toujours le code à jour. |
| `Gemini HTTP 503 : high demand` | Pic de charge côté Google, fréquent en free tier. L'outil réessaie avec backoff puis bascule sur un modèle de secours ; les emails non traités le seront au passage suivant. Rien à faire. |
| Emails avec le libellé ⚠️ Erreur de tri | Threads en quarantaine après 3 échecs. Bouton **Retraiter** du Dashboard, ou attendre le retraitement automatique du dimanche. |
| Le Dashboard affiche une vieille version | Le déploiement `/exec` sert une version figée : `clasp deploy -i <deploymentId>` pour le mettre à jour en place. |
| « 0 e-mails triés » en permanence | Normal si tout est déjà marqué « · analysé » et qu'aucun nouvel email n'entre dans le périmètre (30 jours + onglet Principal par défaut — ajustable dans Paramètres). |

### 8. Sécurité et confidentialité

- **Votre clé API** est stockée côté serveur dans `PropertiesService` (accès restreint au projet) et n'est **jamais renvoyée au navigateur** — le Dashboard ne reçoit qu'un booléen « clé configurée ».
- **Réseau verrouillé par manifeste** : `urlFetchWhitelist` n'autorise techniquement que l'API Gemini comme destination sortante. Aucune autre requête n'est possible.
- **Anti prompt-injection** : le contenu des emails est transmis à Gemini comme donnée non fiable ; une instruction cachée dans un email n'est jamais suivie. La réponse du modèle est contrainte par schéma et revalidée localement (enums strictes).
- **Liste « ne jamais envoyer à l'IA »** : pour vos expéditeurs confidentiels, classement 100 % local.
- **Aucune dépendance tierce** : Google Apps Script, Gmail, l'API Gemini et Google Fonts — rien d'autre.

### 9. Tests et qualité

Le projet embarque **83 tests unitaires** exécutables des deux côtés :

```bash
node tests/run_local.js
```

- En local via Node.js (mocks des services Google), lancés par **GitHub Actions à chaque push**.
- Dans Apps Script via la fonction `executerTestsUnitaires()`.

Sous le capot : verrous d'exécution, quarantaine avec compteurs à durée de vie limitée, retry avec backoff exponentiel + jitter + `Retry-After`, drainage automatique du backlog, quotas PropertiesService protégés.

### 10. Limites connues

- **Mono-utilisateur par conception** : chaque personne déploie sa propre copie sur son compte (c'est aussi ce qui garantit la confidentialité). Pas de version Marketplace.
- **Free tier Gemini** : ~15 requêtes/min → 30 emails analysés par passage, avec reprise automatique si backlog. Une clé payante lève la contrainte (toggle dans Paramètres).
- **Digest en français** (l'interface du Dashboard est bilingue FR/EN).

---

## 🇬🇧 English guide

### 1. What it does

Every incoming email is sorted into one of these labels, right inside Gmail:

| Label | Meaning |
|-------|---------|
| 🔴 Attention requise *(Needs attention)* | Decision, complex task or deep work expected |
| 🟠 Action rapide *(Quick action)* | Simple reply or check (≈ 2 min) |
| 🟢 Aucune action *(No action)* | Informational or closed thread |
| ⏰ Urgent | Cross-cutting marker: incident, deadline, blocker |
| ⚠️ Erreur de tri *(Sort error)* | Thread quarantined after repeated processing failures |

### 2. How it works

The engine is **hybrid** and applies rules in this order — AI is only the last resort:

1. **Your sender rules**: VIPs, sensitive senders ("never send to AI"), ignore list.
2. **Your recipient/alias rules**: `support@domain.com:RAPIDE`.
3. **Your subject keywords**: direct classification with zero AI calls (invoices, receipts…).
4. **Newsletter detection** via RFC headers (`List-Unsubscribe`, `Precedence: bulk`, `Auto-Submitted`) — with a safety net: alert-looking subjects (security, incident, expiry…) skip the shortcut and go to AI.
5. **Gemini** for the remaining cases, with a strictly schema-constrained JSON output (`action` / `effort` / `urgency`), revalidated locally.

**What gets sent to Gemini** (only for emails no local rule matched): the subject, an excerpt of the latest message body (quotes and signatures stripped), From/To/Cc addresses, and attachment metadata (name, type, size — never the content). Senders on the "never send to AI" list **never** leave your account.

### 3. Setup (~10 minutes)

**Prerequisites**: a Google account, a free Gemini API key, and for the recommended path: [Node.js](https://nodejs.org) + [clasp](https://github.com/google/clasp).

#### Step 1 — Get a free Gemini API key

1. Go to [Google AI Studio](https://aistudio.google.com) and sign in.
2. Click **Get API key** → **Create API key**, copy the key.

#### Step 2 — Create the Apps Script project

Recommended (clasp):

```bash
git clone https://github.com/FabriceFx/gas-gmail-organizer.git
cd gas-gmail-organizer
npm install -g @google/clasp
clasp login
clasp create --type standalone --title "TriGénie"
clasp push
```

> Without clasp: create a project at [script.google.com](https://script.google.com/create) and copy every `.gs` and `.html` file (plus `appsscript.json` via *Project Settings → Show manifest file*). Tedious — clasp really is the way.

> ⏰ **Time zone**: `appsscript.json` ships with `Europe/Paris` (the daily digest fires at 8 AM in that zone). Adjust `timeZone` before pushing if needed.

#### Step 3 — Deploy the Dashboard

1. In the Apps Script editor: **Deploy → New deployment → Web app**.
2. Configure: *Execute as*: **Me** — *Who has access*: **Only myself** (crucial for email privacy).
3. **Deploy**, authorize the requested permissions, then open the generated URL: that's your Dashboard. **Bookmark it.**

#### Step 4 — Configure and enable

1. Dashboard → **Settings**: paste your Gemini API key, keep "Free API Key" on (paces calls to ~15 req/min), save.
2. Dashboard → **Overview**: enable the **Auto Sort** toggle. This creates the labels and triggers (hourly triage, daily digest, weekly quarantine retry).
3. Check with **Test key**: a latency reading means everything works.

> 💡 After any **code update** (`clasp push`): update the deployment *in place* (`clasp deploy -i <deploymentId>`, or editor → Manage deployments → Edit → New version). Don't create a new deployment each time. See [Troubleshooting](#7-troubleshooting).

### 4. The Dashboard, day to day

- **Overview**: auto-sort status, last-run metrics (volumes per category), quarantine with retry button, Gemini key test with latency, instant manual sort.
- **7-day Analytics**: daily volumes as stacked bars, estimated time saved, automation rate.
- **1-click suggestions**: frequent unconfigured senders are detected, with `+ VIP`, `+ Ignore`, `+ Do not send to AI` buttons.
- **Settings**: search scope (time window, Primary tab only), newsletter detection, subject keywords, alias rules (`address@domain.com:CATEGORY` — one per line, categories `RAPIDE`, `ATTENTION`, `AUCUNE`), VIP / sensitive / ignore lists (exact address, `@domain.com`, `prefix@`, or `domain.com`).

### 5. The Inbox Zero method — 3 moves a day

1. **Act**: empty 🟠 *Quick action* (2 min per email), then open 🔴 *Needs attention* with focus.
2. **Archive**: handled email = label removed or email archived. Otherwise it stays pending in your daily report.
3. **Ignore**: skim the 🟢 *No action* pile, then bulk archive.

### 6. The daily digest and its 1-click actions

Every morning at 8 AM, a recap email lists everything pending, sorted by priority (urgent first). Each line has two direct buttons (French labels):

- **📥 Archiver** *(Archive)*: archives the email and removes its triage labels, in one click from the digest.
- **✅ Fait** *(Done)*: removes the triage labels; the email stays in the inbox.

### 7. Troubleshooting

| Symptom | Likely cause and fix |
|---------|----------------------|
| Code changes don't seem to affect the automatic triage | **Apps Script gotcha**: a trigger created from a deployed web app stays pinned to *that deployment's version*, forever. Fix: delete all triggers at [script.google.com/home/triggers](https://script.google.com/home/triggers), then run `setup()` **from the editor** — editor-created triggers always follow the latest code. |
| `Gemini HTTP 503: high demand` | Google-side load spike, common on the free tier. The tool retries with backoff then falls back to a backup model; unprocessed emails are handled on the next run. Nothing to do. |
| Emails labeled ⚠️ Erreur de tri | Threads quarantined after 3 failures. Use the Dashboard **Retry** button, or wait for the automatic Sunday retry. |
| The Dashboard shows an old version | The `/exec` deployment serves a pinned version: `clasp deploy -i <deploymentId>` to update it in place. |
| "0 emails sorted" all the time | Normal if everything is already marked "· analysé" and no new email enters the scope (30 days + Primary tab by default — adjustable in Settings). |

### 8. Security & privacy

- **Your API key** is stored server-side in `PropertiesService` (project-restricted access) and is **never sent back to the browser** — the Dashboard only receives a "key configured" boolean.
- **Manifest-locked network**: `urlFetchWhitelist` technically restricts outbound requests to the Gemini API only. No other destination is possible.
- **Prompt-injection defense**: email content is passed to Gemini as untrusted data; a hidden instruction inside an email is never followed. The model's response is schema-constrained and revalidated locally (strict enums).
- **"Never send to AI" list**: 100% local classification for your confidential senders.
- **No third-party dependencies**: Google Apps Script, Gmail, the Gemini API and Google Fonts — nothing else.

### 9. Tests & quality

The project ships with **83 unit tests**, runnable on both sides:

```bash
node tests/run_local.js
```

- Locally via Node.js (Google services mocked), run by **GitHub Actions on every push**.
- Inside Apps Script via the `executerTestsUnitaires()` function.

Under the hood: execution locks, quarantine with TTL'd failure counters, retry with exponential backoff + jitter + `Retry-After`, automatic backlog draining, protected PropertiesService quotas.

### 10. Known limitations

- **Single-user by design**: each person deploys their own copy on their own account (which is precisely what guarantees privacy). No Marketplace version.
- **Gemini free tier**: ~15 req/min → 30 emails analyzed per run, with automatic catch-up on backlog. A paid key lifts the constraint (toggle in Settings).
- **Digest is French-only** (the Dashboard UI is bilingual FR/EN).

---

## Licence / License

MIT — voir / see [LICENSE](LICENSE).

Développé par / Developed by [Fabrice Faucheux](https://faucheux.bzh) · [faucheux.bzh](https://faucheux.bzh)
