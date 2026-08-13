import type { Metadata } from "next";
import "@glazelab/react/styles.css";
import "./styles.css";

export const metadata: Metadata = {
  title: "Glaze Next consumer",
  description: "Fresh Next App Router consumer for @glazelab/react",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
