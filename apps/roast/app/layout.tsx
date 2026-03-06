import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Layer Roast",
  description: "Evidence-backed map layer exploration with adjustable tone.",
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