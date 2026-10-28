// Runs test/*.test.ts with node:test. esbuild compiles each file (TypeScript with the app's
// extensionless imports); packages such as @arcgis/core load as-is, so tests use the real SDK.
import { build } from "esbuild";
import { readdirSync } from "node:fs";
import { run } from "node:test";
import { spec } from "node:test/reporters";

const outdir = ".next/test";
const tests = readdirSync("test").filter((file) => file.endsWith(".test.ts"));
await build({
  entryPoints: tests.map((file) => `test/${file}`),
  outdir,
  outExtension: { ".js": ".mjs" },
  bundle: true,
  packages: "external",
  platform: "node",
  format: "esm",
  logLevel: "warning",
});

run({ files: tests.map((file) => `${outdir}/${file.replace(/\.ts$/, ".mjs")}`) })
  .on("test:fail", () => (process.exitCode = 1))
  .compose(spec)
  .pipe(process.stdout);
