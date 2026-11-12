import { NextRequest } from "next/server";
import { signIn, signUp } from "@/lib/backend";
import { APP_SESSION_COOKIE, encodeSession, redirectWithFlash } from "@/lib/session";

export async function POST(req: NextRequest) {
  const fd = await req.formData();
  const intent = String(fd.get("intent") || "signin");

  if (intent === "signout") {
    return redirectWithFlash("/", "ok:Signed out.", (res) =>
      res.cookies.set(APP_SESSION_COOKIE, "", { path: "/", maxAge: 0 }),
    );
  }

  const email = String(fd.get("email") || "").trim();
  const password = String(fd.get("password") || "");
  const name = String(fd.get("name") || "").trim() || "User";
  if (!email || !password) return redirectWithFlash("/", "err:Email and password are required.");

  const r = intent === "signup" ? await signUp(email, password, name) : await signIn(email, password);
  if (!r.session) {
    const back = intent === "signup" ? "/?mode=signup" : "/";
    return redirectWithFlash(back, `err:${r.error || "Authentication failed"}`);
  }

  const session = r.session;
  return redirectWithFlash("/", `ok:${intent === "signup" ? "Account created. You are signed in." : "Signed in."}`, (res) =>
    res.cookies.set(APP_SESSION_COOKIE, encodeSession(session), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    }),
  );
}
