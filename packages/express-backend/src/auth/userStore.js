import fs from "node:fs";
import path from "node:path";
import { isValidRole } from "./roles.js";

// Where accounts are stored. Two interchangeable stores with
// the same async methods:
//
//   createMongoUserStore(db)  shared team database (MongoDB
//                             Atlas); used when MONGODB_URI
//                             is set
//   createJsonUserStore(file) a local data/users.json file;
//                             for tests and working offline
//
// A user looks like:
//   { id, name, email, role, passwordHash, emailVerified,
//     verification?, passwordReset?, passwordChangedAt? }

export function normalizeEmail(email) {
  return String(email ?? "")
    .trim()
    .toLowerCase();
}

// Thrown by create() when the email is already taken.
export class DuplicateEmailError extends Error {
  constructor(email) {
    super(`An account already exists for ${email}`);
    this.name = "DuplicateEmailError";
  }
}

// ---------- MongoDB ----------

const COLLECTION = "users";

// Mongo calls the id field `_id`; the rest of the app uses
// `id`.
function fromDoc(doc) {
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return { id: _id, ...rest };
}

export async function createMongoUserStore(db) {
  const users = db.collection(COLLECTION);
  // One account per email, enforced by the database itself
  // so two people signing up at once can't both win.
  await users.createIndex({ email: 1 }, { unique: true });

  return {
    kind: "mongodb",

    async findByEmail(email) {
      return fromDoc(
        await users.findOne({ email: normalizeEmail(email) })
      );
    },

    async findById(id) {
      return fromDoc(await users.findOne({ _id: id }));
    },

    async list() {
      return (await users.find().toArray()).map(fromDoc);
    },

    async create(user) {
      const { id, ...rest } = user;
      const doc = {
        _id: id,
        ...rest,
        email: normalizeEmail(user.email)
      };
      try {
        await users.insertOne(doc);
      } catch (err) {
        if (err?.code === 11000) {
          throw new DuplicateEmailError(doc.email);
        }
        throw err;
      }
      return fromDoc(doc);
    },

    async delete(id) {
      const { deletedCount } = await users.deleteOne({
        _id: id
      });
      return deletedCount === 1;
    },

    // Merges `changes` into the user. A field set to
    // undefined is removed.
    async update(id, changes) {
      const $set = {};
      const $unset = {};
      for (const [key, value] of Object.entries(changes)) {
        if (value === undefined) $unset[key] = "";
        else $set[key] = value;
      }
      const ops = {};
      if (Object.keys($set).length) ops.$set = $set;
      if (Object.keys($unset).length) ops.$unset = $unset;
      if (!ops.$set && !ops.$unset) return this.findById(id);

      return fromDoc(
        await users.findOneAndUpdate({ _id: id }, ops, {
          returnDocument: "after"
        })
      );
    }
  };
}

// ---------- Local JSON file ----------

export function readUsers(usersFile) {
  if (!fs.existsSync(usersFile)) {
    return [];
  }
  const users = JSON.parse(fs.readFileSync(usersFile, "utf8"));
  if (!Array.isArray(users)) {
    throw new Error(`${usersFile} must contain a JSON array`);
  }
  return users;
}

export function writeUsers(usersFile, users) {
  fs.mkdirSync(path.dirname(usersFile), { recursive: true });
  fs.writeFileSync(
    usersFile,
    JSON.stringify(users, null, 2) + "\n"
  );
}

export function createJsonUserStore(usersFile) {
  return {
    kind: "json",

    async findByEmail(email) {
      const wanted = normalizeEmail(email);
      return (
        readUsers(usersFile).find(
          (user) => normalizeEmail(user.email) === wanted
        ) ?? null
      );
    },

    async findById(id) {
      return (
        readUsers(usersFile).find((user) => user.id === id) ??
        null
      );
    },

    async list() {
      return readUsers(usersFile);
    },

    async create(user) {
      const users = readUsers(usersFile);
      const email = normalizeEmail(user.email);
      if (
        users.some((u) => normalizeEmail(u.email) === email)
      ) {
        throw new DuplicateEmailError(email);
      }
      const created = { ...user, email };
      users.push(created);
      writeUsers(usersFile, users);
      return created;
    },

    async delete(id) {
      const users = readUsers(usersFile);
      const remaining = users.filter((u) => u.id !== id);
      writeUsers(usersFile, remaining);
      return remaining.length < users.length;
    },

    // Merges `changes` into the user. A field set to
    // undefined is removed.
    async update(id, changes) {
      const users = readUsers(usersFile);
      const user = users.find((u) => u.id === id);
      if (!user) return null;
      for (const [key, value] of Object.entries(changes)) {
        if (value === undefined) delete user[key];
        else user[key] = value;
      }
      writeUsers(usersFile, users);
      return user;
    }
  };
}

// ---------- Helpers ----------

// Accounts made with the create-user script predate email
// verification, so only an explicit `false` means unverified.
export function isEmailVerified(user) {
  return user.emailVerified !== false;
}

// The user object that is safe to send to the browser.
export function toPublicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: isValidRole(user.role) ? user.role : "viewer"
  };
}
