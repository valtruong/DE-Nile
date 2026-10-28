import { isEmailVerified } from "./userStore.js";

// The user for this request's session, or null.
//
// A session stops counting once the account's password
// changes after it was created, so resetting a password
// signs out every other browser.
export async function sessionUser(req, userStore) {
  const userId = req.session?.userId;
  const user = userId ? await userStore.findById(userId) : null;
  if (!user || !isEmailVerified(user)) return null;
  if (
    user.passwordChangedAt &&
    !(req.session.signedInAt >= user.passwordChangedAt)
  ) {
    return null;
  }
  return user;
}
