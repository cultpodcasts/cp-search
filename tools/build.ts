#!/usr/bin/env -S node --experimental-strip-types

// Bundles sources to dist/ and public/.
//
// build.ts [--minify] [--watch]
// --local  Run development server. Serve on http://localhost:1234 and reload on
//          code change.
// --minify    Minify output.
// --watch     Automatically rebuild whenever an input changes.

import fs from "node:fs";
import path from "node:path";
import type { BuildOptions } from "esbuild";
import esbuild from "esbuild";

const watch = process.argv.includes("--watch");

function composeHtml(): void {
  function resolveIncludes(source: string): string {
    return source.replace(/<!--include:(\S+)-->/g, (_, name: string) => {
      const fragment = fs
        .readFileSync(path.join("src/client", name), "utf-8")
        .trimEnd();
      return resolveIncludes(fragment);
    });
  }

  const shell = fs.readFileSync("src/client/shell.html", "utf-8");
  const html = resolveIncludes(shell);
  fs.writeFileSync("public/app.html", html);
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
  entryPoints: ["src/client/app.ts"],
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
  composeHtml();
  const clientCtx = await esbuild.context(clientOpts);
  const serverCtx = await esbuild.context(serverOpts);
  await Promise.all([
    watch ? clientCtx.watch() : undefined,
    watch ? serverCtx.watch() : undefined,
  ]);
} else {
  composeHtml();
  const [client, server] = await Promise.all([
    esbuild.build(clientOpts),
    esbuild.build(serverOpts),
  ]);
  if (client.metafile)
    fs.writeFileSync("dist/client.meta.json", JSON.stringify(client.metafile));
  if (server.metafile)
    fs.writeFileSync("dist/server.meta.json", JSON.stringify(server.metafile));
}
