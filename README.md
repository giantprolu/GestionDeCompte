# 💰 Gestion de Comptes Bancaires

Application complète de gestion financière personnelle avec système de transactions (revenus et dépenses) et catégories prédéfinies.

## 📋 Fonctionnalités

### ✅ Gestion des Transactions
- **Revenus** : Salaire, Prime, Freelance, Investissements, etc.
- **Dépenses** : Alimentation, Transport, Logement, Santé, Loisirs, etc.
- 24 catégories prédéfinies avec icônes et couleurs
- Ajout, suppression et filtrage des transactions
- Notes optionnelles pour chaque transaction

### 📊 Dashboard Analytique
- Vue d'ensemble des soldes de comptes
- Solde du mois (Revenus - Dépenses)
- Graphique en camembert des top 5 catégories de dépenses
- Liste des dernières transactions
- Statistiques mensuelles détaillées

### 🏦 Gestion des Comptes
- **Compte Bourso** : Dépenses occasionnelles
- **Compte Caisse EP** : Dépenses obligatoires mensuelles
- Calcul automatique des soldes avec historique des transactions
- Mise à jour des soldes initiaux

## 🛠️ Technologies

- **Frontend** : Next.js 16, React, TypeScript
- **UI** : Shadcn/UI, TailwindCSS, Framer Motion
- **Backend** : Next.js API Routes
- **Base de données** : Supabase (PostgreSQL)
- **Graphiques** : Recharts
- **Validation** : Zod, React Hook Form

## 📁 Structure

```
├── app/
│   ├── page.tsx              # Dashboard avec statistiques
│   ├── transactions/         # Page de gestion des transactions
│   ├── comptes/              # Page de gestion des comptes
│   └── api/
│       ├── accounts/         # API des comptes
│       ├── categories/       # API des catégories
│       └── expenses/         # API des transactions
├── components/
│   ├── TransactionForm.tsx   # Formulaire de transaction
│   └── Sidebar.tsx           # Navigation
├── lib/
│   └── db.ts                 # Client Supabase
└── supabase-schema.sql       # Schéma de la BDD
```

## 🚀 Installation

### 1. Cloner et installer les dépendances

```bash
npm install
```

### 2. Configuration Supabase

Créez un fichier `.env.local` :

```env
NEXT_PUBLIC_SUPABASE_URL=votre_url_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=votre_clé_anonyme
```

### 3. Créer la base de données

1. Allez sur [Supabase](https://supabase.com)
2. Créez un nouveau projet
3. Ouvrez l'éditeur SQL
4. Exécutez le contenu de `supabase-schema.sql`

### 4. Lancer l'application

```bash
npm run dev
```

Ouvrez [http://localhost:3000](http://localhost:3000)

## 📊 Catégories Prédéfinies

### Dépenses (15)
- 🛒 Alimentation
- 🚗 Transport
- 🏠 Logement
- 💊 Santé
- 🎮 Loisirs
- 👕 Vêtements
- 📚 Éducation
- 📄 Factures
- 🍽️ Restaurants
- 📱 Abonnements
- 🎁 Cadeaux
- 🛡️ Assurances
- 🏛️ Impôts
- 💰 Épargne
- 📦 Autres dépenses

### Revenus (9)
- 💼 Salaire
- 🎉 Prime
- 💻 Freelance
- 📈 Investissements
- 💳 Remboursement
- 🏷️ Vente
- 🎁 Cadeau reçu
- 👨‍👩‍👧 Allocation
- 💵 Autres revenus

## 🎨 Design

- Interface minimaliste et moderne
- Couleurs pastel pour les différentes sections
- Animations fluides avec Framer Motion
- Responsive design (mobile, tablette, desktop)
- Icônes et couleurs par catégorie

## 🔧 API Routes

### Comptes
- `GET /api/accounts` : Liste des comptes avec soldes
- `POST /api/accounts` : Créer un compte
- `PATCH /api/accounts` : Mettre à jour un compte

### Catégories
- `GET /api/categories` : Liste des catégories
- `GET /api/categories?type=income` : Catégories de revenus
- `GET /api/categories?type=expense` : Catégories de dépenses

### Transactions
- `GET /api/expenses` : Liste des transactions
- `GET /api/expenses?type=income` : Filtrer par type
- `GET /api/expenses?categoryId=xxx` : Filtrer par catégorie
- `POST /api/expenses` : Créer une transaction
- `DELETE /api/expenses/[id]` : Supprimer une transaction

## 📝 Schéma de Base de Données

### Table `categories`
- id (UUID)
- name (TEXT)
- type (income | expense)
- icon (TEXT)
- color (TEXT)

### Table `accounts`
- id (UUID)
- name (TEXT)
- type (ponctuel | obligatoire)
- initial_balance (DECIMAL)
- created_at, updated_at (TIMESTAMP)

### Table `transactions`
- id (UUID)
- amount (DECIMAL)
- type (income | expense)
- category_id (UUID → categories)
- account_id (UUID → accounts)
- date (TIMESTAMP)
- note (TEXT)
- created_at, updated_at (TIMESTAMP)

## 🔒 Sécurité

- Row Level Security (RLS) activé sur toutes les tables
- Politiques permissives pour usage personnel
- Validation des données avec Zod
- Typage TypeScript strict

## 📱 Pages

### Dashboard (`/`)
- Vue d'ensemble des comptes
- Solde du mois en cours
- Top 5 des catégories de dépenses
- Dernières transactions

### Transactions (`/transactions`)
- Liste complète des transactions
- Formulaire d'ajout (revenu/dépense)
- Filtres par type (tout/revenus/dépenses)
- Suppression de transactions
- Statistiques : total revenus, total dépenses, solde

### Comptes (`/comptes`)
- Liste des comptes bancaires
- Soldes actuels calculés
- Mise à jour des soldes initiaux
- Création de comptes par défaut

## 🎯 Utilisation

1. **Créer les comptes** : Allez dans "Comptes" → "Créer les comptes par défaut"
2. **Ajouter une transaction** : "Transactions" → "Ajouter"
3. **Choisir le type** : Revenu ou Dépense
4. **Sélectionner la catégorie** : 24 catégories disponibles
5. **Voir les statistiques** : Dashboard pour la vue d'ensemble

## 🐛 Dépannage

Si vous rencontrez des erreurs RLS (42501), consultez `MIGRATION-GUIDE.md` pour réinitialiser la base de données.

## 📄 License

Projet personnel - Utilisation libre

---

Développé avec ❤️ en Next.js et Supabase
