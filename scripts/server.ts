#!/usr/bin/env bun

import { file, serve, type Server } from "bun";
import { join, extname } from "path";
import { existsSync, statSync } from "fs";

const PORT = parseInt(process.env.PORT || "3000", 10);
// Use current working directory for compiled executable
const ROOT_DIR = process.env.DATA_DIR || process.cwd();

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

async function handleRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);
  let pathname = decodeURIComponent(url.pathname);

  // Handle OPTIONS for CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  // Only allow GET and HEAD
  if (req.method !== "GET" && req.method !== "HEAD") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // Resolve file path
  let filePath = join(ROOT_DIR, pathname);

  // Security: prevent directory traversal
  if (!filePath.startsWith(ROOT_DIR)) {
    return new Response("Forbidden", { status: 403 });
  }

  // Check if path is a directory, serve index.html
  if (existsSync(filePath) && statSync(filePath).isDirectory()) {
    filePath = join(filePath, "index.html");
  }

  // Check if file exists
  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    // Fallback to root index.html for SPA-like behavior (optional)
    const indexPath = join(ROOT_DIR, "index.html");
    if (pathname !== "/" && existsSync(indexPath)) {
      return new Response(file(indexPath), {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          ...corsHeaders(),
        },
      });
    }
    return new Response("Not Found", { status: 404, headers: corsHeaders() });
  }

  const mimeType = getMimeType(filePath);
  const fileHandle = file(filePath);

  // Cache static assets
  const cacheControl = pathname.startsWith("/index/") || pathname.includes("/assets/") || pathname.includes("/chainlogos/")
    ? "public, max-age=86400" // 1 day for data files
    : "public, max-age=3600"; // 1 hour for others

  return new Response(fileHandle, {
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
