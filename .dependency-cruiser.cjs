/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      from: {},
      to: { circular: true },
    },
    {
      name: "domain-has-no-outer-dependencies",
      severity: "error",
      from: { path: "^src/domain" },
      to: {
        path: "^src/(app|features|application|ports|infrastructure|components|config|contracts)",
      },
    },
    {
      name: "application-does-not-use-adapters-or-ui",
      severity: "error",
      from: { path: "^src/application" },
      to: { path: "^src/(app|features|infrastructure|components)" },
    },
    {
      name: "ui-does-not-use-infrastructure",
      severity: "error",
      from: { path: "^src/(app|features|components)" },
      to: { path: "^src/infrastructure" },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    exclude: { path: "(\\.test\\.|^src/test/)" },
    tsConfig: { fileName: "tsconfig.json" },
    enhancedResolveOptions: {
      extensions: [".ts", ".tsx", ".js", ".jsx"],
    },
    reporterOptions: {
      text: { highlightFocused: true },
    },
  },
};
