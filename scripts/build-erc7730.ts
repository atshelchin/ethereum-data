#!/usr/bin/env bun

/**
 * Build ERC-7730 clear signing data from the upstream registry.
 *
 * Input:  https://github.com/ethereum/clear-signing-erc7730-registry (cloned locally)
 * Output: erc7730/
 *           ercs.json                          — universal ERC standards (ERC-20, ERC-721, etc.)
 *           calldata/{chainId}/{address}.json   — per-contract calldata descriptors
 *           eip712/{chainId}/{address}.json     — per-contract EIP-712 descriptors (keyed by encodeTypeHash)
 *
 * Usage:
 *   bun run scripts/build-erc7730.ts [path-to-registry]
 *
 * If path is omitted, defaults to ../clear-signing-erc7730-registry (sibling directory).
 */

import { readFile, writeFile, mkdir, rm, readdir } from "fs/promises";
import { join, basename } from "path";
import { existsSync } from "fs";

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const ROOT_DIR = join(import.meta.dir, "..");
const OUT_DIR = join(ROOT_DIR, "erc7730");

const registryRoot =
  process.argv[2] ||
  join(ROOT_DIR, "..", "clear-signing-erc7730-registry");

if (!existsSync(registryRoot)) {
  console.error(
    `Registry not found at: ${registryRoot}\n` +
      `Clone it first:\n  git clone https://github.com/ethereum/clear-signing-erc7730-registry.git`
  );
  process.exit(1);
}

const ERCS_DIR = join(registryRoot, "ercs");
const INDEX_CALLDATA = join(registryRoot, "index.calldata.json");
const INDEX_EIP712 = join(registryRoot, "index.eip712.json");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseKey(key: string): { chainId: string; address: string } | null {
  // "eip155:137:0xAbC..." → { chainId: "137", address: "0xabc..." }
  const parts = key.split(":");
  if (parts.length !== 3) return null;
  return { chainId: parts[1], address: parts[2].toLowerCase() };
}

async function readJson(path: string): Promise<any> {
  return JSON.parse(await readFile(path, "utf-8"));
}

async function writeJson(path: string, data: any) {
  const dir = join(path, "..");
  if (!existsSync(dir)) await mkdir(dir, { recursive: true });
  await writeFile(path, JSON.stringify(data, null, 2));
}

/**
 * Resolve a descriptor's `includes` field per ERC-7730 spec.
 *
 * Merges from the included file (included values first, descriptor overrides):
 *   - metadata (owner, info, enums, constants, token, maps)
 *   - display.definitions (shared formatter refs)
 *   - display.formats
 *
 * Also removes `$schema` (relative path not valid outside upstream repo)
 * and `includes` (already resolved).
 */
const resolveCache = new Map<string, any>();

function mergeObjects(base: any, override: any): any {
  if (!base) return override;
  if (!override) return base;
  return { ...base, ...override };
}

async function resolveDescriptor(filePath: string): Promise<any> {
  if (resolveCache.has(filePath)) return resolveCache.get(filePath);

  const desc = await readJson(filePath);
  if (desc.includes) {
    const dir = join(filePath, "..");
    const includePath = join(dir, desc.includes);
    try {
      const included = await resolveDescriptor(includePath);

      // Merge metadata (included first, descriptor overrides)
      desc.metadata = mergeObjects(included?.metadata, desc.metadata);

      // Merge display.definitions
      if (!desc.display) desc.display = {};
      desc.display.definitions = mergeObjects(
        included?.display?.definitions,
        desc.display.definitions,
      );
      if (!desc.display.definitions) delete desc.display.definitions;

      // Merge display.formats
      desc.display.formats = mergeObjects(
        included?.display?.formats,
        desc.display.formats,
      );
    } catch {
      // include target missing — continue with what we have
    }
    delete desc.includes;
  }

  // Remove relative $schema (not valid outside upstream repo)
  delete desc.$schema;

  resolveCache.set(filePath, desc);
  return desc;
}

// ---------------------------------------------------------------------------
// 1. Build ercs.json — universal standards
// ---------------------------------------------------------------------------

