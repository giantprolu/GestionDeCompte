- ✅ ~~il faut gérer que si un user supprime son compte clerk toutes ses données doivent être deleted en base~~
  - **FAIT** : Webhook configuré dans `/api/webhooks/clerk/route.ts` qui écoute l'événement `user.deleted` et supprime toutes les données associées
  - N'oublie pas de configurer le webhook dans le dashboard Clerk : URL = `https://gestion-de-compte.trouve-tout-conseil.fr/api/webhooks/clerk`, Event = `user.deleted`
  - Variable d'environnement requise : `CLERK_WEBHOOK_SECRET`

- ✅ ~~il faut gérer le changement clerk de dev vers prod~~
  - **FAIT** : Script de migration créé dans `/scripts/migrate-clerk-users.ts`
  - Documentation complète dans `/docs/CLERK_MIGRATION.md`
  - Commande : `npm run migrate:clerk`
  - Le script mappe les utilisateurs par email et met à jour tous les user_id dans Supabase
