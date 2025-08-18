// ./js/main.js
import { router } from "./router.js";
import store from "./store.js";

// ===== Mobile menu (silencioso, sin alerts) =====
function setupMobileMenu() {
    const menuBtn =
        document.querySelector("[data-menu-btn]") || document.getElementById("menuBtn");
    const menuPane =
        document.querySelector("[data-menu-panel]") || document.getElementById("mobileMenu");

    if (!menuBtn || !menuPane) {
        console.debug("[menu] no elements found"); // trazas discretas
        return;
    }

    // Estado inicial forzado (cerrado)
    if (menuPane.dataset.open !== "true") {
        menuPane.dataset.open = "false";
        menuPane.hidden = true;
        menuBtn.setAttribute("aria-expanded", "false");
    }

    // Evitar handlers duplicados si re-renderiza
    if (menuBtn.__mbBound) {
        menuBtn.removeEventListener("click", menuBtn.__mbBound, { capture: false });
    }
    if (menuPane.__mbOutsideHandler) {
        document.removeEventListener("click", menuPane.__mbOutsideHandler, true);
    }
    if (menuPane.__mbEscHandler) {
        document.removeEventListener("keydown", menuPane.__mbEscHandler);
    }

    function toggleMenu(ev) {
        ev?.preventDefault?.();
        ev?.stopPropagation?.();
        try {
            const isOpen = menuPane.dataset.open === "true";
            menuPane.dataset.open = String(!isOpen);
            menuPane.hidden = isOpen;
            menuBtn.setAttribute("aria-expanded", String(!isOpen));
            console.debug("[menu] toggle", { open: !isOpen });
        } catch (err) {
            console.error("[menu] toggle error", err);
        }
    }

    const onBtnClick = (ev) => toggleMenu(ev);
    menuBtn.addEventListener("click", onBtnClick, { passive: false });
    menuBtn.__mbBound = onBtnClick;

    // Cerrar al hacer click fuera
    const outsideHandler = (ev) => {
        try {
            if (menuPane.hidden) return;
            // si el target está dentro del botón (ícono/hijo), no cerrar
            const clickedBtn = menuBtn.contains(ev.target);
            const clickedInsidePanel = menuPane.contains(ev.target);
            if (!clickedInsidePanel && !clickedBtn) {
                toggleMenu(ev);
            }
        } catch (err) {
            console.error("[menu] outside-click error", err);
        }
    };
    document.addEventListener("click", outsideHandler, true);
    menuPane.__mbOutsideHandler = outsideHandler;

    // Cerrar con ESC
    const escHandler = (ev) => {
        if (ev.key === "Escape" && !menuPane.hidden) {
            toggleMenu(ev);
        }
    };
    document.addEventListener("keydown", escHandler);
    menuPane.__mbEscHandler = escHandler;
}

// Inicializar app + menú
document.addEventListener("DOMContentLoaded", async () => {
    const root = document.getElementById("app");

    // Intentar rehidratar sesión por cookie antes de iniciar el router
    try {
        await store.auth.init();
        console.debug("[auth] init completed");
    } catch (err) {
        console.warn("[auth] init failed", err?.message || err);
    }

    router.init(root);
    // setup del menú (se volverá a ejecutar en hashchange tras render)
    setupMobileMenu();
});

// Re-aplicar y cerrar menú en cambios de ruta
window.addEventListener("hashchange", () => {
    const menuPane =
        document.querySelector("[data-menu-panel]") || document.getElementById("mobileMenu");
    const menuBtn =
        document.querySelector("[data-menu-btn]") || document.getElementById("menuBtn");
    if (menuPane && menuBtn) {
        menuPane.dataset.open = "false";
        menuPane.hidden = true;
        menuBtn.setAttribute("aria-expanded", "false");
    }
    setTimeout(setupMobileMenu, 0); // re-bind tras re-render
});
