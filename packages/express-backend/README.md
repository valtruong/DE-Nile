# DE-Nile backend

Express server for DE-Nile. Right now it handles sign-in,
account creation, email verification and roles (issue #25);
diagram and telemetry routes come later.

## Run it

```bash
npm install
npm run create-user -- --email you@calpoly.edu --name "Your Name" --role editor
npm run dev          # http://localhost:8000
```

Then run the frontend (`npm run dev` in `react-frontend`). Vite
forwards `/api/*` to this server, so sign in at
http://localhost:5173.

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

`npm run create-user` still works for adding an account directly
(it's marked verified, and you pick the role).

- Accounts live in `data/users.json` (git-ignored). Passwords
  and codes are stored only as hashes.
- Sessions use an httpOnly cookie. Set `SESSION_SECRET` in any
  shared or deployed environment.

## Email

Without any setup, verification emails are **printed in the
backend terminal** instead of sent. Copy the code from there.
That's the normal way to work locally.

To send real email, set these before `npm run dev` (Gmail
example; it needs an
[app password](https://myaccount.google.com/apppasswords), not
your normal password):

```bash
export SMTP_HOST=smtp.gmail.com
export SMTP_PORT=465
export SMTP_USER=you@gmail.com
export SMTP_PASS=your-16-char-app-password
export MAIL_FROM="DE-Nile <you@gmail.com>"
```

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
