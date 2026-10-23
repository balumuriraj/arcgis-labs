import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aftershock Replay",
  description:
    "Explore the July 2019 Ridgecrest earthquake sequence with an AI timeline guide.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
