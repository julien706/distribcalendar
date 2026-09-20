# Années de distribution, montants collectés, tournées et suivi des calendriers

Ajout d'un volet « campagne » à l'application : une année de distribution active, les montants encaissés lors du passage d'une adresse en « fait », des tournées d'équipe pouvant durer plusieurs jours, et le suivi par l'admin des calendriers remis/restitués et de l'argent reversé.

## 1. Année de distribution

- Nouvel espace « Années » dans l'administration : créer une année (nom, année, date de début), la rendre active, la clôturer.
- Une seule année active à la fois. Tout ce qui est enregistré (montants, tournées, stock, versements) est rattaché à l'année active.
- Les adresses, zones et équipes restent communes à toutes les années — rien n'est dupliqué.
- Un sélecteur d'année dans les statistiques et le journal permet de consulter les années passées.
- Bouton optionnel, avec confirmation, pour remettre toutes les adresses en « en attente » au démarrage d'une nouvelle année.

## 2. Montant reçu pour un calendrier

- Dans le popup d'une adresse (et de chaque appartement d'immeuble), quand on passe le statut en « fait », un champ montant facultatif apparaît : on peut valider sans rien saisir.
- Saisie rapide avec des montants suggérés (5, 10, 15, 20 €) plus un champ libre.
- Le montant est rattaché à l'année active, à la tournée en cours s'il y en a une, et à la personne qui l'a saisi.
- Le montant reste modifiable ensuite depuis le popup et depuis la liste.

## 3. Tournées d'équipe

- Bouton « Démarrer une tournée » sur la carte : on choisit l'équipe, la tournée s'ouvre et reste ouverte tant qu'on ne l'arrête pas, même sur plusieurs jours.
- Pendant la tournée : bandeau permanent affichant la durée, le nombre d'adresses faites et le total encaissé en direct.
- « Arrêter la tournée » ouvre un récapitulatif : total calculé, nombre d'adresses faites, et un champ « montant réellement compté » pour corriger l'écart, avec une note explicative.
- Historique des tournées consultable dans l'administration : équipe, dates de début/fin, total calculé, total corrigé, écart.
- Plusieurs membres d'une même équipe peuvent contribuer à la tournée ouverte de leur équipe.

## 4. Calendriers et versements (saisie par l'admin)

Nouvel onglet « Calendriers & caisse » dans l'administration, pour l'année active :

- Ligne par distributeur et par équipe : calendriers remis, calendriers restitués, calendriers écoulés (calculé), montant encaissé (calculé depuis les adresses), montant déjà reversé, reste à reverser.
- Enregistrement des remises de calendriers (date, quantité, bénéficiaire) et des restitutions.
- Enregistrement des versements d'argent en une ou plusieurs fois (date, montant, moyen, commentaire) ; le solde se met à jour à chaque versement.
- Totaux généraux en haut : calendriers en circulation, argent collecté, argent encaissé par l'admin, reste dû.

## 5. Statistiques

- Ajout du montant total collecté, du montant moyen par calendrier et du taux de dons, filtrables par année, zone et équipe, en complément des compteurs existants.

## Détails techniques

Nouvelles tables (avec RLS et GRANT) :
- `campaigns` : année, libellé, dates, indicateur d'année active (une seule active).
- `donations` : adresse ou appartement, campagne, tournée, montant, utilisateur, date. Un enregistrement par passage en « fait » avec montant.
- `rounds` (tournées) : équipe, campagne, démarrée par, début, fin, total calculé, total corrigé, note d'écart.
- `calendar_stocks` : campagne, distributeur ou équipe, type (remise/restitution), quantité, date, saisi par.
- `payments` : campagne, distributeur ou équipe, montant, date, moyen, commentaire, saisi par.

Règles d'accès : lecture des montants et tournées limitée à l'équipe de l'utilisateur ; stock et versements en écriture pour les admins seulement, en lecture pour le distributeur concerné ; admin en accès total.

Agrégats calculés par fonctions SQL `security definer` (totaux par tournée, par distributeur, par campagne) plutôt que côté navigateur, pour rester rapide sur les 3 525 adresses.

Interface : nouveaux composants `CampaignManagement`, `RoundBanner`, `EndRoundDialog`, `CalendarStockView`, et extension de `MapPopup`, `BuildingPopup`, `StatisticsView` et `Admin`.

## Ordre de réalisation proposé

1. Années de distribution + sélecteur.
2. Montant à la validation d'une adresse.
3. Tournées d'équipe avec démarrage/arrêt et montant corrigé.
4. Calendriers & caisse dans l'administration.
5. Statistiques financières.
