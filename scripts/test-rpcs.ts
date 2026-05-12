#!/usr/bin/env bun

import { readdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

const CHAINS_DIR = join(import.meta.dir, "../chains");
const TIMEOUT = 5000;
const TEST_ROUNDS = 2; // test each RPC multiple times for stability

interface RpcResult {
  url: string;
  avgLatency: number; // average latency in ms, Infinity if failed
  successCount: number;
}

async function testRpc(url: string): Promise<number | null> {
  const start = performance.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method: "eth_blockNumber", params: [], id: 1 }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json();
      if (data.result) return Math.round(performance.now() - start);
    }
    return null;
  } catch {
    return null;
  }
}

function isTestable(url: string): boolean {
  return url.startsWith("http") && !url.includes("${") && !url.includes("$");
}

async function testChain(filePath: string, fileName: string) {
  const raw = readFileSync(filePath, "utf-8");
  const data = JSON.parse(raw);

  if (!data.rpc?.length) return;

  const testableRpcs = data.rpc.filter((r: string) => isTestable(r));
  const nonTestableRpcs = data.rpc.filter((r: string) => !isTestable(r));

  if (testableRpcs.length === 0) {
    console.log(`  ⏭ ${data.name} (${fileName}) — no testable RPCs`);
    return;
  }

  console.log(`  🔍 ${data.name} (${fileName}) — testing ${testableRpcs.length} RPCs...`);

  // Test all RPCs in parallel, multiple rounds
  const results: RpcResult[] = await Promise.all(
    testableRpcs.map(async (url: string) => {
      let totalLatency = 0;
      let successCount = 0;

      for (let i = 0; i < TEST_ROUNDS; i++) {
        const latency = await testRpc(url);
        if (latency !== null) {
          totalLatency += latency;
          successCount++;
        }
      }

      const avgLatency = successCount > 0 ? Math.round(totalLatency / successCount) : Infinity;
      return { url, avgLatency, successCount };
    })
  );

  // Sort: by success count desc, then by avg latency asc
  results.sort((a, b) => {
    if (a.successCount !== b.successCount) return b.successCount - a.successCount;
    return a.avgLatency - b.avgLatency;
  });

  // Log results
  for (const r of results) {
    const status = r.successCount > 0
      ? `${r.avgLatency}ms (${r.successCount}/${TEST_ROUNDS})`
      : "FAILED";
    console.log(`    ${r.successCount > 0 ? "✅" : "❌"} ${status} — ${r.url}`);
  }

  // Rebuild rpc array: sorted testable first, then non-testable
  const newRpc = [...results.map(r => r.url), ...nonTestableRpcs];

  // Check if order changed
  const orderChanged = JSON.stringify(data.rpc) !== JSON.stringify(newRpc);
  if (orderChanged) {
    data.rpc = newRpc;
    writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n");
    console.log(`    📝 Updated RPC order`);
  } else {
    console.log(`    — Order unchanged`);
  }
}

async function main() {
  const files = readdirSync(CHAINS_DIR)
    .filter(f => f.endsWith(".json"))
    .sort();

  console.log(`Found ${files.length} chain files\n`);

  let processed = 0;
  for (const file of files) {
    processed++;
    console.log(`[${processed}/${files.length}]`);
    await testChain(join(CHAINS_DIR, file), file);
    console.log();
  }

  console.log(`Done! Processed ${processed} chains.`);
}

main();
