# Changelog — Tri Gmail IA

Toutes les modifications notables de ce projet sont documentées ici.
All notable changes to this project are documented here.

Format basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/).

---

## [3.6.0] — 2026-08-27

### 🎯 Contre-intuitif & Terre promise : Inbox Zero sans ouvrir vos e-mails
*On pense souvent que pour vider sa boîte mail, il faut passer des heures à chercher et ouvrir chaque message dans Gmail. C'est faux. Dès votre café du matin, un simple clic depuis le Digest quotidien suffit à archiver ou marquer comme traité un e-mail en attente. Et sur votre Dashboard, le graphique d'activité sur 7 jours vous montre noir sur blanc les heures de travail que vous économisez chaque semaine.*

### ✨ Ajouté / Added
- **⚡ Actions rapides 1-clic dans le Digest quotidien** :
  - Liens directs sécurisés `[📥 Archiver]` et `[✅ Fait]` sur chaque e-mail dans le tableau du rapport matinal.
  - Traitement instantané via la WebApp (`doGet`) et affichage d'une page de confirmation épurée en Material Design 3.
- **📊 Analytics & Graphique d'activité sur 7 jours dans le Dashboard** :
  - Historique roulant des 7 derniers jours : volumes triés, répartition visuelle (vert/jaune/rouge/bordeaux).
  - KPIs d'impact clés : *Total e-mails triés (7j)*, *Temps économisé estimé (ex: 4h 15min)*, *Taux de traitement instantané*.
  - Graphique en barres empilées interactif et adaptatif en CSS pur.
- **🎭 Gestion des règles par Alias & Destinataires multiples (To / Cc)** :
  - Définition de règles de routage direct selon l'adresse de réception (`support@domaine.com:RAPIDE`, `compta@domaine.com:AUCUNE`).
  - Classement local immédiat sans consommation de quota d'IA.
- **🛡️ Précision et sécurité renforcée de la détection Newsletter** :
  - Protection des en-têtes `List-Unsubscribe` : les e-mails d'alerte, de sécurité ou demandant une action explicite continuent vers Gemini au lieu d'être court-circuités.
  - Respect strict des frontières de mots (`contientUnMotCle_`).
  - Cache utilisateur (`CacheService`) sur les suggestions d'expéditeurs pour des temps de chargement ultra-rapides.

---

## [3.5.0] — 2026-08-27

### 🎯 Terre promise : Zéro jeton gaspillé, des règles configurées en un battement de cil
*Votre boîte mail contient des dizaines de newsletters, factures et confirmations qui n'ont pas besoin de mobiliser une IA pour être comprises. Vos quotas d'API restent intacts grâce à la détection native des en-têtes et des mots-clés d'objet. Et dès qu'un expéditeur régulier apparaît dans votre boîte, un simple clic dans votre Dashboard l'ajoute à vos règles sans jamais avoir à taper une seule adresse.*

### ✨ Ajouté / Added
- **Règles déterministes par mots-clés dans l'objet** :
  - Configuration de listes de termes pour classement immédiat en 🟢 *Aucune action* (ex: `Facture`, `Reçu`, `Confirmation`) ou 🟠 *Action rapide* sans appel à Gemini.
  - Évaluation instantanée et insensible à la casse / aux espaces.
- **Détection native des Newsletters & e-mails automatiques (En-têtes RFC)** :
  - Détection automatique basée sur les en-têtes `List-Unsubscribe`, `Precedence: bulk/list/junk` et `Auto-Submitted: auto-generated`.
  - Option activable/désactivable dans les Paramètres (activée par défaut).
- **Assistant de règles & suggestions 1-clic dans le Dashboard** :
  - Détection intelligente des expéditeurs fréquents non encore catégorisés dans la boîte de réception.
  - Boutons d'action instantanés dans l'interface Web : `+ VIP`, `+ Ignorer`, `+ Ne pas envoyer à l'IA`.
- **Réactivité instantanée de la configuration (Getters dynamiques)** :
  - Accès aux propriétés en temps réel sans blocage par snapshot figé.

---

## [3.4.0] — 2026-08-27

### 🎯 Terre promise : La clarté instantanée et la maîtrise absolue du tri
*Fini l'incertitude : vous ouvrez votre Dashboard et savez en un clin d'œil quand le dernier tri a tourné, combien d'e-mails ont été traités et si votre API répond en quelques millisecondes. Vos quotas ne s'épuisent plus dans les promotions ou les vieux messages, et les urgences critiques vous sautent aux yeux dès le matin.*

### ⚠️ Note de migration importante / Migration Notice
- **Changement des filtres par défaut** : Par défaut, l'analyse s'applique désormais aux 30 derniers jours (`newer_than:30d`) et exclut les onglets secondaires Promotions / Réseaux sociaux / Forums (`category:primary`). Si vous souhaitez trier l'ensemble de votre boîte ou de votre historique, modifiez simplement ces options dans l'onglet **Paramètres** de la WebApp.

