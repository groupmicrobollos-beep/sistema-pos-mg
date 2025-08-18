// ./pages/Inventario.js
// Inventario con solapas: Insumos + Proveedores (CRUD completo) + Lista de compra + Envíos + KPIs
// ✅ Insumos independientes de Proveedores (supplierId opcional)
// ✅ Sin colisiones de nombres en <form> (usamos form.elements y campos ocultos iid/sid)
// ✅ Forzamos pestaña "Insumos" al guardar/importar y repintamos
// ✅ FIX TDZ: viewItems se declara ANTES de usar refreshItems()
// ✅ Lista de compra completa: marcar 🛒, editar cantidad/nota, limpiar, WhatsApp/Email por proveedor
// ✅ FIXES técnicos:
//    - Se cablea el botón "Enviar a proveedores" (abrir modal con mensajes por proveedor)
//    - Se cablea "Limpiar" lista de compra
//    - Se agrega delegación de eventos para editar qty/nota y eliminar líneas de la lista de compra
//    - Se restaura la pestaña activa desde localStorage (si existe), pero se fuerza "Insumos" al guardar/importar
//    - Se actualizan KPIs al modificar lista de compra

const INV_ACTIVE_TAB = "inv_active_tab";
const ARS = { style: "currency", currency: "ARS", minimumFractionDigits: 2, maximumFractionDigits: 2 };
const money = (n) => (Number(n) || 0).toLocaleString("es-AR", ARS);
const todayISO = () => new Date().toISOString().slice(0, 10);
const rid = (p = "id") => `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

// API helpers
async function apiGet(url) {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function apiPost(url, data) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function apiPut(url, data) {
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function apiDelete(url) {
  const res = await fetch(url, {
    method: "DELETE",
    credentials: "include"
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function toast(msg, type = "info") {
  const bg = type === "error" ? "bg-rose-600" : type === "success" ? "bg-emerald-600" : "bg-sky-700";
  const el = document.createElement("div");
  el.className = `fixed top-4 right-4 z-[4000] px-3 py-2 rounded-lg text-white shadow-2xl text-xs ${bg}`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => { el.style.opacity = "0"; el.style.transform = "translateX(10px)"; setTimeout(() => el.remove(), 150); }, 1900);
}

// Data helpers
let items = [];
let suppliers = [];

async function loadItems() {
  items = await apiGet("/api/products/list");
  return items;
}

async function loadSuppliers() {
  suppliers = await apiGet("/api/suppliers/list");
  return suppliers;
}

function findSupplier(id) {
  return suppliers.find(s => s.id === id) || null;
}

function parseNum(v) {
  const n = parseFloat(String(v).replace(",", "."));
  return isNaN(n) ? 0 : n;
}

export default {
  render() {
    return /*html*/`
