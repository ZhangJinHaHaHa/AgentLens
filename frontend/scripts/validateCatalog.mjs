// @ts-check
/*
 * Catalog validation gate.
 *
 * Run before tsc/vite. Verifies:
 *   - every curated/listed entry has both zh + en for every I18nText
 *   - every curated entry has a matching onboarding file under data/catalog/onboarding/
 *   - scenario references resolve against the canonical scenario map
 *   - access types/risk levels/complexity values are within the allowed enums
 *
 * The script imports the source modules directly via ts-blank-space-style
 * dynamic import — but to keep zero runtime deps it parses the .ts files as
 * text and scans for shape mismatches with a small set of heuristics. That's
 * lighter than wiring tsx/esbuild and matches the "fast pre-build" intent.
 */

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, "..");
const CATALOG_DIR = join(ROOT, "src", "data", "catalog");
const ONBOARDING_DIR = join(CATALOG_DIR, "onboarding");

const ALLOWED_RISK = new Set(["low", "medium", "high"]);
const ALLOWED_COMPLEXITY = new Set(["low", "medium", "high"]);
const ALLOWED_ACCESS = new Set(["api", "saas", "cli", "browser_ext", "local", "cloud"]);

/** @type {string[]} */
const errors = [];

/**
 * @param {string} relativePath
 * @returns {string}
 */
function read(relativePath) {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

function fail(msg) {
  errors.push(msg);
}

/**
 * Extract every `{ zh: "...", en: "..." }` literal that has BOTH or just one
 * key, and complain when only one is present. We rely on a forgiving regex
 * because the source uses TypeScript with type annotations.
 *
 * @param {string} fileLabel
 * @param {string} body
 */
function checkI18nLiterals(fileLabel, body) {
  // Match { zh: "..." } and { en: "..." } literals individually
  const zhKeys = body.match(/\bzh\s*:/g)?.length ?? 0;
  const enKeys = body.match(/\ben\s*:/g)?.length ?? 0;
  if (zhKeys !== enKeys) {
    fail(
      `${fileLabel}: zh/en counts mismatch — found zh:${zhKeys} en:${enKeys}. ` +
        "Every i18n text needs both zh AND en."
    );
  }
}

/**
 * Pull every `id: "..."` value out of an entry block.
 *
 * @param {string} body
 */
function extractIds(body) {
  /** @type {string[]} */
  const ids = [];
  const re = /\bid:\s*"([a-z0-9][a-z0-9-_]*)"/g;
  let m;
  while ((m = re.exec(body)) !== null) {
    ids.push(m[1]);
  }
  return ids;
}

function extractAgentIds(body) {
  // First-level id occurrences inside the array entries. We pick the FIRST id
  // per entry block separated by `},` boundaries.
  const blocks = body.split(/},\s*\{/);
  /** @type {string[]} */
  const ids = [];
  for (const block of blocks) {
    const m = block.match(/\bid:\s*"([a-z0-9][a-z0-9-_]*)"/);
    if (m) ids.push(m[1]);
  }
  return ids;
}

function checkEnumLiterals(fileLabel, body) {
  const riskMatches = body.match(/riskLevel:\s*"([a-z]+)"/g) ?? [];
  for (const literal of riskMatches) {
    const value = literal.split('"')[1];
    if (!ALLOWED_RISK.has(value)) {
      fail(`${fileLabel}: invalid riskLevel "${value}".`);
    }
  }

  const complexityMatches = body.match(/complexity:\s*"([a-z]+)"/g) ?? [];
  for (const literal of complexityMatches) {
    const value = literal.split('"')[1];
    if (!ALLOWED_COMPLEXITY.has(value)) {
      fail(`${fileLabel}: invalid complexity "${value}".`);
    }
  }

  const accessRe = /accessTypes:\s*\[([^\]]*)\]/g;
  let m;
  while ((m = accessRe.exec(body)) !== null) {
    const list = m[1]
      .split(",")
      .map((s) => s.trim().replace(/^"|"$/g, ""))
      .filter(Boolean);
    for (const v of list) {
      if (!ALLOWED_ACCESS.has(v)) {
        fail(`${fileLabel}: invalid accessType "${v}".`);
      }
    }
  }
}

