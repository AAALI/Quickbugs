#!/usr/bin/env node

/**
 * Post-processes Tailwind v4 CSS output to make it compatible with consumers
 * using any Tailwind version (v3, v4) or no Tailwind at all.
 *
 * Tailwind v4 emits theme variables inside `@layer theme { … }` blocks.
 * When a consumer's Tailwind v3 / PostCSS pipeline processes that CSS, the
 * layer is stripped or reordered and the variables vanish — utilities like
 * `bg-gray-900` resolve to `var(--color-gray-900)` which is undefined.
 *
 * This script:
 *  1. Builds the CSS with `@tailwindcss/cli` (v4).
 *  2. Strips every `@layer <name> { … }` wrapper (keeps inner content).
 *  3. Removes bare `@layer` order statements (`@layer theme, base;`).
 *
 * The result is flat, self-contained CSS that works regardless of the
 * consumer's build tooling.
 */

import { readFileSync, writeFileSync, unlinkSync, mkdirSync } from "node:fs";
import { execSync } from "node:child_process";

const RAW_PATH = "dist/_styles.raw.css";
const OUT_PATH = "dist/styles.css";

// Ensure dist/ exists
mkdirSync("dist", { recursive: true });

// 1. Build with Tailwind v4 CLI
console.log("Building CSS with Tailwind v4 CLI…");
execSync(`npx @tailwindcss/cli -i src/styles.css -o ${RAW_PATH} --minify`, {
  stdio: "inherit",
});

// 2. Read raw output
let css = readFileSync(RAW_PATH, "utf-8");

// 3. Strip @layer wrappers
css = stripLayerWrappers(css);

// 4. Write self-contained output
writeFileSync(OUT_PATH, css, "utf-8");

// 5. Clean up temp file
try {
  unlinkSync(RAW_PATH);
} catch {
  // ignore
}

console.log("✓ dist/styles.css built (layer-free, self-contained)");

// ---------------------------------------------------------------------------

/**
 * Remove `@layer <name> { … }` wrappers while preserving inner content.
 * Also removes bare @layer order statements like `@layer theme, base;`.
 * Handles both minified and formatted CSS.
 */
function stripLayerWrappers(input) {
  let output = "";
  let i = 0;

  while (i < input.length) {
    // Detect @layer
    if (
      input.startsWith("@layer", i) &&
      (i === 0 || /[\s;{}]/.test(input[i - 1]))
    ) {
      let j = i + 6; // skip "@layer"

      // Skip whitespace after @layer
      while (j < input.length && /\s/.test(input[j])) j++;

      // Scan forward to find either { (block) or ; (order statement)
      let bracePos = -1;
      let semiPos = -1;
      for (let k = j; k < input.length; k++) {
        if (input[k] === "{" && bracePos === -1) {
          bracePos = k;
          break;
        }
        if (input[k] === ";" && semiPos === -1) {
          semiPos = k;
          break;
        }
      }

      // Bare order statement — e.g. `@layer theme, base, utilities;`
      if (semiPos !== -1 && (bracePos === -1 || semiPos < bracePos)) {
        i = semiPos + 1;
        continue;
      }

      // Block — unwrap contents
      if (bracePos !== -1) {
        let depth = 1;
        let m = bracePos + 1;
        while (m < input.length && depth > 0) {
          if (input[m] === "{") depth++;
          else if (input[m] === "}") depth--;
          m++;
        }
        // Content between the outer braces
        output += input.substring(bracePos + 1, m - 1);
        i = m;
        continue;
      }
    }

    output += input[i];
    i++;
  }

  return output;
}
