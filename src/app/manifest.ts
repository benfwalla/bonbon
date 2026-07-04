import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "bonbon",
    short_name: "bonbon",
    description: "Save YouTube cooking recipes and cook along with AI",
    start_url: "/",
    display: "standalone",
    background_color: "#FFF3E9",
    theme_color: "#FFF3E9",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
