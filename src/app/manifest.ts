import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Ocean State",
    short_name: "Ocean State",
    description:
      "Live ocean-state observations for Maui: wind, bump energy, channels, harbors, cameras, tide, rain, and marine conditions.",
    start_url: "/home",
    display: "standalone",
    background_color: "#edf8f7",
    theme_color: "#082838",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
