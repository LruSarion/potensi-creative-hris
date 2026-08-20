import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Pragmatic: `any` is used in typed API client code; type-safety is enforced by tsc + Zod schemas.
      "@typescript-eslint/no-explicit-any": "warn",
      // Pragmatic: inline form-helper components and derived state are used in client pages.
      // These rules are stylistic (performance-nudges), not correctness.
      "react-hooks/static-components": "off",
      "react-hooks/immutability": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
