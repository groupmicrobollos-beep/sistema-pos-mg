// frontend/js/pages/Reports.js
// Reportes — profesional, compacto y completo — INTEGRADO con Configuración
// - Lee sucursales y ajustes (moneda/locale/decimales/datos empresa) desde cfg_* y reacciona a eventos cfg:*
// - Filtros: sucursal, período rápido, rango de fechas
// - Agrupación: día / semana / mes / año
// - KPIs + gráfico de barras (canvas nativo)
// - Resumen por agrupador + Detalle
// - Exportar Excel (si XLSX) o CSV (fallback)
// - Modal de detalle con PDF (si generateBudgetPDF está disponible)

// ====== Vínculo con Configuración (snapshot inicial) ======
const ls = (k, d) => { try { return JSON.parse(localStorage.getItem(k) ?? JSON.stringify(d)); } catch { return d; } };

let CFG_SETTINGS = (window.CFG?.getSettings?.() || ls("cfg_settings", {}));
let CFG_BRANCHES = (window.CFG?.getBranches?.() || ls("cfg_branches", []));

// moneda/locale/decimales dinámicos desde Ajustes
let CURRENCY = CFG_SETTINGS?.currency || "ARS";
let LOCALE   = CFG_SETTINGS?.locale   || "es-AR";
let DECIMALS = Number.isInteger(CFG_SETTINGS?.decimals) ? CFG_SETTINGS.decimals : 2;

const money = (n) => (Number(n) || 0).toLocaleString(LOCALE, {
  style: "currency",
  currency: CURRENCY,
  minimumFractionDigits: DECIMALS,
  maximumFractionDigits: DECIMALS
});

const parseMoney = (text) => {
  if (typeof text === "number") return text;
  const t = String(text || "0")
    .replace(/\s/g, "")
    .replace(/[^\d,.-]/g, "")
    // elimina puntos que parecen separadores de miles (pero respeta decimales .xx)
    .replace(/\.(?=\d{3}(?:[^\d]|$))/g, "")
    .replace(",", ".");
  const v = parseFloat(t);
  return isNaN(v) ? 0 : v;
};

const toDMY = (iso) => {
  const d = new Date((iso || "").slice(0,10)+"T00:00:00"); if (isNaN(d)) return "-";
  const dd = String(d.getDate()).padStart(2,"0"); const mm = String(d.getMonth()+1).padStart(2,"0"); const yy = d.getFullYear();
  return `${dd}/${mm}/${yy}`;
};
const monthName = (i) => ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"][i] || "";
const todayISO = () => new Date().toISOString().slice(0,10);

function toast(msg, type="info"){
  const bg = type==="error" ? "bg-rose-600" : type==="success" ? "bg-emerald-600" : "bg-sky-700";
  const el = document.createElement("div");
  el.className = `fixed top-4 right-4 z-[4000] px-3 py-2 rounded-lg text-white shadow-2xl text-xs ${bg}`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(()=>{ el.style.opacity="0"; el.style.transform="translateX(10px)"; setTimeout(()=>el.remove(),160); }, 2000);
}

// Helpers sucursales / empresa
const getBranchName = (id) => (CFG_BRANCHES || []).find(b => b.id === id)?.name || id || "-";
const getCompany = () => ({
  companyName: CFG_SETTINGS?.companyName || "",
  brandName:   CFG_SETTINGS?.brandName   || "",
  address:     CFG_SETTINGS?.address     || "",
  phone:       CFG_SETTINGS?.phone       || "",
  email:       CFG_SETTINGS?.email       || ""
});

