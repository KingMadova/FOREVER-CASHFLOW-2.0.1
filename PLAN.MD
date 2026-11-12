# PLAN — Refonte complète de FOREVER CASHFLOW

> **Document de pilotage du projet**  
> Dépôt : `KingMadova/FOREVER-CASHFLOW-2.0.1`  
> Périmètre : refonte de l'interface et de l'expérience utilisateur avec UIArc, sans réécriture injustifiée du métier.  
> Statut initial : audit statique effectué — aucune modification du code applicatif à ce stade.

---

## 1. Vision et objectifs

Faire évoluer FOREVER CASHFLOW vers une application de pilotage commercial et financier de niveau professionnel, orientée **Business Intelligence**, prise de décision et suivi opérationnel.

La refonte doit apporter :

- Une identité visuelle cohérente avec la marque **Yekola Business**.
- Une interface dense mais lisible, permettant de consulter beaucoup d'informations sans multiplier les changements d'écran.
- Une expérience desktop, tablette et mobile cohérente.
- Un système de composants réutilisables et documentés.
- Une meilleure séparation entre présentation, composants et logique métier.
- La conservation des fonctionnalités, des données et des règles de calcul existantes.

### Principes non négociables

1. Ne pas réécrire une logique métier uniquement pour faciliter le design.
2. Ne pas modifier les structures Firestore, les règles de sécurité ou les contrats de données sans justification et validation explicites.
3. Ne supprimer aucune fonctionnalité existante sans décision explicite du propriétaire.
4. Ne pas remplacer une fonctionnalité opérationnelle par une maquette statique.
5. Ne pas introduire de dépendance payante sans accord préalable.
6. Tester chaque lot avant de commencer le suivant.
7. Ne pas fusionner de branche et ne pas modifier la branche principale sans autorisation explicite.
8. Préserver les capacités PWA, hors ligne, synchronisation, impression et sauvegarde.

---

## 2. Direction artistique validée

### 2.1 Positionnement

**Executive Business Intelligence — Yekola Business**

L'interface doit évoquer un outil professionnel de direction et de pilotage : précis, structuré, efficace, crédible et premium. La densité est volontaire : les informations importantes doivent être visibles rapidement, sans sacrifier la hiérarchie visuelle.

### 2.2 Palette officielle

Les couleurs ci-dessous proviennent de la charte Yekola Business fournie par le propriétaire du projet. Elles constituent la référence de la refonte.

| Rôle | Couleur | Code |
|---|---|---|
| Accent principal / or | Jaune Yekola | `#F9A825` |
| Accent secondaire | Orange Yekola | `#FF6A1A` |
| Accent profond / action forte | Terracotta | `#C1440E` |
| Fond clair | Ivoire | `#FFF9F3` |

**Dégradé officiel :** `#F9A825 → #C1440E`.

Règles d'utilisation :

- Réserver le dégradé aux éléments de mise en valeur : actions principales, accents, illustrations et éléments de marque.
- Ne pas utiliser le dégradé sur toutes les cartes ou tous les arrière-plans.
- Conserver des surfaces neutres pour les tableaux, formulaires et zones de lecture.
- Garantir un contraste suffisant pour les textes et les états interactifs.
- Définir des couleurs sémantiques distinctes pour succès, avertissement, erreur et information. Elles ne doivent pas être confondues avec les couleurs de marque.
- Décliner le thème sombre avec des surfaces et contrastes adaptés, sans simplement inverser les couleurs.

### 2.3 Typographie

| Usage | Police | Graisse recommandée |
|---|---|---|
| Titres principaux | Montserrat | Bold / ExtraBold |
| Sous-titres et accents | Montserrat | Medium / SemiBold |
| Texte courant et données | Poppins | Regular / Medium |

Prévoir des tailles et hauteurs de ligne adaptées à une interface dense. Les chiffres financiers doivent rester très lisibles et alignés.

### 2.4 Logo et éléments de marque

- Le logo Yekola Business fourni est la référence.
- Ne pas redessiner, déformer, recolorer arbitrairement ou remplacer le logo par une icône générique.
- Prévoir les variantes logo complet, icône seule et monochrome selon le contexte.
- Le motif de marque peut être utilisé avec parcimonie dans les écrans de connexion, états vides ou supports éditoriaux.
- Les fichiers définitifs du logo devront être intégrés au dépôt dans un dossier d'assets identifié avant leur utilisation en production.

### 2.5 Densité et hiérarchie

La densité choisie est **compacte** :

- Montrer plusieurs indicateurs pertinents sur une même ligne lorsque la largeur le permet.
- Favoriser les tableaux structurés, filtres compacts et actions contextuelles.
- Éviter les cartes surdimensionnées, les espaces vides excessifs et les titres décoratifs.
- Maintenir des zones cliquables confortables sur mobile.
- Sur petit écran, transformer les tableaux et grilles en présentations adaptées plutôt que réduire simplement leur taille.

---

## 3. Audit initial — état connu du dépôt

Audit statique du code distant réalisé avant toute modification. Le projet n'a pas encore été exécuté localement ni soumis à une suite de tests dans le cadre de cet audit.

### 3.1 Socle technique relevé

- React 19
- TypeScript
- Vite
- Tailwind CSS 4
- Zustand pour l'état global
- Firebase / Firestore pour les services et données
- React Router avec chargement différé des vues
- Lucide React pour les icônes
- Motion pour certaines animations
- Recharts pour les graphiques
- PWA avec mécanisme d'installation et de notification de mise à jour

Le socle React/Vite existant est à conserver. Aucune migration de framework n'est prévue.

### 3.2 Vues et composants identifiés

Vues principales examinées :

- Tableau de bord : `src/views/DashboardView.tsx`
- Prospects : `src/views/ProspectsView.tsx`
- Clients : `src/views/ClientsView.tsx`
- Commandes : `src/views/OrdersView.tsx`
- Projection : `src/views/ProjectionView.tsx`
- Budget : `src/views/BudgetView.tsx`
- Agenda : `src/views/AgendaView.tsx`
- Profil : `src/views/ProfileView.tsx`
- Paramètres : `src/views/SettingsView.tsx`
- Journal / suivi G4 : `src/views/TrackerView.tsx`
- Connexion et inscription : vues dédiées

Structure et composants examinés :

- `src/App.tsx`
- `src/components/ui/Layout.tsx`
- `src/components/ui/PageHeader.tsx`
- `src/components/ui/BottomNav.tsx`
- `src/components/ui/Card.tsx`
- `src/store/StoreProvider.tsx`
- `src/store/slices/*`
- `src/lib/firestoreService.ts`
- `src/lib/firebase.ts`
- `vite.config.ts`

### 3.3 Constats techniques et UX

- Les classes Tailwind et couleurs sont fréquemment définies directement dans les vues.
- Plusieurs vues sont volumineuses et mélangent présentation, état local et traitements métier.
- La navigation desktop et mobile repose sur des structures distinctes à harmoniser.
- Les styles de cartes, bordures, rayons et espacements ne sont pas entièrement uniformes.
- Les mécanismes de thème doivent être examinés : des références au thème existent dans plusieurs stores. Il faudra identifier la source de vérité avant toute modification.
- L'application possède déjà des fonctions sensibles à préserver : mode hors ligne, file de synchronisation, sauvegardes, impression, notifications et PWA.