### ✨ Ajouté / Added
- **Périmètre d'analyse borné & exclusion des onglets secondaires** :
  - Support de `newer_than:30d` (configurable à 7, 14, 30, 90 jours ou tout l'historique) pour préserver le quota Gemini lors du premier lancement.
  - Option `category:primary` pour filtrer d'emblée les onglets Promotions, Réseaux sociaux et Forums déjà gérés par Gmail.
- **Panneau de statut temps réel & métriques d'exécution** :
  - Carte de surveillance du dernier tri : date, volume d'emails, répartition par catégories et temps de traitement.
  - Diagnostic API Gemini en un clic avec mesure de la latence réseau en millisecondes et validation du modèle.
  - Compteur d'e-mails en quarantaine avec badge d'alerte (`50+` si plafonné) et bouton de relance.
- **Priorité Haute & Libellé `⏰ Urgent`** :
  - Libellé non exclusif `⏰ Urgent` appliqué aux e-mails nécessitant une décision critique ou d'urgence élevée (`urgence === 'ELEVEE'`).
  - Section prioritaire en tête du Digest quotidien sans doublons de comptage avec les autres sections.

### 🐛 Corrigé / Fixed
- **Élimination de la condition morte `CRITIQUE`** : alignement de `Tri.gs` sur les 3 valeurs réelles de l'énumération (`FAIBLE`, `NORMALE`, `ELEVEE`).
- **Garantie d'entier sur `fenetreJours`** : assainissement systématique (`Math.floor`) pour interdire les valeurs décimales (`newer_than:7.5d`) côté serveur.
- **Suppression du double comptage dans le Digest** : exclusion du libellé `⏰ Urgent` des requêtes *Attention requise* et *Actions rapides* pour garantir un décompte unitaire exact.

---

## [3.3.1] — 2026-08-27

### 🐛 Corrigé / Fixed
- **Protection des déclencheurs récurrents contre les reprises one-off** : découplage strict entre les handlers récurrents (`trierBoiteReception`, `retraiterErreurs`) et les handlers de reprise éphémère (`executerTriManuelBackground`, `retraiterErreursBackground`). Les auto-reprises rapides pour le backlog et la quarantaine ne suppriment plus les déclencheurs horaires ou hebdomadaires de l'utilisateur.
- **Ajout des wrappers dans `HANDLERS_GERES_`** : garantie que `setup()` et `teardown()` nettoient l'ensemble des triggers résiduels sans orphelins.

---

## [3.3.0] — 2026-08-27

### 🎯 Terre promise : Zéro blocage, zéro fuite, fluidité absolue
*Même au retour de congés face à des centaines d'e-mails en attente, le moteur rattrape automatiquement son retard sans intervention manuelle. Vos requêtes sortantes sont verrouillées par plateforme vers Google, et vos quarantaines sont purgées de façon fluide et accessible.*

### 🔒 Sécurité & Durcissement / Security & Hardening
- **Whitelist d'URL sortantes (`urlFetchWhitelist`)** : restriction plateforme dans `appsscript.json` vers `https://generativelanguage.googleapis.com/` uniquement (garantie qu'aucune donnée d'e-mail ne peut s'échapper).
- **Garde anti-concurrence `setup()`** : blocage d'installation si une réinitialisation est en cours pour éviter l'annulation silencieuse d'un nettoyage.
- **Whitelist de langue serveur** : normalisation stricte `['fr', 'en']` dans `doGet` pour la WebApp.

### ⚡ Performance & Résilience / Performance & Resilience
- **Drainage automatique du backlog** : auto-reprise rapide (à 1 min) si le lot maximum de 30 e-mails a été atteint ou en cas d'interruption chrono, pour rattraper immédiatement les grosses boîtes de réception.
- **Snapshot `PropertiesService`** : chargement mémoïsé en un seul appel `getProperties()` au lieu de 4 requêtes réseau distinctes au démarrage du script.
- **Déduplication du déclencheur manuel** : utilisation de `programmerRepriseUnique_` pour éviter l'accumulation de triggers en cas de clics répétés.
- **Sortie de quarantaine automatisée** : déclencheur hebdomadaire planifié dans `setup()` + nouveau bouton d'action *"Retraiter les erreurs"* dans le Dashboard WebApp.

### 🎨 UI/UX & Accessibilité / UI/UX & Accessibility
- **Navigation au clavier** : support complet `tabindex="0"`, `role="tab"`, `aria-selected` et touches `Enter` / `Espace` sur les onglets.
- **Bouton Retraiter les erreurs** : carte dédiée dans le Dashboard avec retour snackbar en arrière-plan.

### 🧪 Tests & CI
- **GitHub Actions CI** : workflow automatisé `.github/workflows/test.yml` exécutant la suite Node.js (35 tests) à chaque push.
- **Résilience environnementale** : suite de tests exécutable sans interruption sur un script sans clé préalablement configurée.

