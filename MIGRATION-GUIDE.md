# Guide de mise à jour de la base de données Supabase

## Étape 1 : Supprimer les anciennes tables

```sql
-- Supprimer les anciennes tables
DROP TABLE IF EXISTS expenses CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS accounts CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column CASCADE;
```

## Étape 2 : Créer les nouvelles tables

Copiez et exécutez le contenu du fichier `supabase-schema.sql` dans votre éditeur SQL Supabase.

## Étape 3 : Vérifier les données

Après l'exécution, vérifiez que :
- La table `categories` contient 24 catégories (15 dépenses + 9 revenus)
- Les tables `accounts` et `transactions` sont vides et prêtes
- Les politiques RLS sont activées

```sql
-- Vérifier les catégories
SELECT COUNT(*), type FROM categories GROUP BY type;

-- Vérifier les tables
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('categories', 'accounts', 'transactions');
```

## Étape 4 : Créer vos comptes depuis l'application

1. Allez sur l'onglet "Comptes"
2. Cliquez sur "Créer les comptes par défaut"
3. Les comptes Bourso et Caisse EP seront créés

## Étape 5 : Commencer à utiliser l'application

✅ Vous êtes prêt ! Vous pouvez maintenant :
- Ajouter des revenus et dépenses
- Consulter les statistiques sur le dashboard
- Filtrer les transactions par type et catégorie
