import path from "node:path";
import { fileURLToPath } from "node:url";
import { MongoClient } from "mongodb";
import {
  createJsonUserStore,
  createMongoUserStore
} from "./auth/userStore.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_USERS_FILE = path.join(
  here,
  "..",
  "data",
  "users.json"
);

// Picks where accounts live, based on the environment:
//
//   MONGODB_URI set  -> the shared team database
//   otherwise        -> data/users.json on this laptop only
//
// Returns { userStore, close }.
export async function openUserStore(env = process.env) {
  if (env.MONGODB_URI) {
    const client = new MongoClient(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10_000
    });
    try {
      await client.connect();
    } catch (err) {
      throw new Error(
        `Couldn't connect to MongoDB. Check MONGODB_URI in .env and that your IP is allowed in Atlas → Network Access.\n  ${err.message}`,
        { cause: err }
      );
    }
    const db = client.db(env.MONGODB_DB ?? "denile");
    return {
      userStore: await createMongoUserStore(db),
      where: `MongoDB database "${db.databaseName}"`,
      close: () => client.close()
    };
  }

  const usersFile = env.USERS_FILE ?? DEFAULT_USERS_FILE;
  return {
    userStore: createJsonUserStore(usersFile),
    where: `${usersFile} (this laptop only; set MONGODB_URI to share accounts)`,
    close: async () => {}
  };
}
