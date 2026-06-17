import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cooper's Console",
  description: "An Interstellar-themed ArcGIS assistant command console.",
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