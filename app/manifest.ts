import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "wisedinner",
    short_name: "wisedinner",
    start_url: "/",
    display: "standalone",
    background_color: "#FFFFFF",
    theme_color: "#191817",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
