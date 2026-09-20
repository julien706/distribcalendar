# Cahier des charges — Distribution Calendriers

Objectif : produire un document de cahier des charges complet de l'application, exploitable pour une reprise, un audit ou un portage vers un autre outil.

## Livrable

Un fichier `CAHIER-DES-CHARGES.md` à la racine du projet, rédigé en français, structuré ainsi :

1. **Contexte et objectifs** — gestion de distribution de calendriers en porte-à-porte, usage mobile terrain, PWA installable.
2. **Utilisateurs et rôles** — administrateur, chef d'équipe, distributeur ; périmètre de visibilité de chacun (équipes → zones → adresses).
3. **Exigences fonctionnelles**, par module :
   - Authentification et inscription par code d'invitation, activation des comptes par un admin.
   - Carte interactive : marqueurs par statut, regroupement, filtres, fond de carte, suivi GPS continu, ajout et déplacement d'adresses.
   - Adresses : création, édition, suppression, statuts (7 valeurs), observations, ouverture d'un itinéraire externe.
   - Immeubles et appartements : conversion adresse ↔ immeuble, gestion des appartements (nom, statut, observations), statut d'immeuble calculé, comptage des appartements dans les totaux.
   - Zones : dessin au lasso, couleur, équipe rattachée, affectation automatique des adresses contenues, édition et suppression.
   - Équipes et membres.
   - Liste des adresses : recherche, tri, filtres, appartements affichés comme lignes distinctes.
   - Optimiseur de tournée et mode distribution rapide.
   - Administration : utilisateurs, rôles, codes d'invitation, statistiques filtrables par zone/équipe/statut, journal des changements, import CSV avec mapping de colonnes.
4. **Règles de gestion** — calcul du statut d'immeuble, comptage des appartements dans le total, affectation géographique automatique, journalisation des changements de statut.
5. **Exigences non fonctionnelles** — mobile-first, interface en français, hors-ligne/PWA, performances (lots de 300 pour les mises à jour de masse), sécurité et confidentialité des données.
6. **Modèle de données** — tables, colonnes, relations, énumérations, avec un schéma récapitulatif.
7. **Sécurité et droits d'accès** — principe des règles de lecture/écriture par rôle et par zone, rôle stocké dans une table dédiée.
8. **Traitements serveur** — validation du code d'invitation, actions administrateur sur les comptes.
9. **Contraintes techniques** — technologies utilisées, cartographie, import CSV, points de vigilance pour un portage.
10. **Annexes** — liste des écrans, liste des statuts et leurs couleurs, glossaire.

## Détails techniques

- Le contenu sera vérifié par lecture du code existant (écrans, composants, hooks) et du schéma de base, afin que chaque exigence décrite corresponde à une fonctionnalité réellement présente.
- Aucune modification du code applicatif : seul le fichier de documentation sera ajouté.
- Option possible sur demande : ajouter en annexe le schéma SQL consolidé prêt à réutiliser ailleurs.
