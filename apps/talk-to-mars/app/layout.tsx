import type { Metadata } from "next";
import type { ReactNode } from "react";
import "../src/styles.css";

export const metadata: Metadata = {
  title: "Talk to Mars",
  description:
    "Explore Mars landings, rover routes, and named features with an interactive 3D Mars guide.",
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
