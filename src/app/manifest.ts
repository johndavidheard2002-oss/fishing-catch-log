import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Catch Compass",
    short_name: "Catch Compass",
    description: "Automatic Logbook for catches, weather, and similar conditions.",
    start_url: "/",
    display: "standalone",
    background_color: "#c5e5f8",
    theme_color: "#134e4c",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
