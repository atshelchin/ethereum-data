#!/usr/bin/env bun

import { readdir, readFile, writeFile, mkdir, rm } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import Fuse from "fuse.js";

const ROOT_DIR = join(import.meta.dir, "..");
const CHAINS_DIR = join(ROOT_DIR, "chains");
const CHAIN_LOGOS_DIR = join(ROOT_DIR, "chainlogos");
const ASSETS_DIR = join(ROOT_DIR, "assets");
const CONTRACTS_DIR = join(ROOT_DIR, "contracts");
const INDEX_DIR = join(ROOT_DIR, "index");
const INDEX_HTML = join(ROOT_DIR, "index.html");

// Original chain data with full field names (for Fuse.js)
interface ChainFull {
  chainId: number;
  name: string;
  shortName?: string;
  nativeCurrencySymbol?: string;
  hasLogo?: boolean;
}

// Original asset data with full field names (for Fuse.js)
interface AssetFull {
  chainId: number;
  address: string;
  name: string;
  symbol: string;
  decimals?: number;
  hasLogo?: boolean;
}

// Original contract data with full field names (for Fuse.js)
interface ContractFull {
  chainId: number;
  address: string;
  name: string;
}

interface FuseIndex {
  v: string;
  t: string;
  data: ChainFull[] | AssetFull[] | ContractFull[];
  index: ReturnType<typeof Fuse.createIndex>["toJSON"] extends () => infer R ? R : never;
}

async function loadChains(): Promise<ChainFull[]> {
  const chains: ChainFull[] = [];

  try {
    const files = await readdir(CHAINS_DIR);

    for (const file of files) {
      if (!file.endsWith(".json")) continue;

      try {
        const content = await readFile(join(CHAINS_DIR, file), "utf-8");
        const data = JSON.parse(content);
        const logoPath = join(CHAIN_LOGOS_DIR, `eip155-${data.chainId}.png`);
        const hasLogo = existsSync(logoPath);

        const chain: ChainFull = {
          chainId: data.chainId,
          name: data.name || "",
        };

        if (data.shortName) chain.shortName = data.shortName;
        if (data.nativeCurrency?.symbol) chain.nativeCurrencySymbol = data.nativeCurrency.symbol;
        if (hasLogo) chain.hasLogo = true;

        chains.push(chain);
      } catch (e) {
        // Skip invalid files
      }
    }
  } catch (e) {
    console.error("Error reading chains:", e);
  }

  return chains.sort((a, b) => a.chainId - b.chainId);
}

async function loadAssets(): Promise<AssetFull[]> {
  const assets: AssetFull[] = [];

  try {
    const chainDirs = await readdir(ASSETS_DIR);

    for (const chainDir of chainDirs) {
      const match = chainDir.match(/^eip155-(\d+)$/);
      if (!match) continue;

      const chainId = parseInt(match[1], 10);
      const chainPath = join(ASSETS_DIR, chainDir);

      try {
        const addressDirs = await readdir(chainPath);

        for (const addressDir of addressDirs) {
          const infoPath = join(chainPath, addressDir, "info.json");
          const logoPath = join(chainPath, addressDir, "logo.png");

          try {
            const content = await readFile(infoPath, "utf-8");
            const data = JSON.parse(content);
            const hasLogo = existsSync(logoPath);

            const asset: AssetFull = {
              chainId,
              address: addressDir,
              name: data.name || "",
              symbol: data.symbol || "",
            };

            if (data.decimals !== undefined) asset.decimals = data.decimals;
            if (hasLogo) asset.hasLogo = true;

            assets.push(asset);
          } catch {
            // Skip if no info.json
          }
        }
      } catch (e) {
        // Skip invalid chain directories
      }
    }
  } catch (e) {
    console.error("Error reading assets:", e);
  }

  return assets;
}

