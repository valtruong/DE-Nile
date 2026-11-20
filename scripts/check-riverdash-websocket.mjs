// Local demo protocol test only. No test-stand endpoint or hardware commands.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { once } from "node:events";
import {
  createRiverDashSource,
  formatReading,
  parseDiagram
} from "../packages/pid-viewer/dist/index.js";
import { readFile } from "node:fs/promises";

const packageDirectory = process.argv[2];
if (!packageDirectory)
  throw new Error(
    "Pass a compiled GDT package directory with ws installed for this test."
  );
const reference = process.argv.includes(
  "--reference-transport"
);
const require = createRequire(
  resolve(packageDirectory, "package.json")
);
const { WebSocketServer } = require("ws");
const { ok } = require("neverthrow");
const load = (file) =>
  import(
    pathToFileURL(resolve(packageDirectory, "dist", file)).href
  );
const NativeWebSocket = globalThis.WebSocket;
const sockets = [];
// The imported default singleton must not contact localhost:9090 or any stand.
globalThis.WebSocket = class extends EventTarget {
  send() {
    throw new Error("Unexpected singleton send");
  }
};
const { NetworkTopicStream, TransportWebsocket } = await load(
  "network_stream.js"
);
const start = NetworkTopicStream.prototype.start;
NetworkTopicStream.prototype.start = () => {};
let GlobalDataTable;
try {
  ({ GlobalDataTable } = await load("global_data_table.js"));
} finally {
  NetworkTopicStream.prototype.start = start;
  globalThis.WebSocket = NativeWebSocket;
}

const server = new WebSocketServer({
  host: "127.0.0.1",
  port: 0,
  handleProtocols: (protocols) =>
    protocols.has("RiverDash.pubsub.v1")
      ? "RiverDash.pubsub.v1"
      : false
});
await once(server, "listening");
const endpoint = new URL(
  `ws://127.0.0.1:${server.address().port}/api/ws`
);
const errors = [];
const capture = (error) => errors.push(error);
process.on("unhandledRejection", capture);
let received;
let outgoing = 0;
server.on("connection", (socket) => {
  received = socket;
  socket.on("message", () => outgoing++);
});

// A test-only queue for isolating DE-Nile/GDT from defects in host transport.
// It is never exported or installed in the viewer or RiverDash.
class ReferenceTransport {
  queue = [];
  waiting;
  constructor(url) {
    this.socket = new NativeWebSocket(url, [
      "RiverDash.pubsub.v1"
    ]);
    sockets.push(this.socket);
    this.socket.onmessage = (event) => {
      assert.equal(
        typeof event.data,
        "string",
        "Backend protocol uses text frames"
      );
      this.queue.push(event.data);
      if (this.waiting) {
        const done = this.waiting;
        this.waiting = undefined;
        done(ok(this.queue.splice(0)));
      }
    };
  }
  send_data() {
    outgoing++;
    throw new Error("DE-Nile must not transmit topic writes");
  }
  receive_data() {
    return this.queue.length
      ? Promise.resolve(ok(this.queue.splice(0)))
      : new Promise((done) => {
          this.waiting = done;
        });
  }
}
const transport = reference
  ? new ReferenceTransport(endpoint)
  : new TransportWebsocket(endpoint);
if (!reference) sockets.push(transport.m_socket);
const stream = new NetworkTopicStream(transport);
const table = new GlobalDataTable(stream);
const modes = [];
const getTopic = table.get_topic.bind(table);
table.get_topic = (name, mode) => {
  modes.push(mode);
  return getTopic(name, mode);
};
const source = createRiverDashSource(table, "R", {
  staleAfterMs: 100
});
const pressure = [];
const valve = [];
const stopPressure = source.subscribe(
  "demo.pressure.pt101",
  (r) => pressure.push(r)
);
const stopValve = source.subscribe("demo.valve.pv101", (r) =>
  valve.push(r)
);
const diagram = parseDiagram(
  JSON.parse(
    await readFile(
      new URL(
        "../packages/pid-viewer/src/team-diagram.json",
        import.meta.url
      ),
      "utf8"
    )
  )
);
const original = JSON.stringify(diagram);
const binding = (id) =>
  diagram.equipment.find((item) => item.id === id).binding;
