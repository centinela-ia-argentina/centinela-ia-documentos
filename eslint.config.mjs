import nextConfig from "eslint-config-next/core-web-vitals";
import nextTypeScriptConfig from "eslint-config-next/typescript";

const config = [
  ...nextConfig,
  ...nextTypeScriptConfig,
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
      "out/**",
      "build/**"
    ]
  }
];

export default config;
