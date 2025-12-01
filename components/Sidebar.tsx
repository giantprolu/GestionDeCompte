'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, ArrowLeftRight, Wallet, Share2, type LucideIcon, Sparkles, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SignInButton, SignUpButton, SignedIn, SignedOut, UserButton } from '@clerk/nextjs'
import { useUserSettings } from '@/components/AppWrapper'

interface NavItem {
  href: string
  label: string
  icon: LucideIcon
  viewerOnly?: boolean  // true = visible uniquement pour les visionneurs
  userOnly?: boolean    // true = visible uniquement pour les utilisateurs complets
}

const navItems: NavItem[] = [
  { href: '/', label: 'Dashboard', icon: Home, userOnly: true },
  { href: '/transactions', label: 'Transactions', icon: ArrowLeftRight, userOnly: true },
  { href: '/comptes', label: 'Comptes', icon: Wallet, userOnly: true },
  { href: '/partage', label: 'Partage', icon: Share2 },
  { href: '/previsionnel', label: 'Prévisonnel', icon: Sparkles, userOnly: true },
]

interface SidebarProps {
  children: React.ReactNode
}

export default function Sidebar({ children }: SidebarProps) {
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)
  const { userType } = useUserSettings()

  useEffect(() => {
    setMounted(true)
  }, [])

  // Filtrer les éléments de navigation selon le type d'utilisateur
  const filteredNavItems = navItems.filter(item => {
    // Si pas encore de type défini, montrer tout
    if (!userType) return true
    // Si l'item est réservé aux utilisateurs complets et qu'on est visionneur
    if (item.userOnly && userType === 'viewer') return false
    // Si l'item est réservé aux visionneurs et qu'on est utilisateur complet
    if (item.viewerOnly && userType === 'user') return false
    return true
  })

  return (
    <div className="flex min-h-screen">
      {/* Sidebar Desktop - Glassmorphism */}
      <aside className="hidden lg:flex flex-col w-72 glass border-r border-white/10 p-6">
        {/* Logo */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-blue-600 flex items-center justify-center shadow-lg">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold gradient-text">MoneyFlow</h1>
          </div>
          <p className="text-sm text-gray-400 ml-13">Gestion financière intelligente</p>
        </div>

        {/* Navigation */}
        <nav className="space-y-2 flex-1">
          {filteredNavItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-300 group',
                  isActive
                    ? 'bg-gradient-to-r from-emerald-500/20 to-blue-500/20 text-white shadow-lg border border-emerald-500/30'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                )}
              >
                <Icon className={cn(
                  'w-5 h-5 transition-transform duration-300',
                  isActive ? 'text-emerald-400' : 'group-hover:scale-110'
                )} />
                <span className="font-medium">{item.label}</span>
                {isActive && (
                  <div className="ml-auto w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                )}
              </Link>
            )
          })}
        </nav>

        {/* User Section */}
        <div className="mt-auto pt-6 border-t border-white/10">
          {mounted && (
            <>
              <SignedOut>
                <div className="space-y-2">
                  <SignInButton mode="modal">
                    <button className="w-full px-4 py-2.5 text-sm font-medium text-white bg-white/10 hover:bg-white/20 rounded-xl transition border border-white/10">
                      Se connecter
                    </button>
                  </SignInButton>
                  <SignUpButton mode="modal">
                    <button className="w-full px-4 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-emerald-500 to-blue-600 hover:from-emerald-600 hover:to-blue-700 rounded-xl transition shadow-lg">
                      S'inscrire
                    </button>
                  </SignUpButton>
                </div>
              </SignedOut>
              <SignedIn>
                <div className="flex items-center gap-3 px-4 py-3 glass rounded-xl border border-white/10">
                  <UserButton />
                  <span className="text-sm text-gray-300 flex-1">Mon compte</span>
                  <Link href="/parametres">
                    <button className="p-2 hover:bg-white/10 rounded-lg transition" title="Paramètres">
                      <Settings className="w-4 h-4 text-gray-400 hover:text-white" />
                    </button>
                  </Link>
                </div>
              </SignedIn>
            </>
          )}
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 glass border-b border-white/10 px-4 py-3 backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-blue-600 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-lg font-bold gradient-text">MoneyFlow</h1>
          </div>
          <div className="flex items-center gap-2">
            {mounted && (
              <>
                <SignedIn>
                  <UserButton />
                </SignedIn>
                <SignedOut>
                  <SignInButton mode="modal">
                    <button className="px-3 py-1.5 text-sm font-medium text-white bg-gradient-to-r from-emerald-500 to-blue-600 hover:from-emerald-600 hover:to-blue-700 rounded-lg transition shadow-lg">
                      Connexion
                    </button>
                  </SignInButton>
                </SignedOut>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Navigation Mobile */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 glass border-t border-white/10 backdrop-blur-xl">
        <div className="flex items-center justify-around px-4 py-3">
          {filteredNavItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition min-w-[70px]',
                  isActive ? 'text-emerald-400' : 'text-gray-400'
                )}
              >
                <Icon className={cn('w-6 h-6', isActive && 'animate-bounce')} />
                <span className="text-xs font-medium">{item.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-4 lg:p-8 pt-20 lg:pt-8 pb-24 lg:pb-8">
          {children}
        </div>
      </main>
    </div>
  )
}
