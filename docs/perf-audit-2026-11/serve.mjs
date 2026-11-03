// GitHub Pages 相当の静的サーバー: /portfolio/x -> x.html, gzip 対応, キャッシュ無効
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import zlib from "node:zlib";
const [root, port] = [process.argv[2], Number(process.argv[3] || 8765)];
const types = {".html":"text/html; charset=utf-8",".js":"text/javascript",".css":"text/css",".woff2":"font/woff2",".png":"image/png",".jpg":"image/jpeg",".jpeg":"image/jpeg",".svg":"image/svg+xml",".json":"application/json",".txt":"text/plain",".ico":"image/x-icon",".webp":"image/webp"};
const isDir = (p) => { try { return fs.statSync(p).isDirectory(); } catch { return false; } };
const isFile = (p) => { try { return fs.statSync(p).isFile(); } catch { return false; } };
http.createServer((req, res) => {
  try {
    const p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    const rootAbs = path.resolve(root);
    let f = path.resolve(rootAbs, "." + p);
    if (f !== rootAbs && !f.startsWith(rootAbs + path.sep)) { res.writeHead(403); return res.end("403"); }
    const bare = f.replace(/\/$/, "");
    if (isDir(f)) f = isFile(path.join(f, "index.html")) ? path.join(f, "index.html") : (isFile(bare + ".html") ? bare + ".html" : "");
    else if (!isFile(f) && isFile(f + ".html")) f = f + ".html";
    if (!f || !isFile(f)) { res.writeHead(404, {"content-type":"text/plain"}); return res.end("404"); }
    const ext = path.extname(f); const type = types[ext] || "application/octet-stream";
    const data = fs.readFileSync(f);
    const gz = /gzip/.test(req.headers["accept-encoding"] || "") && (/^(text|application)\//.test(type) || ext === ".svg");
    res.writeHead(200, {"content-type": type, "cache-control": "no-store", ...(gz ? {"content-encoding": "gzip"} : {})});
    res.end(gz ? zlib.gzipSync(data) : data);
  } catch (e) { res.writeHead(500); res.end(String(e)); }
}).listen(port, () => console.log("ready http://localhost:" + port + "/portfolio/"));
