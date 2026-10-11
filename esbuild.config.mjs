import esbuild from "esbuild";

await esbuild.build({
  entryPoints: ["src/main.ts"],
  outfile: "dist/main.js",
  bundle: true,
  platform: "node",
  target: "node24",
  format: "cjs",
  sourcemap: "external",
  sourcesContent: true,
  minify: true,
  treeShaking: true,
  external: ['lodash'],
  logLevel: "info"
});