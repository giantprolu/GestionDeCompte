# Guide de migration Clerk Dev → Prod

## Vue d'ensemble

Ce guide explique comment migrer les utilisateurs et leurs données de l'environnement Clerk de développement vers l'environnement de production.

## Prérequis

1. **Comptes Clerk** : Avoir accès aux dashboards Clerk Dev et Prod
2. **Base de données** : Accès Supabase avec la clé `service_role`
3. **Utilisateurs en prod** : Les utilisateurs doivent s'être connectés au moins une fois en production

## Processus de migration

### Étape 1 : Préparer les environnements

1. **Créer l'application Clerk Prod** (si pas déjà fait)
   - Aller sur [clerk.com](https://clerk.com)
   - Créer une nouvelle application pour la production
   - Configurer les mêmes paramètres d'authentification

2. **Récupérer les clés API**
   ```
   CLERK_DEV_SECRET_KEY=sk_test_xxxxxxxx  (depuis le dashboard Clerk Dev)
   CLERK_PROD_SECRET_KEY=sk_live_xxxxxxxx (depuis le dashboard Clerk Prod)
   SUPABASE_SERVICE_ROLE_KEY=eyJxxxxxxxx  (depuis Supabase > Settings > API)
   ```

### Étape 2 : Faire migrer les utilisateurs vers Clerk Prod

⚠️ **Important** : Les user_id Clerk changent entre Dev et Prod !

Les utilisateurs doivent se reconnecter en production pour créer leur compte Clerk Prod. Il y a deux approches :

#### Option A : Migration progressive (recommandée)
1. Déployer l'app avec Clerk Prod
2. Les utilisateurs se reconnectent naturellement
3. Exécuter le script de migration pour transférer leurs données

#### Option B : Migration en une fois
1. Informer tous les utilisateurs de la migration
2. Tous les utilisateurs se reconnectent en prod
3. Exécuter le script de migration

### Étape 3 : Exécuter le script de migration

```bash
# Depuis la racine du projet
CLERK_DEV_SECRET_KEY=sk_test_xxx \
CLERK_PROD_SECRET_KEY=sk_live_xxx \
SUPABASE_SERVICE_ROLE_KEY=eyJxxx \
npx ts-node scripts/migrate-clerk-users.ts
```

Ou avec npm :
```bash
npm run migrate:clerk
```

Le script va :
1. Récupérer les utilisateurs des deux environnements Clerk
2. Créer un mapping basé sur l'email (identifiant stable)
3. Mettre à jour tous les `user_id` dans Supabase

### Étape 4 : Configurer le webhook en production

1. Dans le dashboard Clerk Prod, aller dans **Webhooks**
2. Créer un nouveau endpoint :
   - URL : `https://votre-domaine.com/api/webhooks/clerk`
   - Événements : `user.deleted`
3. Copier le **Webhook Secret** et l'ajouter aux variables d'environnement :
   ```
   CLERK_WEBHOOK_SECRET=whsec_xxxxxxxx
   ```

### Étape 5 : Mettre à jour les variables d'environnement

Remplacer les clés Clerk Dev par les clés Prod :

```env
# .env.production
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_xxxxxxxx
CLERK_SECRET_KEY=sk_live_xxxxxxxx
CLERK_WEBHOOK_SECRET=whsec_xxxxxxxx
```

## Tables migrées

Le script met à jour les références `user_id` dans les tables suivantes :

| Table | Colonne |
|-------|---------|
| `accounts` | `user_id` |
| `credits` | `user_id` |
| `month_closures` | `user_id` |
| `user_settings` | `user_id` |
| `notification_preferences` | `user_id` |
| `push_subscriptions` | `user_id` |
| `sent_notifications` | `user_id` |
| `shared_dashboards` | `owner_user_id` |
| `shared_dashboards` | `shared_with_user_id` |

## Dépannage

### "Utilisateur X n'existe pas encore en prod"
L'utilisateur doit d'abord se connecter en production pour créer son compte Clerk.

### "Erreur migration table.column"
Vérifier que la clé `SUPABASE_SERVICE_ROLE_KEY` est correcte et a les permissions nécessaires.

### Données non migrées
Vérifier le rapport final pour voir s'il reste des entrées avec des `user_id` dev.

## Rollback

En cas de problème, vous pouvez inverser la migration en inversant les mappings :

```sql
-- Exemple de rollback pour la table accounts
UPDATE accounts SET user_id = 'dev_user_id' WHERE user_id = 'prod_user_id';
```

Les mappings sont sauvegardés dans la table `user_id_migrations` pour référence.
