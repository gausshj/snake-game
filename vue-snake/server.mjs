import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL(".", import.meta.url));
const host = process.env.HOST || "127.0.0.1";
const port = Number(process.env.PORT || 5173);

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8"
};

function resolvePath(urlPath) {
  const basePath = urlPath === "/" ? "/index.html" : urlPath;
  const safePath = normalize(basePath).replace(/^(\.\.[/\\])+/, "");
  return join(rootDir, safePath);
}

createServer((request, response) => {
  const requestUrl = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
  const filePath = resolvePath(requestUrl.pathname);

  if (!filePath.startsWith(rootDir) || !existsSync(filePath) || statSync(filePath).isDirectory()) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  const contentType = mimeTypes[extname(filePath)] || "application/octet-stream";
  response.writeHead(200, { "Content-Type": contentType });
  createReadStream(filePath).pipe(response);
}).listen(port, host, () => {
  console.log(`Vue Snake dev server running at http://${host}:${port}`);
});
