import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar" ;
import AuthGuard from "@/components/AuthGuard";
import { ClerkProvider } from "@clerk/nextjs";
import { frFR } from "@clerk/localizations";
import AppWrapper from "@/components/AppWrapper";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Gestion de Comptes",
  description: "Application de gestion de dépenses pour deux comptes bancaires",
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
              <Sidebar>
                {children}
              </Sidebar>
            </AppWrapper>
          </AuthGuard>
        </body>
      </html>
    </ClerkProvider>
  );
}
