# Migration de Prisma vers Supabase

## ✅ Fichiers créés

1. **supabase-schema.sql** - Script SQL pour créer les tables dans Supabase
2. **.env.example** - Template de configuration

## 📋 Instructions de migration

### 1. Créer un projet Supabase

1. Allez sur https://supabase.com
2. Créez un compte et un nouveau projet
3. Notez l'URL du projet et la clé anon

### 2. Créer les tables

1. Dans Supabase, allez dans **SQL Editor**
2. Copiez le contenu de `supabase-schema.sql`
3. Exécutez le script

### 3. Configurer les variables d'environnement

Éditez le fichier `.env` et ajoutez:

```env
NEXT_PUBLIC_SUPABASE_URL=https://votre-projet.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=votre-clé-anon
```

Vous trouverez ces valeurs dans **Settings > API** de votre projet Supabase.

### 4. Nettoyer et relancer

```bash
# Supprimer le cache
Remove-Item -Path ".\.next" -Recurse -Force

# Relancer l'application
npm run dev
```

## ✨ Changements effectués

- ✅ Prisma désinstallé
- ✅ Supabase installé
- ✅ `lib/db.ts` - Client Supabase configuré
- ✅ API routes migrées vers Supabase
- ✅ Types et requêtes adaptés pour PostgreSQL

## 📝 Différences techniques

### Noms de colonnes
- Prisma: `initialBalance`, `accountId` (camelCase)
- Supabase: `initial_balance`, `account_id` (snake_case)

### Relations
- Prisma: `include: { expenses: true }`
- Supabase: `.select('*, account:accounts(*)')`

### Types
- Prisma: UUID via `@default(cuid())`
- Supabase: UUID natif PostgreSQL via `gen_random_uuid()`

L'application est maintenant prête à fonctionner avec Supabase ! 🚀
