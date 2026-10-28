// Permanently delete an account, e.g. to test sign-up again
// with the same email:
//
//   npm run delete-user -- --email you@calpoly.edu
//
// You'll be asked to type the email again to confirm.
// Refuses to delete the only admin.
import readline from "node:readline/promises";
import { parseArgs } from "node:util";
import { normalizeEmail } from "../src/auth/userStore.js";
import { openStoreForScript } from "./open-store.js";

const { values } = parseArgs({
  options: { email: { type: "string" } }
});
const email = normalizeEmail(values.email);
if (!email) {
  console.error(
    "Usage: npm run delete-user -- --email you@calpoly.edu"
  );
  process.exit(1);
}

const { userStore, close } = await openStoreForScript();
const user = await userStore.findByEmail(email);
if (!user) {
  console.error(`No account for ${email}.`);
  await close();
  process.exit(1);
}

if (user.role === "admin") {
  const admins = (await userStore.list()).filter(
    (u) => u.role === "admin"
  );
  if (admins.length === 1) {
    console.error(
      "That's the only admin. Make someone else an admin first."
    );
    await close();
    process.exit(1);
  }
}

console.log(
  `About to delete ${user.name} <${email}> (${user.role}).`
);
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});
const answer = await rl.question(
  "Type the email again to confirm: "
);
rl.close();

if (normalizeEmail(answer) !== email) {
  console.log("Didn't match. Nothing deleted.");
  await close();
  process.exit(1);
}

await userStore.delete(user.id);
console.log(`Deleted ${email}. They can sign up again.`);
await close();
