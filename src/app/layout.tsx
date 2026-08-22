import type { Metadata, Viewport } from "next";
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

export const viewport: Viewport = {
  themeColor: "#04101a",
  colorScheme: "dark light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <style
          dangerouslySetInnerHTML={{
            __html: "html,body{background-color:#04101a}html.light,html.light body{background-color:#f7fcfd}",
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
try {
  var theme = localStorage.getItem("ocean-state-theme") || localStorage.getItem("downwind-theme");
  if (theme !== "light") {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.add("light");
  }
} catch (_) {}
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-[#f7fcfd] dark:bg-[#04101a]">{children}</body>
    </html>
  );
}
