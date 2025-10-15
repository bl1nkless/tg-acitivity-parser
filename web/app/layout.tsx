import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SPEC-1 Presence Tracker",
  description: "Heatmaps and trends for Telegram online sessions",
  icons: [
    {
      rel: "icon",
      url: "/favicon.ico"
    }
  ]
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-slate-950 text-slate-100`}>
        <div className="min-h-screen">{children}</div>
      </body>
    </html>
  );
}