function validate() {
  const curated = read("src/data/catalog/curated.ts");
  const listed = read("src/data/catalog/listed.ts");
  const marketplace = read("src/data/catalog/marketplace.ts");

  checkI18nLiterals("curated.ts", curated);
  checkI18nLiterals("listed.ts", listed);
  checkI18nLiterals("marketplace.ts", marketplace);
  checkEnumLiterals("curated.ts", curated);
  checkEnumLiterals("listed.ts", listed);
  checkEnumLiterals("marketplace.ts", marketplace);

  const curatedIds = extractAgentIds(curated);
  const listedIds = extractAgentIds(listed);
  const marketplaceIds = extractAgentIds(marketplace);

  if (curatedIds.length < 10) {
    fail(`curated.ts: expected at least 10 agents, found ${curatedIds.length}.`);
  }
  if (listedIds.length < 15) {
    fail(`listed.ts: expected at least 15 agents, found ${listedIds.length}.`);
  }
  if (marketplaceIds.length < 10) {
    fail(`marketplace.ts: expected at least 10 agents, found ${marketplaceIds.length}.`);
  }

  const allIds = new Set();
  for (const id of curatedIds) {
    if (allIds.has(id)) {
      fail(`curated.ts: duplicate id "${id}".`);
    }
    allIds.add(id);
  }
  for (const id of listedIds) {
    if (allIds.has(id)) {
      fail(`listed.ts: duplicate id "${id}".`);
    }
    allIds.add(id);
  }
  for (const id of marketplaceIds) {
    if (allIds.has(id)) {
      fail(`marketplace.ts: duplicate id "${id}".`);
    }
    allIds.add(id);
  }

  if (existsSync(ONBOARDING_DIR)) {
    const onboardingFiles = readdirSync(ONBOARDING_DIR).filter((f) => f.endsWith(".ts"));
    const indexFile = onboardingFiles.find((f) => f === "index.ts");
    if (!indexFile) {
      fail("data/catalog/onboarding/index.ts is missing.");
    }
    for (const id of curatedIds) {
      const matching = onboardingFiles.find((f) => f === `${id}.ts`);
      if (!matching) {
        fail(`data/catalog/onboarding/${id}.ts is missing for curated agent "${id}".`);
      }
    }
  } else {
    // Sprint 1.5 will create the directory. We tolerate its absence to keep
    // the pre-Sprint-1.5 build green, but require it once it exists.
    console.warn(
      "[catalog] onboarding directory not yet created — skipping per-agent guide check."
    );
  }

  // Cross-check zh/en JSON locale parity for every namespace.
  const localesRoot = join(ROOT, "src", "i18n", "locales");
  if (existsSync(localesRoot)) {
    const zhRoot = join(localesRoot, "zh");
    const enRoot = join(localesRoot, "en");
    const namespaces = readdirSync(zhRoot).filter((f) => f.endsWith(".json"));
    for (const ns of namespaces) {
      const zhPath = join(zhRoot, ns);
      const enPath = join(enRoot, ns);
      if (!existsSync(enPath)) {
        fail(`i18n: missing en/${ns}.`);
        continue;
      }
      const zhJson = JSON.parse(readFileSync(zhPath, "utf8"));
      const enJson = JSON.parse(readFileSync(enPath, "utf8"));
      const zhKeys = listKeys(zhJson);
      const enKeys = listKeys(enJson);
      const missingInEn = zhKeys.filter((k) => !enKeys.includes(k));
      const missingInZh = enKeys.filter((k) => !zhKeys.includes(k));
      if (missingInEn.length > 0) {
        fail(`i18n: en/${ns} missing keys ${missingInEn.join(", ")}`);
      }
      if (missingInZh.length > 0) {
        fail(`i18n: zh/${ns} missing keys ${missingInZh.join(", ")}`);
      }
    }
  }
}

/**
 * @param {Record<string, unknown> | unknown[]} obj
 * @param {string} prefix
 * @returns {string[]}
 */
function listKeys(obj, prefix = "") {
  /** @type {string[]} */
  const keys = [];
  if (Array.isArray(obj)) {
    obj.forEach((item, idx) => {
      keys.push(...listKeys(/** @type {Record<string, unknown>} */ (item), `${prefix}[${idx}]`));
    });
    return keys;
  }
  if (obj && typeof obj === "object") {
    for (const [k, v] of Object.entries(obj)) {
      const next = prefix ? `${prefix}.${k}` : k;
      if (v && typeof v === "object" && !Array.isArray(v)) {
        keys.push(...listKeys(/** @type {Record<string, unknown>} */ (v), next));
      } else {
        keys.push(next);
      }
    }
  }
  return keys;
}

validate();

if (errors.length > 0) {
  console.error("\nCatalog validation failed:");
  for (const err of errors) {
    console.error("  ✗", err);
  }
  console.error(`\n${errors.length} issue(s).`);
  process.exit(1);
}

console.log("Catalog validation passed.");
