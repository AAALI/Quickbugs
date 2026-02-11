#!/usr/bin/env node

/**
 * Post-processes Tailwind v4 CSS output to make it **universally compatible**
 * with consumers using Tailwind v3, v4, or no Tailwind at all.
 *
 * Problem: Tailwind v4 utilities reference theme CSS custom properties, e.g.
 *   .bottom-4 { bottom: calc(var(--spacing) * 4); }
 *   .bg-gray-900 { background-color: var(--color-gray-900); }
 * These variables don't exist in a Tailwind v3 / plain CSS environment, so
 * positioning, colors, and spacing all break silently.
 *
 * This script:
 *  1. Builds CSS with `@tailwindcss/cli` (v4).
 *  2. Strips every `@layer` wrapper (keeps inner content).
 *  3. Collects all theme variable definitions from `:root,:host`.
 *  4. Resolves every theme `var()` reference to its hardcoded value.
 *     Internal `--tw-*` variables (utility composition) are left intact.
 *  5. Removes the now-redundant `:root,:host` theme block.
 *
 * The result is flat, self-contained CSS with zero dependency on any Tailwind
 * theme — it works in a plain HTML page with a single <link> tag.
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

// 4. Resolve theme variables to hardcoded values
css = resolveThemeVariables(css);

// 5. Strip @property declarations (TW v4 specific, conflicts with TW v3 preflight)
css = stripAtProperty(css);

// 6. Strip @supports fallback block for --tw-* variable initialization
//    (the @property declarations these fall back from are already stripped)
css = stripTwSupportsBlock(css);

// 7. Convert CSS `translate` property to `transform: translate()` for TW v3 compat
css = convertTranslateProperty(css);

// 8. Write self-contained output
writeFileSync(OUT_PATH, css, "utf-8");

// 6. Clean up temp file
try {
  unlinkSync(RAW_PATH);
} catch {
  // ignore
}

// Quick sanity check — count var() refs that are NOT --tw-* (those are fine)
const allVarRefs = css.match(/var\(--[\w-]+/g) || [];
const themeLeaks = allVarRefs.filter((v) => !v.startsWith("var(--tw-"));
console.log(
  `✓ dist/styles.css built (layer-free, ${themeLeaks.length} unresolved theme vars, self-contained)`
);
if (themeLeaks.length > 0) {
  console.warn(`  ⚠ Unresolved theme vars: ${[...new Set(themeLeaks)].join(", ")}`);
}

// ===========================================================================
// @property stripping (TW v4 → TW v3 compat)
// ===========================================================================

/**
 * Remove all `@property --tw-*{…}` declarations. TW v4 uses these to define
 * custom properties with type info + initial values, but they conflict with
 * TW v3's preflight which sets the same variables via `*, ::before, ::after`.
 */
function stripAtProperty(css) {
  // @property --name { syntax:"*"; inherits:false; initial-value:0 }
  return css.replace(/@property\s+--[\w-]+\s*\{[^}]*\}/g, "");
}

// ===========================================================================
// @supports fallback block stripping
// ===========================================================================

/**
 * Remove the `@supports (…) { *, :before, :after, ::backdrop { --tw-…:… } }`
 * block that TW v4 emits as a fallback for browsers without @property support.
 * Since we stripped @property, this block would re-initialize --tw-* vars with
 * values that conflict with TW v3's own preflight.
 */
