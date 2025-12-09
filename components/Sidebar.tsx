'use client'

import { useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, ArrowLeftRight, Wallet, Share2, type LucideIcon, Sparkles, Settings, Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SignInButton, SignUpButton, SignedIn, SignedOut, UserButton } from '@clerk/nextjs'
import { useUserSettings } from '@/components/AppWrapper'
import { motion, AnimatePresence } from 'framer-motion'

// Hook pour détecter si on est côté client (évite hydration mismatch)
const emptySubscribe = () => () => {}
function useIsMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  )
}

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
  const mounted = useIsMounted()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [lastPathname, setLastPathname] = useState(pathname)
  const { userType } = useUserSettings()

  // Fermer le menu mobile quand on change de page
  if (pathname !== lastPathname) {
    setLastPathname(pathname)
    if (mobileMenuOpen) {
      setMobileMenuOpen(false)
    }
  }

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
        <div className="mb-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-blue-600 flex items-center justify-center shadow-lg">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold gradient-text">MoneyFlow</h1>
          </div>
          <p className="text-sm text-gray-400 ml-13">Gestion financière intelligente</p>
        </div>

        {/* User Section - En haut */}
        <div className="mb-6 pb-4 border-b border-white/10">
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
                      S&apos;inscrire
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
      </aside>

      {/* Mobile Menu Button - Bouton hamburger avec safe area pour Dynamic Island */}
      <div className="lg:hidden fixed mobile-menu-btn z-50">
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2.5 rounded-xl bg-slate-800/80 backdrop-blur-sm border border-white/10 hover:bg-slate-700/80 transition-all touch-target"
        >
          {mobileMenuOpen ? (
            <X className="w-6 h-6 text-white" />
          ) : (
            <Menu className="w-6 h-6 text-white" />
          )}
        </button>
      </div>

      {/* Mobile Drawer Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            />
            
            {/* Menu Drawer */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="lg:hidden fixed top-0 right-0 bottom-0 w-72 max-w-[85vw] bg-slate-900/95 backdrop-blur-xl border-l border-white/10 z-50 mobile-drawer"
            >
              <div className="flex flex-col h-full p-6 pt-16">
                {/* Logo */}
                <div className="mb-6">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-blue-600 flex items-center justify-center shadow-lg">
                      <Sparkles className="w-6 h-6 text-white" />
                    </div>
                    <h1 className="text-xl font-bold gradient-text">MoneyFlow</h1>
                  </div>
                </div>

                {/* User Section */}
                <div className="mb-6 pb-6 border-b border-white/10">
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
                              S&apos;inscrire
                            </button>
                          </SignUpButton>
                        </div>
                      </SignedOut>
                      <SignedIn>
                        <div className="flex items-center gap-3 px-4 py-3 glass rounded-xl border border-white/10">
                          <UserButton />
                          <span className="text-sm text-gray-300 flex-1">Mon compte</span>
                        </div>
                      </SignedIn>
                    </>
                  )}
                </div>

                {/* Menu Items */}
                <nav className="space-y-2 flex-1">
                  <Link
                    href="/parametres"
                    className={cn(
                      'flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-300',
                      pathname === '/parametres'
                        ? 'bg-gradient-to-r from-emerald-500/20 to-blue-500/20 text-white border border-emerald-500/30'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    )}
                  >
                    <Settings className="w-5 h-5" />
                    <span className="font-medium">Paramètres</span>
                  </Link>
                </nav>

                {/* Version */}
                <div className="pt-4 border-t border-white/10">
                  <p className="text-xs text-slate-500 text-center">MoneyFlow v1.0</p>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Bottom Navigation Mobile - avec support safe area Android/iOS */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 glass border-t border-white/10 backdrop-blur-xl mobile-nav safe-left safe-right">
        <div className="flex items-center justify-around px-2 xs:px-4 pt-2 pb-1">
          {filteredNavItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex flex-col items-center gap-0.5 px-2 xs:px-4 py-2 rounded-xl transition min-w-[56px] xs:min-w-[70px] touch-target',
                  isActive ? 'text-emerald-400' : 'text-gray-400'
                )}
              >
                <Icon className={cn('w-5 h-5 xs:w-6 xs:h-6', isActive && 'animate-bounce')} />
                <span className="text-[10px] xs:text-xs font-medium truncate max-w-[60px]">{item.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-4 lg:p-8 main-content lg:!pt-8 lg:!pb-8">
          {children}
        </div>
      </main>
    </div>
  )
}
