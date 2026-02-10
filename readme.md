# Ethereum Data Repository

A comprehensive dataset containing EVM-compatible blockchain networks, token assets, and verified smart contracts.

**Live Demo:** [ethereum-data.pages.dev](https://ethereum-data.pages.dev) (or your deployed URL)

## Directory Structure

```
ethereum-data/
├── chains/          # Network/chain definitions (2500+ chains)
├── chainlogos/      # Chain/network logo images
├── assets/          # Token information organized by chain (12500+ tokens)
├── contracts/       # Verified smart contract data
├── index/           # Fuse.js search indexes (auto-generated)
│   ├── fuse-chains.json
│   ├── fuse-assets.json
│   └── fuse-contracts.json
└── index.html       # Landing page with live search demo
```

## Deployment

This repository is designed for static hosting on Cloudflare Pages (or similar platforms).

**Cloudflare Pages Build Settings:**

- Build command: `bun run build`
- Build output directory: `/` (root)

The build script generates Fuse.js search indexes from the original data directories.

## Search Index

Pre-built [Fuse.js](https://fusejs.io/) indexes for fuzzy search. Each index file contains both data and the Fuse.js index.

| File                    | Description           | Size    |
| ----------------------- | --------------------- | ------- |
| `fuse-chains.json`    | Chain data + index    | ~500 KB |
| `fuse-assets.json`    | Asset data + index    | ~2.5 MB |
| `fuse-contracts.json` | Contract data + index | ~1 KB   |

**Usage Example:**

```javascript
import Fuse from 'fuse.js';

// Load data and index
const res = await fetch('./index/fuse-assets.json');
const { data, index } = await res.json();

// Create Fuse instance with pre-built index
const fuseIndex = Fuse.parseIndex(index);
const fuse = new Fuse(data, {
  keys: ['name', 'symbol'],
  threshold: 0.3
}, fuseIndex);

// Fuzzy search
const results = fuse.search('usdt');
console.log(results[0].item); // { chainId: 1, address: "0x...", name: "Tether USD", symbol: "USDT", ... }
```

**Data Structure:**

```javascript
// Chain
{ chainId: 1, name: "Ethereum Mainnet", shortName: "eth", nativeCurrencySymbol: "ETH", hasLogo: true }

// Asset
{ chainId: 1, address: "0x...", name: "Tether USD", symbol: "USDT", decimals: 6, hasLogo: true }

// Contract
{ chainId: 137, address: "0x...", name: "MyContract" }
```

---

## Data Formats

### Chains (`chains/`)

Chain files follow the EIP-155 naming convention: `eip155-{chainId}.json`

**Example:** `eip155-1.json` (Ethereum Mainnet), `eip155-137.json` (Polygon)

```json
{
  "name": "Ethereum Mainnet",
  "chain": "ETH",
  "icon": "ethereum",
  "rpc": [
    "https://mainnet.infura.io/v3/${INFURA_API_KEY}",
    "https://cloudflare-eth.com"
  ],
  "features": [{ "name": "EIP155" }, { "name": "EIP1559" }],
  "faucets": [],
  "nativeCurrency": {
    "name": "Ether",
    "symbol": "ETH",
    "decimals": 18
  },
  "infoURL": "https://ethereum.org",
  "shortName": "eth",
  "chainId": 1,
  "networkId": 1,
  "slip44": 60,
  "ens": {
    "registry": "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e"
  },
  "explorers": [
    {
      "name": "etherscan",
      "url": "https://etherscan.io",
      "standard": "EIP3091"
    }
  ]
}
```

| Field              | Type     | Description                                |
| ------------------ | -------- | ------------------------------------------ |
| `name`           | string   | Full network name                          |
| `chain`          | string   | Short chain identifier                     |
| `icon`           | string   | Icon reference name                        |
| `rpc`            | string[] | List of RPC endpoint URLs                  |
| `features`       | object[] | Supported EIPs and features                |
| `faucets`        | string[] | Testnet faucet URLs (if applicable)        |
| `nativeCurrency` | object   | Native token info (name, symbol, decimals) |
| `infoURL`        | string   | Official website                           |
| `shortName`      | string   | Short name for display                     |
| `chainId`        | number   | EIP-155 chain ID                           |
| `networkId`      | number   | Network ID                                 |
| `slip44`         | number   | SLIP-44 coin type                          |
| `ens`            | object   | ENS registry address (if supported)        |
| `explorers`      | object[] | Block explorer information                 |

---

### Chain Logos (`chainlogos/`)

Chain logo images following the EIP-155 naming convention: `eip155-{chainId}.png`

```
chainlogos/
├── eip155-1.png      # Ethereum Mainnet
├── eip155-10.png     # Optimism
├── eip155-56.png     # BNB Smart Chain
├── eip155-137.png    # Polygon
├── eip155-42161.png  # Arbitrum One
└── ...
```

| Format       | Description              |
| ------------ | ------------------------ |
| File naming  | `eip155-{chainId}.png` |
| Image format | PNG                      |

---

### Assets (`assets/`)

Assets are organized by chain using the EIP-155 format:

```
assets/
├── eip155-1/           # Ethereum Mainnet tokens
│   ├── 0x00000.../
│   │   ├── info.json   # Token metadata
│   │   └── logo.png    # Token logo (optional)
│   └── ...
├── eip155-137/         # Polygon tokens
└── ...
```

**Asset Directory Contents:**

| File          | Required | Description                    |
| ------------- | -------- | ------------------------------ |
| `info.json` | Yes      | Token metadata and information |
| `logo.png`  | No       | Token logo image (PNG format)  |

**Asset info.json Format:**

```json
{
  "name": "TrueUSD",
  "website": "https://www.trueusd.com/",
  "description": "TrueUSD is the first independently-verified digital asset redeemable 1-for-1 for US Dollars.",
  "explorer": "https://etherscan.io/token/0x0000000000085d4780B73119b644AE5ecd22b376",
  "type": "ERC20",
  "symbol": "TUSD",
  "decimals": 18,
  "status": "active",
  "id": "0x0000000000085d4780B73119b644AE5ecd22b376",
  "tags": ["stablecoin"],
  "links": [
    { "name": "github", "url": "https://github.com/trusttoken/TrueUSD" },
    { "name": "x", "url": "https://x.com/tusd_official" },
    { "name": "telegram", "url": "https://t.me/TUSDofficial_EN" },
    { "name": "coingecko", "url": "https://coingecko.com/en/coins/true-usd/" }
  ]
}
```

| Field           | Type     | Description                          |
| --------------- | -------- | ------------------------------------ |
| `name`        | string   | Token name                           |
| `website`     | string   | Official website URL                 |
| `description` | string   | Token description                    |
| `explorer`    | string   | Block explorer URL for the token     |
| `type`        | string   | Token standard (ERC20, ERC721, etc.) |
| `symbol`      | string   | Token symbol                         |
| `decimals`    | number   | Token decimals                       |
| `status`      | string   | Token status (active/inactive)       |
| `id`          | string   | Contract address                     |
| `tags`        | string[] | Categorization tags                  |
| `links`       | object[] | Social and info links                |

---

### Contracts (`contracts/`)

Verified smart contracts organized by chain:

```
contracts/
└── eip155-137/
    └── 0x1b04e723.../
        ├── info.json      # Contract metadata
        └── payload.json   # ABI and bytecode
```

**Contract info.json Format:**

```json
{
  "id": "137:0x1b04e723170Dfd23E99b086dDB7C17962890aFe8",
  "chainId": 137,
  "name": "BiuBiuPremium",
  "address": "0x1b04e723170Dfd23E99b086dDB7C17962890aFe8",
  "explorer": "https://polygonscan.com/address/0x1b04e723170dfd23e99b086ddb7c17962890afe8#code",
  "sourceCode": {
    "url": "https://github.com/atshelchin/biubiu-contracts",
    "commitId": "cc04f15",
    "compilerVersion": "0.8.28+commit.7893614a",
    "optimization": { "enabled": true, "runs": 200 },
    "evmVersion": "cancun"
  },
  "proxy": {
    "isProxy": false,
    "proxyType": "",
    "implementation": ""
  }
}
```

| Field                          | Type    | Description                         |
| ------------------------------ | ------- | ----------------------------------- |
| `id`                         | string  | Unique identifier (chainId:address) |
| `chainId`                    | number  | Chain ID where contract is deployed |
| `name`                       | string  | Contract name                       |
| `address`                    | string  | Contract address                    |
| `explorer`                   | string  | Block explorer URL                  |
| `sourceCode.url`             | string  | Source code repository              |
| `sourceCode.commitId`        | string  | Git commit hash                     |
| `sourceCode.compilerVersion` | string  | Solidity compiler version           |
| `sourceCode.optimization`    | object  | Compiler optimization settings      |
| `sourceCode.evmVersion`      | string  | Target EVM version                  |
| `proxy.isProxy`              | boolean | Whether contract is a proxy         |
| `proxy.proxyType`            | string  | Proxy pattern type (if applicable)  |
| `proxy.implementation`       | string  | Implementation address (if proxy)   |

**Contract payload.json Format:**

```json
{
  "abi": [...],       // Contract ABI (Application Binary Interface)
  "bytecode": "0x..." // Compiled contract bytecode
}
```

---

## Naming Conventions

All chain-related identifiers follow the [CAIP-2](https://github.com/ChainAgnostic/CAIPs/blob/master/CAIPs/caip-2.md) standard:

- Format: `eip155-{chainId}`
- Examples:
  - `eip155-1` - Ethereum Mainnet
  - `eip155-137` - Polygon
  - `eip155-10` - Optimism
  - `eip155-42161` - Arbitrum One

## Statistics

| Category               | Count  |
| ---------------------- | ------ |
| Chains                 | 2,505  |
| Assets                 | 12,524 |
| Supported Asset Chains | 49     |
| Fuse.js Index Total    | ~3 MB  |

---

## Contributing

Contributions are welcome! Feel free to:

- Add new chains, assets, or contracts
- Fix incorrect data
- Improve documentation
- Report issues

### How to Contribute

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/add-new-chain`)
3. Add or update data following the formats above
4. Commit your changes (`git commit -m 'Add new chain data'`)
5. Push to the branch (`git push origin feature/add-new-chain`)
6. Open a Pull Request

### Data Quality Guidelines

- Ensure all JSON files are valid
- Use checksummed addresses (EIP-55)
- Include logo images in PNG format when available
- Verify RPC endpoints are functional
- Link to official sources when possible

---

## License

This project is open source. Data is aggregated from various public sources.