const waitFor = async (predicate, label) => {
  const until = performance.now() + 2000;
  while (!predicate()) {
    if (errors.length) throw errors[0];
    if (performance.now() > until)
      throw new Error(`Timed out: ${label}`);
    await new Promise((done) => setTimeout(done, 5));
  }
};
const send = (name, type, data) =>
  received.send(JSON.stringify({ name, type, data }));
const declare = (name, type) =>
  send(name, "D", { name, mode: "R", type, declaration: {} });
const update = (name, data) =>
  send(name, "U", {
    data,
    ts: Temporal.Now.instant().epochNanoseconds.toString()
  });
try {
  await waitFor(() => received, "local socket open");
  assert.equal(received.protocol, "RiverDash.pubsub.v1");
  assert.equal(pressure.at(-1).status, "unavailable");
  declare("demo.pressure.pt101", "F32");
  await waitFor(
    () => table.m_topic_infos.has("demo.pressure.pt101"),
    "pressure declaration"
  );
  update("demo.pressure.pt101", { decimal: 0 });
  await waitFor(
    () => pressure.at(-1).status === "available",
    "pressure initialization"
  );
  assert.equal(pressure.at(-1).freshness, "unconfirmed");
  update("demo.pressure.pt101", { decimal: 0 });
  await waitFor(
    () =>
      pressure.at(-1).status === "available" &&
      !pressure.at(-1).freshness,
    "confirmed zero"
  );
  assert.equal(
    formatReading(
      binding("pressure-transducer1"),
      pressure.at(-1)
    ).text,
    "0.0 kPa"
  );
  declare("demo.valve.pv101", "Message");
  await waitFor(
    () => table.m_topic_infos.has("demo.valve.pv101"),
    "valve declaration"
  );
  update("demo.valve.pv101", { str: "closed" });
  await waitFor(
    () => valve.at(-1).status === "available",
    "valve initialization"
  );
  update("demo.valve.pv101", { str: "open" });
  await waitFor(
    () =>
      valve.at(-1).value === "open" && !valve.at(-1).freshness,
    "valve update"
  );
  assert.equal(
    formatReading(binding("pneumatic-valve1"), valve.at(-1))
      .text,
    "Open"
  );
  await waitFor(
    () => valve.at(-1).status === "stale",
    "update silence"
  );
  update("demo.valve.pv101", { str: "closed" });
  await waitFor(
    () => valve.at(-1).value === "closed",
    "recovery"
  );
  assert.equal(
    formatReading(binding("pneumatic-valve1"), valve.at(-1))
      .text,
    "Closed"
  );
  stopValve();
  const count = valve.length;
  update("demo.valve.pv101", { str: "open" });
  await new Promise((done) => setTimeout(done, 30));
  assert.equal(valve.length, count);
  assert.equal(JSON.stringify(diagram), original);
  assert.ok(
    modes.length > 0 && modes.every((mode) => mode === "R")
  );
  assert.equal(outgoing, 0);
  console.log(
    `${reference ? "REFERENCE TRANSPORT" : "UPSTREAM TRANSPORT"} PASSED: local WebSocket text frames → actual GDT → DE-Nile readings; zero, valve states, stale/recovery, cleanup, no writes, unchanged config.`
  );
} catch (error) {
  console.error(
    `${reference ? "REFERENCE" : "UPSTREAM"} TRANSPORT FAILED: ${error.message}`
  );
  process.exitCode = 1;
} finally {
  stopPressure();
  stopValve();
  stream.stop();
  for (const socket of sockets) {
    socket.onclose = null;
    socket.onerror = null;
    socket.onmessage = null;
    socket.close();
  }
  for (const client of server.clients) client.terminate();
  await new Promise((done) => server.close(done));
  process.removeListener("unhandledRejection", capture);
}
