import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Catch Compass",
    short_name: "Catch Compass",
    description: "Catch Compass Saltwater Logbook — log catches with photo, weather, and similar conditions.",
    start_url: "/",
    display: "standalone",
    background_color: "#7ecdee",
    theme_color: "#0a4e6a",
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
