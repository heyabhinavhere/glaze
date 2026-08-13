import type { Metadata } from "next";
import "@glazelab/react/styles.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Glaze — Material workbench",
  description:
    "Design, inspect, and export honest glass materials for semantic React interfaces.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="preload" as="image" href="/backgrounds/bg-4.jpg" />
      </head>
      <body>{children}</body>
    </html>
  );
}
