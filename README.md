# Tri Gmail IA — Gmail Organizer AI

> Triage automatique de la boîte de réception Gmail par règles déterministes + Gemini, propulsé par une WebApp de contrôle Premium.
> Automatic Gmail inbox triage using deterministic rules + Gemini AI, powered by a Premium WebApp Dashboard.

Développé par [Fabrice Faucheux](https://faucheux.bzh).

---

## FR — Guide d'utilisation (Français)

### 1. Description du système

Ce projet Google Apps Script trie automatiquement les emails de votre boîte de réception en catégories claires :

| Libellé | Signification |
|---------|---------------|
| 🔴 Attention requise | Décision, tâche complexe ou effort approfondi attendu |
| 🟠 Action rapide | Réponse ou vérification simple (≈ 2 min) |
| 🟢 Aucune action | Email informatif ou clôturé, sans suivi attendu |
| ⏰ Urgent | Priorité haute détectée (décision critique ou urgence élevée) |
| ⚠️ Erreur de tri | Thread mis en quarantaine après plusieurs échecs de traitement |

Le moteur hybride applique d'abord des règles locales (expéditeurs VIP, adresses à ignorer, etc.) configurées via le **Dashboard**. Les cas ambigus sont ensuite délégués à l'API Gemini avec un prompt sécurisé contre l'injection d'instructions.

### 2. Installation et Déploiement (Dashboard WebApp)

Ce projet est modulaire et dispose d'une interface graphique (WebApp).

1. Clonez ce projet via `clasp` ou déployez les multiples fichiers `.gs` et `.html` dans votre éditeur Google Apps Script.
2. Dans l'éditeur Apps Script, cliquez sur **Déployer** (en haut à droite) puis **Nouveau déploiement**.
3. Sélectionnez le type **Application Web** (Web app).
4. Paramétrez :
   - *Exécuter en tant que* : **Moi**
   - *Qui a accès* : **Moi uniquement** (Important pour la sécurité de vos emails)
5. Cliquez sur **Déployer**. Autorisez les accès demandés par Google.
6. Cliquez sur l'URL générée. **Ajoutez cette URL dans vos favoris**, c'est votre tableau de bord !

### 3. Utilisation du Dashboard

Toute la configuration et le suivi se font depuis l'interface Web (Dashboard), sans jamais avoir à modifier le code source.

- **Onglet Dashboard (Vue d'ensemble)** :
  - **État du service** : Activez / désactivez la surveillance horaire en arrière-plan en un clic.
  - **Bilan du dernier tri** : Date, volume d'emails traités, répartition par catégorie et urgence, temps d'exécution.
  - **📊 Analytics & Activité (7 jours)** : Suivi des volumes quotidiens avec graphique en barres empilées, calcul du temps économisé (*ex: 4h 15min*) et du taux de traitement instantané.
  - **💡 Suggestions de règles 1-clic** : Détection des expéditeurs récurrents non configurés avec boutons d'ajout direct (`+ VIP`, `+ Ignorer`, `+ Ne pas envoyer à l'IA`).
  - **Quarantaine & Retraitement** : Compteur d'e-mails en quarantaine avec bouton de relance immédiate.
  - **Diagnostic Gemini** : Testez la validité de votre clé API et mesurez la latence réseau en temps réel.
  - **Lancer le tri manuel** : Déclenche l'analyse immédiate des nouveaux emails.
- **Onglet Paramètres** :
  - **Périmètre d'analyse** : Choisissez la fenêtre temporelle (30 jours par défaut) et l'exclusion des onglets secondaires (`category:primary`).
  - **Détection native des Newsletters** : Analyse automatique des en-têtes standard (`List-Unsubscribe`, `Precedence: bulk`) pour classer en *Aucune action* sans consommer de quota IA.
  - **Mots-clés dans l'objet** : Définissez des termes pour classement direct en *Aucune action* (factures, reçus) ou *Action rapide* sans appel Gemini.
  - **Règles par Alias & Destinataire** : Règles de routage direct selon l'adresse de réception (`support@domaine.com:RAPIDE`, `compta@domaine.com:AUCUNE`).
  - **Clé API Gemini** : Clé Google AI Studio (masquée et sécurisée).
  - **Contacts VIP** : Expéditeurs classés en "Attention requise" (🔴) sans appel IA.
  - **Ne pas envoyer à l'IA** : Expéditeurs ultra-sensibles traités localement.
  - **Newsletters & à ignorer** : Expéditeurs classés en "Aucune action" (🟢).

### 4. Méthodologie au quotidien (Inbox Zero)
Pour que l'outil soit efficace et que votre rapport quotidien ne se remplisse pas indéfiniment, suivez cette méthode simple :
1. **Agir** : Ouvrez votre dossier/libellé `Action Rapide` et traitez les e-mails en attente.
2. **Archiver** : Une fois l'e-mail traité, **enlevez-lui le libellé de couleur** ou **archivez l'e-mail**.
3. **Nettoyer** : Consultez de temps en temps le dossier `Aucune Action` en lisant en diagonale, puis archivez massivement.

### 5. Rapports quotidiens (Digest) & Actions rapides 1-clic
En activant le tri automatique, un email récapitulatif (Digest) vous sera envoyé tous les matins à 8h avec le résumé des actions rapides et attentions requises, priorisant les e-mails urgents.
Chaque e-mail dans le rapport dispose de boutons directs :
- **`[📥 Archiver]`** : Archive l'e-mail et retire ses libellés de tri en un clic depuis votre messagerie.
- **`[✅ Fait]`** : Retire les libellés de tri sans déplacer l'e-mail.

### 6. Sécurité
- Votre clé API est chiffrée et stockée dans le `PropertiesService` masqué de Google (jamais exposée au navigateur).
- Restriction plateforme stricte des requêtes sortantes (`urlFetchWhitelist`) vers l'API Gemini exclusivement.
- Le contenu de vos emails est injecté comme "donnée non fiable" contre le Prompt Injection.
- Aucune dépendance hors services Google (Google Fonts / Google Apps Script).

---

## EN — User Guide (English)

### 1. System Description

This Google Apps Script project automatically sorts your inbox emails into clear categories:

| Label | Meaning |
|-------|---------|
| 🔴 Attention required | Decision, urgency, or deep work expected |
| 🟠 Quick action | Simple reply or check (≈ 2 min) |
| 🟢 No action | Informational or closed thread |
| ⏰ Urgent | High priority badge (critical decision or high urgency) |
| ⚠️ Sort error | Thread quarantined after repeated processing failures |

A hybrid engine first applies local rules (VIP senders, ignore lists, keyword patterns, alias rules, RFC newsletter headers). Ambiguous cases are then delegated to the Gemini API using an injection-hardened prompt.

### 2. Setup and Deployment (WebApp Dashboard)

This project is modular and features a graphical interface (WebApp).

1. Clone this project using `clasp` or deploy the multiple `.gs` and `.html` files in your Google Apps Script editor.
2. In the Apps Script editor, click **Deploy** (top right) then **New deployment**.
3. Select the **Web app** type.
4. Configure:
   - *Execute as*: **Me**
   - *Who has access*: **Only myself** (Crucial for email privacy)
5. Click **Deploy**. Authorize the permissions requested by Google.
6. Click the generated URL. **Bookmark this URL**, this is your control panel!

### 3. Using the Dashboard

All configuration and monitoring is done from the Web Interface (Dashboard), without touching the code.

- **Dashboard Tab (Overview)**:
  - **Service Status**: Toggle hourly background monitoring in one click.
  - **Last Run Metrics**: Date, total sorted emails, category & urgency breakdown, execution time.
  - **📊 Analytics & Activity (7 days)**: Daily triage volumes with interactive stacked bar chart, estimated time saved (*e.g., 4h 15min*), and automation rate.
  - **💡 1-Click Rule Suggestions**: Detects frequent unconfigured inbox senders with direct action buttons (`+ VIP`, `+ Ignore`, `+ Do not send to AI`).
  - **Quarantine & Retry**: Quarantined count with instant retry action button.
  - **Gemini Diagnostics**: Test API key validity and measure network latency.
  - **Manual Sort**: Trigger immediate analysis of new incoming emails.
- **Settings Tab**:
  - **Search Scope**: Choose time window (30 days by default) and exclude secondary tabs (`category:primary`).
  - **Native Newsletter Detection**: Automatic RFC header parsing (`List-Unsubscribe`, `Precedence: bulk`) to sort into *No Action* without consuming AI quota.
  - **Subject Keywords**: Configure keyword patterns for direct sorting into *No Action* or *Quick Action* without calling Gemini.
  - **Alias & Recipient Rules**: Route directly based on destination address (`support@domain.com:RAPIDE`, `billing@domain.com:AUCUNE`).
  - **Gemini API Key**: Securely stored AI Studio key.
  - **VIP Contacts**: Always classified as "Attention required" (🔴) without AI.
  - **Do not send to AI**: Sensitive senders processed locally.
  - **Ignore & Newsletters**: Always classified as "No Action" (🟢).

### 4. Daily Workflow (Inbox Zero)
For the tool to be effective and keep your daily digest clean, follow this simple routine:
1. **Act**: Open your `Quick Action` label and process the pending emails.
2. **Archive**: Once an email is processed, **remove its color label** or **archive the email**.
3. **Clean**: Briefly check the `No Action` folder, skim through, and bulk archive.

### 5. Daily Reports (Digest) & 1-Click Quick Actions
By enabling auto-sort, a summary email (Digest) will be sent to you every morning at 8 AM, listing quick actions and required attentions, highlighting urgent items.
Each email in the report features direct 1-click action buttons:
- **`[📥 Archiver]`**: Archives the email and removes triage labels in 1 click from your email client.
- **`[✅ Fait]`**: Removes triage labels without moving the email.

### 6. Security
- Your API key is encrypted and stored in Google's hidden `PropertiesService` (never exposed to client browser).
- Platform-enforced outbound URL restriction (`urlFetchWhitelist`) strictly targeting the Gemini API.
- Email content is treated as untrusted data against prompt injection.
- Zero third-party dependencies outside Google services (Google Fonts / Google Apps Script).

---

## Licence / License

MIT — voir [LICENSE](LICENSE) / see [LICENSE](LICENSE).

Développé par / Developed by [Fabrice Faucheux](https://faucheux.bzh).
