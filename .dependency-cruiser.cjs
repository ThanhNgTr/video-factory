// Architecture rules from docs/roadmap.md §4.9. CI fails on any violation.
const mod = (name) => `^modules/${name}/src`;
module.exports = {
  forbidden: [
    { name: "no-circular", severity: "error", from: {}, to: { circular: true } },
    {
      name: "packages-dont-import-modules",
      severity: "error",
      from: { path: "^packages/" },
      to: { path: "^modules/|^apps/" },
    },
    {
      name: "contracts-only-zod",
      severity: "error",
      from: { path: "^packages/contracts/src" },
      to: { path: "^packages/(core|pipeline)|^modules/|^apps/" },
    },
    {
      name: "core-not-pipeline",
      severity: "error",
      from: { path: "^packages/core/src" },
      to: { path: "^packages/pipeline" },
    },
    // modules talk only through artifacts; the single exception is video -> assets/render
    {
      name: "script-isolated",
      severity: "error",
      from: { path: mod("script") },
      to: { path: "^modules/(assets|audio|video)/" },
    },
    {
      name: "assets-isolated",
      severity: "error",
      from: { path: mod("assets") },
      to: { path: "^modules/(script|audio|video)/" },
    },
    {
      name: "audio-isolated",
      severity: "error",
      from: { path: mod("audio") },
      to: { path: "^modules/(script|assets|video)/" },
    },
    {
      name: "video-only-assets-render",
      severity: "error",
      from: { path: mod("video") },
      to: { path: "^modules/(script|audio)/|^modules/assets/src/(?!render/)" },
    },
    {
      name: "no-deep-imports",
      severity: "error",
      from: { path: "^(modules|apps|packages)/" },
      to: {
        path: "^(modules|packages)/[^/]+/src/(?!index\\.ts$)",
        pathNot: "^(modules|packages)/([^/]+)/src/.*",
        dependencyTypesNot: ["local"],
      },
    },
    {
      name: "domain-is-pure",
      severity: "error",
      from: { path: "/src/domain/" },
      to: { path: "/src/(adapters|stages)/|^node_modules/|^packages/(core|pipeline)" },
    },
    {
      name: "domain-no-node-builtins",
      severity: "error",
      from: { path: "/src/domain/" },
      to: { dependencyTypes: ["core"] },
    },
    {
      name: "stages-dont-import-adapters",
      severity: "error",
      from: { path: "/src/stages/" },
      to: { path: "/src/adapters/" },
    },
    {
      name: "ports-are-types",
      severity: "error",
      from: { path: "/src/ports\\.ts$" },
      to: { path: "/src/(adapters|stages|domain)/" },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.json" },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "default"],
      extensions: [".ts", ".tsx"],
    },
  },
};
