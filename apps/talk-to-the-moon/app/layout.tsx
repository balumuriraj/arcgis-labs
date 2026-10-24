import type { Metadata } from "next";
import type { ReactNode } from "react";
import "../src/styles.css";

export const metadata: Metadata = {
  title: "Talk to the Moon",
  description:
    "Explore lunar missions and named features with an interactive 3D Moon guide.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="calcite-mode-dark">
        {children}
      </body>
    </html>
  );
}
