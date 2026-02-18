import * as esbuild from "esbuild";
import { readFileSync, writeFileSync, mkdirSync } from "fs";

// Build code.ts → code.js (Figma plugin sandbox)
await esbuild.build({
  entryPoints: ["src/figma-plugin/code.ts"],
  bundle: true,
  outfile: "src/figma-plugin/code.js",
  target: "es6",
  platform: "browser",
  format: "iife",
});

console.log("Plugin built: src/figma-plugin/code.js");