Quelques tailles de fichiers relevées lors de l'audit :

| Vue | Lignes approximatives |
|---|---:|
| Commandes | 1 707 |
| Clients | 1 152 |
| Prospects | 585 |
| Journal G4 | 557 |
| Projection | 505 |
| Budget | 646 |

Ces volumes justifient une refactorisation progressive des vues les plus complexes, mais pas une réécriture globale automatique.

### 3.4 Points restant à vérifier

Avant le premier changement de code :

- Installer les dépendances dans un environnement de travail et vérifier le build de référence.
- Exécuter les tests existants et établir un état initial.
- Examiner les scripts, versions exactes et dépendances complètes de `package.json`.
- Examiner les règles Firestore, les chemins de données et les contrats des stores.
- Identifier les composants UIArc gratuits réellement nécessaires et leurs dépendances.
- Vérifier les contraintes de licence et les éventuelles fonctionnalités Pro.
- Capturer l'état initial des principales vues sur desktop et mobile.
- Identifier les tests manquants pour les calculs financiers et les parcours critiques.

---

## 4. Stratégie d'intégration UIArc

### 4.1 Objectif

Introduire UIArc comme bibliothèque de composants visuels, sans imposer une réécriture du routage, des stores, des services Firebase ou des modèles métier.

### 4.2 Vérifications préalables

- Suivre la documentation officielle : https://uiarc.dev/docs/installation
- Confirmer les versions compatibles avec React, Vite et TypeScript du dépôt.
- Vérifier les dépendances requises par chaque composant retenu.
- Distinguer les composants gratuits des composants Pro.
- Vérifier le fonctionnement conjoint d'UIArc et de Tailwind CSS 4.
- Vérifier l'impact CSS global et l'ordre de chargement des styles.
- Ne pas installer l'ensemble de la bibliothèque sans besoin identifié.

### 4.3 Fondation et conventions

- Initialiser la configuration de composants nécessaire, notamment `components.json` si le parcours d'installation retenu le requiert.
- Définir les alias TypeScript/Vite sans casser les imports existants.
- Définir les variables CSS de marque et les tokens sémantiques.
- Définir le mécanisme unique de thème clair/sombre.
- Créer une couche de composants applicatifs qui encapsule les composants UIArc.
- Conserver des composants métier indépendants de la bibliothèque lorsque cela est pertinent.

### 4.4 Composants fondamentaux à standardiser

- Boutons et groupes d'actions
- Cartes et panneaux
- Champs, sélecteurs et zones de texte
- Dialogues, drawers et popovers
- Badges et indicateurs d'état
- Menus, onglets et navigation
- Tableaux, pagination, tri et filtres
- Alertes, toasts et confirmations
- Skeletons, états vides et états d'erreur
- Graphiques et légendes

---

## 5. Architecture visuelle cible

### 5.1 Shell applicatif

Créer une structure commune composée de :

- Sidebar desktop avec sections clairement hiérarchisées.
- Navigation mobile compacte et accessible.
- En-tête de page avec titre, contexte et actions principales.
- Zone de contenu avec largeur et densité cohérentes.
- Centre de notifications.
- Indicateur de connexion, mode hors ligne et synchronisation.
- Menu utilisateur et accès aux paramètres.

La navigation doit préserver l'accès à toutes les fonctionnalités existantes, y compris celles qui ne figurent pas dans la navigation principale mobile.

### 5.2 Dashboard — priorité UX

Le tableau de bord doit devenir un véritable poste de pilotage.

Contenu à organiser, selon les données réellement disponibles :

- Indicateurs clés de performance.
- Marge et résultats de la période.
- Volume CC et progression des objectifs.
- Ventes et évolution.
- Clients et prospects.
- Trésorerie et budget.
- Activité récente.
- Objectifs et indicateurs quotidiens / G4.
- Alertes et actions prioritaires.

Règles :

- Hiérarchiser les indicateurs selon leur utilité décisionnelle.
- Afficher la période de référence et les unités.
- Distinguer clairement valeur réelle, objectif et évolution.
- Éviter les graphiques décoratifs sans valeur opérationnelle.
- Respecter les calculs et définitions déjà utilisés dans le métier.

### 5.3 Vues métier

Refondre progressivement :

1. Prospects : pipeline, recherche, filtres, suivi et actions.
2. Clients : portefeuille, historique, segmentation et relances.
3. Commandes : liste, statuts, détail, création, impression et suivi.
4. Projection : scénarios, calculs et synthèses.
5. Budget : entrées, sorties, soldes, tendances et exports.
6. Agenda : calendrier, échéances, rappels et tâches.
7. Journal G4 : objectifs, progression et historique.
8. Profil : informations FBO et paramètres personnels.
9. Paramètres : thème, synchronisation, sauvegarde et préférences.
10. Connexion / inscription : expérience cohérente avec la marque.

---

## 6. Plan de réalisation par lots

Chaque lot doit être réalisé sur une branche de travail dédiée ou une branche explicitement approuvée, puis vérifié avant le lot suivant. La branche principale ne doit pas être fusionnée sans autorisation.

### Lot 0 — Préparation et référence technique

**Objectif :** disposer d'une base vérifiable avant toute modification.

### Résultats du Lot 0 — vérification distante (2026-11-12)

**Statut : PARTIELLEMENT EFFECTUÉ — les vérifications nécessitant un clone et une exécution locale restent bloquées.**

#### Vérifications réalisées sur GitHub

- [x] Dépôt confirmé : `KingMadova/FOREVER-CASHFLOW-2.0.1`.
- [x] Branche par défaut : `main`.
- [x] Liste des branches vérifiée : seule la branche `main` est actuellement exposée.
- [x] Commit de référence : `955745d237cf1c1dc1e0c8553896604d32e85d1e` (`docs: ajouter le plan de refonte UIArc et Yekola Business`).
- [x] Fichier `PLAN.MD` présent sur `main`.
- [x] État du déploiement Vercel associé au commit de référence : `success`, description GitHub « Deployment has completed ».
- [x] Fichiers de configuration, manifeste PWA, règles Firestore, scripts npm et lockfile inspectés à distance.

#### Anomalies et points d'attention découverts

