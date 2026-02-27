import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Test files and vitest config use Vitest globals; skip Next.js rules for them
    "**/*.test.ts",
    "**/*.test.tsx",
    "vitest.config.ts",
    "vitest.setup.ts",
  ]),
]);

export default eslintConfig;
