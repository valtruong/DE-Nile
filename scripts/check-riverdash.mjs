import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createRiverDashSource } from "../packages/pid-viewer/dist/index.js";

const packageDirectory = process.argv[2];
if (!packageDirectory)
  throw new Error(
    "Pass the path to the compiled RiverDash global_data_source package"
  );
const load = (file) =>
  import(
    pathToFileURL(resolve(packageDirectory, "dist", file)).href
  );
// Current GDT imports create a default WebSocket singleton. Replace the socket
// in this standalone test process before importing it; never contact a server.
let socketSends = 0;
globalThis.WebSocket = class extends EventTarget {
  send() {
    socketSends++;
    throw new Error(
      "Compatibility tests must not send WebSocket data"
    );
  }
};
const { NetworkTopicStream } = await load("network_stream.js");
// Do not start the imported singleton's receive loop, including older GDT's
// polling transport. Restore the real method before creating our local table.
const start = NetworkTopicStream.prototype.start;
let GlobalDataTable;
try {
  NetworkTopicStream.prototype.start = () => {};
  ({ GlobalDataTable } = await load("global_data_table.js"));
} finally {
  NetworkTopicStream.prototype.start = start;
}
const { DataTypes, F32, Message } = await load("types.js");

// TopicOpenMode is now type-only at the public /topic export. The adapter
// accepts the stable read literal; writes below belong only to fake publishers.
const TopicOpenMode = { Read: "R", ReadWrite: "RW" };
// An inert transport also prevents the new receive loop from polling a server.
const stream = new NetworkTopicStream({
  send_data() {
    throw new Error(
      "Compatibility tests must not send transport data"
    );
  },
  receive_data() {
    return new Promise(() => {});
  }
});
let networkSends = 0;
stream.stream_send_message = () => {
  networkSends++;
};
const table = new GlobalDataTable(stream);
const getTopic = table.get_topic.bind(table);
const readModes = [];
table.get_topic = (name, mode) => {
  readModes.push(mode);
  return getTopic(name, mode);
};
const readings = [];
// A short timeout exercises real timers here; unit tests cover the five-second default.
const source = createRiverDashSource(
  table,
  TopicOpenMode.Read,
  { staleAfterMs: 50 }
);
const stop = source.subscribe("demo.pressure", (reading) =>
  readings.push(reading)
);
assert.equal(readings.at(-1).status, "unavailable");
assert.equal(
  TopicOpenMode.ReadWrite,
  "RW",
  "Use the current GDT publisher API"
);
const publisher = table.initialize_topic(
  "demo.pressure",
  TopicOpenMode.ReadWrite,
  DataTypes.F32,
  F32.from(0)._unsafeUnwrap(),
  Temporal.Now.instant()
);
assert.equal(readings.at(-1).value, 0);
assert.equal(readings.at(-1).freshness, "unconfirmed");
assert.equal(
  networkSends,
  0,
  "subscribing and initializing local data must not send network messages"
);
const writer =
  publisher ??
  getTopic(
    "demo.pressure",
    TopicOpenMode.ReadWrite
  )._unsafeUnwrap();
await new Promise((resolve) => setTimeout(resolve, 100));
assert.equal(readings.at(-1).status, "stale");
writer.write_data(F32.from(42)._unsafeUnwrap());
assert.equal(readings.at(-1).status, "available");
assert.equal(readings.at(-1).freshness, undefined);
assert.equal(readings.at(-1).value, 42);
// Fake valve strings exercise the same read path; these are not CPSS state contracts.
assert.equal(
  typeof Message,
  "function",
  "Build a current GDT revision with Message support"
);
const valveReadings = [];
const sendsBeforeValveSubscription = networkSends;
const stopValve = source.subscribe("demo.valve", (reading) =>
  valveReadings.push(reading)
);
assert.equal(networkSends, sendsBeforeValveSubscription);
const valve = table.initialize_topic(
  "demo.valve",
  TopicOpenMode.ReadWrite,
  DataTypes.Message,
  new Message("closed"),
  Temporal.Now.instant()
);
assert.equal(valveReadings.at(-1).value, "closed");
valve.write_data(new Message("open"));
assert.equal(valveReadings.at(-1).value, "open");
stopValve();
const before = readings.length;
stop();
writer.write_data(F32.from(99)._unsafeUnwrap());
assert.equal(
  readings.length,
  before,
  "unsubscribe detaches actual GDT events"
);
stream.stop?.();
// Current GDT writes may emit stream messages; those fake-publisher messages
// are intercepted above. Every topic opened by the adapter must still be read-only.
assert.ok(readModes.length > 0);
assert.ok(readModes.every((mode) => mode === "R"));
assert.equal(
  socketSends,
  0,
  "test process sends no WebSocket data"
);
console.log(
  "Actual RiverDash GDT compatibility passed: delayed init, cached snapshot, zero, timeout, recovery, live pressure and valve updates, cleanup."
);