1. **État Git local inconnu :** l'API GitHub ne permet pas de voir les modifications non commitées présentes sur le poste de travail. Aucun état de working tree ne peut donc être certifié.
2. **Build et TypeScript non exécutés :** aucun environnement de clone/exécution locale n'est disponible dans cette session. Le statut Vercel réussi confirme le déploiement, mais ne remplace pas une exécution indépendante de `npm run build` et `npm run lint`.
3. **Aucun script de test :** `package.json` expose `dev`, `build`, `preview`, `clean` et `lint`, mais pas de script `test`. Les fichiers de configuration Vitest et Playwright recherchés ne sont pas présents à la racine.
4. **Le script `lint` n'est pas un linter :** il exécute `tsc --noEmit`, donc une vérification TypeScript.
5. **Métadonnées du lockfile incohérentes :** `package.json` déclare le paquet `forever-cashflow`, tandis que l'entrée racine de `package-lock.json` déclare `react-example`. À vérifier avec `npm install --package-lock-only` ou `npm ci` dans un clone, sans régénérer le lockfile avant d'avoir établi la référence.
6. **Dépendance Vite déclarée deux fois :** Vite apparaît dans `dependencies` et `devDependencies`. À nettoyer uniquement après vérification de l'environnement de build et des usages de déploiement.
7. **Configuration des alias :** Vite et TypeScript déclarent actuellement `@` vers la racine du dépôt (`.` / `./*`). Ne pas les faire pointer automatiquement vers `src` : cela casserait potentiellement les imports existants. Toute évolution doit être précédée d'un inventaire des imports.
8. **Variables d'environnement à clarifier :** le README demande `API_KEY`, alors que `.env.example` documente `GEMINI_API_KEY` et `APP_URL`. Ne pas afficher ni copier de secrets ; vérifier les noms réellement lus par le code et le fournisseur de déploiement.
9. **Métadonnées linguistiques et PWA :** `index.html` indique `lang="en"` et un thème `#0f172a`, tandis que le manifeste Vite déclare `theme_color: #f59e0b` et `background_color: #09090b`. À harmoniser pendant la refonte, pas dans ce lot de préparation.
10. **Automatisation CI :** le répertoire `.github/workflows` n'a pas été trouvé. Le déploiement Vercel est le seul statut distant identifié pour le commit de référence ; aucune suite de tests automatisés n'a été confirmée.

#### Résultats transmis depuis le poste Windows — 2026-11-12

- [x] Branche locale rapportée : `main`.
- [x] `git status --short` ne retourne aucune ligne : working tree propre au moment du relevé.
- [x] Commit local : `454939158317a7d37acecb741f0314909789ab49`.
- [x] Node.js : `v22.22.3`.
- [x] npm : `10.9.8`.
- [ ] `npm ci` : échec pendant le téléchargement/extraction des paquets.
  - Le journal montre des archives corrompues depuis `registry.npmmirror.com` (`zlib: unexpected end of file`, `TAR_ENTRY_INVALID checksum failure`).
  - Erreur finale TLS : `ERR_SSL_DECRYPTION_FAILED_OR_BAD_RECORD_MAC`.
  - Des opérations de nettoyage ont aussi échoué avec `EPERM`, probablement parce que certains dossiers étaient verrouillés par un processus Windows.
- [ ] `npm run lint` : non exécuté réellement, car `tsc` n'est pas disponible après l'installation échouée.
- [ ] `npm run build` : non exécuté réellement, car `vite` n'est pas disponible après l'installation échouée.

**Écart local/distant à noter :** le commit local communiqué est antérieur au commit documentaire qui a créé ce `PLAN.MD`. Le working tree est propre, mais le clone local n'est pas à jour avec la documentation ajoutée sur GitHub. Ne pas faire de pull ou de reset avant d'avoir vérifié les commits distants et les éventuelles conventions locales.

**Diagnostic provisoire :** l'échec observé est d'abord un problème d'accès au registre npm / transfert TLS et d'intégrité du cache, pas une preuve d'une erreur dans le code de l'application. Les avertissements `EPERM` indiquent en plus un possible verrouillage de fichiers sous Windows. Le build et le contrôle TypeScript restent inconnus.

#### Résultat de la nouvelle installation npm — 2026-11-12

- [x] `npm ci` terminé avec succès depuis le registre officiel.
- [x] 613 paquets ajoutés ; 614 paquets audités.
- [x] Les erreurs TLS, archives corrompues et erreurs de nettoyage bloquantes ne se sont pas reproduites.
- [ ] Contrôle TypeScript et build de production à exécuter.
- [ ] Examiner le détail des 30 vulnérabilités signalées par `npm audit` (3 low, 13 moderate, 13 high, 1 critical).
- **Consigne :** ne pas exécuter `npm audit fix` ni `npm audit fix --force` à ce stade. Les mises à jour de dépendances sont hors du diagnostic initial et pourraient modifier les versions ou introduire des régressions. Il faudra d'abord examiner `npm audit` et distinguer dépendances directes/transitives, chemins d'impact et correctifs disponibles.

#### Analyse complémentaire de la configuration npm — 2026-11-12

- [x] Registre npm utilisateur identifié : `https://registry.npmmirror.com/`.
- [x] Le fichier `package-lock.json` contient des URL `resolved` officielles `https://registry.npmjs.org/...` dans les premières entrées examinées.
- [x] Configuration utilisateur relevée : `legacy-peer-deps=true`, `registry=npmmirror.com`, `strict-ssl=false`.
- **Conclusion :** le miroir est configuré dans `C:\Users\...\.npmrc`, et non imposé par les URL `resolved` montrées dans le lockfile. La désactivation de `strict-ssl` réduit la sécurité des connexions HTTPS et ne doit pas être conservée comme solution.
- **Action recommandée, pas encore exécutée :** rétablir le registre officiel npm, remettre `strict-ssl=true`, nettoyer le cache npm puis relancer `npm ci` après fermeture des processus susceptibles de verrouiller `node_modules`.
- Conserver `legacy-peer-deps=true` pendant ce diagnostic afin de ne pas changer simultanément la stratégie de résolution des dépendances.

#### Vérifications encore nécessaires sur le poste de travail

- [ ] Confirmer branche, commit et état `git status --short` local.
- [ ] Vérifier version de Node.js et npm.
- [ ] Exécuter `npm ci` sans modifier le lockfile.
- [ ] Exécuter `npm run lint` et conserver la sortie complète.
- [ ] Exécuter `npm run build` et conserver la sortie complète.
- [ ] Démarrer l'application et vérifier les parcours critiques.
- [ ] Capturer les écrans de référence desktop et mobile.
- [ ] Identifier les variables d'environnement requises sans divulguer leurs valeurs.
- [ ] Vérifier les fonctions PWA, hors ligne, impression et synchronisation dans le navigateur.

**Décision initiale mise à jour le 2026-11-12 :** après confirmation de la branche de travail, synchronisation du clone local avec GitHub et vérification des composants retenus, l'intégration UIArc a été autorisée sur `feat/lot-1-design-system`. Les vérifications de build et de rendu restent toutefois à exécuter localement ; le Lot 0 demeure donc partiellement effectué.

- [ ] Confirmer la branche de travail et le commit de référence.
- [ ] Vérifier l'état Git et les éventuels changements non commités.
- [ ] Installer les dépendances dans l'environnement prévu.
- [ ] Exécuter le build initial.
- [ ] Exécuter les tests existants.
- [ ] Relever les erreurs et avertissements initiaux.
- [ ] Identifier les parcours critiques et les données de test.
- [ ] Documenter les résultats de référence.

**Critère de validation :** état initial reproductible et anomalies préexistantes documentées.

### Lot 1 — Fondation UIArc et design system

**Objectif :** établir une base visuelle commune.

- [ ] Vérifier les prérequis et licences UIArc.
- [ ] Installer uniquement les dépendances nécessaires.
- [ ] Configurer les alias et la fondation UI.
- [ ] Intégrer les polices Montserrat et Poppins.
- [ ] Définir les couleurs officielles Yekola Business.
- [ ] Définir les tokens de typographie, espacements, rayons, ombres et bordures.
- [ ] Définir les thèmes clair et sombre.
- [ ] Créer les composants fondamentaux.
- [ ] Documenter les règles d'utilisation des composants.

**Critère de validation :** page de démonstration interne montrant les composants, états et thèmes, sans régression du fonctionnement actuel.

