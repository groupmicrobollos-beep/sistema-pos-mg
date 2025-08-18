// ./components/Sidebar.js
import { setAuth, isAuthenticated, subscribe, getState } from "../store.js";

function link(href, text) {
  return `<a href="${href}" class="block rounded px-3 py-2 hover:bg-indigo-500/20 hover:text-indigo-300 transition">${text}</a>`;
}

function logoutButton() {
  return `
    <button id="btn-logout"
      class="mt-2 w-full flex items-center justify-center gap-2 rounded px-3 py-2 border border-rose-500/30 text-rose-300 hover:bg-rose-500/10 hover:text-rose-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
      aria-label="Cerrar sesión">
      <span>🚪</span><span data-label>Cerrar sesión</span>
    </button>`;
}

export function Sidebar() {
  // Enlazamos eventos una vez que el DOM del sidebar existe
  // (si tu app re-renderiza el sidebar, este bloque se puede mover al “mount” correspondiente)
  setTimeout(() => {
    const btn = document.querySelector("#btn-logout");
    if (!btn) return;

    // Acción de Logout
    btn.addEventListener("click", async () => {
      // intentar notificar al backend
      try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }); } catch (e) { /* ignore */ }

      // limpiar “sesin” local
      setAuth({ token: null, user: null });

      // (opcional) limpiar cosas temporales de tu app
      try { sessionStorage.clear(); } catch {}

      // navegar al login
      location.hash = "#/login";
    });

    // Mantener el botón y el nav en sync con el estado de auth
    const updateAuthUI = (auth) => {
      // Texto del botón
      const labelEl = btn.querySelector("[data-label]");
      if (labelEl) labelEl.textContent = auth?.token ? "Cerrar sesión" : "Ir a login";

      // Habilitar/Deshabilitar cuando no hay sesión
      btn.disabled = !auth?.token;

      // (Opcional) Deshabilitar navegación cuando no hay sesión
      const nav = document.querySelector("[data-sb-nav]");
      if (nav) nav.style.pointerEvents = auth?.token ? "" : "";
      // Si preferís ocultar:
      // if (nav) nav.style.opacity = auth?.token ? "1" : ".6";
    };

    // Pintado inicial + suscripción a cambios
    updateAuthUI(getState().auth);
    subscribe("auth", updateAuthUI);
  }, 0);

  return /*html*/`
    <aside class="hidden md:flex h-dvh flex-col gap-2 p-3 glass rounded-none overflow-y-auto">
      <div class="px-2 py-3 text-xl font-semibold tracking-wide">
        <span class="neon">Microbollos POS</span>
      </div>

      <nav data-sb-nav class="flex-1 space-y-1">
        ${link("#/dashboard", "📊 Dashboard")}
        ${link("#/presupuesto", "🧾 Presupuesto")}
        ${link("#/presupuestos", "📁 Presupuestos")}
        ${link("#/reportes", "📈 Reportes")}
        ${link("#/inventario", "📦 Inventario")}
        ${link("#/configuracion", "⚙️ Configuración")}
      </nav>

      ${logoutButton()}
      <div class="mt-2 text-xs text-slate-400 px-2">v0.1 • powered by blint</div>
    </aside>
  `;
}
