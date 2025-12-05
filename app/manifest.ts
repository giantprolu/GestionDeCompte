import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'MoneyFlow - Gestion de Comptes',
    short_name: 'MoneyFlow',
    description: 'Application de gestion de dépenses et de comptes bancaires',
    start_url: '/',
    display: 'standalone',
    display_override: ['standalone', 'minimal-ui'],
    background_color: '#0f172a',
    theme_color: '#10b981',
    orientation: 'portrait-primary',
    scope: '/',
    id: 'moneyflow-app',
    categories: ['finance', 'productivity'],
    icons: [
      {
        src: '/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
