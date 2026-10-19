import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

const config = [
  {
    ignores: [
      ".next/**",
      ".next-build/**",
      "node_modules/**",
      "public/sw.js",
      "public/swe-worker-*.js",
      "reference/**",
      "supabase/functions/**",
      "playwright-report/**",
      "test-results/**",
      "next-env.d.ts",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    // Le moteur reste du TypeScript pur (CLAUDE.md, règle 2).
    files: ["src/engine/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["react", "react-dom", "next", "next/*"],
              message: "Le moteur ne dépend pas de React ni de Next.",
            },
            { group: ["@supabase/*"], message: "Le moteur ne dépend pas de Supabase." },
          ],
        },
      ],
    },
  },
];

export default config;
