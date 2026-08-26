# Tri Gmail IA — Gmail Organizer AI

> Triage automatique de la boîte de réception Gmail par règles déterministes + Gemini, propulsé par une WebApp de contrôle Premium.
> Automatic Gmail inbox triage using deterministic rules + Gemini AI, powered by a Premium WebApp Dashboard.

Développé par [Fabrice Faucheux](https://faucheux.bzh).

---

## FR — Guide d'utilisation (Français)

### 1. Description du système

Ce projet Google Apps Script trie automatiquement les emails de votre boîte de réception en trois catégories :

| Libellé | Signification |
|---------|---------------|
| 🔴 Attention requise | Décision, urgence ou effort approfondi attendu |
| 🟠 Action rapide | Réponse ou vérification simple (≈ 2 min) |
| 🟢 Aucune action | Email informatif ou clôturé, sans suivi attendu |
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

Toute la configuration se fait depuis l'interface Web (Dashboard), sans jamais avoir à modifier le code source.

- **Onglet Dashboard** :
  - **Lancer le tri manuel** : Lance une passe de tri immédiate sur les emails non lus.
  - **Interrupteur Tri Automatique** : Active (ON) ou désactive (OFF) le robot de tri en arrière-plan (qui s'exécute toutes les heures).
- **Onglet Paramètres** :
  - **Clé API Gemini** : Obligatoire.
    > **Comment obtenir une clé API ? (Gratuit)**
    > 1. Allez sur [Google AI Studio](https://aistudio.google.com) et connectez-vous.
    > 2. Dans le menu de gauche, cliquez sur **Get API key**.
    > 3. Cliquez sur le bouton **Create API key** et copiez la longue chaîne de caractères.
  - **VIP** : Saisissez ici les adresses (ex: `direction@entreprise.fr`) ou domaines (ex: `@mondomaine.com`) dont les emails doivent toujours être classés en "Action Rapide", sans passer par l'IA.
  - **Ne pas envoyer à l'IA** : Liste des expéditeurs ultra-sensibles. Ils seront toujours classés en "Attention requise" et leur contenu ne sera jamais envoyé à Gemini.
  - **Ignorer** : Liste des expéditeurs de type "Newsletter" qui finiront automatiquement en "Aucune action".

### 4. Méthodologie au quotidien (Inbox Zero)
Pour que l'outil soit efficace et que votre rapport quotidien ne se remplisse pas indéfiniment, suivez cette méthode simple :
1. **Agir** : Ouvrez votre dossier/libellé `Action Rapide` et traitez les e-mails en attente.
2. **Archiver** : Une fois l'e-mail traité, **enlevez-lui le libellé de couleur** ou **archivez l'e-mail**. S'il reste dans votre boîte de réception avec le libellé coloré, le script considérera qu'il est toujours "en attente de votre part".
3. **Nettoyer** : Consultez de temps en temps le dossier `Aucune Action` en lisant en diagonale, puis archivez massivement.

### 5. Rapports quotidiens (Digest)
En activant le tri automatique, un email récapitulatif (Digest) vous sera envoyé tous les matins à 8h avec le résumé des actions rapides et attentions requises.

### 5. Sécurité
- Votre clé API est chiffrée et stockée dans le `PropertiesService` masqué de Google.
- Le contenu de vos emails (corps, pièces jointes) est toujours injecté comme "donnée non fiable" pour bloquer tout piratage par ingénierie sociale (Prompt Injection) dans l'email entrant.

---

## EN — User Guide (English)

### 1. System Description

This Google Apps Script project automatically sorts your inbox emails into three categories:

| Label | Meaning |
|-------|---------|
| 🔴 Attention required | Decision, urgency, or deep work expected |
| 🟠 Quick action | Simple reply or check (≈ 2 min) |
| 🟢 No action | Informational or closed thread |
| ⚠️ Sort error | Thread quarantined after repeated processing failures |

A hybrid engine first applies local rules (VIP senders, ignore lists, etc.) configured via the **Dashboard**. Ambiguous cases are then delegated to the Gemini API using an injection-hardened prompt.

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

All configuration is done from the Web Interface (Dashboard), without ever needing to touch the source code.

- **Dashboard Tab**:
  - **Manual Sort**: Instantly triggers a sorting pass on unread emails.
  - **Auto-Sort Toggle**: Enables (ON) or disables (OFF) the background sorting robot (runs hourly).
- **Settings Tab**:
  - **Gemini API Key**: Mandatory. 
    > **How to get an API key? (Free)**
    > 1. Go to [Google AI Studio](https://aistudio.google.com) and sign in.
    > 2. In the left menu, click **Get API key**.
    > 3. Click the **Create API key** button and copy the generated string.
  - **VIP**: Enter addresses (e.g., `boss@company.com`) or domains (e.g., `@mydomain.com`) whose emails should always be flagged as "Quick Action" without using AI.
  - **Do not send to AI**: Ultra-sensitive senders list. They will always be flagged as "Attention required" and their content will never be sent to Gemini.
  - **Ignore**: Newsletters or receipts that should automatically go to "No Action".

### 4. Daily Workflow (Inbox Zero)
For the tool to be effective and keep your daily digest clean, follow this simple routine:
1. **Act**: Open your `Quick Action` label and process the pending emails.
2. **Archive**: Once an email is processed, **remove its color label** or **archive the email**. If it stays in your inbox with the color label attached, the script will consider it still "pending".
3. **Clean**: Briefly check the `No Action` folder, skim through, and bulk archive.

### 5. Daily Reports (Digest)
By enabling auto-sort, a summary email (Digest) will be sent to you every morning at 8 AM, listing quick actions and required attentions.

### 6. Security
- Your API key is encrypted and stored in Google's hidden `PropertiesService`.
- Email content (body, attachments) is strictly injected as "untrusted data" to prevent social engineering attacks (Prompt Injection) originating from incoming emails.

---

## Licence / License

MIT — voir [LICENSE](LICENSE) / see [LICENSE](LICENSE).

Développé par / Developed by [Fabrice Faucheux](https://faucheux.bzh).
