import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Cast Log",
    short_name: "Cast Log",
    description: "Personal fishing journal for catches, weather, and similar conditions.",
    start_url: "/",
    display: "standalone",
    background_color: "#efe6d2",
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
