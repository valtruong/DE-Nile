import { hasAtLeast } from "./roles.js";
import { sessionUser } from "./session.js";

// Express middleware that blocks a route unless the signed-in
// user has at least `minimum` role.
//
//   router.put("/api/diagrams/:id", requireRole("editor"), ...)
//
// 401 = not signed in, 403 = signed in but role too low.
// The role is re-read from the user store on every request,
// so a role change takes effect on the user's next request.
export function requireRole(minimum, userStore) {
  return async (req, res, next) => {
    let user;
    try {
      user = await sessionUser(req, userStore);
    } catch (err) {
      return next(err);
    }

    if (!user) {
      return res
        .status(401)
        .json({ error: "Sign in to do this." });
    }
    if (!hasAtLeast(user.role, minimum)) {
      return res.status(403).json({
        error: `This needs ${minimum} permissions.`
      });
    }
    req.user = user;
    next();
  };
}
