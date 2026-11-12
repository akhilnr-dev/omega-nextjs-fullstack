import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Omega Tracker",
  description: "Full-stack sample app: Next.js frontend with a migrated Postgres backend.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a className="skip" href="#main">Skip to content</a>
        <main id="main" className="wrap">{children}</main>
      </body>
    </html>
  );
}
