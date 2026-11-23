import nextConfig from "eslint-config-next/core-web-vitals";

const config = [
  ...nextConfig,
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
      "out/**",
      "build/**",
      ".tmp-muestras/**",
      ".agents/**",
      ".github/**",
      ".codex/**"
    ]
  }
];

export default config;
