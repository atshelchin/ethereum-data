#!/usr/bin/env bun

import { serve, type Server, embeddedFiles } from "bun";
import { extname } from "path";
// 导入 manifest 触发所有静态文件的嵌入
import "./manifest.ts";

const PORT = parseInt(process.env.PORT || "3000", 10);

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8",
};

function getMimeType(path: string): string {
  const ext = extname(path).toLowerCase();
  return MIME_TYPES[ext] || "application/octet-stream";
}

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "Access-Control-Allow-Headers": "*",
  };
}

// 构建嵌入文件的查找表
const embeddedFilesMap = new Map<string, Blob>();

for (const file of embeddedFiles) {
  // file.name 格式是 "../chains/eip155-1.json"，需要去掉 "../" 前缀
  let name = file.name;
  while (name.startsWith("../") || name.startsWith("./")) {
    name = name.slice(name.startsWith("../") ? 3 : 2);
  }
  embeddedFilesMap.set("/" + name, file);
}

console.log(`Loaded ${embeddedFilesMap.size} embedded files`);

async function handleRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);
  let pathname = decodeURIComponent(url.pathname);

  // 处理 CORS 预检请求
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  // 只允许 GET 和 HEAD
  if (req.method !== "GET" && req.method !== "HEAD") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // 查找文件
  let file = embeddedFilesMap.get(pathname);

  // 如果是目录，尝试 index.html
  if (!file && (pathname === "/" || pathname.endsWith("/"))) {
    const indexPath = pathname === "/" ? "/index.html" : pathname + "index.html";
    file = embeddedFilesMap.get(indexPath);
    if (file) {
      // 明确设置 HTML Content-Type
      return new Response(file, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "public, max-age=3600",
          ...corsHeaders(),
        },
      });
    }
  }

  // 如果找不到，尝试作为 SPA 回退到 /index.html
  if (!file && pathname !== "/") {
    file = embeddedFilesMap.get("/index.html");
    if (file) {
      return new Response(file, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          ...corsHeaders(),
        },
      });
    }
  }

  if (!file) {
    return new Response("Not Found", { status: 404, headers: corsHeaders() });
  }

  const mimeType = getMimeType(pathname);

  // 缓存静态资源
  const cacheControl = pathname.startsWith("/index/") || pathname.includes("/assets/") || pathname.includes("/chainlogos/")
    ? "public, max-age=86400" // 数据文件缓存1天
    : "public, max-age=3600"; // 其他缓存1小时

  return new Response(file, {
    headers: {
      "Content-Type": mimeType,
      "Cache-Control": cacheControl,
      ...corsHeaders(),
    },
  });
}

const server: Server = serve({
  port: PORT,
  fetch: handleRequest,
});

console.log(`🚀 Ethereum Data server running at http://localhost:${server.port}`);
