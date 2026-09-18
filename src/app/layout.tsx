import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CCS Dashboard - Cámara de Comercio de Soacha",
  description: "Dashboard de métricas Kommo CRM para la Cámara de Comercio de Soacha",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      style={{ background: '#0a0a0a' }}
    >
      <body className="min-h-full flex flex-col" style={{ background: '#0a0a0a', margin: 0 }}>{children}</body>
    </html>
  );
}
