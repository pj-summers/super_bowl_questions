import type { Metadata } from "next";

import "./globals.css";

import AppNav from "@/components/AppNav";

export const metadata: Metadata = {
  title: "Super Bowl Questions",
  description: "Super Bowl Questions",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen bg-background text-foreground">
          <AppNav />

          <main className="sbq-page">{children}</main>
        </div>
      </body>
    </html>
  );
}