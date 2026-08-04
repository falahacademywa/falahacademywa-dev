import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Built output is committed to /platform so GitHub Pages serves it
// at falahacademywa.org/platform/ with no change to how the site deploys.
export default defineConfig({
  base: "/platform/",
  plugins: [react(), tailwindcss()],
  build: {
    outDir: "../platform",
    emptyOutDir: true,
  },
});
