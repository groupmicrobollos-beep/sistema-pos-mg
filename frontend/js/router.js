// ./router.js
import { isAuthenticated, setAuth, hasPerm, hasAnyPerm } from "./store.js";
import { Shell } from "./components/Shell.js";

// === Definición de rutas con metadatos de permisos ===
// requireAll: requiere TODOS esos permisos
// requireAny: requiere AL MENOS uno de esos permisos
const ROUTES = {
    "/login": { public: true, loader: () => import("./pages/Login.js") },
    "/dashboard": { public: false, loader: () => import("./pages/Dashboard.js") },
    "/presupuesto": { public: false, loader: () => import("./pages/Presupuesto.js"), requireAny: ["pos", "quotes"] },
    "/presupuestos": { public: false, loader: () => import("./pages/Presupuestos.js"), requireAny: ["quotes"] },
    "/reportes": { public: false, loader: () => import("./pages/Reportes.js"), requireAny: ["reports"] },
    "/inventario": { public: false, loader: () => import("./pages/Inventario.js"), requireAny: ["inventory", "suppliers"] },
    "/configuracion": { public: false, loader: () => import("./pages/Configuracion.js"), requireAny: ["settings"] },

    // Ruta técnica para cerrar sesión
    "/logout": { public: true, loader: async () => ({ default: { render: () => "", mount() { } } }) },

    // 404 por defecto
    "/404": {
        public: true,
        loader: async () => ({
            default: {
                render: () => `
          <div class="p-6">
            <h1 class="text-2xl font-semibold">404</h1>
            <p class="text-slate-400">Ruta no encontrada.</p>
          </div>`,
                mount() { },
            },
        }),
    },
};

function currentPath() {
    const raw = (location.hash || "").replace(/^#/, "");
    return raw || "/dashboard";
}

function resolveRoute(path) {
    return ROUTES[path] ? path : "/404";
}

function canAccess(meta = {}) {
    // Público
    if (meta.public) return true;

    // Requiere login
    if (!isAuthenticated()) return false;

    // Chequeos de permisos
    if (meta.requireAll && Array.isArray(meta.requireAll) && meta.requireAll.length) {
        const allOk = meta.requireAll.every((p) => hasPerm(p));
        if (!allOk) return false;
    }
    if (meta.requireAny && Array.isArray(meta.requireAny) && meta.requireAny.length) {
        // basta con tener uno
        const anyOk = meta.requireAny.some((p) => hasPerm(p));
        if (!anyOk) return false;
    }
    return true;
}

function render403(root) {
    const html = `
    <div class="p-6">
      <h1 class="text-xl font-semibold">403 — Acceso denegado</h1>
      <p class="text-slate-400 mt-1">No tenés permisos para acceder a esta sección.</p>
    </div>`;
    root.innerHTML = Shell.render(html);
    Shell.mount(root);
}

async function renderRoute(root) {
    let path = resolveRoute(currentPath());
    const meta = ROUTES[path];

    // Logout: limpia sesión y redirige a login
    if (path === "/logout") {
        setAuth({ token: null, user: null });
        location.hash = "#/login";
        return;
    }

    // Guard de autenticación / permisos
    if (!canAccess(meta)) {
        if (!meta.public && !isAuthenticated()) {
            // no logueado → login
            location.hash = "#/login";
            return;
        }
        // logueado pero sin permisos → 403 dentro del Shell
        render403(root);
        return;
    }

    // Si ya estoy logueado y voy a /login → mandar a dashboard
    if (path === "/login" && isAuthenticated()) {
        location.hash = "#/dashboard";
        return;
    }

    // Carga de la página
    const mod = await meta.loader();
    const page = mod.default;

    // /login se renderiza sin Shell
    if (path === "/login") {
        root.innerHTML = page.render();
        page.mount?.(root);
        window.scrollTo({ top: 0, behavior: "instant" });
        return;
    }

    // Rutas internas con Shell
    const html = page.render();
    root.innerHTML = Shell.render(html);
    Shell.mount(root);
    page.mount?.(root.querySelector("#view"));

    window.scrollTo({ top: 0, behavior: "instant" });
}

export const router = {
    init(root) {
        const handler = () => renderRoute(root);
        window.addEventListener("hashchange", handler);
        window.addEventListener("load", handler);

        // Primera ejecución
        handler();
    },
};

// ✅ Eliminamos el viejo bloque duplicado de routing (PUBLIC/handleRoute)
// para evitar conflictos de guards y doble render.
