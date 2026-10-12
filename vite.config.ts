import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { loadEnv } from "vite";
import { defineConfig, type ViteUserConfig } from "vitest/config";
export default defineConfig(({ mode }: { mode: string }): ViteUserConfig => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      proxy: { "/api": env.API_PROXY_URL || "http://127.0.0.1:3000" },
    },
    build: {
      minify: "terser",
      terserOptions: {
        compress: { passes: 3 },
        mangle: true,
        format: { comments: false },
      },
    },
    preview: {
      proxy: { "/api": env.API_PROXY_URL || "http://127.0.0.1:3000" },
    },
    test: {
      include: ["src/**/*.test.{ts,tsx}"],
      environment: "jsdom",
      setupFiles: ["./src/test/setup.ts"],
    },
  };
});
