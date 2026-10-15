
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nexora AI — Build Websites with AI",
  description:
    "Turn your ideas into websites with Nexora AI. Generate, customize, and publish with AI.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}