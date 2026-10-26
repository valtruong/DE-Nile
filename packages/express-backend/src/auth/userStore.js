import fs from "node:fs";
import path from "node:path";
import { isValidRole } from "./roles.js";

// Users live in a JSON file until the team picks a database.
// Shape: [{ id, name, email, role, passwordHash }]
// The file is git-ignored; create accounts with
// `npm run create-user`.

export function normalizeEmail(email) {
  return String(email ?? "")
    .trim()
    .toLowerCase();
}

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

export function createUserStore(usersFile) {
  return {
    findByEmail(email) {
      const wanted = normalizeEmail(email);
      return readUsers(usersFile).find(
        (user) => normalizeEmail(user.email) === wanted
      );
    },

    findById(id) {
      return readUsers(usersFile).find(
        (user) => user.id === id
      );
    },

    create(user) {
      const users = readUsers(usersFile);
      users.push(user);
      writeUsers(usersFile, users);
      return user;
    },

    // Shallow-merges `changes` into the user and saves.
    update(id, changes) {
      const users = readUsers(usersFile);
      const user = users.find((u) => u.id === id);
      if (!user) return null;
      Object.assign(user, changes);
      writeUsers(usersFile, users);
      return user;
    }
  };
}

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
