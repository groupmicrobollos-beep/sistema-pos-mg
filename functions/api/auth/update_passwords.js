// functions/api/auth/update_passwords.js
import { getCorsHeaders, json, generateSalt, hashPassword } from '../utils.js';

export const onRequestPost = async ({ request, env }) => {
  const corsHeaders = getCorsHeaders(request);

  // Requiere admin (token = id de sesión en tabla sessions)
  const auth = request.headers.get("Authorization");
  if (!auth || !auth.startsWith("Bearer ")) {
    return json({ error: "Unauthorized" }, 401, corsHeaders);
  }
  const token = auth.split(" ")[1];

  const session = await env.DB
    .prepare("SELECT u.id, u.role FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.id = ? LIMIT 1")
    .bind(token)
    .first();

  if (!session || session.role !== "admin") {
    return json({ error: "Unauthorized" }, 401, corsHeaders);
  }

  try {
    const updated = await updateUserPasswords(env);
    return json({ message: "Passwords updated successfully", updated }, 200, corsHeaders);
  } catch (error) {
    console.error("[update_passwords] Error:", error);
    return json({ error: "Internal server error" }, 500, corsHeaders);
  }
};

/**
 * Actualiza hashes y salts de usuarios en D1.
 * Reglas mínimas:
 * - Si no tiene salt → genera uno y re-hashea.
 * - Si el hash no es hex de 64 chars → re-hashea.
 * - Si viene un campo legacy (p.ej. `password`) y faltan `password_hash`/`salt`, lo migra.
 */
async function updateUserPasswords(env) {
  // Trae columnas típicas; ajustá nombres si cambian
  const res = await env.DB.prepare(
    "SELECT id, username, password_hash, salt, password FROM users"
  ).all();

  const users = res.results || [];
  let count = 0;

  for (const u of users) {
    const needsSalt = !u.salt || typeof u.salt !== 'string' || u.salt.length < 4;
    const badHash =
      !u.password_hash ||
      typeof u.password_hash !== 'string' ||
      !/^[0-9a-f]{64}$/i.test(u.password_hash);

    // Si hay columna legacy `password` en texto plano (solo por migración)
    const hasLegacyPlain = u.password && typeof u.password === 'string' && u.password.length > 0;

    if (needsSalt || badHash || hasLegacyPlain) {
      const salt = needsSalt ? await generateSalt() : u.salt;
      // Si hay legacy plain, usarlo; si no, no podemos re-hashear sin conocer la contraseña
      const plain = hasLegacyPlain ? u.password : null;

      // Si no hay contraseña en claro, solo re-hasheamos si ya había hash inválido (no recuperable).
      // En ese caso dejamos el usuario para reset vía flujo normal.
      if (!plain && hasLegacyPlain === false && badHash) {
        // No sabemos la contraseña original → generamos un hash imposible y forzamos reset
        const randomImpossible = await generateSalt(); // solo para marcar
        const newHash = await hashPassword(randomImpossible, salt);
        await env.DB
          .prepare("UPDATE users SET password_hash = ?, salt = ? WHERE id = ?")
          .bind(newHash, salt, u.id)
          .run();
        count++;
        continue;
      }

      if (plain) {
        const newHash = await hashPassword(plain, salt);
        await env.DB
          .prepare("UPDATE users SET password_hash = ?, salt = ? WHERE id = ?")
          .bind(newHash, salt, u.id)
          .run();
        count++;
      } else if (needsSalt) {
        // Tenía hash válido pero sin salt almacenado → no podemos re-calcular sin la clave
        // Guardamos solo el salt nuevo para futuras actualizaciones si así querés (opcional).
        await env.DB
          .prepare("UPDATE users SET salt = ? WHERE id = ?")
          .bind(salt, u.id)
          .run();
        count++;
      }
    }
  }

  return { attempted: users.length, updated: count };
}