### Lot 2 — Navigation et shell applicatif

**Objectif :** reconstruire l'enveloppe commune de l'application.

- [ ] Repenser la sidebar desktop.
- [ ] Repenser la navigation mobile.
- [ ] Harmoniser les en-têtes de page.
- [ ] Intégrer le menu utilisateur.
- [ ] Intégrer les notifications.
- [ ] Préserver les indicateurs hors ligne et synchronisation.
- [ ] Vérifier les états de navigation active, focus et survol.
- [ ] Vérifier les largeurs et points de rupture responsive.

**Critère de validation :** toutes les routes restent accessibles et les fonctions de navigation sont utilisables sur les formats cibles.

### Lot 3 — Dashboard et pilotage

**Objectif :** livrer le nouveau poste de pilotage.

- [ ] Définir la hiérarchie des KPI.
- [ ] Refaire les cartes et indicateurs.
- [ ] Refaire les graphiques et légendes.
- [ ] Organiser les objectifs et leur progression.
- [ ] Refaire les blocs d'activité et d'alertes.
- [ ] Vérifier les périodes, unités et calculs.
- [ ] Optimiser la densité desktop et l'adaptation mobile.

**Critère de validation :** les chiffres affichés correspondent aux stores et calculs existants, sans régression fonctionnelle.

### Lot 4 — Prospects et clients

- [ ] Refaire les listes, tableaux ou vues adaptées.
- [ ] Refaire recherche, tri, filtres et pagination si applicable.
- [ ] Refaire formulaires, drawers et dialogues.
- [ ] Préserver les étapes du pipeline et les statuts.
- [ ] Préserver les actions de contact et de relance.
- [ ] Préserver l'historique et les règles de conversion.
- [ ] Tester création, lecture, modification et suppression.

**Critère de validation :** parcours complets prospects et clients vérifiés sur données de test.

### Lot 5 — Commandes et ventes

- [ ] Refaire la liste des commandes et les filtres.
- [ ] Refaire le détail et la création de commande.
- [ ] Refaire les sélecteurs de produits et clients.
- [ ] Préserver les statuts, types, canaux et moyens de paiement.
- [ ] Préserver les calculs de livraison et de total.
- [ ] Préserver les règles de comptabilisation des ventes.
- [ ] Vérifier impression et documents générés.

**Critère de validation :** aucun écart dans les calculs ou les états de commande par rapport à la référence.

### Lot 6 — Projection et finances

- [ ] Refaire l'interface de projection.
- [ ] Préserver les formules et scénarios existants.
- [ ] Refaire le budget et ses filtres.
- [ ] Refaire les indicateurs de trésorerie.
- [ ] Préserver les tris, exports et impressions.
- [ ] Tester les cas limites des calculs financiers.

**Critère de validation :** résultats identiques à la référence pour les mêmes entrées de calcul.

### Lot 7 — Agenda, journal G4, profil et paramètres

- [ ] Refaire l'agenda et ses états.
- [ ] Refaire les rappels et tâches.
- [ ] Refaire le journal G4 et ses objectifs.
- [ ] Refaire le profil FBO.
- [ ] Refaire les paramètres et préférences.
- [ ] Unifier le changement de thème.
- [ ] Préserver sauvegarde, restauration et déconnexion.

**Critère de validation :** toutes les opérations et préférences restent persistantes et fonctionnelles.

### Lot 8 — Authentification et expérience de première utilisation

- [ ] Refaire connexion et inscription.
- [ ] Préserver l'authentification Google/Firebase.
- [ ] Vérifier les erreurs et états de chargement.
- [ ] Vérifier les redirections et routes protégées.
- [ ] Harmoniser les messages et états vides.
- [ ] Vérifier l'expérience sur smartphone.

**Critère de validation :** les parcours d'authentification existants restent opérationnels.

### Lot 9 — Qualité, responsive et PWA

- [ ] Tester les formats mobiles, tablettes et desktop.
- [ ] Tester clavier, focus, contrastes et libellés accessibles.
- [ ] Tester les états chargement, vide, erreur et succès.
- [ ] Tester le mode hors ligne.
- [ ] Tester la file et la reprise de synchronisation.
- [ ] Tester installation et mise à jour PWA.
- [ ] Tester sauvegarde et restauration.
- [ ] Tester impression et exports.
- [ ] Exécuter build et tests de non-régression.
- [ ] Vérifier les performances et le poids des bundles.

**Critère de validation :** aucune régression bloquante connue et validation explicite du propriétaire.

---

## 7. Stratégie de tests et de non-régression

### 7.1 Tests techniques

À chaque lot :

- Vérification TypeScript.
- Build de production.
- Lint et tests existants.
- Tests ciblés des composants modifiés.
- Vérification des erreurs console.
- Vérification des routes concernées.

### 7.2 Tests métier prioritaires

Les scénarios suivants doivent rester exacts :

- Calculs de commandes, totaux et frais de livraison.
- Calculs de marge, CC et projections.
- Statistiques clients et conversions.
- Comptabilisation des ventes par période.
- Entrées et sorties budgétaires.
- Persistance des données Firestore.
- Synchronisation en ligne / hors ligne.
- Sauvegarde et restauration.
- Authentification et autorisations.
- Impression des documents.

### 7.3 Tests responsive

Vérifier au minimum :

- Petit smartphone : largeur 320–375 px.
- Smartphone courant : largeur 390–430 px.
- Tablette : largeur 768–1024 px.
- Ordinateur : largeur 1280 px et plus.

Ces largeurs sont des repères de test, pas des limites rigides de conception.

---

## 8. Gestion des risques

| Risque | Mesure de prévention |
|---|---|
| Régression métier pendant la refonte | Séparer logique métier et présentation |
| Incompatibilité CSS UIArc / Tailwind | Tester la fondation dans un lot isolé |
| Dépendance UIArc Pro | Vérifier chaque composant avant adoption |
| Régression du thème | Identifier une source de vérité unique |
| Perte de données hors ligne | Tests de synchronisation et sauvegarde |
| Vues trop volumineuses | Refactoriser progressivement |
| Interface trop dense sur mobile | Adapter la structure, pas seulement réduire les tailles |
| Régression des impressions | Tests dédiés des documents générés |
| Modification involontaire de Firestore | Aucun changement de schéma sans validation |

---

## 9. Organisation du travail et règles Git

- Le présent fichier est la référence du plan de refonte.
- Lire et mettre à jour ce document au début et à la fin de chaque session de travail sur le projet.
- Avant tout changement : vérifier branche, commit et état du dépôt.
- Ne jamais écraser des modifications préexistantes de l'utilisateur.
- Faire des changements petits, isolés et vérifiables.
- Utiliser des messages de commit explicites.
- Ne pas fusionner dans `main` sans autorisation.
- Consigner dans ce fichier les lots terminés, les tests exécutés, les anomalies et les décisions.
- En cas de contradiction entre une hypothèse et le code réel, le code vérifié et les décisions explicites du propriétaire prévalent.

### Journal des décisions

