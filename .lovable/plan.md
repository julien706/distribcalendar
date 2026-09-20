# Propositions d'améliorations et d'optimisations

Analyse faite sur les données réelles (3 525 adresses, 2 immeubles, 10 appartements, 2 368 adresses sans zone) et sur le code des écrans.

## 1. Bug confirmé : les chiffres des statistiques sont faux

Le serveur ne renvoie que 1 000 lignes maximum par requête. Vérifié : une demande de toutes les adresses renvoie 1 000 résultats sur 3 525.

L'écran Statistiques et le total affiché en haut de la liste utilisent une requête sans découpage, donc ils comptent au mieux 1 000 adresses sur 3 525. La carte et la liste, elles, chargent bien par paquets et sont correctes.

Correction : charger les adresses et les appartements par paquets de 1 000 jusqu'au bout, comme le fait déjà la carte.

Priorité : haute. C'est la seule anomalie fonctionnelle trouvée.

## 2. Vitesse de chargement

- Aujourd'hui, chaque écran (carte, liste, statistiques) recharge sa propre copie des 3 525 adresses. Mutualiser un seul chargement partagé évite de tout retélécharger en changeant d'onglet.
- Pour les statistiques, faire calculer les compteurs par le serveur plutôt que de rapatrier toutes les lignes : réponse quasi instantanée au lieu de 4 allers-retours.
- Ne demander que les colonnes utiles pour la carte (aujourd'hui tout est rapatrié, y compris les données brutes d'import qui ne servent pas à l'affichage).

## 3. Fiabilité sur le terrain

- Mode hors connexion réel : mémoriser les changements de statut faits sans réseau et les envoyer automatiquement au retour du signal. Aujourd'hui une validation sans réseau est perdue.
- Confirmation visuelle immédiate lors d'un changement de statut, avec retour en arrière si l'enregistrement échoue.
- Avertissement quand deux distributeurs modifient la même adresse en même temps.

## 4. Confort d'utilisation

- Compteur de progression du jour (adresses faites aujourd'hui) visible sur la carte.
- Recherche d'adresse directement depuis la carte, avec recentrage sur le résultat.
- Regroupement par rue dans la liste, pour suivre une rue complète d'un coup d'œil.
- Export des statistiques en fichier tableur pour un suivi hors application.

## 5. Administration

- 2 368 adresses ne sont rattachées à aucune zone : elles sont invisibles pour les distributeurs. Ajouter dans l'espace admin un indicateur du nombre d'adresses non rattachées et un bouton de réattribution automatique.
- Suppression en masse d'adresses depuis la liste admin (actuellement une par une).
- Historique visible par adresse depuis son popup, pas seulement dans le journal global.

## 6. Qualité du code

- L'écran carte fait 1 574 lignes et l'espace admin 739 : les découper en morceaux plus petits facilite les évolutions et réduit les régressions.
- Retirer les messages de débogage laissés dans la carte.
- Centraliser les accès aux données dans des hooks réutilisables plutôt que de refaire les mêmes requêtes dans chaque composant.

## Ce que je propose de faire en premier

1. Corriger les chiffres des statistiques (point 1).
2. Ajouter l'indicateur et la réattribution des adresses sans zone (point 5).
3. Accélérer les statistiques par un calcul côté serveur (point 2).

Dites-moi lesquels vous voulez, dans l'ordre que vous préférez, et je détaille la mise en œuvre.

## Détails techniques

- Limite PostgREST `max-rows` = 1000 ; `useAddressesWithApartments` fait deux `select` sans `.range()`, contrairement à `AddressList` et `MapView` qui paginent par lots.
- Calcul serveur : fonction SQL `security definer` renvoyant les compteurs par statut avec les appartements comptés individuellement (option A déjà retenue), filtrable par zone/équipe.
- Hors ligne : file d'attente locale (IndexedDB) rejouée à la reconnexion, PWA déjà en place via `vite-plugin-pwa`.
