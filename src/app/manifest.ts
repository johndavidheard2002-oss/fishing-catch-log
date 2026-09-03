import type { MetadataRoute } from "next";
import { APP_DISPLAY_NAME, APP_TAGLINE } from "@/lib/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_DISPLAY_NAME,
    short_name: APP_DISPLAY_NAME,
    description: APP_TAGLINE,
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
