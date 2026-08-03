# Spécification complète — Distribution Calendriers

Application web (mobile-first) de gestion de distribution de calendriers en porte-à-porte : carte interactive, adresses, immeubles/appartements, zones dessinées, équipes, statistiques et import CSV.

## Stack actuelle

- Front : React 18 + Vite 5 + TypeScript, Tailwind CSS 3, shadcn/ui (Radix), React Router 6, TanStack Query, sonner (toasts), recharts (graphiques), zod + react-hook-form, vite-plugin-pwa.
- Carte : Leaflet 1.9 + leaflet-draw (dessin de zones) + leaflet.markercluster (regroupement de marqueurs), fond de carte OSM.
- CSV : papaparse.
- Backend : Supabase (Postgres + Auth email/mot de passe + RLS + Edge Functions Deno).

## Modèle de données (Postgres)

Enums :
- `app_role` : `admin` | `team_leader` | `distributor`
- `distribution_status` : `pending`, `done`, `retry_first`, `retry_second`, `refused`, `uninhabited`, `no_answer`

Tables :
- `addresses` : id, street_name, street_number, city, latitude, longitude, status (distribution_status), observations, is_building, building_name, apartment_count, is_even (côté pair/impair), zone_id → zones, csv_data (jsonb brut de l'import), last_visit_date, created_at, updated_at.
- `apartments` : id, address_id → addresses, name, status, observations, created_at, updated_at. (Un immeuble = une adresse `is_building` + N appartements.)
- `address_status_history` : id, address_id, old_status, new_status, old_observations, new_observations, changed_at. (Journal alimenté par trigger sur `addresses`.)
- `zones` : id, name, color, boundary_coordinates (jsonb : tableau de `[lng, lat]`), team_id → teams, timestamps.
- `teams` : id, name, description, color, timestamps.
- `team_members` : id, team_id, user_id, role (texte), joined_at.
- `profiles` : id (= auth user id), email, is_active, timestamps. Créé par trigger `on_auth_user_created`.
- `user_roles` : id, user_id, role (app_role) — table séparée obligatoire, jamais de rôle dans `profiles`.
- `invitation_codes` : id, code, is_active, timestamps. Code exigé à l'inscription.

Fonctions SQL (security definer) :
- `has_role(_user_id, _role) → boolean` — base de toutes les policies RLS.
- `get_user_team_ids(_user_id) → uuid[]`, `get_user_zone_ids(_user_id) → uuid[]` — périmètre visible d'un distributeur.
- `point_in_polygon(lat, lon, coords jsonb) → boolean` — ray casting côté SQL.
- `assign_addresses_to_zone(_zone_id, _address_ids[])` — affectation en masse.
- `backfill_zone_assignments() → int` — recalcule les zone_id de toutes les adresses.
- `calculate_building_status(_address_id) → distribution_status` — statut agrégé d'un immeuble à partir de ses appartements.
- `get_zone_stats(_zone_id)` — total + compteur par statut.

RLS (principes) : lecture des adresses limitée aux zones des équipes de l'utilisateur ; admin = accès total ; mise à jour du statut autorisée aux membres de l'équipe propriétaire de la zone ; `user_roles` lisible par l'utilisateur, écrit par admin uniquement. Ne pas oublier les GRANT (`authenticated`, `service_role`) sur chaque table.

## Écrans et fonctionnalités

**/auth** — inscription (email + mot de passe + code d'invitation validé par l'Edge Function `validate-invitation`) et connexion. `/login` redirige vers `/auth`.

**/** (Index) — en-tête + deux onglets, garde d'authentification (redirection vers /auth) :
- Onglet Carte (`MapView`, le cœur de l'app, ~1500 lignes) :
  - marqueurs colorés par statut avec clustering, popup riche (`MapPopup`) : changement de statut en un tap, observations, ouverture Waze/Google Maps, édition/suppression, conversion adresse ↔ immeuble.
  - filtre par statut (`StatusFilter`), affichage des zones en polygones colorés, géolocalisation temps réel, recentrage, changement de fond de carte.
  - outil lasso / dessin de polygone (leaflet-draw) → création de zone (`CreateZoneDialog`) : nom, couleur, équipe, puis affectation automatique par chunks de 300 des adresses contenues dans le polygone ; édition/suppression de zone (`EditZoneDialog`).
  - ajout manuel d'une adresse par clic sur la carte (`AddAddressDialog`, `EditManualAddressDialog`).
  - immeubles : dialogue de gestion des appartements (`BuildingApartmentsDialog`, `BuildingPopup`) avec statut par appartement et statut d'immeuble calculé.
  - optimiseur de tournée (`RouteOptimizer`) : sélection d'adresses en attente + algorithme du plus proche voisin (distance Haversine) depuis la position de l'utilisateur, tracé de l'itinéraire.
  - mode distribution rapide (`QuickDistributionMode`) : adresse la plus proche, validation en un geste, passage à la suivante.
- Onglet Liste (`AddressList`) : recherche, tri, filtres par statut/zone, édition via `AddressForm`.

**/admin** — onglets Général, Statistiques, Journal, Données :
- `UserManagement` : liste des comptes, attribution des rôles, activation/désactivation, suppression et réinitialisation de mot de passe via l'Edge Function `admin-user-actions` (service role, vérification admin côté serveur), gestion des codes d'invitation.
- `TeamManagement` / `ZoneManagement` : CRUD équipes (nom, couleur, membres) et zones (couleur, équipe rattachée, recalcul des affectations).
- `StatisticsView` + `StatisticsCard` : totaux, répartition par statut, progression par zone et par équipe, graphiques recharts.
- `LogsView` : historique des changements de statut (`address_status_history`).
- `CSVImporter` + `ColumnMapper` : import d'un fichier CSV, mapping interactif des colonnes (rue, numéro, ville, lat, lng…), géocodage/normalisation, insertion par lots, conservation de la ligne brute dans `csv_data`.

**/teams** — vue des équipes et de leurs membres pour l'utilisateur connecté (`MemberSelector`).

## Edge Functions

- `validate-invitation` : vérifie qu'un code existe et est actif avant l'inscription (public, sans JWT).
- `admin-user-actions` : actions `delete` et `reset_password` sur un utilisateur ; contrôle que l'appelant est admin puis utilise la clé service role.

## Points d'attention pour un portage

- Le rôle utilisateur doit rester dans une table dédiée (`user_roles`) avec une fonction `has_role` security definer, sinon escalade de privilèges via les policies.
- `boundary_coordinates` est stocké en `[lng, lat]` (ordre GeoJSON) alors que Leaflet attend `[lat, lng]` — inverser à l'affichage.
- Les mises à jour en masse d'adresses sont découpées en lots de 300 pour éviter les requêtes trop longues.
- Interface entièrement en français, pensée mobile (boutons larges, PWA installable).

## Livrable proposé

Si vous validez, je peux générer un fichier `SPEC.md` (ou `DOCS/`) à la racine du projet contenant cette spécification complète, plus le schéma SQL consolidé exporté depuis les migrations, prêt à coller dans un autre outil.
