import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

const siteUrl = 'https://gittoskill.vercel.app'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'GitToSkill',
    template: '%s | GitToSkill',
  },
  description:
    'Turn any GitHub profile into an installable coding skill by analyzing the profile, repo lineup, and real code style.',
  icons: {
    icon: [
      { url: '/favicon.png', type: 'image/png', sizes: '512x512' },
      { url: '/icon.png', type: 'image/png' },
    ],
    apple: '/apple-icon.png',
    shortcut: '/favicon.png',
  },
  openGraph: {
    type: 'website',
    siteName: 'GitToSkill',
    title: 'GitToSkill',
    description:
      'Turn any GitHub profile into an installable coding skill by analyzing the profile, repo lineup, and real code style.',
    url: siteUrl,
  },
  twitter: {
    card: 'summary',
    title: 'GitToSkill',
    description:
      'Turn any GitHub profile into an installable coding skill by analyzing the profile, repo lineup, and real code style.',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded-lg focus:bg-violet-600 focus:px-4 focus:py-2 focus:text-white focus:ring-2 focus:ring-violet-500 focus:ring-offset-2"
        >
          Skip to main content
        </a>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