async function loadContracts(): Promise<ContractFull[]> {
  const contracts: ContractFull[] = [];

  try {
    const chainDirs = await readdir(CONTRACTS_DIR);

    for (const chainDir of chainDirs) {
      const match = chainDir.match(/^eip155-(\d+)$/);
      if (!match) continue;

      const chainId = parseInt(match[1], 10);
      const chainPath = join(CONTRACTS_DIR, chainDir);

      try {
        const addressDirs = await readdir(chainPath);

        for (const addressDir of addressDirs) {
          const infoPath = join(chainPath, addressDir, "info.json");

          try {
            const content = await readFile(infoPath, "utf-8");
            const data = JSON.parse(content);

            contracts.push({
              chainId,
              address: addressDir,
              name: data.name || "",
            });
          } catch {
            // Skip if no info.json
          }
        }
      } catch (e) {
        // Skip invalid chain directories
      }
    }
  } catch (e) {
    console.error("Error reading contracts:", e);
  }

  return contracts;
}

async function generateIndex() {
  console.log("Loading data from original directories...");

  const [chains, assets, contracts] = await Promise.all([
    loadChains(),
    loadAssets(),
    loadContracts(),
  ]);

  console.log(`Loaded: ${chains.length} chains, ${assets.length} assets, ${contracts.length} contracts`);

  // Clean and recreate index directory
  try {
    await rm(INDEX_DIR, { recursive: true, force: true });
  } catch {}
  await mkdir(INDEX_DIR, { recursive: true });

  // Generate Fuse.js indexes from original data
  console.log("Generating Fuse.js indexes from original data...");

  // Chain index (search by name, shortName, nativeCurrencySymbol)
  const chainKeys = ["name", "shortName", "nativeCurrencySymbol"];
  const chainIndex = Fuse.createIndex(chainKeys, chains);
  const chainFuseData: FuseIndex = {
    v: "3.0.0",
    t: new Date().toISOString(),
    data: chains,
    index: chainIndex.toJSON(),
  };
  await writeFile(
    join(INDEX_DIR, "fuse-chains.json"),
    JSON.stringify(chainFuseData)
  );

  // Asset index (search by name, symbol)
  const assetKeys = ["name", "symbol"];
  const assetIndex = Fuse.createIndex(assetKeys, assets);
  const assetFuseData: FuseIndex = {
    v: "3.0.0",
    t: new Date().toISOString(),
    data: assets,
    index: assetIndex.toJSON(),
  };
  await writeFile(
    join(INDEX_DIR, "fuse-assets.json"),
    JSON.stringify(assetFuseData)
  );

  // Contract index (search by name)
  const contractKeys = ["name"];
  const contractIndex = Fuse.createIndex(contractKeys, contracts);
  const contractFuseData: FuseIndex = {
    v: "3.0.0",
    t: new Date().toISOString(),
    data: contracts,
    index: contractIndex.toJSON(),
  };
  await writeFile(
    join(INDEX_DIR, "fuse-contracts.json"),
    JSON.stringify(contractFuseData)
  );

  const chainSize = JSON.stringify(chainFuseData).length;
  const assetSize = JSON.stringify(assetFuseData).length;
  const contractSize = JSON.stringify(contractFuseData).length;
  const totalSize = chainSize + assetSize + contractSize;

  // Update stats in index.html
  console.log("Updating index.html stats...");
  let html = await readFile(INDEX_HTML, "utf-8");
  html = html.replace(
    /(<div class="stat-value" id="chain-count">)([^<]*)(<\/div>)/,
    `$1${chains.length.toLocaleString()}$3`
  );
  html = html.replace(
    /(<div class="stat-value" id="asset-count">)([^<]*)(<\/div>)/,
    `$1${assets.length.toLocaleString()}$3`
  );
  html = html.replace(
    /(<div class="stat-value" id="contract-count">)([^<]*)(<\/div>)/,
    `$1${contracts.length.toLocaleString()}$3`
  );
  await writeFile(INDEX_HTML, html);

  console.log("\nIndex generation complete!");
  console.log(`  - fuse-chains.json: ${(chainSize / 1024).toFixed(0)} KB (${chains.length} chains)`);
  console.log(`  - fuse-assets.json: ${(assetSize / 1024).toFixed(0)} KB (${assets.length} assets)`);
  console.log(`  - fuse-contracts.json: ${(contractSize / 1024).toFixed(0)} KB (${contracts.length} contracts)`);
  console.log(`  - Total: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
}

generateIndex().catch(console.error);