export default {
  render(){
    return /*html*/`
<section data-page="reports" class="space-y-6 text-[13px]">
  <style>
    [data-page="reports"] .glass{ background:rgba(255,255,255,.035); backdrop-filter:blur(6px); }
    [data-page="reports"] .card{ border:1px solid rgba(255,255,255,.09); border-radius:.6rem; }
    [data-page="reports"] .k{ font-size:.74rem; color:#cbd5e1 }
    [data-page="reports"] .v{ font-size:1.06rem; font-weight:700 }
    [data-page="reports"] .g-indigo{ background:linear-gradient(135deg,rgba(99,102,241,.16),rgba(99,102,241,.06)); }
    [data-page="reports"] .g-emerald{ background:linear-gradient(135deg,rgba(16,185,129,.16),rgba(16,185,129,.06)); }
    [data-page="reports"] .g-pink{ background:linear-gradient(135deg,rgba(236,72,153,.16),rgba(236,72,153,.06)); }
    [data-page="reports"] .g-amber{ background:linear-gradient(135deg,rgba(245,158,11,.16),rgba(245,158,11,.06)); }
    [data-page="reports"] .g-slate{ background:linear-gradient(135deg,rgba(100,116,139,.16),rgba(100,116,139,.06)); }
    [data-page="reports"] .ctrl, [data-page="reports"] .btn{ height:36px; line-height:34px; font-size:12.5px }
    [data-page="reports"] .btn{ display:inline-flex; align-items:center; gap:.4rem; padding:0 .7rem; border-radius:.45rem; border:1px solid rgba(255,255,255,.10); background:rgba(255,255,255,.08) }
    [data-page="reports"] .btn:hover{ background:rgba(255,255,255,.14) }
    [data-page="reports"] .btn-primary{ background:rgba(16,185,129,.85); border-color:transparent }
    [data-page="reports"] .btn-primary:hover{ background:rgba(16,185,129,1) }
    [data-page="reports"] .btn-secondary{ background:rgba(99,102,241,.85); border-color:transparent }
    [data-page="reports"] .btn-secondary:hover{ background:rgba(99,102,241,1) }
    [data-page="reports"] .table-wrap{ border:1px solid rgba(255,255,255,.08); border-radius:.5rem; overflow:hidden; }
    [data-page="reports"] .table td, .table th{ padding:.5rem .65rem; border-bottom:1px solid rgba(255,255,255,.06) }
    [data-page="reports"] th{ font-weight:600; color:#cbd5e1; white-space:nowrap; }
    [data-page="reports"] .badge{ font-size:.68rem; padding:.16rem .45rem; border-radius:.45rem }
    [data-page="reports"] .status-active{ background:#16a34a33; color:#86efac }
    [data-page="reports"] .status-expired{ background:#dc262633; color:#fca5a5 }
    [data-page="reports"] select option{ color:#e2e8f0; background-color:#0b1220; }
    [data-page="reports"] .bar-wrap{ overflow:auto; }
  </style>

  <!-- Título + filtros -->
  <div class="flex flex-wrap items-center justify-between gap-3">
    <h1 class="text-[18px] font-semibold leading-none">Reportes</h1>
    <div class="flex flex-wrap items-center gap-2">
      <select id="branch" class="ctrl px-2.5 rounded bg-white/10 border border-white/10 text-slate-100">
        <option value="">Todas las sucursales</option>
      </select>
      <select id="quick" class="ctrl px-2.5 rounded bg-white/10 border border-white/10 text-slate-100">
        <option value="month" selected>Este mes</option>
        <option value="today">Hoy</option>
        <option value="week">Esta semana</option>
        <option value="year">Este año</option>
        <option value="custom">Personalizado</option>
      </select>
      <input id="from" type="date" class="ctrl px-2.5 rounded bg-white/10 border border-white/10" />
      <span class="text-slate-400">–</span>
      <input id="to" type="date" class="ctrl px-2.5 rounded bg-white/10 border border-white/10" />
      <select id="group" class="ctrl px-2.5 rounded bg-white/10 border border-white/10 text-slate-100">
        <option value="day">Día</option>
        <option value="week">Semana</option>
        <option value="month" selected>Mes</option>
        <option value="year">Año</option>
      </select>
      <button id="export" class="btn btn-primary">📤 Exportar</button>
    </div>
  </div>

  <!-- KPIs -->
  <div class="grid sm:grid-cols-3 xl:grid-cols-5 gap-3">
    ${kpi("💼","Presupuestos","kpi-count","g-indigo")}
    ${kpi("💰","Monto","kpi-amount","g-emerald")}
    ${kpi("🧾","Ticket Prom.","kpi-avg","g-pink")}
    ${kpi("🏢","Sucursales","kpi-branches","g-amber")}
    ${kpi("🗓️","Rango activo","kpi-range","g-slate")}
  </div>

  <!-- Chart -->
  <div class="glass card p-4 space-y-2">
    <div class="flex items-center justify-between">
      <h2 class="font-medium text-[13px] leading-none">Distribución por <span id="chart-group-label">mes</span></h2>
      <div class="text-[11px] text-slate-400" id="chart-sub">—</div>
    </div>
    <div class="bar-wrap">
      <canvas id="chart-bar" class="h-48 w-full"></canvas>
    </div>
  </div>

  <!-- Resumen -->
  <div class="glass card p-4 space-y-2">
    <h2 class="font-medium text-[13px] leading-none">Resumen</h2>
    <div class="table-wrap">
      <table class="table w-full text-[12.5px]">
        <thead class="bg-white/5">
          <tr>
            <th>Periodo</th>
            <th class="text-right">Presupuestos</th>
            <th class="text-right">Monto</th>
            <th class="text-right">Ticket Prom.</th>
          </tr>
        </thead>
        <tbody id="sum-body"></tbody>
      </table>
    </div>
    <div id="sum-empty" class="text-slate-400 text-xs py-2 text-center hidden">Sin datos dentro del rango.</div>
  </div>

  <!-- Detalle -->
  <div class="glass card p-4 space-y-2">
    <h2 class="font-medium text-[13px] leading-none">Detalle</h2>
    <div class="table-wrap">
      <table class="table w-full text-[12.5px]">
        <thead class="bg-white/5">
          <tr>
            <th>Número</th>
            <th>Fecha</th>
            <th>Cliente</th>
            <th>Vehículo</th>
            <th>Sucursal</th>
            <th class="text-right">Total</th>
            <th>Estado</th>
            <th class="text-right">Acciones</th>
          </tr>
        </thead>
        <tbody id="detail-body"></tbody>
      </table>
    </div>
    <div id="detail-empty" class="text-slate-400 text-xs py-2 text-center hidden">No hay presupuestos para el filtro.</div>
  </div>

  <!-- Modal Detalle -->
  <div id="detail-modal" class="fixed inset-0 z-[1000] hidden items-center justify-center bg-black/60">
    <div class="bg-slate-900 border border-white/10 rounded-xl w-[min(92vw,980px)] max-h-[86vh] overflow-auto">
      <div class="flex items-center justify-between p-3 border-b border-white/10">
        <h2 class="text-lg font-semibold">👁️ Detalles del Presupuesto</h2>
        <div class="flex gap-2">
          <button id="modal-pdf" class="px-3 py-1.5 rounded bg-rose-600/80 hover:bg-rose-600 hidden">⬇️ PDF</button>
          <button id="modal-close" class="px-3 py-1.5 rounded bg-white/10 hover:bg-white/20">✖</button>
        </div>
      </div>
      <div id="modal-body" class="p-4 space-y-5"></div>
    </div>
  </div>
</section>
    `;
  },

  mount(root){
    // Refs filtros
    const branch = root.querySelector("#branch");
    const quick  = root.querySelector("#quick");
    const from   = root.querySelector("#from");
    const to     = root.querySelector("#to");
    const group  = root.querySelector("#group");
    const exportBtn = root.querySelector("#export");

    // KPIs
    const kCount = root.querySelector("#kpi-count");
    const kAmount = root.querySelector("#kpi-amount");
    const kAvg = root.querySelector("#kpi-avg");
    const kBranches = root.querySelector("#kpi-branches");
    const kRange = root.querySelector("#kpi-range");

    // Chart
    const barCanvas = root.querySelector("#chart-bar");
    const chartGroupLabel = root.querySelector("#chart-group-label");
    const chartSub = root.querySelector("#chart-sub");

    // Tablas
    const sumBody = root.querySelector("#sum-body");
    const sumEmpty = root.querySelector("#sum-empty");
    const detailBody = root.querySelector("#detail-body");
    const detailEmpty = root.querySelector("#detail-empty");

    // Modal
    const modal = root.querySelector("#detail-modal");
    const modalBody = root.querySelector("#modal-body");
    const modalClose = root.querySelector("#modal-close");
    const modalPdf = root.querySelector("#modal-pdf");

    // ===== Pinta sucursales desde Configuración =====
    function paintBranchesFilter(keep = null) {
      const prev = keep ?? branch.value;
      branch.innerHTML = `<option value="">Todas las sucursales</option>` +
        (CFG_BRANCHES || []).map(b => `<option value="${b.id}">${b.name || b.address || b.id}</option>`).join("");
      branch.value = (CFG_BRANCHES || []).some(b => b.id === prev) ? prev : "";
    }
    paintBranchesFilter();

    // Reaccionar a cambios desde Configuración
    document.addEventListener("cfg:branches-updated", (e) => {
      CFG_BRANCHES = e.detail?.branches || [];
      paintBranchesFilter();
      renderDetail(); // refresca nombres de sucursal en tabla
      renderSummary();
    });
    document.addEventListener("cfg:settings-updated", (e) => {
      CFG_SETTINGS = e.detail?.settings || CFG_SETTINGS;
      CURRENCY = CFG_SETTINGS.currency || CURRENCY;
      LOCALE   = CFG_SETTINGS.locale   || LOCALE;
      DECIMALS = Number.isInteger(CFG_SETTINGS.decimals) ? CFG_SETTINGS.decimals : DECIMALS;
      renderAll(); // re-formatea KPIs, tablas y gráfico
      toast("Ajustes aplicados en Reportes ✅","success");
    });

    // Estado
    let all = [];        // presupuestos (lista con details)
    let filtered = [];   // tras filtros
    let aggregated = []; // resumen por group
    let current = null;

    // Init fechas por quick=month
    setQuickRange("month");
    from.value = from.value || todayISO();
    to.value = to.value || todayISO();

    load(); applyFilters(); computeAggregates(); renderAll();

    // Eventos
    branch.addEventListener("change", () => { applyFilters(); computeAggregates(); renderAll(); });
    group.addEventListener("change",  () => { computeAggregates(); renderAll(); });
    [from, to].forEach(el => el.addEventListener("change", () => {
      quick.value = "custom";
      applyFilters(); computeAggregates(); renderAll();
    }));
    quick.addEventListener("change", () => {
      setQuickRange(quick.value);
      applyFilters(); computeAggregates(); renderAll();
    });
    exportBtn.addEventListener("click", exportData);

    // Tabla acciones
    detailBody.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-act]"); if (!btn) return;
      const act = btn.dataset.act, key = btn.dataset.key, num = btn.dataset.num;
      if (act==="view") openDetail(key);
      if (act==="edit") { try{ sessionStorage.setItem("editBudgetKey", key); }catch{}; location.hash="#/presupuesto"; }
      if (act==="del")  deleteBudget(key, num);
    });

    // Modal
    modalClose.addEventListener("click", closeDetail);
    modal.addEventListener("click", (e)=>{ if(e.target===modal) closeDetail(); });
    modalPdf.addEventListener("click", async ()=>{
      if (!current || typeof window.generateBudgetPDF !== "function") return;
      try {
        const data = normalizeForPdf(current);
        const pdf = await window.generateBudgetPDF(data);
        const clean = (data.numero||"SIN").replace(/[^\w\d]/g,"-");
        pdf.save(`Presupuesto-${clean}.pdf`);
      } catch (e) { console.error(e); toast("No se pudo generar el PDF","error"); }
    });

    // ====== Load + Filters + Aggregation ======
    function load(){
      const list = JSON.parse(localStorage.getItem("budgets_list") || "[]");
      all = list.map(s => {
        const full = JSON.parse(localStorage.getItem(s.key) || "null");
        return { ...s, details: full || null };
      }).filter(b => !!b.details);
    }

    function setQuickRange(value){
      const now = new Date(); now.setHours(0,0,0,0);
      let a = new Date(now), b = new Date(now);
      if (value === "today") { /* hoy */ }
      else if (value === "week") {
        const day = (now.getDay()+6)%7; // lunes=0
        a.setDate(now.getDate()-day);
        b.setDate(a.getDate()+6);
      } else if (value === "month") {
        a = new Date(now.getFullYear(), now.getMonth(), 1);
        b = new Date(now.getFullYear(), now.getMonth()+1, 0);
      } else if (value === "year") {
        a = new Date(now.getFullYear(), 0, 1);
        b = new Date(now.getFullYear(), 11, 31);
      } // custom -> no tocamos
      from.value = a.toISOString().slice(0,10);
      to.value   = b.toISOString().slice(0,10);
    }

    function applyFilters(){
      const br = branch.value;
      const a = new Date((from.value||todayISO())+"T00:00:00");
      const b = new Date((to.value||todayISO())+"T23:59:59");
      filtered = all.filter(x => {
        if (br && x.sucursal !== br) return false;
        const d = new Date((x.fecha||"").slice(0,10)+"T12:00:00");
        return d>=a && d<=b;
      });
    }

    function computeAggregates(){
      const mode = group.value; // day/week/month/year
      const map = new Map();
      filtered.forEach(b => {
        const d = new Date((b.fecha||"").slice(0,10)+"T12:00:00");
        const amount = parseMoney(b.total);
        const {key, label} = bucket(d, mode);
        if (!map.has(key)) map.set(key, { key, label, count:0, amount:0 });
        const it = map.get(key);
        it.count += 1; it.amount += amount;
      });
      aggregated = Array.from(map.values()).sort((a,b)=> a.key < b.key ? -1 : 1)
        .map(x => ({...x, avg: x.count ? x.amount/x.count : 0}));
    }

    // ====== Render ======
    function renderAll(){
      renderKPIs();
      renderChart();
      renderSummary();
      renderDetail();
    }
    function renderKPIs(){
      const count = filtered.length;
      const amount = filtered.reduce((s,b)=> s + parseMoney(b.total), 0);
      const avg = count ? amount / count : 0;
      const branches = new Set(filtered.map(b=>b.sucursal)).size || 0;
      kCount.textContent = count;
      kAmount.textContent = money(amount);
      kAvg.textContent = money(avg);
      kBranches.textContent = branches;
      kRange.textContent = `${toDMY(from.value)} — ${toDMY(to.value)}`;
    }

    function renderSummary(){
      if (!aggregated.length){
        sumBody.innerHTML = "";
        sumEmpty.classList.remove("hidden");
        return;
      }
      sumEmpty.classList.add("hidden");
      sumBody.innerHTML = aggregated.map(r => `
        <tr class="hover:bg-white/5">
          <td>${r.label}</td>
          <td class="text-right">${r.count}</td>
          <td class="text-right font-medium">${money(r.amount)}</td>
          <td class="text-right">${money(r.avg)}</td>
        </tr>
      `).join("");
    }

    function renderDetail(){
      if (!filtered.length){
        detailBody.innerHTML = "";
        detailEmpty.classList.remove("hidden");
        return;
      }
      detailEmpty.classList.add("hidden");
      detailBody.innerHTML = filtered
        .slice()
        .sort((a,b)=> (b.details?.fechaCreacion||b.fecha||"") > (a.details?.fechaCreacion||a.fecha||"") ? 1 : -1)
        .map(b => {
          const veh = vehicleInfo(b);
          const suc = getBranchName(b.sucursal);
          const expired = isExpired(b.fecha);
          return `
            <tr class="hover:bg-white/5">
              <td class="font-medium">${b.numero}</td>
              <td>${toDMY(b.fecha)}</td>
              <td class="max-w-[260px] truncate">${b.cliente || "Sin nombre"}</td>
              <td class="max-w-[260px] truncate">${veh}</td>
              <td>${suc}</td>
              <td class="text-right font-medium">${b.total}</td>
              <td><span class="badge ${expired?"status-expired":"status-active"}">${expired? "Vencido":"Vigente"}</span></td>
              <td class="text-right whitespace-nowrap">
                <button data-act="view" data-key="${b.key}" class="btn" style="height:28px;line-height:26px;padding:0 .45rem;">👁️</button>
                <button data-act="edit" data-key="${b.key}" class="btn btn-secondary" style="height:28px;line-height:26px;padding:0 .45rem;">✏️</button>
                <button data-act="del"  data-key="${b.key}" data-num="${b.numero}" class="btn" style="height:28px;line-height:26px;padding:0 .45rem;">🗑</button>
              </td>
            </tr>
          `;
        }).join("");
    }

    // ====== Chart (barras) ======
    function renderChart(){
      const mode = group.value;
      chartGroupLabel.textContent = (mode==="day"?"día":mode==="week"?"semana":mode==="month"?"mes":"año");
      chartSub.textContent = `${toDMY(from.value)} → ${toDMY(to.value)}`;
      drawBars(barCanvas, aggregated.map(x=>x.label), aggregated.map(x=>x.amount));
    }

    // ====== Modal detalle ======
    function openDetail(key){
      const b = JSON.parse(localStorage.getItem(key) || "null");
      if (!b) return toast("No se encontró el presupuesto","error");
      current = b;
      modalBody.innerHTML = renderBudgetDetail(b);
      if (typeof window.generateBudgetPDF === "function") modalPdf.classList.remove("hidden");
      else modalPdf.classList.add("hidden");
      modal.classList.remove("hidden"); modal.classList.add("flex");
    }
    function closeDetail(){ modal.classList.add("hidden"); modal.classList.remove("flex"); current = null; }
    function deleteBudget(key, numero){
      if (!confirm(`¿Eliminar el presupuesto ${numero}? Esta acción no se puede deshacer.`)) return;
      localStorage.removeItem(key);
      const list = JSON.parse(localStorage.getItem("budgets_list") || "[]").filter(x => x.key !== key);
      localStorage.setItem("budgets_list", JSON.stringify(list));
      load(); applyFilters(); computeAggregates(); renderAll();
      toast(`Presupuesto ${numero} eliminado ✅`, "success");
    }
    function renderBudgetDetail(b){
      const sucName = getBranchName(b.sucursal);
      const c = b.cliente || {};
      const items = b.items || [];
      const totalNum = items.reduce((s,it)=> s + parseMoney(it.total), 0);
      const dd = daysFrom(b.fecha);
      const expired = dd > 30;
      const status = expired ? `Vencido (${dd} días)` : `Vigente (${Math.max(0,30-dd)} días restantes)`;
      return `
        <div class="glass rounded-lg p-3">
          <div class="font-medium mb-1">Información general</div>
          <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 text-sm">
            <div><div class="text-slate-400">Número</div><div class="font-semibold">${b.numero}</div></div>
            <div><div class="text-slate-400">Fecha</div><div>${toDMY(b.fecha)}</div></div>
            <div><div class="text-slate-400">Sucursal</div><div>${sucName}</div></div>
            <div><div class="text-slate-400">Estado</div><div class="${expired?'text-rose-400':'text-emerald-400'} font-medium">${status}</div></div>
            <div><div class="text-slate-400">Subtotal</div><div>${b.subtotal || money(totalNum)}</div></div>
            <div><div class="text-slate-400">Total</div><div class="font-semibold">${b.total || money(totalNum)}</div></div>
          </div>
        </div>

        <div class="glass rounded-lg p-3">
          <div class="font-medium mb-1">Datos del cliente</div>
          <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 text-sm">
            <div><div class="text-slate-400">Nombre</div><div>${c.nombre || "-"}</div></div>
            <div><div class="text-slate-400">Teléfono</div><div>${c.telefono || "-"}</div></div>
            <div><div class="text-slate-400">Vehículo</div><div>${c.vehiculo || "-"}</div></div>
            <div><div class="text-slate-400">Patente</div><div>${c.patente || "-"}</div></div>
            <div><div class="text-slate-400">Modelo</div><div>${c.modelo || "-"}</div></div>
            <div><div class="text-slate-400">Compañía de seguro</div><div>${c.compania || "-"}</div></div>
          </div>
        </div>

        <div class="glass rounded-lg p-3">
          <div class="font-medium mb-2">Ítems</div>
          <div class="overflow-auto rounded border border-white/10">
            <table class="w-full text-sm">
              <thead class="bg-white/5">
                <tr>
                  <th class="text-left px-3 py-2 w-20">Cant.</th>
                  <th class="text-left px-3 py-2">Descripción</th>
                  <th class="text-right px-3 py-2 w-40">Precio Unit.</th>
                  <th class="text-right px-3 py-2 w-40">Total</th>
                </tr>
              </thead>
              <tbody>
                ${
                  items.length
                    ? items.map(it=>`
                        <tr>
                          <td class="px-3 py-2">${it.cantidad ?? "-"}</td>
                          <td class="px-3 py-2">${it.descripcion ?? "-"}</td>
                          <td class="px-3 py-2 text-right">${it.precio ?? (it.unit? money(it.unit) : "-")}</td>
                          <td class="px-3 py-2 text-right">${it.total ?? "-"}</td>
                        </tr>
                      `).join("")
                    : `<tr><td colspan="4" class="px-3 py-6 text-center text-slate-400">No hay ítems</td></tr>`
                }
              </tbody>
              <tfoot class="bg-white/5">
                <tr>
                  <td colspan="3" class="px-3 py-2 text-right font-medium">TOTAL</td>
                  <td class="px-3 py-2 text-right font-semibold">${b.total || money(totalNum)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      `;
    }

    // ====== Export ======
    function exportData(){
      if (!filtered.length){
        toast("No hay datos para exportar con los filtros actuales","error"); return;
      }
      const resumen = aggregated.map(r => ({
        "Periodo": r.label,
        "Presupuestos": r.count,
        "Monto": round2(r.amount),
        "Ticket Prom.": round2(r.avg)
      }));
      const detalle = filtered.map(b => ({
        "Número": b.numero,
        "Fecha": toDMY(b.fecha),
        "Cliente": b.cliente || "Sin nombre",
        "Vehículo": vehicleInfo(b),
        "Sucursal": getBranchName(b.sucursal),
        "Total": parseMoney(b.total),
        "Estado": isExpired(b.fecha) ? "Vencido" : "Vigente"
      }));

      const fname = `Reporte_${from.value}_a_${to.value}_${group.value}.xlsx`.replace(/-/g,"");
      if (window.XLSX){
        const wb = XLSX.utils.book_new();
        const ws1 = XLSX.utils.json_to_sheet(resumen);
        const ws2 = XLSX.utils.json_to_sheet(detalle);
        ws1["!cols"] = [{wch:20},{wch:14},{wch:16},{wch:16}];
        ws2["!cols"] = [{wch:22},{wch:12},{wch:28},{wch:26},{wch:24},{wch:14},{wch:12}];
        XLSX.utils.book_append_sheet(wb, ws1, "Resumen");
        XLSX.utils.book_append_sheet(wb, ws2, "Detalle");
        XLSX.writeFile(wb, fname);
        toast(`Excel "${fname}" exportado ✅`, "success");
      } else {
        // Fallback: CSV doble (Resumen y Detalle)
        const csv = toCSV(resumen);
        const csv2 = toCSV(detalle);
        downloadText(csv, fname.replace(/\.xlsx$/,"_resumen.csv"));
        downloadText(csv2, fname.replace(/\.xlsx$/,"_detalle.csv"));
        toast("CSV exportado (no se encontró XLSX) ✅","success");
      }
    }

    // ====== Helpers ======
    function round2(n){ return Math.round((Number(n)||0)*100)/100; }
    function toCSV(arr){
      if (!arr.length) return "";
      const headers = Object.keys(arr[0]);
      const lines = [headers.join(",")].concat(
        arr.map(o => headers.map(h => csvEscape(o[h])).join(","))

      );
      return lines.join("\n");
    }
    function csvEscape(v){
      const s = String(v ?? "");
      if (/[",\n]/.test(s)) return `"${s.replace(/"/g,'""')}"`;
      return s;
    }
    function downloadText(text, filename){
      const blob = new Blob([text], {type:"text/csv;charset=utf-8;"});
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
      setTimeout(()=>URL.revokeObjectURL(url), 500);
    }

    function vehicleInfo(b){
      const c = b.details?.cliente || b.cliente || {};
      const v = c.vehiculo || "";
      const m = c.modelo || "";
      const p = c.patente || "";
      const parts = [v,m,p].filter(Boolean);
      return parts.length ? parts.join(" - ") : "No especificado";
    }
    function isExpired(iso){
      const d = new Date((iso||"").slice(0,10)+"T00:00:00");
      const delta = Math.floor((Date.now() - d.getTime())/(1000*60*60*24));
      return delta > 30;
    }
    function daysFrom(iso){
      const d = new Date((iso||"").slice(0,10)+"T00:00:00");
      return Math.floor((Date.now() - d.getTime())/(1000*60*60*24));
    }

    function normalizeForPdf(b){
      const subtotalNum = (b.items||[]).reduce((s,it)=> s+parseMoney(it.total), 0);
      return {
        numero: b.numero || "",
        fecha: (b.fecha || todayISO()),
        sucursalId: b.sucursal || "",
        sucursalNombre: getBranchName(b.sucursal),
        cliente: {
          nombre: b.cliente?.nombre || "",
          telefono: b.cliente?.telefono || "",
          vehiculo: b.cliente?.vehiculo || "",
          patente: b.cliente?.patente || "",
          modelo: b.cliente?.modelo || "",
          compania: b.cliente?.compania || "",
          chasis: b.cliente?.chasis || ""
        },
        items: (b.items || []).map(x => ({
          cantidad: Number(x.cantidad)||1,
          descripcion: x.descripcion || "-",
          unit: parseMoney(x.unit ?? x.precio),
          total: parseMoney(x.total)
        })),
        subtotal: subtotalNum,
        total: subtotalNum,
        firmaDataUrl: localStorage.getItem("digital_signature") || null,
        company: getCompany()
      };
    }

    // === Buckets ===
    function bucket(d, mode){
      const y = d.getFullYear();
      const m = d.getMonth();
      const dd = d.getDate();
      if (mode === "day"){
        const key = `${y}-${String(m+1).padStart(2,"0")}-${String(dd).padStart(2,"0")}`;
        return { key, label: toDMY(key) };
      }
      if (mode === "week"){
        const {year, week, start, end} = isoWeek(d);
        const key = `${year}-W${String(week).padStart(2,"0")}`;
        const label = `Sem ${week} (${toDMY(start.toISOString().slice(0,10))}–${toDMY(end.toISOString().slice(0,10))})`;
        return { key, label };
      }
      if (mode === "month"){
        const key = `${y}-${String(m+1).padStart(2,"0")}`;
        const label = `${monthName(m)} ${y}`;
        return { key, label };
      }
      // year
      return { key: String(y), label: String(y) };
    }
    function isoWeek(d){
      const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
      const dayNum = tmp.getUTCDay() || 7;
      tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
      const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(),0,1));
      const weekNo = Math.ceil((((tmp - yearStart)/86400000) + 1)/7);
      // start/end monday-sunday
      const start = new Date(tmp); start.setUTCDate(tmp.getUTCDate() - (tmp.getUTCDay()||7) + 1);
      const end = new Date(start); end.setUTCDate(start.getUTCDate()+6);
      return { year: tmp.getUTCFullYear(), week: weekNo, start, end };
    }

    // === Bar chart (canvas nativo) ===
    function drawBars(canvas, labels, values){
      const dpr = window.devicePixelRatio || 1;
      const n = Math.max(labels.length, 1);
      const barW = 36; const gap = 16;
      const minW = n * (barW + gap) + 40;
      const W = Math.max(canvas.parentElement.clientWidth || 600, minW);
      const H = canvas.clientHeight || 200;
      canvas.width = W * dpr; canvas.height = H * dpr;
      const ctx = canvas.getContext("2d");
      ctx.setTransform(dpr,0,0,dpr,0,0);
      ctx.clearRect(0,0,W,H);

      // fondo
      ctx.fillStyle = "rgba(255,255,255,0.025)";
      roundRect(ctx, 0, 0, W, H, 10, true, false);

      const padL = 34, padR = 12, padT = 16, padB = 34;
      const chartW = W - padL - padR;
      const chartH = H - padT - padB;

      const max = Math.max(...values, 1);
      // grid
      ctx.strokeStyle = "rgba(255,255,255,0.06)"; ctx.lineWidth = 1;
      for(let i=1;i<=3;i++){
        const y = padT + chartH * (i/4);
        ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W-padR, y); ctx.stroke();
      }

      // barras
      const step = chartW / n;
      for(let i=0;i<n;i++){
        const v = values[i] || 0;
        const x = padL + i*step + (step - barW)/2;
        const h = Math.max(2, v * chartH / max);
        const y = padT + chartH - h;
        ctx.fillStyle = "rgba(99,102,241,0.92)";
        roundRect(ctx, x, y, barW, h, 6, true, false);

        // valor arriba (si hay espacio)
        ctx.fillStyle = "rgba(226,232,240,0.9)";
        ctx.font = "11px system-ui, -apple-system, Segoe UI, Roboto, Arial";
        const val = money(v);
        if (h > 18) ctx.fillText(val, x + barW/2 - ctx.measureText(val).width/2, y - 4);
      }

      // labels eje X
      ctx.fillStyle = "rgba(148,163,184,0.9)";
      ctx.font = "11px system-ui, -apple-system, Segoe UI, Roboto, Arial";
      labels.forEach((lab,i) => {
        const x = padL + i*step + step/2;
        const text = lab;
        const w = ctx.measureText(text).width;
        ctx.save();
        ctx.translate(x, H - 12);
        ctx.rotate(-Math.PI/6); // -30°
        ctx.fillText(text, -w/2, 0);
        ctx.restore();
      });

      // eje Y min / max
      ctx.fillStyle = "rgba(148,163,184,0.9)";
      ctx.fillText(money(0), 6, H - padB + 4);
      const mStr = money(max);
      ctx.fillText(mStr, 6, padT + 8);
    }

    function roundRect(ctx, x, y, w, h, r, fill, stroke){
      if (typeof r === "number") r = {tl:r, tr:r, br:r, bl:r};
      else r = Object.assign({tl:0,tr:0,br:0,bl:0}, r);
      ctx.beginPath();
      ctx.moveTo(x + r.tl, y);
      ctx.lineTo(x + w - r.tr, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r.tr);
      ctx.lineTo(x + w, y + h - r.br);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r.br, y + h);
      ctx.lineTo(x + r.bl, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r.bl);
      ctx.lineTo(x, y + r.tl);
      ctx.quadraticCurveTo(x, y, x + r.tl, y);
      if (fill) ctx.fill();
      if (stroke) ctx.stroke();
    }
  }
};

// === UI helpers (cards)
function kpi(icon, label, id, g="g-indigo"){
  return /*html*/`
  <div class="glass card ${g} p-3.5 flex items-center gap-3 min-h-[64px]">
    <div>${icon}</div>
    <div><div class="k">${label}</div><div id="${id}" class="v">—</div></div>
  </div>`;
}
