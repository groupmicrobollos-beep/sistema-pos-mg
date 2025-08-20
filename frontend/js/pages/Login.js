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

// ===== Utils =====
function limitText(s, n=600) {
  if (typeof s !== "string") return s;
  return s.length > n ? s.slice(0, n) + "…[truncated]" : s;
}

async function fetchWithTimeout(resource, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(resource, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

// ===== API helper (D1 via Functions) =====
async function apiLogin(identifier, password) {
  try {
    // normalizar: si es email, usar lowercase
    const ident = (identifier.includes("@") ? identifier.toLowerCase() : identifier).trim();
    console.log("[login] Intentando login para:", ident);

    const res = await fetchWithTimeout("/api/auth/login", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      credentials: "include",
      body: JSON.stringify({ identifier: ident, password })
    }, 15000);

    console.log("[login] Status:", res.status, "Headers:", Object.fromEntries(res.headers.entries()));

    const contentType = res.headers.get("content-type") || "";
    const isJSON = contentType.toLowerCase().includes("application/json");
    console.log("[login] Content-Type:", contentType, "isJSON:", isJSON);

    let payload;
    if (isJSON) {
      try {
        payload = await res.json();
      } catch {
        payload = { error: "invalid_json_response" };
      }
    } else {
      const text = await res.text();
      payload = limitText(text);
    }

    if (!res.ok) {
      // Mensajes más claros por status
      if (res.status === 401) {
        const serverMsg = typeof payload === "object" ? (payload?.error || payload?.message) : payload;
        throw new Error(serverMsg || "Credenciales inválidas");
      }
      if (res.status === 429) throw new Error("Demasiados intentos. Probá de nuevo en un momento.");
      if (res.status >= 500) {
        // Cloudflare 1101 suele devolver HTML; dejamos pista útil
        const trace = typeof payload === "string" ? payload : (payload?.error || payload?.message || "");
        throw new Error(`Error del servidor (${res.status}). ${limitText(trace, 200)}`);
      }
      const msg = (typeof payload === "object" ? (payload?.error || payload?.message) : payload) || `HTTP ${res.status}`;
      throw new Error(msg);
    }

    // Normalizar formato de respuesta: { user } o user plano
    const data = isJSON ? payload : null;
    if (!data || typeof data !== "object") {
      console.error("[login] Respuesta inválida (no JSON o vacía):", payload);
      throw new Error("Respuesta del servidor inválida");
    }

    const me = data.user ?? data; // soporta ambos formatos
    return me; // { id, email, username, role, branch_id, full_name, perms }
  } catch (err) {
    if (err?.name === "AbortError") {
      console.error("[login] Timeout de login");
      throw new Error("Tiempo de espera agotado intentando conectar con el servidor.");
    }
    console.error("[login] Error completo:", err);
    // Mensaje de red genérico si no hay message
    if (!err?.message) throw new Error("Error de red al intentar iniciar sesión.");
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
        // Deshabilitar form y mostrar estado
        form.classList.add("opacity-50", "pointer-events-none");
        submitBtn && (submitBtn.disabled = true);
        submitBtn && (submitBtn.textContent = "Iniciando sesión...");

        console.log("[login] Iniciando proceso de login");

        // 1) API D1
        const me = await apiLogin(identifier, password);
        
        if (!me || !me.id || !me.role) {
          console.error("[login] Respuesta inválida del servidor:", me);
          throw new Error("Respuesta del servidor inválida");
        }

        console.log("[login] Login exitoso, guardando sesión");
        setAuth({ token: "cookie", user: me });
        
        // Redirección
        console.log("[login] Redirigiendo a dashboard");
        location.hash = "#/dashboard";
        return;

      } catch (err) {
        console.error("[login] Error en proceso de login:", err);
        
        // Mostrar error específico o genérico
        const msg = (err && err.message) 
          ? err.message
          : "Error al iniciar sesión. Por favor, intenta de nuevo.";
        
        showError(msg);

      } finally {
        // Restaurar UI
        form.classList.remove("opacity-50", "pointer-events-none");
        submitBtn && (submitBtn.disabled = false);
        submitBtn && (submitBtn.textContent = "Entrar");
      }

      // 2) Fallback local (solo si la API falló)
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
