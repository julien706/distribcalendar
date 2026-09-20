# Réinitialiser le mot de passe de test@test.fr

Objectif : redonner l'accès au compte de test en lui attribuant directement un nouveau mot de passe.

## Ce qui va être fait

1. Vérifier que le compte test@test.fr existe bien dans les comptes de l'application.
2. Lui attribuer un nouveau mot de passe défini côté serveur.
3. Vous communiquer le mot de passe dans le chat pour que vous puissiez vous connecter immédiatement.
4. Vérifier la connexion avec ce compte sur l'écran de connexion pour confirmer que ça fonctionne.

Aucune modification du code de l'application, des écrans ou des données de distribution.

## Mot de passe proposé

`Test2026!` — dites-moi si vous préférez une autre valeur, sinon j'utilise celle-ci.

## Détails techniques

- Mise à jour du mot de passe via l'API d'administration des comptes (service role), sans toucher aux tables `profiles`, `user_roles` ou aux affectations d'équipe/zone.
- Le rôle, l'état actif et les appartenances d'équipe du compte restent inchangés.
