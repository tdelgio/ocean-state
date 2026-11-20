import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Ocean State",
    short_name: "Ocean State",
    description:
      "Live ocean-state observations for Maui: wind, swell, tide, currents, channels, and harbors.",
    start_url: "/home?shore=north",
    display: "standalone",
    background_color: "#173844",
    theme_color: "#173844",
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
