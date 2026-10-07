import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "같이가계부",
    short_name: "같이가계부",
    description: "카드만 써, 기록은 내가 할게",
    lang: "ko",
    start_url: "/",
    display: "standalone",
    background_color: "#f2f4f6",
    theme_color: "#f2f4f6",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
