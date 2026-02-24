import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { GradientBlobs } from "@/components/layout/gradient-blobs";
import { Sidebar } from "@/components/layout/sidebar";
import { TitleBar } from "@/components/layout/title-bar";
import { ToastContainer } from "@/components/ui/toast";
import { UpdateOverlay } from "@/components/ui/update-overlay";
import { KeyboardShortcutsProvider } from "@/components/layout/keyboard-shortcuts-provider";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  weight: ["400", "600"],
});

export const metadata: Metadata = {
  title: "Narada — Narayan Narayan! Speak once, inform all three worlds",
  description:
    "Narayan Narayan! Like the divine sage who travels the three worlds, Narada carries your voice to Slack, Teams, and Jira — so the right souls know at the right time.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} antialiased`}
      >
        <GradientBlobs />
        <div className="flex w-full h-screen relative z-[1]">
          <TitleBar />
          <Sidebar />
          <main className="flex-1 flex flex-col overflow-hidden pt-12">
            {children}
          </main>
        </div>
        <ToastContainer />
        <UpdateOverlay />
        <KeyboardShortcutsProvider />
      </body>
    </html>
  );
}
