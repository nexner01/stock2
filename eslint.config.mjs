import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-properties": [
        "error",
        {
          object: "process",
          property: "env",
          message: "환경 변수는 src/config 경계에서만 읽으세요.",
        },
      ],
    },
  },
  {
    files: ["src/config/**/*.ts"],
    rules: {
      "no-restricted-properties": "off",
    },
  },
  globalIgnores([
    ".next/**",
    "coverage/**",
    "drizzle/**",
    "node_modules/**",
    "playwright-report/**",
    "test-results/**",
  ]),
]);
