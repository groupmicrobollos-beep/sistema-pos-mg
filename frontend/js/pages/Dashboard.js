// frontend/js/pages/Dashboard.js — versión ajustada (alineaciones + tamaños coherentes)
// + Integración dinámica con Configuración (sucursales desde localStorage / window.CFG)
// - Alturas unificadas para selects y botones (36px)
// - Grids con aire (gap consistente) y cards con paddings parejos
// - Tabla con acciones alineadas a la derecha, botones compactos e iguales
// - Gráficos con leyenda aparte y sin solaparse
// - Estética dark profesional con tipografías de 12–13px

// ====== Integración con Configuración ======
const CFG_BRANCHES_KEY = "cfg_branches";
function _lsBranches(){ try{ return JSON.parse(localStorage.getItem(CFG_BRANCHES_KEY) || "[]"); } catch { return []; } }
function getBranches(){ return (window.CFG && typeof window.CFG.getBranches === "function") ? window.CFG.getBranches() : _lsBranches(); }

// ====== App locals ======
const CLIENTS_KEY = "clients_db";

const ARS = { style: "currency", currency: "ARS", minimumFractionDigits: 2, maximumFractionDigits: 2 };
const money = (n) => (Number(n) || 0).toLocaleString("es-AR", ARS);
const parseMoney = (text) => {
  if (typeof text === "number") return text;
  const t = String(text || "0").replace(/\$/g, "").replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const v = parseFloat(t);
  return isNaN(v) ? 0 : v;
};
const toDMY = (iso) => {
  const d = new Date((iso || "").slice(0, 10) + "T00:00:00");
  if (isNaN(d)) return "-";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = d.getFullYear();
  return `${dd}/${mm}/${yy}`;
};
function toast(msg, type = "info") {
  const bg = type === "error" ? "bg-rose-600" : type === "success" ? "bg-emerald-600" : "bg-sky-700";
  const el = document.createElement("div");
  el.className = `fixed top-4 right-4 z-[4000] px-3 py-2 rounded-lg text-white shadow-2xl text-xs ${bg}`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => { el.style.opacity = "0"; el.style.transform = "translateX(10px)"; setTimeout(()=>el.remove(),160); }, 2000);
}

