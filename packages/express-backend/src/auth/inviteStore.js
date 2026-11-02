import fs from "node:fs";
import path from "node:path";
import { normalizeEmail } from "./userStore.js";

// Pending invites: an admin chose a role for someone who hasn't
// signed up yet. When that email verifies, the role is applied
// and the invite is removed.
//
// An invite looks like:
//   { email, role, invitedBy, invitedByName, createdAt }
//
// Same two backends as accounts: MongoDB (shared) or a local
// JSON file (tests / offline).

export async function createMongoInviteStore(db) {
  const invites = db.collection("invites");
  await invites.createIndex({ email: 1 }, { unique: true });

  const strip = (doc) => {
    if (!doc) return null;
    // eslint-disable-next-line no-unused-vars
    const { _id, ...rest } = doc;
    return rest;
  };

  return {
    async find(email) {
      return strip(
        await invites.findOne({ email: normalizeEmail(email) })
      );
    },

    async list() {
      return (
        await invites.find().sort({ createdAt: -1 }).toArray()
      ).map(strip);
    },

    // Creates the invite, or replaces the role if one exists.
    async upsert(invite) {
      const doc = {
        ...invite,
        email: normalizeEmail(invite.email)
      };
      await invites.replaceOne({ email: doc.email }, doc, {
        upsert: true
      });
      return doc;
    },

    async remove(email) {
      const { deletedCount } = await invites.deleteOne({
        email: normalizeEmail(email)
      });
      return deletedCount === 1;
    }
  };
}

function readInvites(file) {
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeInvites(file, invites) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(
    file,
    JSON.stringify(invites, null, 2) + "\n"
  );
}

export function createJsonInviteStore(file) {
  return {
    async find(email) {
      const wanted = normalizeEmail(email);
      return (
        readInvites(file).find((i) => i.email === wanted) ??
        null
      );
    },

    async list() {
      return readInvites(file).sort(
        (a, b) => b.createdAt - a.createdAt
      );
    },

    async upsert(invite) {
      const doc = {
        ...invite,
        email: normalizeEmail(invite.email)
      };
      const rest = readInvites(file).filter(
        (i) => i.email !== doc.email
      );
      writeInvites(file, [...rest, doc]);
      return doc;
    },

    async remove(email) {
      const wanted = normalizeEmail(email);
      const all = readInvites(file);
      const rest = all.filter((i) => i.email !== wanted);
      writeInvites(file, rest);
      return rest.length < all.length;
    }
  };
}
