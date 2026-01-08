import type { TutorialConfig } from './types'

/**
 * Onboarding tutorial for new MoneyFlow users
 * 
 * This tutorial guides users through the main features:
 * 1. Welcome message
 * 2. Creating their first account
 * 3. Adding a transaction
 * 4. Categories management
 * 5. Export PDF
 * 6. Viewing analytics
 * 7. Budget planning (Prévisionnel)
 * 8. Credit/Loan tracking
 * 9. Account sharing
 * 10. Completion celebration
 */
export const onboardingTutorial: TutorialConfig = {
    id: 'onboarding',
    name: 'Bienvenue sur MoneyFlow',
    showProgress: true,
    steps: [
        {
            id: 'welcome',
            icon: '👋',
            title: 'Bienvenue sur MoneyFlow !',
            description: 'Découvrez comment gérer vos finances efficacement. Ce tutoriel rapide vous guidera à travers les fonctionnalités principales.',
            placement: 'center',
            nextButtonText: 'Commencer',
            canSkip: true
        },
        {
            id: 'sidebar-nav',
            icon: '🧭',
            title: 'Navigation',
            description: 'Utilisez la barre de navigation pour accéder aux différentes sections : Dashboard, Transactions, Comptes, et plus.',
            targetSelector: 'sidebar-nav',
            mobileTargetSelector: 'mobile-nav',
            route: '/',
            placement: 'right',
            mobilePlacement: 'top',
            canSkip: true
        },
        {
            id: 'create-account',
            icon: '💳',
            title: 'Créez vos comptes',
            description: 'Ajoutez vos comptes bancaires pour suivre vos finances.',
            targetSelector: 'create-account-button',
            route: '/comptes',
            placement: 'bottom',
            mobilePlacement: 'bottom',
            canSkip: true
        },
        {
            id: 'add-transaction',
            icon: '💸',
            title: 'Ajoutez des transactions',
            description: 'Enregistrez vos dépenses et revenus pour garder un suivi précis.',
            targetSelector: 'add-transaction-button',
            route: '/transactions',
            placement: 'left',
            mobilePlacement: 'bottom',
            canSkip: true
        },
        {
            id: 'categories',
            icon: '🏷️',
            title: 'Catégories personnalisées',
            description: 'Créez vos propres catégories pour mieux organiser vos transactions. Accédez à cette page depuis le bouton "Catégories" dans les transactions.',
            route: '/categories',
            placement: 'center',
            mobilePlacement: 'center',
            canSkip: true
        },
        {
            id: 'export-pdf',
            icon: '📄',
            title: 'Exportez en PDF',
            description: 'Exportez vos transactions au format PDF pour les conserver ou les partager. Utilisez le bouton "Exporter PDF" dans la page transactions.',
            route: '/transactions',
            placement: 'center',
            mobilePlacement: 'center',
            canSkip: true
        },
        {
            id: 'view-analytics',
            icon: '📊',
            title: 'Analysez vos dépenses',
            description: 'Visualisez la répartition de vos dépenses par catégorie. Vous pouvez choisir différentes périodes pour comparer vos habitudes.',
            targetSelector: 'expense-chart',
            route: '/',
            placement: 'top',
            mobilePlacement: 'top',
            highlightStyle: 'pulse',
            canSkip: true
        },
        {
            id: 'previsionnel',
            icon: '📈',
            title: 'Page Prévisionnel',
            description: 'Cette page vous aide à planifier votre budget mensuel. Elle analyse vos dépenses passées pour vous donner des recommandations personnalisées.',
            targetSelector: 'previsionnel-header',
            route: '/previsionnel',
            placement: 'bottom',
            mobilePlacement: 'bottom',
            canSkip: true
        },
        {
            id: 'savings-card',
            icon: '🐷',
            title: 'Épargne potentielle',
            description: 'Cette carte affiche combien vous pouvez épargner ce mois. Elle calcule : Revenus - Charges fixes - Budget variable = Épargne.',
            targetSelector: 'savings-card',
            route: '/previsionnel',
            placement: 'bottom',
            mobilePlacement: 'bottom',
            highlightStyle: 'pulse',
            canSkip: true
        },
        {
            id: 'calculate-recommendations',
            icon: '✨',
            title: 'Calculer les recommandations',
            description: 'Cliquez ici pour analyser vos dépenses des mois précédents. L\'algorithme vous suggèrera des objectifs réalistes par catégorie.',
            targetSelector: 'calculate-recommendations',
            route: '/previsionnel',
            placement: 'bottom',
            mobilePlacement: 'bottom',
            canSkip: true
        },
        {
            id: 'credits',
            icon: '💰',
            title: 'Suivi des prêts',
            description: 'Ajoutez vos prêts ou crédits ici. Enregistrez chaque remboursement pour suivre le montant restant à payer.',
            targetSelector: 'credit-tracking-card',
            route: '/previsionnel',
            placement: 'left',
            mobilePlacement: 'top',
            canSkip: true
        },
        {
            id: 'partage',
            icon: '👥',
            title: 'Partagez vos comptes',
            description: 'Entrez le nom d\'utilisateur d\'un proche pour partager vos comptes. Choisissez entre lecture seule ou édition.',
            targetSelector: 'share-dashboard-card',
            route: '/partage/gerer',
            placement: 'bottom',
            mobilePlacement: 'bottom',
            canSkip: true
        },
        {
            id: 'complete',
            icon: '🎉',
            title: 'Vous êtes prêt !',
            description: 'Vous connaissez maintenant toutes les fonctionnalités. Pour relancer ce tutoriel, utilisez le bouton "?" en bas à droite de l\'écran ou rendez-vous dans Paramètres > Aide. Bonne gestion !',
            placement: 'center',
            nextButtonText: 'Terminer',
            canSkip: false
        }
    ],
    onComplete: () => {
        // Mark tutorial as completed
        localStorage.setItem('moneyflow_onboarding_complete', 'true')
    },
    onSkip: () => {
        // Mark as skipped but not completed
        localStorage.setItem('moneyflow_onboarding_skipped', 'true')
    }
}

/**
 * Check if onboarding tutorial should be shown
 */
export function shouldShowOnboarding(): boolean {
    if (typeof window === 'undefined') return false

    const completed = localStorage.getItem('moneyflow_onboarding_complete')
    const skipped = localStorage.getItem('moneyflow_onboarding_skipped')

    return !completed && !skipped
}

/**
 * Reset onboarding state (for testing or re-running)
 */
export function resetOnboarding(): void {
    if (typeof window === 'undefined') return

    localStorage.removeItem('moneyflow_onboarding_complete')
    localStorage.removeItem('moneyflow_onboarding_skipped')
}
