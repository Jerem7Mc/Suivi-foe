// Petit serveur local pour essayer l'app : node serveur.mjs, puis http://localhost:8123
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const racine = join(fileURLToPath(new URL(".", import.meta.url)), "app");
const types = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".png": "image/png" };

const port = Number(process.env.PORT) || 8123;

createServer(async (req, res) => {
  const chemin = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^(\.\.[/\\])+/, "");
  const fichier = join(racine, chemin.endsWith("/") ? chemin + "index.html" : chemin);
  try {
    const contenu = await readFile(fichier);
    res.writeHead(200, { "Content-Type": types[extname(fichier)] ?? "application/octet-stream", "Cache-Control": "no-store" });
    res.end(contenu);
  } catch {
    res.writeHead(404).end("Introuvable");
  }

}).listen(port, () => console.log(`Suivi FOE : http://localhost:${port}`));
