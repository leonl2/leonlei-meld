import { defineConfig } from "vitest/config";
import { fileURLToPath } from "url";

export default defineConfig({
  test: {
    environment: "node",
  },
  resolve: {
    alias: {
      "cloudflare:workers": fileURLToPath(
        new URL("./src/__mocks__/cloudflare-workers.ts", import.meta.url)
      ),
      "@shared/types": fileURLToPath(
        new URL("../web/shared/types.ts", import.meta.url)
      ),
    },
  },
});
