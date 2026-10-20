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
  { DataTypes, F32 }
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
const source = createRiverDashSource(table, TopicOpenMode.Read);
const stop = source.subscribe("demo.pressure", (reading) =>
  readings.push(reading)
);
assert.equal(readings.at(-1).status, "unavailable");
table.initialize_topic(
  "demo.pressure",
  TopicOpenMode.Write,
  DataTypes.F32,
  F32.from(0)._unsafeUnwrap(),
  Temporal.Now.instant()
);
assert.equal(readings.at(-1).value, 0);
assert.equal(
  networkSends,
  0,
  "subscribing and initializing local data must not send network messages"
);
const writer = table
  .get_topic("demo.pressure", TopicOpenMode.Write)
  ._unsafeUnwrap();
writer.write_data(F32.from(42)._unsafeUnwrap());
assert.equal(readings.at(-1).value, 42);
const before = readings.length;
stop();
writer.write_data(F32.from(99)._unsafeUnwrap());
assert.equal(
  readings.length,
  before,
  "unsubscribe detaches actual GDT events"
);
console.log(
  "Actual RiverDash GDT compatibility passed: delayed init, zero, numeric wrapper decoding, live update, cleanup."
);