function stripTwSupportsBlock(css) {
  // Match @supports blocks that contain --tw- variable initialization
  return css.replace(
    /@supports\s+\(\(?\(-webkit-hyphens:none\)[^{]*\{[^}]*--tw-[\s\S]*?\}\s*\}/g,
    ""
  );
}

// ===========================================================================
// translate → transform conversion (TW v4 → TW v3 compat)
// ===========================================================================

/**
 * Convert CSS `translate: X Y` property to `transform: translate(X, Y)`.
 * TW v4 uses the newer CSS `translate` property; TW v3 uses `transform`.
 * The `translate` property can conflict with TW v3's preflight transform reset.
 */
function convertTranslateProperty(css) {
  // Match `translate:VALUE` within rule declarations (not inside var names)
  // The translate property in the built CSS looks like:
  //   translate:var(--tw-translate-x)var(--tw-translate-y)
  // or after var resolution, hardcoded values
  return css.replace(
    /([{;])\s*translate\s*:\s*([^;}]+)/g,
    (match, prefix, value) => {
      // Split the two values (x y) — TW v4 emits them space-separated
      const trimmed = value.trim();
      // If it contains var() refs, just convert to transform
      // The value is "Xval Yval" or "Xval" format
      return `${prefix}transform:translate(${trimmed.replace(/\)\s*(?=\S)/, "), ")})`;
    }
  );
}

// ===========================================================================
// Layer stripping
// ===========================================================================

/**
 * Remove `@layer <name> { … }` wrappers while preserving inner content.
 * Also removes bare @layer order statements like `@layer theme, base;`.
 */
function stripLayerWrappers(input) {
  let output = "";
  let i = 0;

  while (i < input.length) {
    if (
      input.startsWith("@layer", i) &&
      (i === 0 || /[\s;{}]/.test(input[i - 1]))
    ) {
      let j = i + 6;
      while (j < input.length && /\s/.test(input[j])) j++;

      let bracePos = -1;
      let semiPos = -1;
      for (let k = j; k < input.length; k++) {
        if (input[k] === "{" && bracePos === -1) { bracePos = k; break; }
        if (input[k] === ";" && semiPos === -1) { semiPos = k; break; }
      }

      if (semiPos !== -1 && (bracePos === -1 || semiPos < bracePos)) {
        i = semiPos + 1;
        continue;
      }

      if (bracePos !== -1) {
        let depth = 1;
        let m = bracePos + 1;
        while (m < input.length && depth > 0) {
          if (input[m] === "{") depth++;
          else if (input[m] === "}") depth--;
          m++;
        }
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

// ===========================================================================
// Theme variable resolution
// ===========================================================================

/**
 * Collect theme variables from `:root,:host{…}`, resolve nested references
 * among them, inline every theme `var()` throughout the CSS, then strip the
 * now-redundant `:root,:host` block.
 */
function resolveThemeVariables(css) {
  const themeVars = extractThemeVars(css);

  if (themeVars.size === 0) {
    console.warn("  ⚠ No theme variables found in :root,:host — skipping resolution");
    return css;
  }

  console.log(`  Found ${themeVars.size} theme variables — resolving…`);

  // Resolve nested refs within theme values themselves (e.g. a var that refs another var)
  resolveNestedRefs(themeVars);

  // Inline every theme var() reference in the full CSS
  css = inlineVarRefs(css, themeVars);

  // Remove the :root,:host{…} blocks (only variable definitions — no longer needed)
  css = removeThemeBlocks(css);

  return css;
}

/**
 * Extract `--name: value` pairs from every `:root,:host{…}` block.
 */
function extractThemeVars(css) {
  const vars = new Map();

  // Match :root,:host{...} — handles minified (no spaces) and formatted
  const blockRe = /:root\s*,\s*:host\s*\{/g;
  let match;

  while ((match = blockRe.exec(css)) !== null) {
    const start = match.index + match[0].length;
    // Find matching closing brace
    let depth = 1;
    let j = start;
    while (j < css.length && depth > 0) {
      if (css[j] === "{") depth++;
      else if (css[j] === "}") depth--;
      j++;
    }
    const blockContent = css.substring(start, j - 1);

    // Parse declarations: --name: value
    const declRe = /(--[\w-]+)\s*:\s*([^;]+)/g;
    let dm;
    while ((dm = declRe.exec(blockContent)) !== null) {
      vars.set(dm[1], dm[2].trim());
    }
  }

  return vars;
}

/**
 * Iteratively resolve var() references *within* the theme map values so that
 * a variable like `--text-xs: var(--font-size-xs)` gets its value inlined.
 */
function resolveNestedRefs(vars) {
  let changed = true;
  let passes = 0;

  while (changed && passes < 20) {
    changed = false;
    passes++;

    for (const [key, value] of vars) {
      if (!value.includes("var(")) continue;
      const resolved = inlineVarRefs(value, vars);
      if (resolved !== value) {
        vars.set(key, resolved);
        changed = true;
      }
    }
  }
}

/**
 * Replace every `var(--name)` / `var(--name, fallback)` in `str` whose name
 * is in `vars` with the resolved value. Internal `--tw-*` variables are
 * intentionally skipped — they're used for runtime utility composition.
 */
function inlineVarRefs(str, vars) {
  let result = "";
  let i = 0;

  while (i < str.length) {
    if (str.startsWith("var(", i)) {
      const parsed = parseVar(str, i);

      if (parsed) {
        const { name, fallback, end } = parsed;

        if (vars.has(name)) {
          // Theme variable — inline the resolved value
          result += vars.get(name);
        } else if (fallback !== null) {
          // Non-theme var (--tw-* etc.) with a fallback — keep the var()
          // wrapper but resolve any theme vars inside the fallback
          const resolvedFallback = inlineVarRefs(fallback, vars);
          result += `var(${name},${resolvedFallback})`;
        } else {
          // Non-theme var without fallback — keep as-is
          result += str.substring(i, end);
        }
        i = end;
        continue;
      }
    }

    result += str[i];
    i++;
  }

  return result;
}

/**
 * Parse a `var(…)` expression starting at `pos`, correctly handling nested
 * parentheses (e.g. `var(--x, rgb(0,0,0))`).
 *
 * Returns `{ name, fallback, end }` where `end` is the index after the
 * closing `)`, or `null` if parsing fails.
 */
function parseVar(css, pos) {
  let i = pos + 4; // skip "var("
  let depth = 1;
  let firstComma = -1;

  while (i < css.length && depth > 0) {
    const ch = css[i];
    if (ch === "(") depth++;
    else if (ch === ")") {
      depth--;
      if (depth === 0) break;
    } else if (ch === "," && depth === 1 && firstComma === -1) {
      firstComma = i;
    }
    i++;
  }

  if (depth !== 0) return null;

  const innerStart = pos + 4;
  const innerEnd = i;
  const end = i + 1;

  let name;
  let fallback;

  if (firstComma !== -1) {
    name = css.substring(innerStart, firstComma).trim();
    fallback = css.substring(firstComma + 1, innerEnd).trim();
  } else {
    name = css.substring(innerStart, innerEnd).trim();
    fallback = null;
  }

  return { name, fallback, end };
}

/**
 * Remove `:root,:host{…}` blocks that consist entirely of custom-property
 * declarations (the theme block).  Other `:root` blocks (if any) are kept.
 */
function removeThemeBlocks(css) {
  return css.replace(/:root\s*,\s*:host\s*\{[^}]*\}/g, (match) => {
    // Only remove if the block contains nothing but --custom-property declarations
    const inner = match.slice(match.indexOf("{") + 1, -1);
    const isAllVars = inner
      .split(";")
      .every((decl) => {
        const trimmed = decl.trim();
        return trimmed === "" || trimmed.startsWith("--");
      });
    return isAllVars ? "" : match;
  });
}
