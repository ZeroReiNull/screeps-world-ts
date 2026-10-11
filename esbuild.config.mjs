import esbuild from "esbuild";

await esbuild.build({
  entryPoints: ["src/main.ts"],
  outfile: "dist/main.js",
  bundle: true,
  platform: "neutral",
  format: "cjs",
  target: "es2019",
  sourcemap: "external",
  sourcesContent: true,
  minify: false,
  external: ['lodash'],
  logLevel: "info"
});