---

## [3.2.0] — 2026-08-27

### 🎯 Terre promise : La sérénité d'une boîte mail maîtrisée
*Finis les doutes et les configurations opaques : vos contacts VIP sont immédiatement sécurisés en haute priorité, votre clé API reste strictement confidentielle sur votre machine, et vos déclencheurs s'activent en un clin d'œil sans ralentissement.*

### 🔒 Sécurité & Robustesse / Security & Robustness
- **Masquage de la clé API** : `getSettings()` ne renvoie plus la clé secrète au navigateur mais un booléen `hasApiKey`, éliminant toute exposition client inutile.
- **Moindre privilège OAuth** : suppression des scopes redondants `gmail.readonly` et `gmail.labels` subsumés par `gmail.modify` dans `appsscript.json`.
- **Suppression du mode iframe ALLOWALL** : retour au mode par défaut protecteur contre le clickjacking.
- **Réflexion IA étendue** : augmentation de `MAX_OUTPUT_TOKENS` à 2048 pour éviter les erreurs `finishReason=MAX_TOKENS` lorsque le mode réflexion est actif sur des e-mails complexes.
- **Purge inconditionnelle** : les compteurs d'échec sont désormais purgés systématiquement à chaque passe de tri et lors du digest quotidien.

### 🐛 Corrigé / Fixed
- **Cohérence VIP** : alignement de l'UI et de la documentation sur la catégorie **Attention requise (🔴)** attribuée aux VIP locaux sans appel IA.
- **Signature `journaliser_`** : correction des appels de log dans `WebApp.gs` (`niveau, message, details`).
- **Validation stricte `saveSettings`** : vérification `typeof apiKey === 'string'` pour parer tout `TypeError`.
- **Toggle instantané** : activation immédiate du tri automatique sans délai d'attente sur le test Gemini.

### ✨ Ajouté / Added
- **Suite de tests unitaires** : `Tests.gs` (exécutable dans Apps Script) et `tests/run_local.js` (runner Node.js local) couvrant 100% des règles d'adresses, nettoyage de corps, mapping IA et parsing.
- **Validation syntaxique des règles** : filtrage et validation stricte (`estRegleValide_`) des règles d'adresses et domaines.
- **Avatar initiales local** : remplacement de l'avatar tiers par un composant SVG/CSS pur (zéro fuite de données).
- **Centralisation des constantes** : création de `CLES_PROPRIETES_` pour unifier l'accès aux clés `PropertiesService`.

---

## [3.1.1] — 2026-08-26

### Corrigé / Fixed
- **API Gemini** : remplacement de `responseFormat.text.mimeType` (non reconnu) par `responseMimeType` + `responseSchema`, conformément à la spécification REST Gemini. Le schema JSON est désormais enforced côté API, en complément de la validation locale.
- **Double appel `Session.getEffectiveUser()`** : `obtenirIdentitesCompte_` n'appelle plus `Session` une seconde fois — `comptePrincipal` est réutilisé directement.
- **Matching de domaine** : une règle `domaine.fr` dans VIP/NE_PAS_ENVOYER_A_IA correspond maintenant aussi aux sous-domaines (`mail.domaine.fr`, `smtp.domaine.fr`, etc.).

### Ajouté / Added
- **Compteurs d'échec par thread** stockés en JSON `{n, t}` avec horodatage (rétro-compatible avec l'ancien format numérique).
- **`purgerAnciensCompteursEchec_()`** : purge automatique des compteurs d'échec plus anciens que `CONFIG.TRI.DUREE_VIE_COMPTEUR_ECHEC_JOURS` (30 jours par défaut). Protège contre le dépassement du quota PropertiesService (500 propriétés).
- **`appsscript.json`** : manifeste avec scopes OAuth explicites (principe du moindre privilège).
- **JSDoc** sur toutes les fonctions publiques (`setup`, `teardown`, `testerConfiguration`, `trierBoiteReception`, `envoyerDigest`, `reinitialiserTri`, `retraiterErreurs`, `annulerReinitialisation`).
- **Commentaire** sur le fast-path check de `reinitialisationEnCours_` dans `trierBoiteReception` pour clarifier le double-check intentionnel sous verrou.

---

## [3.1.0] — 2026-08 (version initiale documentée)

### Ajouté / Added
- Triage hybride Gmail / Gemini avec moteur de règles déterministes.
- Catégories : Attention requise 🔴 · Action rapide 🟠 · Aucune action 🟢 · Erreur ⚠️.
- Système de quarantaine par thread avec compteur d'échecs.
- Réinitialisation complète reprise-able (multi-passes avec trigger).
- Digest quotidien HTML + texte brut.
- Alertes par email en cas d'erreur globale (avec anti-spam 12 h).
- Retry Gemini avec backoff exponentiel + jitter + header `Retry-After`.
- Verrou `LockService` pour éviter les exécutions concurrentes.