| Date | Décision |
|---|---|
| 2026-11-12 | Direction artistique validée : Executive Business Intelligence |
| 2026-11-12 | Palette officielle : couleurs Yekola Business |
| 2026-11-12 | Densité d'interface : compacte |
| 2026-11-12 | UIArc retenu comme base de composants, sous réserve de vérification des dépendances et licences |
| 2026-11-12 | Refonte progressive ; préservation des fonctionnalités métier et de Firebase |
| 2026-11-12 | GitHub devient l'espace de travail distant sur `feat/lot-1-design-system` ; le propriétaire récupère les commits avec `git pull` |
| 2026-11-12 | Première passe visuelle du Dashboard publiée sur la branche feature, sans changement volontaire des calculs métier |


### Vérification locale du Dashboard et correctifs TypeScript — 2026-11-12

- [x] `npm run build` exécuté sur le poste du propriétaire : build Vite réussi en 36,70 s ; PWA générée avec 47 entrées précachées.
- [x] Les avertissements Vite concernent des imports à la fois statiques et dynamiques (Firebase/Firestore et slices) ainsi qu'un chunk principal minifié supérieur à 500 kB ; ils ne bloquent pas le build et ne sont pas modifiés dans ce correctif.
- [x] `npm run lint` (en réalité `tsc --noEmit`) a identifié 5 erreurs de typage : `BadgeProps` ne déclarait pas explicitement `className`/`children` selon les types JSX du projet ; `key` était refusé sur les props locales de `LabelPhase` et `MessageRow`.
- [x] Correctifs ciblés publiés sur `feat/lot-1-design-system` : déclaration explicite des props Badge et acceptation typée de `key` dans les deux composants internes animés. Aucun changement de logique métier.
- [x] Après récupération des correctifs, `npm run lint` (`tsc --noEmit`) s'est terminé sans aucune erreur.
- [x] Après récupération des correctifs, `npm run build` s'est terminé avec succès ; Vite a transformé 2 733 modules et généré la PWA (47 entrées précachées).
- [ ] Effectuer la validation visuelle et responsive du Dashboard sur le poste du propriétaire ; les avertissements Vite non bloquants restent à traiter dans un lot d'optimisation distinct.

### Journal d'avancement

| Lot | Statut | Notes |
|---|---|---|
| Audit statique initial | Effectué | Lecture du code distant ; pas encore de build/test local |
| Lot 0 — Préparation | Validé pour le socle et les contrôles locaux | Après correctifs : `npm run lint` réussi sans erreur et `npm run build` réussi ; avertissements Vite non bloquants sur imports mixtes et chunk principal > 500 kB consignés pour optimisation ultérieure |
| Lot 1 — Design system | En cours — intégration et TypeScript validés | Tokens Yekola et composants Arc UI intégrés ; `npm run lint` et `npm run build` réussis après corrections ; showcase, notice de licence consolidée et validation visuelle restent à terminer |
| Lot 2 — Shell et navigation | En cours — première passe visuelle publiée | Sidebar desktop, en-tête mobile, barre de navigation basse et zone de contenu compactés ; validation visuelle locale requise |
| Lot 3 — Dashboard | En cours — seconde passe Arc UI publiée | KPI remplacés par Arc MetricCard + AnimatedCounter ; densité, surfaces et grille mobile resserrées ; validation visuelle et fonctionnelle locale requise |
| Lot 4 — Prospects et clients | À faire | Gestion commerciale |
| Lot 5 — Commandes et ventes | À faire | Parcours de vente |
| Lot 6 — Projection et finances | À faire | Calculs et budget |
| Lot 7 — Agenda, G4, profil, paramètres | À faire | Fonctions de suivi |
| Lot 8 — Authentification | À faire | Firebase Auth |
| Lot 9 — Qualité et PWA | À faire | Non-régression et validation finale |

---

## 10. Définition de « terminé »

La refonte sera considérée comme terminée lorsque :

- L'ensemble des vues possède une identité cohérente Yekola Business.
- La densité compacte est lisible et maîtrisée sur desktop et mobile.
- Les thèmes clair et sombre sont cohérents.
- Les composants communs sont réutilisés plutôt que dupliqués.
- Les fonctionnalités existantes ont été conservées ou leurs changements validés.
- Les calculs métier ont passé les tests de non-régression.
- Firebase, Firestore, synchronisation hors ligne, sauvegardes et PWA fonctionnent.
- Les parcours critiques ont été testés.
- Le build de production est validé.
- Le propriétaire a effectué sa validation visuelle et fonctionnelle finale.

**État actuel au 2026-11-12 :** fondation UIArc, composants Arc gratuits et seconde passe visuelle du shell/Dashboard publiés sur `feat/lot-1-design-system`. Le build et le contrôle TypeScript de cette seconde passe restent à exécuter localement ; la validation visuelle mobile/desktop et fonctionnelle demeure en attente.


### Seconde passe visuelle — shell, navigation et Dashboard — 2026-11-12

**Motif :** le propriétaire a signalé que la première passe ressemblait encore trop à un template générique, avec des espacements excessifs et une expérience mobile insuffisamment pensée comme une application.

**Audit Arc UI / licence :**
- [x] Consultation de la documentation et du dépôt public Arc UI (`kuratlielia/arc-library`).
- [x] Vérification du registre : `metric-card`, `animated-counter`, `drawer` et `card` sont gratuits (MIT).
- [x] Vérification que le bloc Arc `sidebar` est Pro ; il n'est donc pas intégré. La sidebar applicative reste un composant local stylé, sans dépendance payante.
- [x] Aucun nouveau paquet npm ajouté ; `motion` est déjà présent dans le projet.

**Modifications publiées sur la branche feature :**
- [x] Ajout local des sources Arc `MetricCard` et `AnimatedCounter`, adaptées aux chemins et aux tokens déjà présents dans le projet. `MetricCard` accepte aussi `decimals` pour préserver l'affichage des CC à trois décimales.
- [x] Remplacement des quatre cartes KPI maison du Dashboard par `MetricCard`.
- [x] Recomposition de la grille KPI en quatre colonnes desktop, deux colonnes sur les écrans intermédiaires et petits écrans.
- [x] Réduction des rayons, ombres, hauteurs et espacements ; suppression de l'effet « grandes cartes flottantes ».
- [x] Refonte CSS du shell : sidebar plus étroite et plus dense, navigation active moins criarde, en-tête mobile compact, barre basse mobile plus proche d'une navigation native et contenu moins espacé.
- [x] Ajout de tokens de compatibilité Arc pour les surfaces.
- [x] Aucune modification volontaire des calculs, contrats de données, stores, routes ou services Firebase.
- [x] Nettoyage éditorial du Dashboard : suppression des emojis décoratifs et clarification du sous-titre pour un ton de logiciel de gestion.

**Validation restant à faire :**
- [ ] Le propriétaire doit récupérer la branche et exécuter `npm run lint` puis `npm run build`.
- [ ] Vérifier les captures à 390 px et desktop (idéalement 1440 px).
- [ ] Vérifier le comportement de la sidebar, du header, de la barre basse, des actions KPI et de l'édition des objectifs.
- [ ] Corriger les écarts révélés par les captures avant de considérer le lot 2/3 comme validé.

### Correctif du compteur animé après contrôle local — 2026-11-12

