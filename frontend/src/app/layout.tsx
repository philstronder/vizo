import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { AuthProvider } from "@/lib/auth-context";
import { StoreModeGuard } from "@/lib/store-mode";
import { I18nProvider } from "@/i18n/I18nProvider";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const { meta } = getDictionary(await getLocale());
  return { title: meta.title, description: meta.description };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-cream text-ink">
        <I18nProvider initialLocale={locale}>
          <AuthProvider>
            <Header />
            <main className="flex-1">
              <StoreModeGuard>{children}</StoreModeGuard>
            </main>
          </AuthProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
