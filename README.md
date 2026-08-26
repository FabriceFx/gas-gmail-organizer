# Tri Gmail IA — Gmail Organizer AI

> Triage automatique de la boîte de réception Gmail par règles déterministes + Gemini.
> Automatic Gmail inbox triage using deterministic rules + Gemini AI.

Développé par [Fabrice Faucheux](https://faucheux.bzh).

---

## FR — Français

### Description

Script Google Apps Script qui trie automatiquement les emails de la boîte de réception en trois catégories :

| Libellé | Signification |
|---------|---------------|
| 🔴 Attention requise | Décision, urgence ou effort approfondi attendu |
| 🟠 Action rapide | Réponse ou vérification simple (≈ 2 min) |
| 🟢 Aucune action | Email informatif ou clôturé, sans suivi attendu |
| ⚠️ Erreur de tri | Thread mis en quarantaine après plusieurs échecs |

Le moteur hybride applique d'abord des règles locales (VIP, expéditeurs sensibles, alias…) et délègue les cas ambigus à l'API Gemini avec un prompt sécurisé contre l'injection.

### Prérequis

- Compte Google Workspace ou Gmail personnel
- Accès à [Google AI Studio](https://aistudio.google.com) pour obtenir une clé API Gemini

### Installation

1. Ouvrir [script.google.com](https://script.google.com) et créer un nouveau projet.
2. Copier le contenu de `Code.gs` dans l'éditeur.
3. Copier `appsscript.json` via **Paramètres du projet → Afficher le fichier manifeste**.
4. Dans **Paramètres du projet → Propriétés du script**, ajouter :
   - `GEMINI_API_KEY` : votre clé API Gemini
   - `COMPTE_EMAIL` *(facultatif)* : votre adresse Gmail si `Session.getEffectiveUser()` est vide
   - `ADRESSES_PERSONNELLES` *(facultatif)* : adresses supplémentaires séparées par des virgules
5. Exécuter la fonction `setup()` une première fois manuellement.

### Configuration

Toutes les options sont centralisées dans l'objet `CONFIG` en haut de `Code.gs` :

| Clé | Défaut | Description |
|-----|--------|-------------|
| `TRI.LOT_MAX` | 30 | Threads traités par exécution |
| `TRI.ARCHIVER_AUCUNE_ACTION` | `false` | Archive automatiquement les emails sans action |
| `TRI.CLASSER_CC_SEUL_EN_AUCUNE` | `false` | Classe en "Aucune action" si reçu uniquement en Cc |
| `TRI.NB_ECHECS_AVANT_QUARANTAINE` | 3 | Nombre d'échecs avant quarantaine d'un thread |
| `TRI.DUREE_VIE_COMPTEUR_ECHEC_JOURS` | 30 | Durée de vie des compteurs d'échec |
| `DIGEST.HEURE` | 8 | Heure d'envoi du digest quotidien |
| `GEMINI.MODELE` | `gemini-3.7-flash` | Modèle Gemini utilisé |
| `VIP` | `[]` | Expéditeurs classés automatiquement en Attention |
| `NE_PAS_ENVOYER_A_IA` | `[]` | Expéditeurs sensibles (classés localement, non envoyés à Gemini) |
| `EXPEDITEURS_AUCUNE_ACTION` | `[]` | Expéditeurs toujours classés en Aucune action |

### Déclencheurs installés par `setup()`

| Fonction | Fréquence |
|----------|-----------|
| `trierBoiteReception` | Toutes les heures |
| `envoyerDigest` | Quotidien à l'heure configurée |

### Fonctions disponibles

| Fonction | Description |
|----------|-------------|
| `setup()` | Installation initiale |
| `teardown()` | Suppression des déclencheurs |
| `testerConfiguration()` | Test de la clé API sans modifier les déclencheurs |
| `trierBoiteReception()` | Déclenche un tri immédiat |
| `envoyerDigest()` | Envoie le digest immédiatement |
| `reinitialiserTri()` | Supprime tous les libellés de tri (reprise automatique) |
| `retraiterErreurs()` | Remet en file les threads en quarantaine |
| `annulerReinitialisation()` | Annule une réinitialisation en cours |

### Sécurité

- La clé API est stockée dans `PropertiesService`, jamais dans le code.
- Le contenu des emails envoyés à Gemini est marqué comme donnée non fiable.
- Le prompt système interdit explicitement à Gemini de suivre les instructions présentes dans les emails.
- Les messages d'erreur masquent automatiquement la clé API.

### Limites

- Quota Apps Script : 6 min par exécution, ~100 emails/jour via MailApp.
- Le digest consomme des appels `GmailApp.search` ; prévoir un délai d'envoi si la boîte est très chargée.

---

## EN — English

### Description

A Google Apps Script that automatically sorts Gmail inbox emails into three categories:

| Label | Meaning |
|-------|---------|
| 🔴 Attention required | Decision, urgency, or deep work expected |
| 🟠 Quick action | Simple reply or check (≈ 2 min) |
| 🟢 No action | Informational or closed thread |
| ⚠️ Sort error | Thread quarantined after repeated failures |

A hybrid engine first applies local rules (VIP, sensitive senders, aliases…) then delegates ambiguous cases to the Gemini API using a prompt hardened against injection.

### Prerequisites

- Google Workspace or personal Gmail account
- [Google AI Studio](https://aistudio.google.com) API key

### Setup

1. Open [script.google.com](https://script.google.com) and create a new project.
2. Paste the contents of `Code.gs` into the editor.
3. Copy `appsscript.json` via **Project Settings → Show manifest file**.
4. In **Project Settings → Script Properties**, add:
   - `GEMINI_API_KEY`: your Gemini API key
   - `COMPTE_EMAIL` *(optional)*: your Gmail address if `Session.getEffectiveUser()` returns empty
   - `ADRESSES_PERSONNELLES` *(optional)*: additional addresses separated by commas
5. Run the `setup()` function once manually.

### Security

- API key stored in `PropertiesService`, never hardcoded.
- Email content sent to Gemini is explicitly flagged as untrusted data.
- The system prompt forbids Gemini from following instructions found inside emails.
- Error messages automatically redact the API key.

---

## Licence / License

MIT — voir [LICENSE](LICENSE) / see [LICENSE](LICENSE).

Développé par / Developed by [Fabrice Faucheux](https://faucheux.bzh).