- [x] Retour local reçu : `npm run lint` (script `tsc --noEmit`) signalait deux erreurs TS2322 dans `animated-counter.tsx`, sur les props `key` passées aux composants internes `Glyph` et `Column`.
- [x] Cause isolée : les types de props locaux ne déclaraient pas explicitement le type spécial `React.Key`, alors que le typage JSX du projet le vérifiait dans ces appels.
- [x] Correctif ciblé publié sur `feat/lot-1-design-system` : import de `Key` depuis React et ajout de `key?: Key` aux types de props de `Glyph` et `Column`.
- [x] Aucun changement de rendu attendu, d'animation, de calcul ou de logique métier ; aucune dépendance ajoutée.
- [x] Le propriétaire a confirmé que `npm run build` réussit déjà sur sa copie locale. Les avertissements d'imports mixtes et de chunk principal supérieur à 500 kB restent non bloquants et hors de ce correctif.
- [ ] Récupérer le commit du correctif puis relancer `npm run lint` et `npm run build` pour confirmer le résultat sur le poste local.


### Validation locale confirmée — 2026-11-12

- [x] Le propriétaire a récupéré le correctif TypeScript des props `key` de `Glyph` et `Column`.
- [x] `npm run lint` exécuté localement après le pull : `tsc --noEmit` termine sans erreur.
- [x] `npm run build` exécuté localement après le pull : Vite termine avec succès (2 738 modules transformés) et la PWA est générée avec 46 entrées précachées.
- [x] Les avertissements non bloquants sur les imports mixtes Firebase/Firestore/stores et le chunk principal d'environ 1 044 kB sont consignés comme dette d'optimisation distincte.
- [x] Inspection statique complémentaire du shell : les sélecteurs de sidebar, header et navigation basse correspondent aux identifiants réellement présents dans le DOM.
- [x] Correction CSS préventive publiée : suppression d'une règle de marge verticale générique qui aurait pu se cumuler avec la classe Tailwind `space-y-6` du conteneur Dashboard.
- [ ] La validation visuelle réelle sur desktop et mobile reste à effectuer par le propriétaire ; aucune capture ni exécution navigateur distante n'est disponible pour ce contrôle.

**État corrigé au 2026-11-12 :** contrôle TypeScript et build de production validés localement après récupération du correctif compteur. Le shell et le Dashboard restent en attente de validation visuelle/fonctionnelle. Le lot design n'est pas déclaré terminé.


### Lot CRM — première passe visuelle Prospects / Clients — 2026-11-12

- [x] Inspection des vues et de leurs interactions avant modification.
- [x] Identification des contrats métier à préserver : filtres de pipeline, recherche, création, changement d'étape, conversion prospect-client, suppression confirmée, liens téléphone/WhatsApp ; côté clients, tri mémorisé, classement VIP, calculs de commandes validées, période mensuelle, export PDF, notes et historique.
- [x] Ajout d'une feuille CSS dédiée et partagée `ProspectsClients.css`, limitée aux conteneurs `#prospects_view_container` et `#clients_view_container`.
- [x] Première passe de densification : en-têtes plus nets, actions compactes, champs de recherche cohérents avec les tokens, listes plus serrées, surfaces moins arrondies et responsive mobile.
- [x] Aucun changement apporté aux fonctions métier, aux stores, aux données Firestore, aux filtres, au tri, aux exports, aux liens d'action ou aux drawers.
- [x] Aucun nouveau paquet npm.
- [ ] Contrôle local `npm run lint` et `npm run build` après récupération.
- [ ] Validation visuelle et fonctionnelle des deux vues sur mobile et desktop ; aucun rendu navigateur n'a été prétendu ou validé à distance.

**Statut :** première passe CSS publiée sur la branche feature ; lot CRM non validé tant que les contrôles locaux et la revue visuelle n'ont pas été effectués.


### Réorientation artistique — refonte franche demandée par le propriétaire — 2026-11-12

**Décision prioritaire :** les premières passes CSS de densification sont jugées insuffisantes. La suite du projet doit être traitée comme une refonte visuelle réelle, et non comme un ajustement cosmétique de l'interface existante.

- [x] Consigne confirmée : liberté complète sur la présentation, la composition, la hiérarchie et les composants visuels.
- [x] Référence d'expérience : interfaces natives iOS — sobres, calmes, lisibles, bien organisées et adaptées au tactile, sans copier littéralement iOS.
- [x] Espacements : réduire les marges/paddings inutiles tout en conservant une respiration régulière et une hiérarchie claire.
- [x] Charte Yekola Business obligatoire : or `#F9A825`, orange `#FF6A1A`, terracotta `#C1440E`, ivoire `#FFF9F3`, dégradé réservé aux accents.
- [x] Le responsive doit adapter la composition mobile et desktop ; il ne suffit plus de conserver le même écran en réduisant les dimensions.
- [x] Préservation stricte des règles métier, calculs, données, stores, routes, services Firebase, synchronisation, PWA, sauvegardes, exports et impressions.
- [ ] Refaire entièrement le Dashboard, y compris les zones inférieures et un véritable aperçu « Commandes récentes ».
- [ ] Refaire réellement les vues Prospects et Clients (structure, hiérarchie et composants), au-delà d'une simple feuille CSS de densification.
- [ ] Étendre ensuite la même direction artistique aux autres vues métier, lot par lot.
- [ ] Valider TypeScript/build et les parcours sur le poste local après chaque lot ; aucune validation visuelle locale ne sera prétendue à distance.

**Travail publié dans cette session :** refonte visuelle de la feuille CSS du Dashboard et ajout d'une section de consultation des cinq commandes les plus récentes. Le tri est limité à l'affichage ; aucune donnée n'est modifiée. Les autres calculs et interactions du Dashboard sont conservés.

**Statut :** première étape de la nouvelle direction publiée sur la branche feature ; contrôles locaux et revue responsive restent à faire.


### Refonte CRM — structure des vues Prospects / Clients — 2026-11-12

- [x] Ajout de classes structurelles explicites aux en-têtes, barres de recherche, filtres pipeline, sélecteur de période, synthèse VIP et listes.
- [x] Refonte complète de la feuille CSS partagée : hiérarchie des titres, actions Yekola, filtres, surfaces, cartes, avatars, boutons de contact et adaptation mobile.
- [x] Suppression de l'ancienne approche de simples surcharges CSS successives ; la feuille CRM devient une feuille cohérente et unique.
- [x] Libellés accessibles ajoutés aux boutons d'ajout dont le texte visuel est masqué sur petit écran.
- [x] Préservation des fonctions existantes : recherche, filtre pipeline, création, édition via drawer, suppression confirmée, conversion prospect-client, téléphone/WhatsApp/e-mail, tri mémorisé, classement VIP, période, calculs de commandes, PDF, notes, historique et commande préremplie.
- [ ] Exécuter `npm run lint` et `npm run build` après récupération.
- [ ] Vérifier les vues sur petit mobile, smartphone standard et desktop ; la validation visuelle locale n'est pas disponible à distance.

**Statut :** refonte structurelle et visuelle publiée sur la branche feature ; validation technique et visuelle locale en attente.


### Ajustement de densité du Dashboard — 2026-11-12

- [x] Réduction des espacements entre le graphique, le panneau G4 et les activités récentes, y compris sur desktop.
- [x] Harmonisation de la séparation entre les sections inférieures et les commandes récentes.
- [x] Contrôle statique de `orderAccountingDate` : le tri de l'aperçu s'appuie sur la date comptable existante (date de validation pour les commandes comptabilisées, date de création sinon), sans changer les règles de calcul.


