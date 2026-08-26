# Changelog — Tri Gmail IA

Toutes les modifications notables de ce projet sont documentées ici.
All notable changes to this project are documented here.

Format basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/).

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
