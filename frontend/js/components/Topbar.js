// ./components/Topbar.js
import { getState, subscribe } from "../store.js";

export function Topbar() {
  const u = getState().auth.user;
  const name = u?.full_name || u?.name || u?.username || "Invitado";

  return /*html*/`
    <header class="sticky top-0 z-10 glass px-3 py-2 flex items-center gap-2">
      <button id="menuBtn" data-menu-btn aria-controls="mobileMenu" class="md:hidden inline-flex items-center px-3 py-2 rounded hover:bg-white/10" aria-expanded="false">☰</button>
      <div class="text-lg font-medium">
        <span class="text-indigo-300">Bienvenido,</span>
        <span id="topbar-username">${name}</span>
      </div>
    </header>
  `;
}

/* Opcional: si querés que el nombre se refresque al cambiar el auth sin re-render del Shell */
export function mountTopbar(root) {
  const el = root.querySelector("#topbar-username");
  if (!el) return;
  subscribe("auth", (auth) => {
    el.textContent = auth?.user?.full_name || auth?.user?.name || auth?.user?.username || "Invitado";
  });
}