### Résultats de validation locale — branche feat/lot-1-design-system — 2026-11-12

- [x] `git pull origin feat/lot-1-design-system` effectué en fast-forward jusqu'au commit `4f7cc77`.
- [x] `npm run lint` exécuté localement : `tsc --noEmit` passe sans erreur.
- [x] `npm run build` exécuté localement : Vite 6.4.6 compile 2 739 modules et termine avec succès.
- [x] Génération PWA réussie : 47 ressources précachées.
- [ ] Les avertissements d'imports statiques/dynamiques mixtes et le bundle principal d'environ 1 044 Ko restent à traiter dans un lot performance séparé ; ils ne bloquent pas ce build.

### Lot Commandes — première passe de refonte visuelle — 2026-11-12

- [x] Structure visuelle identifiée : en-tête, filtres de statut, registre, tri, exports CSV/PDF, liste de commandes, drawer de création/détail, facture imprimable.
- [x] Ajout de classes de présentation explicites à l'en-tête, aux filtres, à la barre d'outils et aux cartes de commande.
- [x] Nouvelle feuille de style dédiée : surfaces neutres, accent terracotta pour l'action principale, jaune/or Yekola en accent, listes compactes, adaptation mobile.
- [x] Conservation du drawer de création et de détail, des actions de validation/modification/suppression, du tri, des filtres, des exports, de l'impression et du partage.
- [x] Bouton de création doté d'un nom accessible explicite, y compris lorsque son libellé visuel est masqué sur mobile.
- [ ] Validation locale `npm run lint` / `npm run build` après récupération.
- [ ] Contrôle visuel desktop et mobile à réaliser sur l'application exécutée.

### Cahier des charges UI/UX approuvé — 2026-11-12

Le propriétaire a transmis et validé une spécification détaillée couvrant le système commun, le Dashboard, les Clients, les Commandes et les Ventes.

**Principes de conception retenus :**
- Navigation responsive différenciée : sidebar desktop, rail tablette, tab bar mobile avec action centrale.
- Interface dense, structurée et orientée action ; les changements de couleur seuls ne constituent plus une refonte acceptable.
- Montants et chiffres alignés, chiffres tabulaires, tableaux compacts, filtres et actions contextuelles.
- Palette Yekola Business conservée ; le dégradé or-orange est réservé aux accents et éléments de marque.
- Icônes Lucide cohérentes, rayon maîtrisé, bordures fines et ombres minimales.
- Les compositions mobile doivent être spécifiques au mobile, pas des réductions de la vue desktop.

**Décision de séparation Commandes / Ventes :**
- La navigation et l'architecture visuelle distingueront les deux rubriques.
- La vue Commandes conservera les statuts et les règles de calcul déjà définis dans `Order`.
- La vue Ventes pourra présenter une lecture commerciale dérivée des commandes comptabilisées et des montants déjà présents.
- Le modèle actuel ne contient pas de registre de transactions/encaissements indépendant. Il ne faut donc pas simuler un historique de paiements, des règlements partiels ou des ventes comptoir comme s'ils étaient persistés. Toute création d'un véritable modèle de transaction et toute évolution Firestore/règles de sécurité feront l'objet d'un lot métier distinct et d'une validation explicite.

**Limites de données relevées pendant l'audit :**
- `Customer` contient nom, téléphone, e-mail, ville, adresse, statut Prospect/Client, notes et date de dernier contact. Il ne contient pas de distributeur référent, d'étiquettes libres, de statut Actif/Inactif ou de solde client calculé.
- Les commandes possèdent `amountPaid?`, `paiement`, `status`, `totalRetail` et `validatedAt?`, mais aucun journal des mouvements de paiement.
- Les fonctions d'import client, fusion de doublons, actions groupées annulables et scan de code-barres ne sont pas présentes dans les contrats et composants vérifiés. Ne pas afficher de commandes d'interface qui laisseraient croire que ces fonctions existent déjà.
- Les vues enregistrées réellement livrées doivent s'appuyer sur des critères calculables avec les données existantes ; les vues « Impayés » et « À relancer » nécessitent des règles métier à confirmer.

### Lot Clients — première refonte structurelle — 2026-11-12

**Modifications publiées sur `feat/lot-1-design-system` :**
- [x] Remplacement de la liste desktop en cartes par un tableau de portefeuille avec colonnes Client, Ville, Dernier achat, Segment, CA cumulé et Volume CC.
- [x] Présentation mobile dédiée en lignes compactes avec identité, dernier achat et montants.
- [x] Ajout de vues rapides Tous, VIP et Sans achat, calculées à partir des données existantes.
- [x] Recherche étendue à la ville en plus du nom, téléphone et adresse.
- [x] Conservation du tri existant, du calcul VIP, du rapport PDF VIP, des notes, de l'historique, des commandes liées et des liens d'appel/WhatsApp.
- [x] Ajout d'une variante de Drawer latéral pour les fiches client : panneau à droite sur tablette/desktop et feuille basse sur smartphone.
- [x] Nouveau monogramme produit FC et wordmark Forever CashFlow dans la sidebar, en SVG inline ; les icônes PWA, favicon et icônes d'installation existantes ne sont pas modifiées.
- [x] Aucun changement aux types Customer/Order, stores, calculs, Firestore, routes ou dépendances.
- [ ] Vérification locale `npm run lint` et `npm run build` après récupération.
- [ ] Validation visuelle réelle du tableau desktop, des cartes mobiles et du Drawer sur les appareils ciblés.

**Contrôle statique complémentaire :**
- [x] La déclaration du filtre VIP a été replacée avant son utilisation pour éviter une référence à une constante non initialisée.
- [x] Le Drawer conserve son comportement modal par défaut pour tous les autres écrans ; seule la fiche client demande explicitement la variante latérale.

**Prochaine séquence :**
1. Revoir la navigation commune pour refléter les rubriques Accueil, Clients, Commandes et Ventes, tout en conservant l'accès aux Prospects, au Journal G4, aux Rapports, au Budget, à l'Agenda et aux Paramètres.
2. Repenser Commandes avec les statuts réellement supportés par `OrderStatut`; un Kanban ne doit pas inventer des états non présents.
3. Créer la vue Ventes distincte comme lecture dérivée des commandes comptabilisées, puis définir séparément le besoin d'un vrai registre de transactions avant toute modification du modèle métier.
4. Reprendre le Dashboard selon la composition détaillée du cahier des charges et les champs réellement disponibles.

### Validation locale communiquée — commit `3c00ce6`

Le propriétaire a exécuté après récupération :
- `npm run lint` : réussi, aucune erreur TypeScript.
- `npm run build` : réussi, Vite 6.4.6, 2 741 modules transformés.
- PWA : `generateSW` réussi, 48 ressources précachées.
- Avertissements toujours présents : imports dynamiques/statistiques mélangés pour Firebase, slices Zustand et `postPurchaseService`, ainsi que bundle principal supérieur à 500 kB. Ces sujets restent isolés dans un futur lot performance/synchronisation.

