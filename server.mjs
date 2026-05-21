import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";

const root = join(process.cwd(), "dist");
const port = Number(process.env.PORT || 4173);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp"
};

createServer((request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host}`);
  const pathname = decodeURIComponent(url.pathname);
  const requestedPath = normalize(join(root, pathname));
  const safePath = requestedPath.startsWith(root) ? requestedPath : join(root, "index.html");
  const filePath = existsSync(safePath) && statSync(safePath).isFile() ? safePath : join(root, "index.html");
  const type = mimeTypes[extname(filePath)] || "application/octet-stream";

  response.writeHead(200, { "Content-Type": type });
  createReadStream(filePath).pipe(response);
}).listen(port, "0.0.0.0", () => {
  console.log(`Buscador de Escuelas listo en puerto ${port}`);
});