<section data-page="inventory" class="space-y-6 text-[13px]">
  <style>
    /* ===== Respaldo sin Tailwind ===== */
    [data-page="inventory"] .hidden{display:none!important} [data-page="inventory"] .flex{display:flex!important}
    [data-page="inventory"] .glass{background:rgba(255,255,255,.035);backdrop-filter:blur(6px)}
    [data-page="inventory"] .card{border:1px solid rgba(255,255,255,.09);border-radius:.6rem}
    [data-page="inventory"] .k{font-size:.74rem;color:#cbd5e1} [data-page="inventory"] .v{font-size:1.06rem;font-weight:700}
    [data-page="inventory"] .ctrl,[data-page="inventory"] .btn{height:36px;line-height:34px;font-size:12.5px}
    [data-page="inventory"] .btn{display:inline-flex;align-items:center;gap:.4rem;padding:0 .7rem;border-radius:.45rem;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.08);cursor:pointer}
    [data-page="inventory"] .btn:hover{background:rgba(255,255,255,.14)}
    [data-page="inventory"] .btn-primary{background:rgba(16,185,129,.86);border-color:transparent} .btn-primary:hover{background:rgba(16,185,129,1)}
    [data-page="inventory"] .btn-indigo{background:rgba(99,102,241,.86);border-color:transparent} .btn-indigo:hover{background:rgba(99,102,241,1)}
    [data-page="inventory"] .btn-rose{background:rgba(244,63,94,.86);border-color:transparent} .btn-rose:hover{background:rgba(244,63,94,1)}
    [data-page="inventory"] .tab{padding:.45rem .7rem;border-radius:.5rem;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.05);cursor:pointer}
    [data-page="inventory"] .tab.active{background:rgba(99,102,241,.9);border-color:transparent}
    [data-page="inventory"] .pill{font-size:.7rem;padding:.12rem .45rem;border-radius:.45rem;background:#0b1220;border:1px solid rgba(255,255,255,.08)}
    [data-page="inventory"] .table-wrap{border:1px solid rgba(255,255,255,.08);border-radius:.5rem;overflow:hidden}
    [data-page="inventory"] .table td,.table th{padding:.45rem .6rem;border-bottom:1px solid rgba(255,255,255,.06)} th{font-weight:600;color:#cbd5e1;white-space:nowrap}
    [data-page="inventory"] select option{color:#e2e8f0;background-color:#0b1220}
    [data-page="inventory"] .status-ok{color:#86efac;background:#16a34a33} [data-page="inventory"] .status-low{color:#fca5a5;background:#dc262633}
    [data-page="inventory"] .mini-btn{height:26px;line-height:24px;padding:0 .45rem;border-radius:.35rem}
    /* anclas mini para WhatsApp/Email */
    [data-page="inventory"] .mini{height:26px;line-height:24px;padding:0 .45rem;border-radius:.35rem}
    [data-page="inventory"] textarea{width:100%;min-height:120px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.10);border-radius:.45rem;padding:.5rem;color:#e2e8f0}
  </style>

  <div class="flex items-center justify-between">
    <h1 class="text-[18px] font-semibold leading-none">Inventario</h1>
    <div class="flex gap-2">
      <button id="tab-items" class="tab">📦 Insumos</button>
      <button id="tab-suppliers" class="tab">🏷️ Proveedores</button>
    </div>
  </div>

  <!-- Barra acciones común (sólo Insumos usa filtros) -->
  <div class="flex flex-wrap items-center gap-2">
    <label class="relative">
      <span class="absolute left-2 top-2 text-slate-400">🔎</span>
      <input id="q" placeholder="Buscar insumo o categoría..." class="ctrl pl-8 pr-2 rounded bg-white/10 border border-white/10">
    </label>
    <select id="filter-supplier" class="ctrl px-2.5 rounded bg-white/10 border border-white/10 text-slate-100">
      <option value="">Todos los proveedores</option>
    </select>
    <select id="filter-status" class="ctrl px-2.5 rounded bg-white/10 border border-white/10 text-slate-100">
      <option value="">Estado</option>
      <option value="low">Faltantes</option>
      <option value="ok">En stock</option>
    </select>
    <button id="btn-add-item" class="btn btn-primary" type="button">➕ Insumo</button>
    <button id="btn-add-supp" class="btn btn-indigo" type="button">🏷️ Proveedor</button>
    <button id="btn-export" class="btn" type="button">📤 Exportar</button>
    <label class="btn">
      📥 Importar
      <input id="import-file" type="file" accept=".json" class="hidden">
    </label>
  </div>

  <!-- KPIs (Insumos) -->
  <div id="kpis" class="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
    ${kpi("📦", "Insumos", "kpi-count")}
    ${kpi("⚠️", "Faltantes", "kpi-low")}
    ${kpi("💵", "Valor de stock", "kpi-value")}
    ${kpi("🛒", "Lista de compra", "kpi-list")}
  </div>

  <!-- PANEL: INSUMOS -->
  <div id="panel-items" class="grid lg:grid-cols-[2fr_1fr] gap-4">
    <div class="glass card p-4">
      <div class="table-wrap">
        <table class="table w-full text-[12.5px]">
          <thead class="bg-white/5">
            <tr>
              <th>Código</th><th>Nombre</th><th>Categoría</th>
              <th class="text-right">Stock</th><th class="text-right">Mín.</th>
              <th>Unidad</th><th class="text-right">Costo</th>
              <th>Proveedor</th><th>Actualizado</th><th>Estado</th>
              <th class="text-right">Acciones</th>
            </tr>
          </thead>
          <tbody id="rows-items"></tbody>
        </table>
      </div>
      <div id="empty-items" class="text-slate-400 text-xs py-2 text-center hidden">No hay insumos cargados.</div>
    </div>

    <div class="glass card p-4 space-y-3">
      <div class="flex items-center justify-between">
        <h2 class="font-medium text-[13px] leading-none">🛒 Lista de compra</h2>
        <div class="flex gap-2">
          <button id="btn-send" class="btn btn-primary" type="button">📲 Enviar a proveedores</button>
          <button id="btn-clear-list" class="btn btn-rose" type="button">🧹 Limpiar</button>
        </div>
      </div>
      <div id="buy-list"></div>
      <div id="buy-empty" class="text-slate-400 text-xs py-2 text-center">Vacía. Marcá insumos como “Falta” o bajá el stock debajo del mínimo.</div>
    </div>
  </div>

  <!-- PANEL: PROVEEDORES -->
  <div id="panel-suppliers" class="hidden">
    <div class="glass card p-4">
      <div class="table-wrap">
        <table class="table w-full text-[12.5px]">
          <thead class="bg-white/5">
            <tr>
              <th>Nombre</th><th>Empresa</th><th>Contacto</th><th>WhatsApp/Tel</th><th>Email</th><th>Tags</th><th>Notas</th><th class="text-right">Acciones</th>
            </tr>
          </thead>
          <tbody id="rows-suppliers"></tbody>
        </table>
      </div>
      <div id="empty-suppliers" class="text-slate-400 text-xs py-2 text-center hidden">No hay proveedores cargados.</div>
    </div>
  </div>

  <!-- Modales -->
  ${modalItem()}
  ${modalSupplier()}
  ${modalSend()}
</section>`;
  },

  mount(root) {
    // Helpers modales
    const show = (el)=>{el?.classList.remove("hidden");el?.classList.add("flex");el&&(el.style.display="flex");};
    const hide = (el)=>{el?.classList.add("hidden");el?.classList.remove("flex");el&&(el.style.display="none");};

    // Estado
    let items = [];
    let suppliers = [];
    let buyList = load(INV_LIST_KEY, []); // TODO: Mover a la DB
    let viewItems = [];

    // Funciones para cargar datos de la API
    async function loadData() {
      try {
        const [itemsRes, suppliersRes] = await Promise.all([
          fetch('/api/products/list'),
          fetch('/api/suppliers/list')
        ]);
        
        if (!itemsRes.ok || !suppliersRes.ok) {
          throw new Error('Error al cargar datos');
        }
        
        items = await itemsRes.json();
        suppliers = await suppliersRes.json();
        
        refreshItems();
        refreshSuppliers();
      } catch (err) {
        console.error(err);
        toast("Error al cargar datos", "error");
      }
    }

    // Refs generales
    const q = root.querySelector("#q");
    const fSupp = root.querySelector("#filter-supplier");
    const fStatus = root.querySelector("#filter-status");
    const btnAddItem = root.querySelector("#btn-add-item");
    const btnAddSupp = root.querySelector("#btn-add-supp");
    const btnExport = root.querySelector("#btn-export");
    const importFile = root.querySelector("#import-file");

    // KPIs
    const kCount = root.querySelector("#kpi-count");
    const kLow = root.querySelector("#kpi-low");
    const kValue = root.querySelector("#kpi-value");
    const kList = root.querySelector("#kpi-list");

    // Tabs
    const tabItems = root.querySelector("#tab-items");
    const tabSupps = root.querySelector("#tab-suppliers");
    const panelItems = root.querySelector("#panel-items");
    const panelSupps = root.querySelector("#panel-suppliers");
    const kpis = root.querySelector("#kpis");

    // Tabla insumos
    const rowsItems = root.querySelector("#rows-items");
    const emptyItems = root.querySelector("#empty-items");

    // Tabla proveedores
    const rowsSuppliers = root.querySelector("#rows-suppliers");
    const emptySuppliers = root.querySelector("#empty-suppliers");

    // Lista de compra
    const listWrap = root.querySelector("#buy-list");
    const listEmpty = root.querySelector("#buy-empty");
    const btnSend = root.querySelector("#btn-send");
    const btnClearList = root.querySelector("#btn-clear-list");

    // Modales / formularios
    const itemModal = root.querySelector("#item-modal");
    const itemForm  = root.querySelector("#item-form");
    const itemClose = root.querySelector("#item-close");
    const itemCancel= root.querySelector("#item-cancel");
    const itemSave  = root.querySelector("#item-save");
    const itemSaveNew = root.querySelector("#item-save-new");

    const suppModal = root.querySelector("#supp-modal");
    const suppForm  = root.querySelector("#supp-form");
    const suppClose = root.querySelector("#supp-close");
    const suppCancel= root.querySelector("#supp-cancel");
    const suppSave  = root.querySelector("#supp-save");
    const suppSaveNew = root.querySelector("#supp-save-new");

    const sendModal = root.querySelector("#send-modal");
    const sendClose = root.querySelector("#send-close");
    const sendBody  = root.querySelector("#send-body");

    // === Tabs ===
    function setTab(which){
      if (which === "items"){
        tabItems.classList.add("active"); tabSupps.classList.remove("active");
        panelItems.classList.remove("hidden"); panelSupps.classList.add("hidden"); kpis.classList.remove("hidden");
      } else {
        tabSupps.classList.add("active"); tabItems.classList.remove("active");
        panelSupps.classList.remove("hidden"); panelItems.classList.add("hidden"); kpis.classList.add("hidden");
      }
      save(INV_ACTIVE_TAB, which);
    }
    tabItems.addEventListener("click", ()=> setTab("items"));
    tabSupps.addEventListener("click", ()=> setTab("suppliers"));

    // Restaurar pestaña anterior (si existe)
    setTab(load(INV_ACTIVE_TAB, "items"));

    // === Acciones generales ===
    btnAddItem.addEventListener("click", ()=> openItem());
    btnAddSupp.addEventListener("click", ()=> openSupplier());
    btnExport.addEventListener("click", exportData);
    importFile.addEventListener("change", importData);
    q.addEventListener("input", refreshItems);
    fSupp.addEventListener("change", refreshItems);
    fStatus.addEventListener("change", refreshItems);

    // Lista de compra: enviar / limpiar
    btnSend.addEventListener("click", openSend);
    btnClearList.addEventListener("click", async () => {
      if (!buyList.length) return toast("La lista ya está vacía");
      if (!confirm("¿Vaciar la lista de compra?")) return;
      
      try {
        // Eliminar cada item de la lista
        await Promise.all(
          buyList.map(item => 
            fetch(`/api/shopping/${item.id}`, { method: 'DELETE' })
          )
        );
        
        await loadData();
        toast("Lista de compra vaciada ✅", "success");
      } catch (err) {
        console.error(err);
        toast("Error al vaciar la lista", "error");
      }
    });

    // Delegación lista de compra (eliminar línea + editar qty/nota)
    listWrap.addEventListener("click", async (e) => {
      const btn = e.target.closest("button[data-blid]"); 
      if (!btn) return;
      
      const id = btn.dataset.blid;
      try {
        await fetch(`/api/shopping/${id}`, { method: 'DELETE' });
        await loadData();
      } catch (err) {
        console.error(err);
        toast("Error al eliminar el item", "error");
      }
    });
    
    let updateTimer = null;
    listWrap.addEventListener("input", (e) => {
      const row = e.target.closest('[data-blid]'); 
      if (!row) return;
      
      const id = row.getAttribute("data-blid");
      const item = buyList.find(b => b.id === id); 
      if (!item) return;
      
      // Usar debounce para no hacer muchas llamadas a la API
      clearTimeout(updateTimer);
      updateTimer = setTimeout(async () => {
        try {
          const updates = {};
          
          if (e.target.classList.contains("bl-qty")) {
            const v = Math.max(1, parseInt(e.target.value || "1", 10));
            e.target.value = v;
            updates.quantity = v;
          }
          
          if (e.target.classList.contains("bl-note")) {
            updates.notes = e.target.value || "";
          }
          
          await fetch(`/api/shopping/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
          });
          
          await loadData();
        } catch (err) {
          console.error(err);
          toast("Error al actualizar el item", "error");
        }
      }, 500); // Esperar 500ms antes de actualizar
    });

    // Cerrar modales
    itemClose.addEventListener("click", ()=> hide(itemModal));
    itemCancel.addEventListener("click", ()=> hide(itemModal));
    itemModal.addEventListener("click", (e)=>{ if (e.target === itemModal) hide(itemModal); });

    suppClose.addEventListener("click", ()=> hide(suppModal));
    suppCancel.addEventListener("click", ()=> hide(suppModal));
    suppModal.addEventListener("click", (e)=>{ if (e.target === suppModal) hide(suppModal); });

    sendClose.addEventListener("click", ()=> hide(sendModal));
    sendModal.addEventListener("click", (e)=>{ if (e.target === sendModal) hide(sendModal); });

    // Guardado (sin submit nativo)
    itemSave.addEventListener("click", ()=> saveItem("close"));
    itemSaveNew.addEventListener("click", ()=> saveItem("new"));
    suppSave.addEventListener("click", ()=> saveSupplier("close"));
    suppSaveNew.addEventListener("click", ()=> saveSupplier("new"));

    // Delegados tabla Insumos
    rowsItems.addEventListener("click", (e)=>{
      const btn = e.target.closest("button[data-act]"); if (!btn) return;
      const id = btn.dataset.id;
      if (btn.dataset.act === "inc") changeStock(id, +1);
      if (btn.dataset.act === "dec") changeStock(id, -1);
      if (btn.dataset.act === "need") toggleNeed(id);
      if (btn.dataset.act === "edit") openItem(items.find(x=>x.id===id)||null);
      if (btn.dataset.act === "del") delItem(id);
    });

    // Delegados tabla Proveedores
    rowsSuppliers.addEventListener("click", (e)=>{
      const btn = e.target.closest("button[data-act]"); if (!btn) return;
      const id = btn.dataset.id;
      if (btn.dataset.act === "edit") openSupplier(suppliers.find(s=>s.id===id)||null);
      if (btn.dataset.act === "del") delSupplier(id);
    });

    // ====== INSUMOS ======
    function applyFiltersItems(){
      const term = (q.value||"").toLowerCase().trim();
      const fs = String(fSupp.value || "");
      const st = fStatus.value;

      viewItems = items.filter(it=>{
        const matchesTerm = !term || [it.code,it.name,it.category].join(" ").toLowerCase().includes(term);
        const matchesSupp = !fs || String(it.supplierId || "") === fs; // opcional
        const low = (it.stock||0) < (it.min||0);
        const matchesStatus = !st || (st==="low"? low : !low);
        return matchesTerm && matchesSupp && matchesStatus;
      });
    }
    function paintItems(){
      if (!viewItems.length){
        rowsItems.innerHTML = "";
        emptyItems.classList.remove("hidden");
        return;
      }
      emptyItems.classList.add("hidden");
      rowsItems.innerHTML = viewItems.map(it=>{
        const supp = it.supplierId ? (findSupplier(it.supplierId)?.name || "-") : "—";
        const low = (it.stock||0) < (it.min||0);
        const badge = low ? `<span class="pill status-low">Falta</span>` : `<span class="pill status-ok">OK</span>`;
        return `
          <tr class="hover:bg-white/5">
            <td>${it.code || "-"}</td>
            <td class="font-medium">${it.name}</td>
            <td>${it.category || "-"}</td>
            <td class="text-right">${it.stock ?? 0}</td>
            <td class="text-right">${it.min ?? 0}</td>
            <td>${it.unit || "-"}</td>
            <td class="text-right">${money(it.cost)}</td>
            <td class="max-w-[180px] truncate">${supp}</td>
            <td>${(it.updatedAt || "").slice(0,10) || "-"}</td>
            <td>${badge}</td>
            <td class="text-right whitespace-nowrap">
              <button class="mini-btn btn" data-act="dec" data-id="${it.id}" title="Quitar 1">−</button>
              <button class="mini-btn btn" data-act="inc" data-id="${it.id}" title="Sumar 1">＋</button>
              <button class="mini-btn btn" data-act="need" data-id="${it.id}" title="Marcar en lista">🛒</button>
              <button class="mini-btn btn btn-indigo" data-act="edit" data-id="${it.id}" title="Editar">✏️</button>
              <button class="mini-btn btn btn-rose" data-act="del" data-id="${it.id}" title="Eliminar">🗑</button>
            </td>
          </tr>`;
      }).join("");
    }
    function refreshItems(){ applyFiltersItems(); paintItems(); paintBuyList(); refreshKPIs(); }
    function refreshKPIs(){
      kCount.textContent = items.length;
      kLow.textContent = items.filter(i => (i.stock||0) < (i.min||0)).length;
      kValue.textContent = money(items.reduce((s,i)=> s + (Number(i.stock||0) * Number(i.cost||0)), 0));
      kList.textContent = buyList.length;
    }

    function openItem(data=null){
      const E = itemForm.elements;
      itemForm.reset();
      E.iid.value = data?.id || rid("itm");
      E.code.value = data?.code || "";
      E.name.value = data?.name || "";
      E.category.value = data?.category || "";
      E.unit.value = data?.unit || "u";
      E.cost.value = data?.cost ?? "";
      E.stock.value = data?.stock ?? 0;
      E.min.value = data?.min ?? 1;
      paintSupplierSelect(E.supplierId, data?.supplierId || "");
      E.everyDays.value = data?.alerts?.everyDays ?? "";
      E.nextDate.value = data?.alerts?.nextDate || "";
      E.threshold.value = data?.alerts?.threshold ?? "";
      show(itemModal);
      setTimeout(()=> E.name?.focus(), 0);
    }
    function readItemForm(form){
      const E = form.elements;
      return {
        id: E.iid.value,
        code: E.code.value.trim(),
        name: E.name.value.trim(),
        category: E.category.value.trim(),
        unit: E.unit.value,
        cost: parseNum(E.cost.value || "0"),
        stock: Math.max(0, parseNum(E.stock.value || "0")),
        min: Math.max(0, parseNum(E.min.value || "0")),
        supplierId: E.supplierId.value || "", // opcional
        updatedAt: new Date().toISOString(),
        alerts: {
          everyDays: E.everyDays.value ? Math.max(1, parseInt(E.everyDays.value,10)) : "",
          nextDate: E.nextDate.value || "",
          threshold: E.threshold.value ? Math.max(0, parseInt(E.threshold.value,10)) : ""
        }
      };
    }
    
    async function saveItem(mode="close") {
      const data = readItemForm(itemForm);
      if (!data.name) return toast("Nombre obligatorio","error");
      if (!data.unit) return toast("Unidad obligatoria","error");
      
      try {
        if (data.id) {
          await apiPut(`/api/products/${data.id}`, data);
        } else {
          await apiPost('/api/products/save', data);
        }
        
        items = await apiGet('/api/products/list');
        autoNeed(data);

        setTab("items");
        refreshItems();
        toast("Insumo guardado ✅", "success");
        
        if (mode === "new") {
          openItem(null);
        } else {
          hide(itemModal);
        }
      } catch (err) {
        console.error(err);
        toast("Error al guardar el insumo", "error");
      }
    }
    async function delItem(id) {
      if (!confirm("¿Eliminar insumo?")) return;
      
      try {
        await apiDelete(`/api/products/${id}`);
        buyList = buyList.filter(b => b.itemId !== id);
        save(INV_LIST_KEY, buyList);
        
        items = await apiGet('/api/products/list');
        refreshItems();
        toast("Insumo eliminado", "success");
      } catch (err) {
        console.error(err);
        toast("Error al eliminar el insumo", "error");
      }
    }
    
    async function changeStock(id, delta) {
      const it = items.find(x => x.id === id);
      if (!it) return;
      
      try {
        // Registrar el movimiento de stock
        await fetch('/api/stock/movement', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            product_id: id,
            type: delta > 0 ? 'in' : 'out',
            quantity: Math.abs(delta),
            notes: delta > 0 ? 'Incremento manual' : 'Decremento manual'
          })
        });
        
        await loadData();
        const updatedItem = items.find(x => x.id === id);
        if (updatedItem) autoNeed(updatedItem);
      } catch (err) {
        console.error(err);
        toast("Error al actualizar el stock", "error");
      }
    }
    function autoNeed(it){
      const exists = buyList.find(b=>b.itemId===it.id);
      const needs = (it.stock||0) < (it.min||0);
      if (needs && !exists){
        buyList.push({ id: rid("bl"), itemId: it.id, qty: Math.max(1, (it.min||1) - (it.stock||0)), note:"", supplierId: it.supplierId||"" });
        save(INV_LIST_KEY, buyList);
      }
      if (!needs && exists){
        buyList = buyList.filter(b=>b.itemId!==it.id);
        save(INV_LIST_KEY, buyList);
      }
    }
    async function toggleNeed(id){
      const it = items.find(x=>x.id===id); 
      if(!it) return;
      
      try {
        const exists = buyList.find(b=>b.itemId===id);
        if (exists) {
          buyList = buyList.filter(b=>b.itemId!==id);
        } else {
          buyList.push({ 
            id: rid("bl"), 
            itemId: id, 
            qty: Math.max(1, it.min_stock || 1), 
            note: "", 
            supplierId: it.supplier_id || "" 
          });
        }
        save(INV_LIST_KEY, buyList); // TODO: Mover a la DB
        paintBuyList(); 
        refreshKPIs();
      } catch (err) {
        console.error(err);
        toast("Error al actualizar la lista de compra", "error");
      }
    }

    // ====== LISTA DE COMPRA ======
    function paintBuyList(){
      if (!buyList.length){
        listWrap.innerHTML = ""; 
        listEmpty.classList.remove("hidden"); 
        return;
      }
      listEmpty.classList.add("hidden");

      const groups = {};
      buyList.forEach(b => {
        const sid = b.supplier_id || "__sin__";
        (groups[sid] ||= []).push(b);
      });

      listWrap.innerHTML = Object.entries(groups).map(([sid, arr]) => {
        const s = suppliers.find(s => s.id === sid);
        const head = s ? `${s.name}${s.company ? " — "+s.company : ""}` : "Sin proveedor";
        const contact = s ? `<div class="text-xs text-slate-400">${s.phone?`📱 ${s.phone}`:""} ${s.email?` · ✉️ ${s.email}`:""}</div>` : "";
        return `
          <div class="glass rounded-lg p-2 mb-2">
            <div class="flex items-center justify-between">
              <div><div class="font-medium">${head}</div>${contact}</div>
              <div class="flex gap-2">
                ${s?.phone?`<a class="btn mini" target="_blank" href="${waHref(arr, s)}">📲 WhatsApp</a>`:""}
                ${s?.email?`<a class="btn mini" href="${mailtoHref(arr, s)}">✉️ Email</a>`:""}
              </div>
            </div>
            <div class="mt-2 space-y-1">
              ${arr.map(b => `
                <div class="flex items-center gap-2" data-blid="${b.id}">
                  <div class="flex-1 truncate">${b.product_name || "(eliminado)"} <span class="text-slate-400">(${b.product_unit || "-"})</span></div>
                  <input type="number" min="1" class="bl-qty w-16 h-7 px-2 rounded bg-white/10 border border-white/10 text-right" value="${b.quantity}"/>
                  <input type="text" class="bl-note flex-1 h-7 px-2 rounded bg-white/10 border border-white/10" placeholder="Nota..." value="${b.notes || ""}"/>
                  <button class="mini-btn btn" data-blid="${b.id}" title="Quitar de la lista">🗑</button>
                </div>`).join("")}
            </div>
          </div>`;
      }).join("");
    }
    function buildMessage(block, supplier){
      const lines = [];
      const saludo = supplier?.contact || supplier?.name || "";
      lines.push(`Hola${saludo ? " " + saludo : ""}, ¿cómo estás?`);
      lines.push(`Necesito cotizar / comprar:`); lines.push("");
      block.forEach(b=>{ const n=b.item?.name || "(sin nombre)"; lines.push(`• ${n} — ${b.qty} ${b.item?.unit||""}${b.note?` (${b.note})`:""}`); });
      lines.push(""); lines.push("¡Gracias! — Microbollos Group");
      return lines.join("\n");
    }
    function waHref(block,supplier){
      const phone=(supplier?.phone||"").replace(/[^\d]/g,"");
      const text=encodeURIComponent(buildMessage(block,supplier));
      return `https://wa.me/${phone}?text=${text}`;
    }
    function mailtoHref(block,supplier){
      const subj=encodeURIComponent("Pedido / Cotización – Microbollos Group");
      const body=encodeURIComponent(buildMessage(block,supplier));
      return `mailto:${supplier.email}?subject=${subj}&body=${body}`;
    }
    function openSend(){
      if (!buyList.length){ toast("La lista está vacía","error"); return; }
      const groups={};
      buyList.forEach(b=>{
        const it=items.find(i=>i.id===b.itemId);
        const sid=b.supplierId || it?.supplierId || "__sin__";
        (groups[sid] ||= []).push({ ...b, item: it||{} });
      });
      sendBody.innerHTML = Object.entries(groups).map(([sid,block])=>{
        const s=findSupplier(sid);
        const msg=buildMessage(block,s);
        return `
          <div class="glass rounded-lg p-2">
            <div class="flex items-center justify-between">
              <div class="font-medium">${s ? (s.name + (s.company? " — "+s.company : "")) : "Sin proveedor"}</div>
              <div class="flex gap-2">
                ${s?.phone?`<a class="btn mini-btn" target="_blank" href="${waHref(block,s)}">📲 WhatsApp</a>`:""}
                ${s?.email?`<a class="btn mini-btn" href="${mailtoHref(block,s)}">✉️ Email</a>`:""}
              </div>
            </div>
            <textarea rows="7">${msg}</textarea>
          </div>`;
      }).join("");
      show(sendModal);
    }

    // ========== PROVEEDORES ==========
    function paintSuppliers(){
      if (!suppliers.length){
        rowsSuppliers.innerHTML = ""; 
        emptySuppliers.classList.remove("hidden");
      } else {
        emptySuppliers.classList.add("hidden");
        rowsSuppliers.innerHTML = suppliers.map(s => {
          const tags = s.tags ? JSON.parse(s.tags) : [];
          return `
          <tr class="hover:bg-white/5">
            <td class="font-medium">${s.name}</td>
            <td>${s.company || "-"}</td>
            <td>${s.contact || "-"}</td>
            <td>${s.phone || "-"}</td>
            <td>${s.email || "-"}</td>
            <td class="max-w-[220px] truncate">${tags.join(", ") || "-"}</td>
            <td class="max-w-[240px] truncate">${s.notes || "-"}</td>
            <td class="text-right whitespace-nowrap">
              <button class="mini-btn btn btn-indigo" data-act="edit" data-id="${s.id}" title="Editar">✏️</button>
              <button class="mini-btn btn btn-rose" data-act="del" data-id="${s.id}" title="Eliminar">🗑</button>
            </td>
          </tr>`;
        }).join("");
      }
    }
    
    async function refreshSuppliers(){ 
      paintSuppliers(); 
      repaintSupplierFilter(); 
    }

    function openSupplier(data=null){
      const S = suppForm.elements;
      suppForm.reset();
      S.sid.value = data?.id || rid("supp");
      S.name.value = data?.name || "";
      S.company.value = data?.company || "";
      S.contact.value = data?.contact || "";
      S.phone.value = data?.phone || "";
      S.email.value = data?.email || "";
      S.tags.value = (data?.tags||[]).join(", ");
      S.notes.value = data?.notes || "";
      show(suppModal);
      setTimeout(()=> S.name?.focus(), 0);
    }
    function readSupplierForm(form){
      const S = form.elements;
      return {
        id: S.sid.value,
        name: S.name.value.trim(),
        company: S.company.value.trim(),
        contact: S.contact.value.trim(),
        phone: S.phone.value.trim(),
        email: S.email.value.trim(),
        tags: (S.tags.value||"").split(",").map(s=>s.trim()).filter(Boolean),
        notes: S.notes.value.trim(),
        updatedAt: new Date().toISOString()
      };
    }
    async function saveSupplier(mode="close") {
      const data = readSupplierForm(suppForm);
      if (!data.name) return toast("Nombre del proveedor obligatorio","error");
      
      try {
        if (data.id) {
          await apiPut(`/api/suppliers/${data.id}`, data);
        } else {
          await apiPost('/api/suppliers/save', data);
        }
        
        suppliers = await apiGet('/api/suppliers/list');
        refreshSuppliers();
        toast("Proveedor guardado ✅","success");
        
        if (mode === "new") {
          openSupplier(null);
        } else {
          hide(suppModal);
        }
      } catch (err) {
        console.error(err);
        toast("Error al guardar el proveedor", "error");
      }
    }
    
    async function delSupplier(id) {
      if (!confirm("¿Eliminar proveedor? (los insumos quedarán sin proveedor)")) return;
      
      try {
        await apiDelete(`/api/suppliers/${id}`);
        
        suppliers = await apiGet('/api/suppliers/list');
        items = await apiGet('/api/products/list');
        
        refreshSuppliers();
        refreshItems();
        toast("Proveedor eliminado", "success");
      } catch (err) {
        console.error(err);
        toast("Error al eliminar el proveedor", "error");
      }
    }

    // ====== Select de proveedor en formulario de insumo + filtro ======
    function paintSupplierSelect(select, value=""){
      const list = load(INV_SUPPLIERS_KEY, suppliers);
      select.innerHTML = `<option value="">(Opcional)</option>` + list.map(s=>`<option value="${s.id}">${s.name}${s.company? " — "+s.company : ""}</option>`).join("");
      select.value = value;
    }
    function repaintSupplierFilter(){
      const list = load(INV_SUPPLIERS_KEY, suppliers);
      fSupp.innerHTML = `<option value="">Todos los proveedores</option>` + list.map(s=>`<option value="${s.id}">${s.name}${s.company? " — "+s.company : ""}</option>`).join("");
      fSupp.value = ""; // reset para evitar filtros colgados
    }

    // === Pintado inicial ===
    async function init() {
      try {
        items = await apiGet('/api/products/list');
        suppliers = await apiGet('/api/suppliers/list');
        repaintSupplierFilter();
        refreshItems();
        refreshSuppliers();
      } catch (err) {
        console.error(err);
        toast("Error al cargar los datos iniciales", "error");
      }
    }
    init();

    // ====== Export / Import ======
    function exportData(){
      const payload = { items, suppliers, buyList, exportedAt: new Date().toISOString(), version: 1 };
      const blob = new Blob([JSON.stringify(payload,null,2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `inventario_${todayISO().replace(/-/g,"")}.json`; a.click();
      setTimeout(()=> URL.revokeObjectURL(url), 300);
    }
    function importData(ev){
      const f = ev.target.files?.[0]; if (!f) return;
      const reader = new FileReader();
      reader.onload = ()=>{
        try{
          const data = JSON.parse(reader.result);
          if (Array.isArray(data.items)) items = data.items;
          if (Array.isArray(data.suppliers)) suppliers = data.suppliers;
          if (Array.isArray(data.buyList)) buyList = data.buyList;
          save(INV_ITEMS_KEY, items); save(INV_SUPPLIERS_KEY, suppliers); save(INV_LIST_KEY, buyList);
          setTab("items"); // forzar insumos tras importar
          refreshItems(); refreshSuppliers();
          toast("Importado correctamente ✅","success");
        } catch { toast("Archivo inválido","error"); }
        importFile.value = "";
      };
      reader.readAsText(f);
    }
  }
};

// ======= helpers UI =======
function kpi(icon,label,id){ return /*html*/`
  <div class="glass card p-3.5 flex items-center gap-3 min-h-[64px]">
    <div>${icon}</div>
    <div><div class="k">${label}</div><div id="${id}" class="v">—</div></div>
  </div>`; }

function modalItem(){ return /*html*/`
  <div id="item-modal" class="fixed inset-0 z-[1000] hidden items-center justify-center bg-black/60" style="display:none">
    <div class="bg-slate-900 border border-white/10 rounded-xl w-[min(92vw,880px)]">
      <div class="flex items-center justify-between p-3 border-b border-white/10">
        <h2 class="text-lg font-semibold">➕ Insumo</h2>
        <button id="item-close" type="button" class="px-3 py-1.5 rounded bg-white/10 hover:bg-white/20">✖</button>
      </div>
      <form id="item-form" onsubmit="return false;" class="p-4 space-y-3">
        <input type="hidden" name="iid">
        <div class="grid sm:grid-cols-3 gap-3">
          <label class="text-sm block"><span class="block mb-1 text-slate-300">Código</span>
            <input name="code" class="w-full h-10 px-3 rounded bg-white/10 border border-white/10"></label>
          <label class="text-sm block sm:col-span-2"><span class="block mb-1 text-slate-300">Nombre *</span>
            <input name="name" class="w-full h-10 px-3 rounded bg-white/10 border border-white/10" required></label>
        </div>
        <div class="grid sm:grid-cols-3 gap-3">
          <label class="text-sm block"><span class="block mb-1 text-slate-300">Categoría</span>
            <input name="category" class="w-full h-10 px-3 rounded bg-white/10 border border-white/10"></label>
          <label class="text-sm block"><span class="block mb-1 text-slate-300">Unidad *</span>
            <select name="unit" class="w-full h-10 px-3 rounded bg-white/10 border border-white/10">
              <option value="u">Unidad</option><option value="kg">Kg</option><option value="g">g</option>
              <option value="lt">Lt</option><option value="ml">ml</option><option value="m2">m²</option></select></label>
          <label class="text-sm block"><span class="block mb-1 text-slate-300">Costo</span>
            <input type="number" step="0.01" min="0" name="cost" class="w-full h-10 px-3 rounded bg-white/10 border border-white/10"></label>
        </div>
        <div class="grid sm:grid-cols-4 gap-3">
          <label class="text-sm block"><span class="block mb-1 text-slate-300">Stock</span>
            <input type="number" min="0" name="stock" class="w-full h-10 px-3 rounded bg-white/10 border border-white/10" value="0"></label>
          <label class="text-sm block"><span class="block mb-1 text-slate-300">Mínimo</span>
            <input type="number" min="0" name="min" class="w-full h-10 px-3 rounded bg-white/10 border border-white/10" value="1"></label>
          <label class="text-sm block sm:col-span-2"><span class="block mb-1 text-slate-300">Proveedor</span>
            <select name="supplierId" class="w-full h-10 px-3 rounded bg-white/10 border border-white/10"></select></label>
        </div>
        <div class="glass rounded-lg p-3">
          <div class="font-medium mb-2">🔔 Alertas (opcional)</div>
          <div class="grid sm:grid-cols-3 gap-3">
            <label class="text-sm block"><span class="block mb-1 text-slate-300">Cada (días)</span>
              <input type="number" min="1" name="everyDays" class="w-full h-10 px-3 rounded bg-white/10 border border-white/10" placeholder="ej: 30"></label>
            <label class="text-sm block"><span class="block mb-1 text-slate-300">Fecha</span>
              <input type="date" name="nextDate" class="w-full h-10 px-3 rounded bg-white/10 border border-white/10"></label>
            <label class="text-sm block"><span class="block mb-1 text-slate-300">Umbral stock</span>
              <input type="number" min="0" name="threshold" class="w-full h-10 px-3 rounded bg-white/10 border border-white/10" placeholder="ej: 2"></label>
          </div>
        </div>
        <div class="flex justify-end gap-2">
          <button type="button" class="btn" id="item-cancel">Cancelar</button>
          <button type="button" class="btn" id="item-save-new">💾➕ Guardar y nuevo</button>
          <button type="button" class="btn btn-primary" id="item-save">💾 Guardar</button>
        </div>
      </form>
    </div>
  </div>`; }

function modalSupplier(){ return /*html*/`
  <div id="supp-modal" class="fixed inset-0 z-[1000] hidden items-center justify-center bg-black/60" style="display:none">
    <div class="bg-slate-900 border border-white/10 rounded-xl w-[min(92vw,760px)]">
      <div class="flex items-center justify-between p-3 border-b border-white/10">
        <h2 class="text-lg font-semibold">🏷️ Proveedor</h2>
        <button id="supp-close" type="button" class="px-3 py-1.5 rounded bg-white/10 hover:bg-white/20">✖</button>
      </div>
      <form id="supp-form" onsubmit="return false;" class="p-4 space-y-3">
        <input type="hidden" name="sid">
        <div class="grid sm:grid-cols-2 gap-3">
          <label class="text-sm block"><span class="block mb-1 text-slate-300">Nombre *</span>
            <input name="name" class="w-full h-10 px-3 rounded bg-white/10 border border-white/10" required></label>
          <label class="text-sm block"><span class="block mb-1 text-slate-300">Empresa</span>
            <input name="company" class="w-full h-10 px-3 rounded bg-white/10 border border-white/10"></label>
        </div>
        <div class="grid sm:grid-cols-3 gap-3">
          <label class="text-sm block"><span class="block mb-1 text-slate-300">Contacto</span>
            <input name="contact" class="w-full h-10 px-3 rounded bg-white/10 border border-white/10"></label>
          <label class="text-sm block"><span class="block mb-1 text-slate-300">WhatsApp / Tel</span>
            <input name="phone" class="w-full h-10 px-3 rounded bg-white/10 border border-white/10" placeholder="+54 9 ..."></label>
          <label class="text-sm block"><span class="block mb-1 text-slate-300">Email</span>
            <input type="email" name="email" class="w-full h-10 px-3 rounded bg-white/10 border border-white/10"></label>
        </div>
        <label class="text-sm block"><span class="block mb-1 text-slate-300">Rubros / Tags</span>
          <input name="tags" class="w-full h-10 px-3 rounded bg-white/10 border border-white/10" placeholder="pinturas, repuestos, ..."></label>
        <label class="text-sm block"><span class="block mb-1 text-slate-300">Notas</span>
          <textarea name="notes" rows="3" class="w-full px-3 py-2 rounded bg-white/10 border border-white/10"></textarea></label>
        <div class="flex justify-end gap-2">
          <button type="button" class="btn" id="supp-cancel">Cancelar</button>
          <button type="button" class="btn" id="supp-save-new">💾➕ Guardar y nuevo</button>
          <button type="button" class="btn btn-primary" id="supp-save">💾 Guardar</button>
        </div>
      </form>
    </div>
  </div>`; }

function modalSend(){ return /*html*/`
  <div id="send-modal" class="fixed inset-0 z-[1000] hidden items-center justify-center bg-black/60" style="display:none">
    <div class="bg-slate-900 border border-white/10 rounded-xl w-[min(92vw,900px)] max-h-[86vh] overflow-auto">
      <div class="flex items-center justify-between p-3 border-b border-white/10">
        <h2 class="text-lg font-semibold">Enviar lista de compra</h2>
        <button id="send-close" type="button" class="px-3 py-1.5 rounded bg-white/10 hover:bg-white/20">✖</button>
      </div>
      <div id="send-body" class="p-4 space-y-3"></div>
    </div>
  </div>`; }