export default {
  render() {
    return /*html*/`
<section data-page="dashboard" class="space-y-6 text-[13px]">
  <style>
    [data-page="dashboard"] .glass{ background:rgba(255,255,255,.035); backdrop-filter:blur(6px); }
    [data-page="dashboard"] .card{ border:1px solid rgba(255,255,255,.09); border-radius:.6rem; }
    [data-page="dashboard"] .k{ font-size:.74rem; color:#cbd5e1 }
    [data-page="dashboard"] .v{ font-size:1.06rem; font-weight:700; letter-spacing:.2px }
    [data-page="dashboard"] .g-indigo{ background:linear-gradient(135deg,rgba(99,102,241,.16),rgba(99,102,241,.06)); }
    [data-page="dashboard"] .g-emerald{ background:linear-gradient(135deg,rgba(16,185,129,.16),rgba(16,185,129,.06)); }
    [data-page="dashboard"] .g-pink{ background:linear-gradient(135deg,rgba(236,72,153,.16),rgba(236,72,153,.06)); }
    [data-page="dashboard"] .g-cyan{ background:linear-gradient(135deg,rgba(6,182,212,.16),rgba(6,182,212,.06)); }
    [data-page="dashboard"] .g-amber{ background:linear-gradient(135deg,rgba(245,158,11,.16),rgba(245,158,11,.06)); }
    [data-page="dashboard"] .g-slate{ background:linear-gradient(135deg,rgba(100,116,139,.16),rgba(100,116,139,.06)); }

    /* Controles y botones con la misma altura */
    [data-page="dashboard"] .ctrl,
    [data-page="dashboard"] .btn{ height:36px; line-height:34px; font-size:12.5px }
    [data-page="dashboard"] .btn{ display:inline-flex; align-items:center; gap:.4rem; padding:0 .7rem; border-radius:.45rem; border:1px solid rgba(255,255,255,.10); background:rgba(255,255,255,.08) }
    [data-page="dashboard"] .btn:hover{ background:rgba(255,255,255,.14) }
    [data-page="dashboard"] .btn-primary{ background:rgba(79,70,229,.82); border-color:transparent }
    [data-page="dashboard"] .btn-primary:hover{ background:rgba(79,70,229,1) }
    [data-page="dashboard"] .btn-info{ background:rgba(3,105,161,.82); border-color:transparent }
    [data-page="dashboard"] .btn-info:hover{ background:rgba(3,105,161,1) }
    [data-page="dashboard"] .btn-icon{ height:28px; line-height:26px; padding:0 .45rem; font-size:12px }

    [data-page="dashboard"] .table-wrap{ border:1px solid rgba(255,255,255,.08); border-radius:.5rem; overflow:hidden; }
    [data-page="dashboard"] .table td, .table th{ padding:.5rem .65rem; border-bottom:1px solid rgba(255,255,255,.06) }
    [data-page="dashboard"] th{ font-weight:600; color:#cbd5e1; white-space:nowrap; }

    [data-page="dashboard"] .badge{ font-size:.68rem; padding:.16rem .45rem; border-radius:.45rem }
    [data-page="dashboard"] .status-active{ background:#16a34a33; color:#86efac }
    [data-page="dashboard"] .status-expired{ background:#dc262633; color:#fca5a5 }

    [data-page="dashboard"] select option{ color:#e2e8f0; background-color:#0b1220; }
    [data-page="dashboard"] .icon{ font-size:1.05rem }
  </style>

  <!-- Título + acciones (alineados verticalmente) -->
  <div class="flex flex-wrap items-center justify-between gap-3">
    <h1 class="text-[18px] font-semibold leading-none">Dashboard</h1>
    <div class="flex flex-wrap items-center gap-2">
      <select id="filter-branch" class="ctrl px-2.5 rounded bg-white/10 border border-white/10 text-slate-100">
        <option value="">Todas las sucursales</option>
      </select>
      <select id="filter-period" class="ctrl px-2.5 rounded bg-white/10 border border-white/10 text-slate-100">
        <option value="month" selected>Este mes</option>
        <option value="today">Hoy</option>
        <option value="week">Esta semana</option>
        <option value="">Todo</option>
      </select>
      <a href="#/presupuesto" class="btn btn-primary">➕ Nuevo</a>
      <a href="#/presupuestos" class="btn btn-info">📄 Ver todos</a>
    </div>
  </div>

  <!-- KPIs (separación orgánica, cards del mismo alto) -->
  <div class="grid sm:grid-cols-3 xl:grid-cols-6 gap-3">
    ${statCard("📄","Presupuestos","kpi-total","g-indigo")}
    ${statCard("📅","Hoy","kpi-today","g-emerald")}
    ${statCard("💰","Monto MTD","kpi-mtd","g-pink")}
    ${statCard("🧾","Ticket Prom.","kpi-avg","g-cyan")}
    ${statCard("🏢","Sucursales","kpi-branches","g-amber")}
    ${statCard("👥","Clientes","kpi-clients","g-slate")}
  </div>

  <!-- Charts con más aire y leyenda separada -->
  <div class="grid xl:grid-cols-2 gap-4">
    <div class="glass card p-4 space-y-2">
      <div class="flex items-center justify-between">
        <h2 class="font-medium text-[13px] leading-none">Ingresos últimos 14 días</h2>
        <div class="text-[11px] text-slate-400" id="spark-subtitle">—</div>
      </div>
      <canvas id="chart-spark" class="h-44 w-full"></canvas>
    </div>

    <div class="glass card p-4 space-y-2">
      <div class="flex items-center justify-between">
        <h2 class="font-medium text-[13px] leading-none">Participación por sucursal</h2>
        <div class="text-[11px] text-slate-400" id="donut-subtitle">—</div>
      </div>
      <div class="grid grid-cols-[1fr_170px] gap-4 items-center">
        <canvas id="chart-donut" class="h-44 w-full"></canvas>
        <div id="donut-legend" class="text-[12px] leading-5"></div>
      </div>
    </div>
  </div>

  <!-- Últimos + Actividad (paddings y alturas coherentes) -->
  <div class="grid xl:grid-cols-2 gap-4">
    <div class="glass card p-4 space-y-2">
      <div class="flex items-center justify-between">
        <h2 class="font-medium text-[13px] leading-none">Últimos presupuestos</h2>
        <a href="#/presupuestos" class="text-[11px] text-slate-300 hover:underline">ver más</a>
      </div>
      <div class="table-wrap">
        <table class="table w-full text-[12.5px]">
          <thead class="bg-white/5">
            <tr>
              <th>Número</th>
              <th>Fecha</th>
              <th>Cliente</th>
              <th class="text-right">Total</th>
              <th>Estado</th>
              <th class="text-right">Acciones</th>
            </tr>
          </thead>
          <tbody id="last-budgets"></tbody>
        </table>
      </div>
      <div id="last-empty" class="text-slate-400 text-xs py-2 text-center hidden">No hay datos aún.</div>
    </div>

    <div class="glass card p-4 space-y-2">
      <h2 class="font-medium text-[13px] leading-none">Actividad reciente</h2>
      <ul id="activity" class="text-[12.5px] space-y-2"></ul>
      <div id="activity-empty" class="text-slate-400 text-xs py-2 hidden">Sin actividad por ahora.</div>
    </div>
  </div>
</section>
    `;
  },

  mount(root) {
    // Filtros
    const fBranch = root.querySelector("#filter-branch");
    const fPeriod = root.querySelector("#filter-period");

    // KPIs
    const kpiTotal = root.querySelector("#kpi-total");
    const kpiToday = root.querySelector("#kpi-today");
    const kpiMtd   = root.querySelector("#kpi-mtd");
    const kpiAvg   = root.querySelector("#kpi-avg");
    const kpiBranches = root.querySelector("#kpi-branches");
    const kpiClients  = root.querySelector("#kpi-clients");

    // Charts
    const spark = root.querySelector("#chart-spark");
    const sparkSub = root.querySelector("#spark-subtitle");
    const donut = root.querySelector("#chart-donut");
    const donutSub = root.querySelector("#donut-subtitle");
    const donutLegend = root.querySelector("#donut-legend");

    // Listas
    const lastBody = root.querySelector("#last-budgets");
    const lastEmpty = root.querySelector("#last-empty");
    const activity = root.querySelector("#activity");
    const activityEmpty = root.querySelector("#activity-empty");

    // ===== Sucursales dinámicas (desde Configuración) =====
    function paintBranchFilter(){
      const list = getBranches();
      const current = fBranch.value;
      fBranch.innerHTML = `<option value="">Todas las sucursales</option>` +
        list.map(b=>`<option value="${b.id}">${b.name}</option>`).join("");
      // Restaurar selección si existe; si no, limpiar
      const ok = list.some(b=> String(b.id) === String(current));
      fBranch.value = ok ? current : "";
      // KPI total de sucursales configuradas
      kpiBranches.textContent = list.length;
    }
    paintBranchFilter();
    // Reaccionar a cambios del panel de Configuración
    window.addEventListener("cfg:branches-updated", ()=>{
      paintBranchFilter();
      applyFilters(); renderAll();
    });

    // Estado
    let budgets = [];
    let filtered = [];

    // Cargar y renderizar
    loadBudgets(); applyFilters(); renderAll();

    // Eventos
    fBranch.addEventListener("change", () => { applyFilters(); renderAll(); });
    fPeriod.addEventListener("change", () => { applyFilters(); renderAll(); });

    // Acciones tabla (alineadas y de tamaño compacto)
    lastBody.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-act]");
      if (!btn) return;
      const act = btn.dataset.act;
      const key = btn.dataset.key;
      const num = btn.dataset.num;
      if (act === "view") openDetail(key);
      if (act === "edit") editBudget(key);
      if (act === "del") deleteBudget(key, num);
    });

    // ===== Datos =====
    function loadBudgets() {
      const list = JSON.parse(localStorage.getItem("budgets_list") || "[]");
      budgets = list.map(s => {
        const full = JSON.parse(localStorage.getItem(s.key) || "null");
        return { ...s, details: full || null };
      });
    }
    function applyFilters() {
      const br = fBranch.value;
      const per = fPeriod.value;
      filtered = budgets.filter(b => {
        const matchesBranch = !br || b.sucursal === br;
        let matchesPeriod = true;
        if (per) {
          const bd = new Date((b.fecha || "").slice(0,10) + "T00:00:00");
          const now = new Date();
          if (per === "today") matchesPeriod = bd.toDateString() === now.toDateString();
          else if (per === "week") {
            const w = new Date(now.getTime() - 7*24*60*60*1000);
            matchesPeriod = bd >= w;
          } else if (per === "month") {
            const first = new Date(now.getFullYear(), now.getMonth(), 1);
            matchesPeriod = bd >= first;
          }
        }
        return matchesBranch && matchesPeriod;
      });
    }

    // ===== Render =====
    function renderAll() {
      renderKPIs();
      renderCharts();
      renderLastBudgets();
      renderActivity();
    }
    function renderKPIs() {
      const todayISO = new Date().toISOString().slice(0,10);
      const todayCount = filtered.filter(b => b.fecha === todayISO).length;
      const mtdAmount = filtered.reduce((s,b)=> s + parseMoney(b.total), 0);
      const totalBranchesConfigured = getBranches().length; // reflejar Configuración
      const clients = getClientsCount();
      const totalBudgets = filtered.length;
      const avgTicket = totalBudgets ? mtdAmount / totalBudgets : 0;

      kpiTotal.textContent = totalBudgets;
      kpiToday.textContent = todayCount;
      kpiMtd.textContent = money(mtdAmount);
      kpiAvg.textContent = money(avgTicket);
      kpiBranches.textContent = totalBranchesConfigured;
      kpiClients.textContent = clients;
    }
    function renderLastBudgets() {
      const latest = [...filtered].sort((a,b)=> {
        const da = a.details?.fechaCreacion || a.fecha || "";
        const db = b.details?.fechaCreacion || b.fecha || "";
        return (db > da) ? 1 : (db < da ? -1 : 0);
      }).slice(0, 8);

      if (!latest.length) {
        lastBody.innerHTML = "";
        lastEmpty.classList.remove("hidden");
        return;
      }
      lastEmpty.classList.add("hidden");
      lastBody.innerHTML = latest.map(b => {
        const expired = isExpired(b.fecha);
        return `
          <tr class="hover:bg-white/5">
            <td class="font-medium">${b.numero}</td>
            <td>${toDMY(b.fecha)}</td>
            <td class="max-w-[260px] truncate">${b.cliente || "Sin nombre"}</td>
            <td class="font-medium text-right">${b.total}</td>
            <td><span class="badge ${expired?"status-expired":"status-active"}">${expired? "Vencido":"Vigente"}</span></td>
            <td class="text-right whitespace-nowrap">
              <button data-act="view" data-key="${b.key}" class="btn btn-icon" title="Ver">👁️</button>
              <button data-act="edit" data-key="${b.key}" class="btn btn-icon btn-primary" title="Editar">✏️</button>
              <button data-act="del" data-key="${b.key}" data-num="${b.numero}" class="btn btn-icon" title="Eliminar">🗑</button>
            </td>
          </tr>
        `;
      }).join("");
    }
    function renderActivity() {
      const list = [...filtered]
        .sort((a,b)=> {
          const da = a.details?.fechaCreacion || a.fecha || "";
          const db = b.details?.fechaCreacion || b.fecha || "";
          return (db > da) ? 1 : (db < da ? -1 : 0);
        })
        .slice(0, 8);

      if (!list.length) {
        activity.innerHTML = "";
        activityEmpty.classList.remove("hidden");
        return;
      }
      activityEmpty.classList.add("hidden");
      activity.innerHTML = list.map(b => {
        const time = (b.details?.fechaCreacion || b.fecha || "").replace("T"," ").slice(0,16).replace(/-/g,"/");
        const sucName = branchName(b.sucursal);
        return `<li>• ${time} — Presupuesto <strong>${b.numero}</strong> — ${sucName} — <span class="text-slate-300">${b.total}</span></li>`;
      }).join("");
    }
    function renderCharts() {
      // Sparkline
      const last14 = getLastDays(14);
      const dailyTotals = last14.map(d => {
        const iso = d.toISOString().slice(0,10);
        const sum = filtered.filter(b => b.fecha === iso).reduce((s,b)=> s + parseMoney(b.total), 0);
        return { date: iso, value: sum };
      });
      sparkSub.textContent = `${toDMY(last14[0].toISOString().slice(0,10))} → ${toDMY(last14[last14.length-1].toISOString().slice(0,10))}`;
      drawSparkline(spark, dailyTotals.map(x=>x.value));

      // Donut
      const byBranch = {};
      filtered.forEach(b => { byBranch[b.sucursal] = (byBranch[b.sucursal] || 0) + parseMoney(b.total); });
      const labels = Object.keys(byBranch);
      const values = labels.map(k => byBranch[k]);
      const total = values.reduce((a,b)=>a+b,0);
      donutSub.textContent = total ? money(total) : "—";
      drawDonut(donut, values);
      donutLegend.innerHTML = labels.length
        ? labels.map((id,i) => {
            const name = branchName(id);
            const pct = total ? Math.round(values[i]*100/total) : 0;
            return `<div class="flex items-center gap-1.5">
              <span class="inline-block w-2.5 h-2.5 rounded" style="background:${donutColor(i)}"></span>
              <span class="min-w-[32px] text-right text-[11px]">${pct}%</span>
              <span class="truncate text-[12px]">${name}</span>
            </div>`;
          }).join("")
        : `<div class="text-slate-400 text-[12px]">Sin datos</div>`;
    }

    // ===== Utils =====
    function branchName(id){
      const list = getBranches();
      return list.find(x=> String(x.id) === String(id))?.name || (id || "—");
    }
    function isExpired(iso) {
      const d = new Date((iso || "").slice(0,10) + "T00:00:00");
      const delta = Math.floor((Date.now() - d.getTime()) / (1000*60*60*24));
      return delta > 30;
    }
    function getClientsCount() {
      try { return (JSON.parse(localStorage.getItem(CLIENTS_KEY) || "[]") || []).length; }
      catch { return 0; }
    }
    function getLastDays(n) {
      const arr = []; const base = new Date(); base.setHours(0,0,0,0);
      for (let i=n-1; i>=0; i--) { const d = new Date(base); d.setDate(base.getDate()-i); arr.push(d); }
      return arr;
    }

    // ===== Gráficos Canvas (sin librerías, tamaños moderados) =====
    function drawSparkline(canvas, data) {
      const dpr = window.devicePixelRatio || 1;
      const W = canvas.clientWidth || 520;
      const H = canvas.clientHeight || 160;
      canvas.width = W * dpr; canvas.height = H * dpr;
      const ctx = canvas.getContext("2d");
      ctx.setTransform(dpr,0,0,dpr,0,0);
      ctx.clearRect(0,0,W,H);

      const padX = 12, padY = 10;
      // fondo
      ctx.fillStyle = "rgba(255,255,255,0.025)";
      roundRect(ctx, 0, 0, W, H, 10, true, false);

      if (!data.length) return;
      const max = Math.max(...data, 1);
      const min = Math.min(...data, 0);
      const step = (W - padX*2) / Math.max(1, data.length - 1);

      // grid
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.lineWidth = 1;
      for (let i=1;i<=3;i++){
        const y = padY + (H - padY*2) * (i/4);
        ctx.beginPath(); ctx.moveTo(padX, y); ctx.lineTo(W-padX, y); ctx.stroke();
      }

      // línea
      ctx.strokeStyle = "rgba(99,102,241,0.95)";
      ctx.lineWidth = 1.7;
      ctx.beginPath();
      data.forEach((v, i) => {
        const x = padX + i*step;
        const y = mapRange(v, min, max, H-padY, padY);
        if (i===0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();

      // relleno
      const grad = ctx.createLinearGradient(0, padY, 0, H-padY);
      grad.addColorStop(0, "rgba(99,102,241,0.22)");
      grad.addColorStop(1, "rgba(99,102,241,0.03)");
      ctx.fillStyle = grad;
      ctx.lineTo(W-padX, H-padY);
      ctx.lineTo(padX, H-padY);
      ctx.closePath();
      ctx.fill();

      // punto final
      const lastX = padX + (data.length - 1)*step;
      const lastY = mapRange(data[data.length - 1], min, max, H-padY, padY);
      ctx.fillStyle = "rgba(99,102,241,1)";
      ctx.beginPath(); ctx.arc(lastX, lastY, 2.6, 0, Math.PI*2); ctx.fill();
    }

    function drawDonut(canvas, values) {
      const dpr = window.devicePixelRatio || 1;
      const W = canvas.clientWidth || 520;
      const H = canvas.clientHeight || 160;
      canvas.width = W * dpr; canvas.height = H * dpr;
      const ctx = canvas.getContext("2d");
      ctx.setTransform(dpr,0,0,dpr,0,0);
      ctx.clearRect(0,0,W,H);

      ctx.fillStyle = "rgba(255,255,255,0.025)";
      roundRect(ctx, 0, 0, W, H, 10, true, false);

      const cx = W/2, cy = H/2;
      const R = Math.min(W,H)/2 - 10;
      const r = R * 0.6;

      const total = values.reduce((a,b)=>a+b,0);
      if (!total) {
        ctx.strokeStyle = "rgba(148,163,184,.35)";
        ctx.lineWidth = R - r;
        ctx.beginPath(); ctx.arc(cx, cy, (R+r)/2, 0, Math.PI*2); ctx.stroke();
        return;
      }

      let start = -Math.PI/2;
      values.forEach((v, i) => {
        const ang = (v/total) * Math.PI * 2;
        const midR = (R + r) / 2;
        ctx.strokeStyle = donutColor(i);
        ctx.lineWidth = R - r;
        ctx.beginPath(); ctx.arc(cx, cy, midR, start, start + ang); ctx.stroke();
        start += ang;
      });
    }

    function donutColor(i){
      const palette = [
        "rgba(99,102,241,0.95)",   // indigo
        "rgba(16,185,129,0.95)",   // emerald
        "rgba(236,72,153,0.95)",   // pink
        "rgba(6,182,212,0.95)",    // cyan
        "rgba(245,158,11,0.95)",   // amber
        "rgba(100,116,139,0.95)"   // slate
      ];
      return palette[i % palette.length];
    }
    function mapRange(v, inMin, inMax, outMin, outMax) {
      if (inMax - inMin === 0) return (outMin + outMax)/2;
      return outMin + (v - inMin) * (outMax - outMin) / (inMax - inMin);
    }
    function roundRect(ctx, x, y, w, h, r, fill, stroke) {
      if (typeof r === "number") r = {tl:r, tr:r, br:r, bl:r};
      else r = Object.assign({tl:0, tr:0, br:0, bl:0}, r);
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

    // ===== Navegación rápida =====
    function openDetail(key) {
      try { sessionStorage.setItem("editBudgetKey", key); } catch {}
      location.hash = "#/presupuestos";
    }
    function editBudget(key) {
      try { sessionStorage.setItem("editBudgetKey", key); } catch {}
      location.hash = "#/presupuesto";
    }
    function deleteBudget(key, numero) {
      if (!confirm(`¿Eliminar el presupuesto ${numero}? Esta acción no se puede deshacer.`)) return;
      localStorage.removeItem(key);
      const list = JSON.parse(localStorage.getItem("budgets_list") || "[]").filter(x => x.key !== key);
      localStorage.setItem("budgets_list", JSON.stringify(list));
      loadBudgets(); applyFilters(); renderAll();
      toast(`Presupuesto ${numero} eliminado ✅`, "success");
    }
  }
};

function statCard(icon, label, id, g="g-indigo"){
  return /*html*/`
  <div class="glass card ${g} p-3.5 flex items-center gap-3 min-h-[64px]">
    <div class="icon">${icon}</div>
    <div>
      <div class="k">${label}</div>
      <div id="${id}" class="v">—</div>
    </div>
  </div>`;
}
