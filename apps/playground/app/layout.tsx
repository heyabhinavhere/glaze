import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Glaze — Visual glass effect configurator",
  description:
    "Compose, preview, and export production-ready glass/glassmorphism effects. The bridge between Figma's glass material and the CSS you need in production.",
};

// Preload all background images so the browser fetches + decodes during
// initial page load. By the time React mounts and the user can click a
// background swatch, the bytes are already in memory ready for instant use.
const BACKGROUND_SRCS = [
  "/backgrounds/bg-1.jpg",
  "/backgrounds/bg-2.jpg",
  "/backgrounds/bg-3.jpg",
  "/backgrounds/bg-4.jpg",
  "/backgrounds/bg-5.jpg",
  "/backgrounds/bg-6.jpg",
  "/backgrounds/bg-7.jpg",
];

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <head>
        {/* Adobe Fonts / Typekit — Redaction Italic for the Glaze wordmark. */}
        <link rel="stylesheet" href="https://use.typekit.net/wkn2zjh.css" />
        {BACKGROUND_SRCS.map((src) => (
          <link
            key={src}
            rel="preload"
            as="image"
            href={src}
            crossOrigin="anonymous"
            fetchPriority="high"
          />
        ))}
      </head>
      {/* suppressHydrationWarning — browser extensions (Grammarly, Dashlane,
          etc.) inject attributes onto <body> before React hydrates. Without
          this, the resulting hydration error can prevent useLayoutEffect
          callbacks from firing, which kills the WebGL renderer setup. */}
      <body className="min-h-full" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
