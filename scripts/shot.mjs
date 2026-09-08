// Headless Chrome + CDP screenshot helper (no deps; Node >=22 global WebSocket)
import { writeFileSync } from "node:fs";
const PORT = 9333;
const OUT = process.argv[2];
const URL_ = process.argv[3];
const PRE = process.argv[4] || ""; // JS to run before shot
const CLIP = process.argv[5] ? JSON.parse(process.argv[5]) : null;

const res = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: "PUT" });
const target = await res.json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pending = new Map();
const events = [];
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); }
  else if (d.method) events.push(d.method);
};
const send = (method, params = {}) =>
  new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

await send("Page.enable");
await send("Emulation.setFocusEmulationEnabled", { enabled: true });
await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 2, mobile: false });
await send("Page.navigate", { url: URL_ });
for (let i = 0; i < 60 && !events.includes("Page.loadEventFired"); i++) await sleep(250);
await sleep(1500);
const TABS = Number(process.env.TABS || 0);
for (let i = 0; i < TABS; i++) {
  await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
  await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
  await sleep(120);
}
if (PRE) {
  const r = await send("Runtime.evaluate", { expression: PRE, awaitPromise: true, returnByValue: true });
  console.log("PRE result:", JSON.stringify(r.result?.result?.value ?? r.result));
  await sleep(900);
}
const shot = await send("Page.captureScreenshot", CLIP ? { clip: { ...CLIP, scale: 2 } } : {});
writeFileSync(OUT, Buffer.from(shot.result.data, "base64"));
console.log("saved", OUT);
await send("Target.closeTarget", { targetId: target.id });
ws.close();
