import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: "https://grantwasil.com",
  output: "static",
  integrations: [sitemap({ filter: (page) => new URL(page).pathname === "/" })],
  build: {
    format: "directory",
  },
});
