// ./store.js
// ===== Estado global ultra simple + pub/sub =====
const listeners = new Map();

function loadUser() {
    try { return JSON.parse(localStorage.getItem("mb_user") || "null"); }
    catch { return null; }
}

const state = {
    auth: {
        user: loadUser(),                          // usuario persistido
        token: localStorage.getItem("mb_token") || null, // opcional (compat)
    },
};

export function getState() { return state; }

export function subscribe(key, cb) {
    if (!listeners.has(key)) listeners.set(key, new Set());
    listeners.get(key).add(cb);
    return () => listeners.get(key).delete(cb);
}

function notify(key) {
    if (listeners.has(key)) for (const cb of listeners.get(key)) cb(state[key]);
}

/**
 * setAuth:
 *  - { token, user } para iniciar sesión
 *  - { token: null, user: null } o null/undefined para cerrar sesión
 */
export function setAuth(obj) {
    const next = obj || { token: null, user: null };

    state.auth.token = next.token ?? null;
    state.auth.user = next.user ?? null;

    if (state.auth.token) localStorage.setItem("mb_token", state.auth.token);
    else localStorage.removeItem("mb_token");

    if (state.auth.user) localStorage.setItem("mb_user", JSON.stringify(state.auth.user));
    else localStorage.removeItem("mb_user");

    notify("auth");
}

export function logout() { setAuth({ token: null, user: null }); }

// ✅ ahora también considera usuario (sesión por cookie httpOnly)
export function isAuthenticated() {
    return Boolean(state.auth.token || state.auth.user);
}

// ===== Helpers de permisos (compatibles con Configuración) =====
export function currentUser() { return state.auth.user || null; }

/** hasPerm("inventory") -> true si el usuario tiene perms.all o perms.inventory === true */
export function hasPerm(perm) {
    const u = currentUser(); if (!u) return false;
    const p = u.perms || {}; if (p.all) return true;
    return !!p[perm];
}

/** hasAnyPerm(["pos","quotes"]) -> true si tiene alguno (o all) */
export function hasAnyPerm(perms = []) {
    if (!Array.isArray(perms) || perms.length === 0) return false;
    const u = currentUser(); if (!u) return false;
    const p = u.perms || {}; if (p.all) return true;
    return perms.some(k => !!p[k]);
}

/* ============================
   Cliente API (Cloudflare D1)
   ============================ */
const API_BASE = ""; // mismo origen. Si usás un Worker aparte, poné su URL.

async function request(path, { method = "GET", body, headers } = {}) {
    const res = await fetch(`${API_BASE}${path}`, {
        method,
        headers: { "Content-Type": "application/json", ...(headers || {}) },
        body: body ? JSON.stringify(body) : undefined,
        credentials: "include",                // importante si usás login por cookie
    });
    const isJSON = res.headers.get("content-type")?.includes("application/json");
    const data = isJSON ? await res.json() : await res.text();
    if (!res.ok) {
        const msg = (data && data.error) || data || `HTTP ${res.status}`;
        throw new Error(msg);
    }
    return data;
}

/* ========= Auth (opcional, si creás /api/auth/*) ========= */
export const auth = {
    /** Intenta rehidratar sesión cookie -> /api/auth/me */
    async init() {
        try {
            const me = await request("/api/auth/me");
            // guardo un "token lógico" para compat con tu UI
            setAuth({ token: state.auth.token || "cookie", user: me });
            return me;
        } catch {
            // sin sesión
            return null;
        }
    },

    /** Login -> /api/auth/login (devuelve usuario y setea cookie httpOnly) */
    async login(email, password) {
        const me = await request("/api/auth/login", { method: "POST", body: { email, password } });
        setAuth({ token: "cookie", user: me });
        return me;
    },

    /** Logout -> /api/auth/logout (si no existe, limpia local) */
    async logout() {
        try { await request("/api/auth/logout", { method: "POST" }); } catch { }
        logout();
    }
};

/* ========= Productos ========= */
export const products = {
    list: () => request("/api/products"),
    get: (id) => request(`/api/products/${id}`),
    create: (p) => request("/api/products", { method: "POST", body: p }),
    update: (id, p) => request(`/api/products/${id}`, { method: "PUT", body: p }),
    remove: (id) => request(`/api/products/${id}`, { method: "DELETE" }),
};

/* ========= Sucursales ========= */
export const branches = {
    list: () => request("/api/branches"),
    create: (b) => request("/api/branches", { method: "POST", body: b }),
};

/* ========= Presupuestos ========= */
export const quotes = {
    list: () => request("/api/quotes"),
    get: (id) => request(`/api/quotes/${id}`),
    create: (q) => request("/api/quotes", { method: "POST", body: q }),
};

// Export por default (cómodo para importar como `store`)
export default { products, branches, quotes, auth, getState, subscribe, setAuth, logout, isAuthenticated, currentUser, hasPerm, hasAnyPerm };
