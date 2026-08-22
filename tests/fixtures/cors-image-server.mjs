import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const image = readFileSync(resolve("apps/playground/public/backgrounds/bg-4.jpg"));

createServer((request, response) => {
  if (request.url === "/health") {
    response.writeHead(200, { "Content-Type": "text/plain" });
    response.end("ok");
    return;
  }
  if (request.url === "/bg-4.jpg") {
    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Length": image.byteLength,
      "Content-Type": "image/jpeg",
    });
    response.end(image);
    return;
  }
  response.writeHead(404, { "Content-Type": "text/plain" });
  response.end("not found");
}).listen(3193, "127.0.0.1");
