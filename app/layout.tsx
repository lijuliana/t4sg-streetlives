import type { Metadata } from "next";
import "./globals.css";
import { Nav } from "@/components/Nav";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Saved Services | Streetmark",
  description: "Browse and save your favorite Streetmark services.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-amber-50/70 text-gray-900">
        <Nav />
        {children}
      </body>
    </html>
  );
}
