#!/usr/bin/env -S node --experimental-strip-types

// Bundles sources to dist/ and public/.
//
// build.ts [--minify] [--watch]
// --local  Run development server. Serve on http://localhost:1234 and reload on
//          code change.
// --minify    Minify output.
// --watch     Automatically rebuild whenever an input changes.

import fs from "node:fs";
import type { BuildOptions } from "esbuild";
import esbuild from "esbuild";

const watch = process.argv.includes("--watch");

function copyHtml(): void {
  fs.copyFileSync("src/client/search.html", "public/search.html");
  fs.copyFileSync("src/client/episode.html", "public/episode.html");
}

const opts: BuildOptions = {
  bundle: true,
  logLevel: "info", // Print the port and build demarcations.
  metafile: true,
  sourcemap: "linked",
  target: "es2023", // https://esbuild.github.io/content-types/#tsconfig-json
};

const clientOpts: BuildOptions = {
  ...opts,
  entryNames: "[name]",
  entryPoints: ["src/client/search.ts", "src/client/episode.ts"],
  format: "esm",
  outdir: "public",
  platform: "browser",
};
const serverOpts: BuildOptions = {
  ...opts,
  entryPoints: ["src/server/index.ts"],
  format: "cjs",
  outdir: "dist/server",
  platform: "node",
};

if (watch) {
  copyHtml();
  const clientCtx = await esbuild.context(clientOpts);
  const serverCtx = await esbuild.context(serverOpts);
  await Promise.all([
    watch ? clientCtx.watch() : undefined,
    watch ? serverCtx.watch() : undefined,
  ]);
} else {
  copyHtml();
  const [client, server] = await Promise.all([
    esbuild.build(clientOpts),
    esbuild.build(serverOpts),
  ]);
  if (client.metafile)
    fs.writeFileSync("dist/client.meta.json", JSON.stringify(client.metafile));
  if (server.metafile)
    fs.writeFileSync("dist/server.meta.json", JSON.stringify(server.metafile));
}