async function buildErcs() {
  if (!existsSync(ERCS_DIR)) {
    console.warn("No ercs/ directory found, skipping ercs.json");
    return;
  }
  const files = await readdir(ERCS_DIR);
  const result: Record<string, any> = {};
  for (const f of files) {
    if (!f.endsWith(".json")) continue;
    const name = basename(f, ".json"); // e.g. "calldata-erc20-tokens"
    const desc = await readJson(join(ERCS_DIR, f));
    delete desc.$schema;
    result[name] = desc;
  }
  await writeJson(join(OUT_DIR, "ercs.json"), result);
  console.log(`ercs.json: ${Object.keys(result).length} standards`);
}

// ---------------------------------------------------------------------------
// 2. Build calldata/{chainId}/{address}.json
// ---------------------------------------------------------------------------

async function buildCalldata() {
  if (!existsSync(INDEX_CALLDATA)) {
    console.warn("index.calldata.json not found, skipping calldata/");
    return;
  }
  const index: Record<string, string> = await readJson(INDEX_CALLDATA);

  // Group by chainId/address, resolve descriptor paths
  // Multiple index entries can point to the same descriptor file — cache reads
  const descriptorCache = new Map<string, any>();
  // Accumulate: chainId/address → { ...all formats merged }
  const grouped = new Map<string, any[]>();

  for (const [key, descriptorPath] of Object.entries(index)) {
    const parsed = parseKey(key);
    if (!parsed) continue;

    const fullPath = join(registryRoot, descriptorPath);
    if (!descriptorCache.has(descriptorPath)) {
      try {
        descriptorCache.set(descriptorPath, await resolveDescriptor(fullPath));
      } catch {
        console.warn(`  skip: ${descriptorPath} (read error)`);
        continue;
      }
    }

    const fileKey = `${parsed.chainId}/${parsed.address}`;
    if (!grouped.has(fileKey)) grouped.set(fileKey, []);
    grouped.get(fileKey)!.push(descriptorCache.get(descriptorPath));
  }

  // Write per-address files: preserve original ERC-7730 schema structure.
  // Single descriptor → output as-is; multiple → array.
  let count = 0;
  for (const [fileKey, descriptors] of grouped) {
    const valid = descriptors.filter(d => d?.display?.formats && Object.keys(d.display.formats).length > 0);
    if (valid.length === 0) continue;
    const output = valid.length === 1 ? valid[0] : valid;
    await writeJson(join(OUT_DIR, "calldata", `${fileKey}.json`), output);
    count++;
  }
  console.log(`calldata/: ${count} files`);
}

// ---------------------------------------------------------------------------
// 3. Build eip712/{chainId}/{address}.json
// ---------------------------------------------------------------------------

async function buildEip712() {
  if (!existsSync(INDEX_EIP712)) {
    console.warn("index.eip712.json not found, skipping eip712/");
    return;
  }
  const index: Record<string, Record<string, any[]>> = await readJson(INDEX_EIP712);
  const descriptorCache = new Map<string, any>();

  let count = 0;
  for (const [key, typeMap] of Object.entries(index)) {
    const parsed = parseKey(key);
    if (!parsed) continue;

    // Build flat map: encodeTypeHash → descriptor content
    const flat: Record<string, any> = {};

    for (const [_primaryType, entries] of Object.entries(typeMap)) {
      for (const entry of entries) {
        const descriptorPath = entry.path;
        const hashes: string[] = entry.encodeTypeHashes || [];

        if (!descriptorCache.has(descriptorPath)) {
          try {
            descriptorCache.set(
              descriptorPath,
              await resolveDescriptor(join(registryRoot, descriptorPath))
            );
          } catch {
            console.warn(`  skip: ${descriptorPath} (read error)`);
            continue;
          }
        }
        const desc = descriptorCache.get(descriptorPath);
        for (const h of hashes) {
          flat[h] = desc;
        }
      }
    }

    if (Object.keys(flat).length === 0) continue;
    await writeJson(
      join(OUT_DIR, "eip712", `${parsed.chainId}/${parsed.address}.json`),
      flat
    );
    count++;
  }
  console.log(`eip712/: ${count} files`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`Registry: ${registryRoot}`);
  console.log(`Output:   ${OUT_DIR}\n`);

  // Clean output
  if (existsSync(OUT_DIR)) await rm(OUT_DIR, { recursive: true });
  await mkdir(OUT_DIR, { recursive: true });

  await buildErcs();
  await buildCalldata();
  await buildEip712();

  console.log("\nDone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
