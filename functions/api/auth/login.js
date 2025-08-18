// functions/api/auth/login.js

import { findUser, verifyPassword, createSession, publicUser } from "../../lib/auth";

export const onRequestOptions = async ({ request }) => {
  const origin = request.headers.get("Origin") || "*";
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept",
      "Access-Control-Allow-Credentials": "true",
      "Vary": "Origin"
    }
  });
};

export const onRequestPost = async ({ request, env }) => {
  try {
    const { username, password } = await request.json();

    // validar usuario en DB
    const user = await findUser(env.DB, username);
    if (!user) {
      return new Response(JSON.stringify({ message: "Invalid credentials" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
    }

    const ok = await verifyPassword(password, user);
    if (!ok) {
      return new Response(JSON.stringify({ message: "Invalid credentials" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
    }

    // crear sesión
    const sid = await createSession(env.DB, user.id);

    // ==== CORS & Cookie flags dinámicos ====
    const origin = request.headers.get("Origin") || "";
    const url = new URL(request.url);
    const { protocol, hostname } = url;

    const isLocalHttp =
      protocol === "http:" ||
      hostname === "localhost" ||
      /^[0-9.]+$/.test(hostname);

    const isCrossSite = (() => {
      try {
        if (!origin) return false;
        return new URL(origin).hostname !== hostname;
      } catch {
        return false;
      }
    })();

    const cookieParts = [
      `sid=${sid}`,
      "HttpOnly",
      `SameSite=${isCrossSite ? "None" : "Lax"}`,
      "Path=/",
      `Max-Age=${60 * 60 * 24}` // 24 horas
    ];
    if (!isLocalHttp) cookieParts.push("Secure"); // sólo en HTTPS
    if (
      !hostname.includes("localhost") &&
      !/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)
    ) {
      cookieParts.push(`Domain=${hostname}`);
    }

    const headers = {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": origin || "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept",
      "Access-Control-Allow-Credentials": "true",
      "Vary": "Origin",
      "Set-Cookie": cookieParts.join("; ")
    };

    return new Response(JSON.stringify({ ok: true, user: publicUser(user) }), {
      status: 200,
      headers
    });
  } catch (err) {
    return new Response(JSON.stringify({ message: "Login error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};