Un incident Windows a toutefois été signalé pendant le pull : Git n'a pas réussi à supprimer un ancien couple de fichiers pack `.idx/.pack` dans `.git/objects/pack` (fichier verrouillé). Le pull a ensuite affiché un fast-forward et les tests ont été exécutés, mais l'intégrité complète du dépôt local doit être contrôlée avant le prochain pull. Ne pas supprimer manuellement les fichiers pack.

### Lot Navigation + Commandes + Ventes — 2026-11-12

**Navigation publiée sur `feat/lot-1-design-system` :**
- [x] Navigation principale desktop organisée autour de quatre espaces : Accueil, Clients, Commandes, Ventes.
- [x] Navigation secondaire conservée : Prospects, Projection, Budget, Agenda et Journal G4.
- [x] Rail tablette de 64 px avec icônes et infobulles.
- [x] Barre mobile à quatre destinations et action centrale ouvrant une feuille d'actions.
- [x] Actions mobiles réellement connectées aux formulaires existants : Nouveau client et Nouvelle commande.
- [x] Accès mobile à la lecture Ventes et au suivi des commandes/règlements.
- [x] Topbar commune affichée sur toutes les tailles d'écran ; titre de page contextualisé.
- [ ] Recherche globale clavier `⌘K` non implémentée dans ce lot.
- [x] Sidebar desktop repliable de 232 px à 64 px, avec icônes seules et infobulles ; bloc utilisateur déplacé en pied de sidebar.

**Rubrique Ventes :**
- [x] Nouvelle route protégée `/sales` et vue dédiée.
- [x] Périodes 7 jours, 30 jours, 90 jours et année.
- [x] KPI dérivés des commandes comptabilisées : CA catalogue, montant encaissé déclaré, écart catalogue/encaissé et panier moyen catalogue.
- [x] Tableau de commandes comptabilisées avec recherche et export CSV.
- [x] Analyse compacte du CA quotidien sur 7 jours et répartition des modes de paiement.
- [x] Composition responsive desktop/tablette/mobile.
- [x] Avertissement visible : la vue est dérivée des commandes et ne constitue pas un journal indépendant des transactions.

- [x] L'écart catalogue/encaissé est explicitement présenté comme un écart de valeur, jamais comme une dette client : le modèle actuel ne permet pas de distinguer une remise commerciale d'un solde restant dû.
- [ ] Aucun modèle de transaction, mouvement de caisse, vente comptoir ou journal de paiement créé ; ces évolutions exigent un lot métier séparé.

**Rubrique Commandes :**
- [x] Séparation explicite de l'intitulé Commandes par rapport à la rubrique Ventes.
- [x] Filtres et compteurs sur tous les statuts réellement présents dans `OrderStatut` : en attente, validée, payée, livrée, annulée, retour et remplacement.
- [x] Bascule Liste / Kanban.
- [x] Kanban en colonnes horizontales utilisant les statuts existants ; ouverture du détail au clic.
- [x] Conservation des formulaires, calculs, exports, factures, détails, synchronisation et transitions existantes.
- [ ] Glisser-déposer et changement de statut inline non implémentés ; le Kanban actuel est une vue de lecture/accès au détail, sans action métier supplémentaire.
- [ ] Validation locale `npm run lint` et `npm run build` après récupération de ces nouveaux commits.
- [ ] Validation visuelle réelle desktop/tablette/mobile.

**Prochaine étape :**
1. Faire contrôler le dépôt Git local Windows avant récupération des nouveaux commits.
2. Faire valider localement ce lot Navigation + Commandes + Ventes.
3. Reprendre le Dashboard pour appliquer la composition opérationnelle demandée, puis poursuivre les écrans Budget/Agenda et les autres vues.

### Validation locale et correctif de cohérence des statuts — 2026-11-12

**Validation confirmée par le propriétaire sur le commit `ff3a2383a45bed6cf3b7e302fa1149270ec9655e` :**
- [x] `npm run lint` : `tsc --noEmit` termine sans erreur.
- [x] `npm run build` : Vite 6.4.6 compile 2 743 modules et termine avec succès en 21,85 s.
- [x] Génération PWA réussie : 48 entrées précachées, service worker et Workbox générés.
- [x] Les avertissements d'imports statiques/dynamiques mixtes restent non bloquants.
- [x] Le bundle principal de 1 050,80 kB minifié (285,11 kB gzip) dépasse le seuil Vite de 500 kB ; optimisation reportée à un lot performance dédié.

**Correctif UI publié après cette validation :**
- [x] Inspection des statuts réels de commande dans `src/types.ts` : `PENDING`, `VALIDATED`, `PAYE`, `LIVRE`, `CANCELLED`, `RETOUR`, `REMPLACEMENT`.
- [x] Correction du Dashboard : les activités récentes et la liste des commandes récentes affichent désormais le libellé correspondant à chacun des sept statuts.
- [x] Ajout de tons visuels dédiés pour « Livrée », « Retour » et « Remplacement ».
- [x] Aucun changement aux données, aux calculs, aux règles de comptabilisation ou aux transitions de statut.
- [ ] Récupérer les commits de ce correctif puis relancer `npm run lint` et `npm run build`.
- [ ] Validation visuelle responsive du Dashboard, des Clients, des Commandes et des Ventes.

**État de validation à ne pas confondre :** le commit `ff3a238` est validé localement par le propriétaire. Les commits de correction publiés après `ff3a238` n'ont pas encore été exécutés localement ; ils restent à valider après récupération.

**Prochaine étape :** poursuivre l'audit visuel et fonctionnel des vues CRM et du Dashboard sans toucher à la logique métier, puis valider chaque lot sur le poste local.


### Lot Prospects + Projection — première refonte structurelle — 2026-11-12

- [x] Ajout d'une vue synthétique du pipeline Prospects avec compteurs par étape, calculés à partir des prospects existants.
- [x] Chaque étape du pipeline permet d'activer/désactiver le filtre correspondant ; aucun nouveau statut ni champ métier n'est introduit.
- [x] Présentation horizontale compacte sur desktop et défilement horizontal adapté au tactile sur mobile.
- [x] Harmonisation de la hiérarchie de la page Projection : en-tête, zone de configuration et panneau de résultats, avec densité et rayons cohérents.
- [x] Conservation des algorithmes de marge, CC, sélection des packs, catalogue produits, partage et copie.
- [ ] Validation locale TypeScript/build et contrôle visuel responsive après récupération.


### Lot Budget + Agenda + Journal G4 — première refonte visuelle — 2026-11-12

- [x] Budget : hiérarchie resserrée entre en-tête, synthèse des entrées/sorties/bénéfice, ventilation des dépenses et registre des mouvements.
- [x] Budget : tableaux de bord et lignes de mouvements adaptés aux surfaces et à la densité de la charte Yekola ; export CSV, impression, tri et formulaires conservés.
- [x] Agenda : hiérarchie en-tête/priorités/échéances clarifiée ; cartes de tâches compactes, lisibles et accessibles au tactile.
- [x] Agenda : conservation du tri chronologique, de la complétion, suppression avec confirmation, contact lié et formulaire existants.
- [x] Journal G4 : onglets de période, sélecteur de date, score, habitudes et compteurs harmonisés ; logique de progression et calculs inchangés.
- [x] Projection : feuille de style dédiée ajoutée pour clarifier la hiérarchie entre paramètres et matrice de résultats.
- [ ] Validation locale TypeScript/build et contrôle visuel responsive après récupération.
