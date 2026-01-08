'use client'

import { HelpCircle } from 'lucide-react'
import { motion } from 'framer-motion'
import { useTutorial } from '@/lib/tutorial/useTutorial'
import { onboardingTutorial } from '@/lib/tutorial/onboardingTutorial'

export default function TutorialHelpButton() {
  const { startTutorial, state: tutorialState } = useTutorial()

  if (tutorialState.isActive) {
    return null
  }

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      onClick={() => startTutorial(onboardingTutorial)}
      className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-40 w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center border-2 border-purple-400/30"
      title="Lancer le tutoriel"
    >
      <HelpCircle className="w-6 h-6" />
    </motion.button>
  )
}
