#!/usr/bin/env node
/**
 * Verify that every publishable package would ship a working tarball.
 *
 * `pnpm build` succeeding proves the code compiles; it does not prove the
 * published artifact is usable. A wrong `files` entry, a missing CSS build
 * step, or an `exports` path that points at nothing all produce a green build
 * and a package that breaks on `npm install`. This script packs each package
 * for real and asserts every declared entry point is inside the tarball.
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const PACKAGES = ["core", "ingest", "react", "vue", "vanilla"];

/** Collect every path a consumer could resolve from the manifest. */
function declaredEntryPoints(pkg) {
  const entries = new Set();

  for (const field of ["main", "module", "types"]) {
    if (typeof pkg[field] === "string") {
      entries.add(pkg[field]);
    }
  }

  const walk = (value) => {
    if (typeof value === "string") {
      entries.add(value);
      return;
    }
    if (value && typeof value === "object") {
      Object.values(value).forEach(walk);
    }
  };
  walk(pkg.exports);

  return [...entries].map((entry) => entry.replace(/^\.\//, ""));
}

/** Files inside a packed tarball, relative to the package root. */
function tarballContents(tarballPath) {
  return execFileSync("tar", ["-tzf", tarballPath], { encoding: "utf8" })
    .split("\n")
    .filter(Boolean)
    .map((line) => line.replace(/^package\//, ""));
}

let failed = false;
const workDir = mkdtempSync(join(tmpdir(), "quickbugs-pack-"));

try {
  for (const name of PACKAGES) {
    const dir = join(ROOT, "packages", name);
    const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));

    const output = execFileSync(
      "npm",
      ["pack", "--ignore-scripts", "--pack-destination", workDir, "--json"],
      { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );

    const [{ filename }] = JSON.parse(output);
    const contents = tarballContents(join(workDir, filename));
    const missing = declaredEntryPoints(pkg).filter((entry) => !contents.includes(entry));

    if (missing.length > 0) {
      failed = true;
      console.error(`✗ ${pkg.name} — declared but not packed:`);
      for (const entry of missing) {
        console.error(`    ${entry}`);
      }
    } else {
      console.log(`✓ ${pkg.name} — ${contents.length} files, all entry points present`);
    }
  }
} finally {
  rmSync(workDir, { recursive: true, force: true });
}

if (failed) {
  console.error("\nPackaging verification failed. Fix `files`/`exports` before publishing.");
  process.exit(1);
}

console.log("\nAll packages would publish a usable tarball.");
