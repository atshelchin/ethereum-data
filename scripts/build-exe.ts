#!/usr/bin/env bun

import { Glob } from "bun";
import { writeFileSync } from "fs";

const patterns = [
  { glob: "./chains/**/*", filter: (f: string) => f.endsWith(".json") || f.endsWith(".png") },
  { glob: "./chainlogos/**/*", filter: (f: string) => f.endsWith(".png") || f.endsWith(".svg") },
  { glob: "./assets/**/*", filter: (f: string) => f.endsWith(".json") || f.endsWith(".png") },
  { glob: "./index/**/*", filter: (f: string) => f.endsWith(".json") },
];

// Collect all files to embed
const filesToEmbed: string[] = ["./index.html"];

for (const { glob: pattern, filter } of patterns) {
  const g = new Glob(pattern);
  for (const file of g.scanSync({ dot: false })) {
    if (filter(file)) {
      // 确保路径格式统一为 ./xxx/yyy
      const normalizedPath = file.startsWith("./") ? file : `./${file}`;
      filesToEmbed.push(normalizedPath);
    }
  }
}

console.log(`Found ${filesToEmbed.length} files to embed`);

// Generate manifest with all imports
// manifest.ts 在 scripts/ 目录下，所以需要用 ../ 返回项目根目录
const imports = filesToEmbed.map((file, i) => {
  // ./index.html -> ../index.html
  // ./chains/xxx -> ../chains/xxx
  const relativePath = "../" + file.slice(2); // 去掉 "./" 前缀，加上 "../"
  return `import f${i} from "${relativePath}" with { type: "file" };`;
}).join("\n");

const exports = `export const files = [${filesToEmbed.map((_, i) => `f${i}`).join(", ")}];`;

const manifest = `// Auto-generated - DO NOT EDIT
${imports}
${exports}
`;

writeFileSync("./scripts/manifest.ts", manifest);
console.log("Generated manifest.ts");

// 获取目标平台参数，如果没有指定则使用当前平台
const targetArg = process.argv[2];

// Build the executable
const compileOptions: { outfile: string; target?: string } = {
  outfile: "./dist/ethereum-data",
};
if (targetArg) {
  compileOptions.target = targetArg;
}

const result = await Bun.build({
  entrypoints: ["./scripts/server.ts"],
  compile: compileOptions as any,
  naming: {
    asset: "[dir]/[name].[ext]",
  },
});

if (!result.success) {
  console.error("Build failed:");
  for (const log of result.logs) {
    console.error(log);
  }
  process.exit(1);
}

console.log(`Build successful: ${result.outputs[0].path}`);
console.log(`  Size: ${(Bun.file(result.outputs[0].path).size / 1024 / 1024).toFixed(2)} MB`);
