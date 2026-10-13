import esbuild from "esbuild";

await esbuild.build({
  entryPoints: ["src/main.ts"],
  outfile: "dist/main.js",
  bundle: true,
  platform: "node",
  target: "es2020",
  format: "cjs",
  sourcemap: "external",
  sourcesContent: true,
  minify: true,
  treeShaking: true,
  logLevel: "info"
});