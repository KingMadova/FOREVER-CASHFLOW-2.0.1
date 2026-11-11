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

### Journal d'avancement

| Lot | Statut | Notes |
|---|---|---|
| Audit statique initial | Effectué | Lecture du code distant ; pas encore de build/test local |
| Lot 0 — Préparation | À faire | Établir la référence exécutable |
| Lot 1 — Design system | À faire | UIArc, tokens, thèmes, composants |
| Lot 2 — Shell et navigation | À faire | Desktop et mobile |
| Lot 3 — Dashboard | À faire | Poste de pilotage |
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

**État actuel : plan créé ; aucune refonte du code applicatif n'a encore commencé.**
