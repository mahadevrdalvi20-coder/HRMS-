import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Manrope, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { missingEnv } from "@/lib/config";
import { SetupNeeded } from "@/components/SetupNeeded";

const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope", display: "swap" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "600"], variable: "--font-plex-mono", display: "swap" });

export const metadata: Metadata = {
  title: "Lehar HRMS · Konkan Coastal Foods",
  description: "Employee records, attendance and leave for Konkan Coastal Foods",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0B4F4A" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Without the keys, ClerkProvider would crash the build and every page.
  const missing = missingEnv();
  if (missing.length > 0) {
    return (
      <html lang="en" className={`${manrope.variable} ${plexMono.variable}`}>
        <body>
          <SetupNeeded missing={missing} />
        </body>
      </html>
    );
  }
  return (
    <ClerkProvider>
      <html lang="en" className={`${manrope.variable} ${plexMono.variable}`}>
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
