#!/usr/bin/env bun

import { readdir, readFile } from "fs/promises";
import { join } from "path";

const CHAINS_DIR = join(import.meta.dir, "..", "chains");
const MIN_RPC_COUNT = 2; // <= 1

function getRpcUrl(rpc: string | { url: string }): string {
  return typeof rpc === "string" ? rpc : rpc.url || "";
}

async function main() {
  const files = (await readdir(CHAINS_DIR)).filter(f => f.endsWith(".json")).sort();

  const results: { file: string; name: string; chainId: number; rpcCount: number; rpcs: string[] }[] = [];

  for (const file of files) {
    const content = await readFile(join(CHAINS_DIR, file), "utf-8");
    const data = JSON.parse(content);
    const rpcs: any[] = data.rpc || [];

    if (rpcs.length < MIN_RPC_COUNT) {
      results.push({
        file,
        name: data.name || "Unknown",
        chainId: data.chainId,
        rpcCount: rpcs.length,
        rpcs: rpcs.map(getRpcUrl),
      });
    }
  }

  // Sort by RPC count ascending
  results.sort((a, b) => a.rpcCount - b.rpcCount);

  console.log(`Networks with fewer than ${MIN_RPC_COUNT} RPCs:\n`);
  console.log(`Found ${results.length} / ${files.length} networks\n`);

  for (const r of results) {
    console.log(`${r.name} (chainId: ${r.chainId}) — ${r.rpcCount} RPCs`);
    for (const url of r.rpcs) {
      console.log(`  ${url}`);
    }
    if (r.rpcCount === 0) console.log(`  (none)`);
  }
}

main().catch(console.error);
