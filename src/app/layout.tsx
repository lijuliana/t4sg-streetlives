import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import RoleSwitcher from "@/components/RoleSwitcher";
import StoreSync from "@/components/StoreSync";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "StreetLives",
  description: "Peer-validated services for youth and young adults",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-gray-50 font-sans">
        {children}
        <Toaster position="top-center" richColors />
        <RoleSwitcher />
        <StoreSync />
      </body>
    </html>
  );
}
