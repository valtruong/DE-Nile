# DE-Nile backend

Express server for DE-Nile. Right now it handles sign-in,
account creation, email verification and roles (issue #25);
diagram and telemetry routes come later. Accounts are shared by
the whole team through one MongoDB Atlas database.

## Run it

```bash
npm install
cp .env.example .env   # then fill it in (see "Team setup")
npm run dev            # http://localhost:8000
```

Then run the frontend (`npm run dev` in `react-frontend`). Vite
forwards `/api/*` to this server, so sign in at
http://localhost:5173.

When the server starts it prints where accounts are stored and
how email is sent:

```
Accounts: MongoDB database "denile"
Email: sending through smtp.gmail.com
```

If it says `data/users.json (this laptop only …)`, your `.env`
is missing `MONGODB_URI` and nobody else will see your accounts.

## Team setup (once, by one person)

Everyone runs their own backend, but all of them read and write
the same accounts in one shared database, and codes are emailed
from one team Gmail. One person sets this up, then shares the
filled-in `.env` privately.

**1. Shared database: MongoDB Atlas (free)**

1. Sign up at
   [mongodb.com/atlas](https://www.mongodb.com/cloud/atlas/register)
   and create a **free (M0)** cluster.
2. **Database Access → Add New Database User**: username
   `denile-app`, a long generated password, role "Read and write
   to any database".
3. **Network Access → Add IP Address → Allow Access from
   Anywhere** (`0.0.0.0/0`). Campus and home IPs change, so a
   fixed list breaks constantly; the database password is what
   protects it.
4. **Connect → Drivers** → copy the connection string into
   `MONGODB_URI`, replacing `<password>`.

**2. Team email: Gmail app password**

1. Make a Gmail for the team (e.g. `denile.team@gmail.com`).
2. Turn on 2-Step Verification for it (Google requires this for
   app passwords).
3. Go to
   [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords),
   create one called "DE-Nile", and put the 16 characters (no
   spaces) in `SMTP_PASS`. Put the Gmail address in `SMTP_USER`
   and `MAIL_FROM`.

**3. Session secret**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Paste the output into `SESSION_SECRET`.

**4. Share it**

Send the finished `.env` to teammates in a private message (not
the repo, not a public channel). Each person saves it as
`packages/express-backend/.env`. Anyone with this file can read
and change every account, so treat it like a password.

**5. Bring over existing local accounts (optional)**

Accounts made before the switch live in your `data/users.json`.
Copy them into the shared database, with the same passwords and
roles:

```bash
npm run import-users
```

Emails already in the database are skipped, so it's safe to run
twice.

## Accounts and roles

| Role   | Can do                                                                 |
| ------ | ---------------------------------------------------------------------- |
| viewer | Watch live diagrams. No account needed: "Continue as viewer".          |
| editor | Everything a viewer can, plus move, connect, delete and save diagrams. |
| admin  | Everything an editor can, plus manage people and roles (later).        |

**Creating an account.** Anyone with a `@calpoly.edu` email can
click "Create an account" on the sign-in page. We email them a
6-digit code (valid 15 minutes, 5 tries, one new code per
minute), and they can't sign in until they enter it. New
accounts are always **viewers**. To give someone editor access:

```bash
npm run set-role -- --email teammate@calpoly.edu --role editor
```

**Forgot password.** "Forgot password?" on the sign-in page
emails a 6-digit reset code (same limits as above). Entering it
with a new password signs you in and signs you out everywhere
else.

To remove an account (for example, to test sign-up again with
the same email):

```bash
npm run delete-user -- --email you@calpoly.edu
```

It asks you to type the email again, and won't delete the only
admin.

`npm run create-user` still works for adding an account directly
(it's marked verified, and you pick the role).

- Accounts live in the shared MongoDB database (or
  `data/users.json` if `MONGODB_URI` isn't set). Passwords and
  codes are stored only as hashes.
- Sessions use an httpOnly cookie. Set `SESSION_SECRET` in any
  shared or deployed environment.

## Email

With `SMTP_*` filled in, codes go to real inboxes. Without it,
they're **printed in the backend terminal** of whoever's server
handled the sign-up. That's fine when testing alone, but it's
why teammates couldn't get codes before.

`ALLOWED_EMAIL_DOMAINS` controls who can sign up
(comma-separated, default `calpoly.edu`; set it to an empty
string to allow any email).

## API

| Method | Route              | Result                                              |
| ------ | ------------------ | --------------------------------------------------- |
| POST   | `/api/auth/login`  | `{ email, password }` → `{ user }` or 401           |
| POST   | `/api/auth/signup` | `{ name, email, password }` → 201, emails a code    |
| POST   | `/api/auth/verify` | `{ email, code }` → `{ user }`, signed in           |
| POST   | `/api/auth/resend` | `{ email }` → 204, new code                         |
| POST   | `/api/auth/forgot` | `{ email }` → 204, emails a reset code              |
| POST   | `/api/auth/reset`  | `{ email, code, password }` → `{ user }`, signed in |
| GET    | `/api/auth/me`     | `{ user }` if signed in, otherwise 401              |
| POST   | `/api/auth/logout` | 204                                                 |

To make a future route editor-only:

```js
import { requireRole } from "./auth/requireRole.js";

app.put(
  "/api/diagrams/:id",
  requireRole("editor", app.locals.userStore),
  saveDiagram
);
```

It answers 401 if nobody is signed in and 403 if the role is too
low. The frontend hides editing for viewers, but this check on
the server is what actually enforces it.

## Tests

```bash
npm test
```

The shared-database tests are skipped unless you point them at a
MongoDB you don't mind them writing to (they use a throwaway
database and delete it afterwards):

```bash
TEST_MONGODB_URI="mongodb+srv://…" npm test
```
