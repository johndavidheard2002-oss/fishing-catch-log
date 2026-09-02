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
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
