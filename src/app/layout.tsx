import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { GradientBlobs } from "@/components/layout/gradient-blobs";
import { Sidebar } from "@/components/layout/sidebar";
import { ToastContainer } from "@/components/ui/toast";

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
  title: "Narada - Speak once, inform all three worlds",
  description:
    "Like the divine messenger Narad Muni, Narada carries your voice to Slack, Teams, and Jira — so the right people know at the right time.",
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
          <Sidebar />
          <main className="flex-1 flex flex-col overflow-hidden">
            {children}
          </main>
        </div>
        <ToastContainer />
      </body>
    </html>
  );
}
