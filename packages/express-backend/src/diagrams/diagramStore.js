import fs from "node:fs";
import path from "node:path";

// Saved P&ID diagrams. Same two backends as accounts:
//
//   createMongoDiagramStore(db)   shared team database
//   createJsonDiagramStore(file)  data/diagrams.json (tests,
//                                 working offline)
//
// A record looks like:
//   { id, name, diagram, version, active,
//     createdAt, createdBy: { id, name },
//     updatedAt, updatedBy: { id, name } }
//
// `diagram` is the shared P&ID configuration v1 JSON (see
// docs/data-format.md). `version` goes up by one on every save,
// so two editors can't silently overwrite each other.

export async function createMongoDiagramStore(db) {
  const diagrams = db.collection("diagrams");
  await diagrams.createIndex({ updatedAt: -1 });

  const fromDoc = (doc) => {
    if (!doc) return null;
    const { _id, ...rest } = doc;
    return { id: _id, ...rest };
  };

  return {
    async list() {
      return (
        await diagrams.find().sort({ updatedAt: -1 }).toArray()
      ).map(fromDoc);
    },

    async get(id) {
      return fromDoc(await diagrams.findOne({ _id: id }));
    },

    async create(record) {
      const { id, ...rest } = record;
      await diagrams.insertOne({ _id: id, ...rest });
      return record;
    },

    // Applies `changes` and bumps the version, but only if the
    // stored version is still `expectedVersion`. Returns the
    // updated record, or null when someone saved in between.
    async update(id, changes, expectedVersion) {
      return fromDoc(
        await diagrams.findOneAndUpdate(
          { _id: id, version: expectedVersion },
          { $set: changes, $inc: { version: 1 } },
          { returnDocument: "after" }
        )
      );
    },

    // Exactly one diagram is live for operators.
    async setActive(id) {
      await diagrams.updateMany(
        { _id: { $ne: id }, active: true },
        { $set: { active: false } }
      );
      return fromDoc(
        await diagrams.findOneAndUpdate(
          { _id: id },
          { $set: { active: true } },
          { returnDocument: "after" }
        )
      );
    },

    async remove(id) {
      const { deletedCount } = await diagrams.deleteOne({
        _id: id
      });
      return deletedCount === 1;
    }
  };
}

function readAll(file) {
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeAll(file, records) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(
    file,
    JSON.stringify(records, null, 2) + "\n"
  );
}

export function createJsonDiagramStore(file) {
  return {
    async list() {
      return readAll(file).sort((a, b) =>
        b.updatedAt.localeCompare(a.updatedAt)
      );
    },

    async get(id) {
      return readAll(file).find((d) => d.id === id) ?? null;
    },

    async create(record) {
      writeAll(file, [...readAll(file), record]);
      return record;
    },

    async update(id, changes, expectedVersion) {
      const all = readAll(file);
      const record = all.find((d) => d.id === id);
      if (!record || record.version !== expectedVersion) {
        return null;
      }
      Object.assign(record, changes, {
        version: record.version + 1
      });
      writeAll(file, all);
      return record;
    },

    async setActive(id) {
      const all = readAll(file);
      const record = all.find((d) => d.id === id);
      if (!record) return null;
      for (const d of all) d.active = d.id === id;
      writeAll(file, all);
      return record;
    },

    async remove(id) {
      const all = readAll(file);
      const rest = all.filter((d) => d.id !== id);
      writeAll(file, rest);
      return rest.length < all.length;
    }
  };
}
