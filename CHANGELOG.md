# Changelog — Tri Gmail IA

Toutes les modifications notables de ce projet sont documentées ici.
All notable changes to this project are documented here.

Format basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/).

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
