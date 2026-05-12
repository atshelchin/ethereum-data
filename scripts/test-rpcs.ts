#!/usr/bin/env bun

import { readdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

const CHAINS_DIR = join(import.meta.dir, "../chains");
const TIMEOUT = 5000;
const BURST_COUNT = 5; // send 5 requests concurrently to test rate limiting

interface RpcResult {
  url: string;
  avgLatency: number;
  burstSuccess: number; // how many of the 5 concurrent requests succeeded
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

// Burst test: fire BURST_COUNT requests simultaneously
async function burstTest(url: string): Promise<{ successCount: number; avgLatency: number }> {
  const results = await Promise.all(
    Array.from({ length: BURST_COUNT }, () => testRpc(url))
  );

  let total = 0;
  let count = 0;
  for (const latency of results) {
    if (latency !== null) {
      total += latency;
      count++;
    }
  }

  return {
    successCount: count,
    avgLatency: count > 0 ? Math.round(total / count) : Infinity,
  };
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

  console.log(`  🔍 ${data.name} (${fileName}) — burst testing ${testableRpcs.length} RPCs (${BURST_COUNT} concurrent)...`);

  // Test each RPC sequentially to avoid cross-interference
  const results: RpcResult[] = [];
  for (const url of testableRpcs) {
    const { successCount, avgLatency } = await burstTest(url);
    results.push({ url, avgLatency, burstSuccess: successCount });
  }

  // Sort: burst success desc → avg latency asc
  results.sort((a, b) => {
    if (a.burstSuccess !== b.burstSuccess) return b.burstSuccess - a.burstSuccess;
    return a.avgLatency - b.avgLatency;
  });

  // Log results
  for (const r of results) {
    const status = r.burstSuccess > 0
      ? `${r.avgLatency}ms (${r.burstSuccess}/${BURST_COUNT})`
      : "FAILED";
    const icon = r.burstSuccess === BURST_COUNT ? "🟢" : r.burstSuccess >= 3 ? "🟡" : r.burstSuccess > 0 ? "🟠" : "❌";
    console.log(`    ${icon} ${status} — ${r.url}`);
  }

  // Rebuild rpc array: sorted testable first, then non-testable
  const newRpc = [...results.map(r => r.url), ...nonTestableRpcs];

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
