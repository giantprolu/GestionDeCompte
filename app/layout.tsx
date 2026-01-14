import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import AuthGuard from "@/components/AuthGuard";
import { ClerkProvider } from "@clerk/nextjs";
import { frFR } from "@clerk/localizations";
import AppWrapper from "@/components/AppWrapper";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";
import { TutorialWrapper } from "@/components/tutorial/TutorialWrapper";
import TutorialAutoStart from "@/components/TutorialAutoStart";
import TutorialHelpButton from "@/components/TutorialHelpButton";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: '#10b981',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: "MoneyFlow - Gestion de Comptes",
  description: "Application de gestion de dépenses pour des comptes bancaires",
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'MoneyFlow',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: '/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/icon-192x192.png', sizes: '192x192', type: 'image/png' },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider localization={frFR}>
      <html lang="fr">
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased bg-slate-50`}
        >
          <AuthGuard>
            <AppWrapper>
              <TutorialWrapper>
                <TutorialAutoStart />
                <Sidebar>
                  {children}
                </Sidebar>
                <TutorialHelpButton />
              </TutorialWrapper>
            </AppWrapper>
          </AuthGuard>
          <PWAInstallPrompt />
        </body>
      </html>
    </ClerkProvider>
  );
}

