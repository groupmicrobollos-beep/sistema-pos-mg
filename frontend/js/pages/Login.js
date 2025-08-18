// ./pages/Login.js
import { setAuth } from '/js/store.js';

// ===== Helpers (modo local heredado) =====
const CFG_USERS_KEY = "cfg_users";
function loadUsers() { try { return JSON.parse(localStorage.getItem(CFG_USERS_KEY) || "[]"); } catch { return []; } }
async function sha256Hex(text) {
  const enc = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,"0")).join("");
}
function b64utf8(s){ return btoa(unescape(encodeURIComponent(s))); }
async function verifyPassword(passHash, plainInput) {
  if (!passHash) return plainInput === "";
  if (passHash.startsWith("sha256:")) return (await sha256Hex(plainInput)) === passHash.slice(7);
  if (passHash.startsWith("weak:"))   return b64utf8(plainInput) === passHash.slice(5);
  return false;
}
function matchUserIdentifier(user, ident) {
  const id = String(ident||"").trim().toLowerCase();
  if (!id) return false;
  const uEmail = String(user.email||"").trim().toLowerCase();
  const uUser  = String(user.username||"").trim().toLowerCase();
  return id === uEmail || id === uUser;
}
function sanitizeUser(u){ const { passHash, ...rest } = u || {}; return rest; }

// ===== API helper (D1 via Functions) =====
async function apiLogin(identifier, password) {
  try {
    // normalizar: si es email, usar lowercase
    const ident = (identifier.includes("@") ? identifier.toLowerCase() : identifier);
    console.log("[login] Intentando login para:", ident);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      credentials: "include",
      body: JSON.stringify({ identifier: ident, password })
    });

    console.log("[login] Status:", res.status, "Headers:", Object.fromEntries(res.headers.entries()));

    const contentType = res.headers.get("content-type");
    const isJSON = contentType?.includes("application/json");
    console.log("[login] Content-Type:", contentType, "isJSON:", isJSON);

    const data = isJSON ? await res.json() : await res.text();
    console.log("[login] Response data:", typeof data, isJSON ? "JSON" : "text", res.ok ? "OK" : "Error");

    if (!res.ok) {
      const msg = (data && data.error) || data || `HTTP ${res.status}`;
      throw new Error(msg);
    }

    if (!data || typeof data !== "object") {
      console.error("[login] Respuesta inválida:", data);
      throw new Error("Respuesta del servidor inválida");
    }

    return data; // { id, email, username, role, branch_id, full_name, perms }
  } catch (err) {
    console.error("[login] Error completo:", err);
    throw err;
  }
}

export default {
  render() {
    return /*html*/`
      <div class="relative min-h-dvh overflow-hidden">
        <div class="pointer-events-none absolute -top-40 -left-40 h-96 w-96 rounded-full blur-3xl bg-indigo-600/20"></div>
        <div class="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full blur-3xl bg-fuchsia-600/20"></div>

        <div class="grid place-items-center min-h-dvh p-4">
          <div class="w-full max-w-[440px] relative">
            <div class="absolute -inset-1 rounded-2xl bg-gradient-to-r from-indigo-500/35 via-fuchsia-500/25 to-cyan-500/35 blur-xl"></div>

            <form id="loginForm" class="relative glass rounded-2xl p-6 md:p-7 space-y-5 shadow-2xl" data-login>
              <div class="text-center">
                <div class="mx-auto mb-3 h-12 w-12 grid place-items-center rounded-full bg-indigo-500/20 ring-1 ring-white/10 text-xl">🍩</div>
                <h1 class="text-xl font-semibold">Microbollos POS</h1>
                <p class="text-xs text-slate-400">Acceso al panel administrativo</p>
              </div>

              <div class="space-y-4">
                <label class="block text-sm">
                  <span class="mb-1 block text-slate-300">Usuario o email</span>
                  <div class="relative">
                    <input name="identifier" type="text" autocomplete="username" required placeholder="usuario o email"
                      class="w-full pl-10 pr-3 py-2 rounded bg-white/10 border border-white/10 focus:outline-none focus:ring focus:ring-indigo-500/40"
                    />
                    <span class="absolute left-3.5 top-2.5 text-slate-400">👤</span>
                  </div>
                </label>

                <label class="block text-sm">
                  <span class="mb-1 block text-slate-300">Contraseña</span>
                  <div class="relative">
                    <input id="pass" name="password" autocomplete="current-password" type="password" required placeholder="••••••••"
                      class="w-full pl-10 pr-10 py-2 rounded bg-white/10 border border-white/10 focus:outline-none focus:ring focus:ring-indigo-500/40"
                    />
                    <span class="absolute left-3.5 top-2.5 text-slate-400">🔒</span>
                    <button type="button" id="togglePass" class="absolute right-2 top-1.5 text-xs px-2 py-1 rounded hover:bg-white/10">ver</button>
                  </div>
                </label>
              </div>

              <button type="submit" class="w-full py-2 rounded bg-indigo-600/80 hover:bg-indigo-600 transition font-medium">
                Entrar
              </button>

              <p id="loginError" class="text-[12px] text-center text-rose-300 hidden"></p>
              <p class="text-[11px] text-center text-slate-400">
                Tip: podés usar <b>usuario o email</b> (ej. <code>admin</code> o <code>admin@pos.local</code>) y la clave que configuraste.
              </p>
            </form>
          </div>
        </div>
      </div>
    `;
  },

  mount(root) {
    const form   = root.querySelector("#loginForm");
    const pass   = root.querySelector("#pass");
    const toggle = root.querySelector("#togglePass");
    const error  = root.querySelector("#loginError");

    const showError = (msg)=>{ error.textContent = msg; error.classList.remove("hidden"); };
    const clearError = ()=>{ error.textContent = ""; error.classList.add("hidden"); };

    toggle?.addEventListener("click", () => {
      const isPass = pass.type === "password";
      pass.type = isPass ? "text" : "password";
      toggle.textContent = isPass ? "ocultar" : "ver";
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      clearError();

      const FD = new FormData(form);
      const identifier = (FD.get("identifier") || "").toString().trim();
      const password   = (FD.get("password")   || "").toString();

      if (!identifier || !password) {
        showError("Completá usuario/email y contraseña.");
        return;
      }

      const submitBtn = form.querySelector('button[type="submit"], button:not([type])');
      submitBtn && (submitBtn.disabled = true);

      try {
        // 1) API D1
        const me = await apiLogin(identifier, password);
        setAuth({ token: "cookie", user: me });
        location.hash = "#/dashboard";
        return;
      } catch (err) {
        const msg = (err && err.message) ? err.message : "Error al iniciar sesión";
        showError(msg); // p.ej., "Credenciales inválidas"
        console.warn("[login] api error", msg);
      } finally {
        submitBtn && (submitBtn.disabled = false);
      }

      // 2) Fallback local
      const users = loadUsers();
      if (!Array.isArray(users) || users.length === 0) {
        showError("No hay usuarios configurados. Creá uno en Configuración → Usuarios.");
        return;
      }

      const user = users.find(u => matchUserIdentifier(u, identifier));
      if (!user) { showError("Usuario o email no encontrado."); return; }
      if (user.active === false) { showError("El usuario está inactivo."); return; }

      const ok = await verifyPassword(user.passHash || "", password);
      if (!ok) { showError("Contraseña incorrecta."); return; }

      const token = `mb:${user.id}:${Date.now()}`;
      const safeUser = sanitizeUser(user);
      setAuth({ token, user: safeUser });
      location.hash = "#/dashboard";
    });
  }
};
