// functions/api/auth/me.js

// ⚠️ Ajustá estos imports a tus helpers reales en ../../lib/auth
// Necesitamos: obtener sesión por SID, traer usuario por ID y "sanitizar" el user para el front.
import { getSession, getUserById, publicUser } from "../../lib/auth";

export const onRequestOptions = async ({ request }) => {
  const origin = request.headers.get("Origin") || "*";
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept",
      "Access-Control-Allow-Credentials": "true",
      "Vary": "Origin"
    }
  });
};

export const onRequestGet = async ({ request, env }) => {
  try {
    const origin = request.headers.get("Origin") || "";

    // === CORS base para la respuesta (se completa más abajo)
    const baseHeaders = {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": origin || "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept",
      "Access-Control-Allow-Credentials": "true",
      "Vary": "Origin"
    };

    // 1) Leer cookie "sid"
    const cookieHeader = request.headers.get("Cookie") || "";
    const sidMatch = cookieHeader.match(/(?:^|;\s*)sid=([^;]+)/);

    if (!sidMatch) {
      // mismo mensaje que veías en consola para mantener consistencia
      return new Response(JSON.stringify({ message: "No session cookie" }), {
        status: 401,
        headers: baseHeaders
      });
    }

    const sid = sidMatch[1];

    // 2) Buscar sesión en DB
    // getSession debe validar expiración/estado y devolver { userId, ... } o null
    const session = await getSession(env.DB, sid);
    if (!session || !session.userId) {
      return new Response(JSON.stringify({ message: "Invalid session" }), {
        status: 401,
        headers: baseHeaders
      });
    }

    // 3) Traer usuario
    const user = await getUserById(env.DB, session.userId);
    if (!user) {
      return new Response(JSON.stringify({ message: "User not found" }), {
        status: 404,
        headers: baseHeaders
      });
    }

    // 4) Responder usuario "público" (sin campos sensibles)
    return new Response(
      JSON.stringify({ ok: true, user: publicUser(user) }),
      { status: 200, headers: baseHeaders }
    );
  } catch (err) {
    return new Response(JSON.stringify({ message: "Me error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};
