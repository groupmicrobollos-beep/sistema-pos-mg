// functions/api/auth/logout.js

import { deleteSession } from "../../lib/auth";

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

    // borrar sesión en DB si corresponde
    const cookieHeader = request.headers.get("Cookie") || "";
    const sidMatch = cookieHeader.match(/sid=([^;]+)/);
    if (sidMatch) {
      await deleteSession(env.DB, sidMatch[1]);
    }

    // armar cookie expirada con mismos flags que login
    const parts = [
      "sid=",
      "HttpOnly",
      `SameSite=${isCrossSite ? "None" : "Lax"}`,
      "Path=/",
      "Max-Age=0"
    ];
    if (!isLocalHttp) parts.push("Secure");
    if (
      !hostname.includes("localhost") &&
      !/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)
    ) {
      parts.push(`Domain=${hostname}`);
    }
    const expired = parts.join("; ");

    const headers = {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": origin || "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept",
      "Access-Control-Allow-Credentials": "true",
      "Vary": "Origin",
      "Set-Cookie": expired
    };

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers
    });
  } catch (e) {
    return new Response(JSON.stringify({ message: "Logout error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};
