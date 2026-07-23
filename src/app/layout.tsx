import type { Metadata } from "next";
import { Geist, Geist_Mono, Noto_Sans_Bengali } from "next/font/google";
import { ToastProvider } from "@/components/ToastProvider";
import { Navbar } from "@/components/Navbar";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Geist/Geist Mono only cover Latin — Bangla practice text needs its own
// web font with full Bengali script + conjunct coverage, otherwise it falls
// back to whatever (if anything) the OS happens to have installed.
const notoSansBengali = Noto_Sans_Bengali({
  variable: "--font-noto-bengali",
  subsets: ["bengali"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "ASSDI Typing Skill",
  description: "Practice typing in English and Bangla, earn points, complete batch assignments, and climb the institute leaderboards.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${notoSansBengali.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ToastProvider>
          {/* Hoisted here (not per-page) so it persists across client-side
              navigations instead of unmounting/remounting on every route
              change — previously every page rendered its own <Navbar />,
              which meant the nav's own /api/auth/me fetch + loading skeleton
              re-ran on every single navigation, visibly flashing and making
              the whole app feel like it was doing a full page reload. */}
          <Navbar />
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
