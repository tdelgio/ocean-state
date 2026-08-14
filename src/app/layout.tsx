import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ocean State — Live Maui Ocean Conditions",
  description:
    "Live ocean-state observations for Maui: wind, bump energy, channels, harbors, cameras, tide, rain, and marine conditions.",
  applicationName: "Ocean State",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Ocean State",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
try {
  var theme = localStorage.getItem("ocean-state-theme") || localStorage.getItem("downwind-theme");
  if (theme !== "light") {
    document.documentElement.classList.add("dark");
  }
} catch (_) {}
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
