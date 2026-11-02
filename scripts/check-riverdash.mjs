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
const [
  { GlobalDataTable },
  { NetworkTopicStream },
  { TopicOpenMode },
  { DataTypes, F32, Message }
] = await Promise.all([
  load("global_data_table.js"),
  load("network_stream.js"),
  load("topic.js"),
  load("types.js")
]);

// Use a local table for this test; only the test publisher can request writes.
const stream = new NetworkTopicStream();
let networkSends = 0;
stream.stream_send_message = () => {
  networkSends++;
};
const table = new GlobalDataTable(stream);
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
  table
    .get_topic("demo.pressure", TopicOpenMode.ReadWrite)
    ._unsafeUnwrap();
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
const stopValve = source.subscribe("demo.valve", (reading) =>
  valveReadings.push(reading)
);
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
console.log(
  "Actual RiverDash GDT compatibility passed: delayed init, cached snapshot, zero, timeout, recovery, live pressure and valve updates, cleanup."
);
