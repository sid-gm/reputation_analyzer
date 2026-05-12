import type { Metadata } from "next";
import { Geist } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "STN Analyzer",
  description: "Signal-To-Noise analyzer for social media analysts",
};

const navLinks = [
  { href: "/", label: "Feed" },
  { href: "/track", label: "Track" },
  { href: "/sources", label: "Sources" },
  { href: "/submit", label: "Submit" },
];

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geist.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <header className="border-b px-6 py-3 flex items-center gap-8">
          <span className="font-semibold tracking-tight text-sm">STN Analyzer</span>
          <nav className="flex gap-6">
            {navLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </header>
        <main className="flex-1 px-6 py-8 max-w-6xl mx-auto w-full">
          {children}
        </main>
      </body>
    </html>
  );
}
