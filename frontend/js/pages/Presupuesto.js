// frontend/js/pages/Presupuesto.js
// SPA Vanilla + Tailwind — Módulo Presupuesto (completo) INTEGRADO con Configuración
// - Sucursales y Ajustes (moneda/locale/decimales/datos empresa) se leen de cfg_* y reaccionan a eventos cfg:*
// - Selects legibles al desplegar (opciones con fondo oscuro y texto claro) + z-index alto
// - Eliminar Vehículo / Eliminar Cliente con modales y confirmación
// - Otros Trabajos + Repuestos (UX anterior), con servicios personalizados (usar/editar/eliminar)
// - Clientes persistentes (localStorage) + múltiples vehículos
// - Totales live, firma digital, guardar presupuesto
// - Generación de PDF integrada (jsPDF + autoTable on-demand)

// === Vínculo con Configuración (snapshot inicial) ===
const ls = (k,d)=>{ try { return JSON.parse(localStorage.getItem(k) ?? JSON.stringify(d)); } catch { return d; } };

let CFG_SETTINGS = (window.CFG?.getSettings?.() || ls("cfg_settings", {}));
let CFG_BRANCHES = (window.CFG?.getBranches?.() || ls("cfg_branches", []));

// moneda/locale/decimales dinámicos desde Ajustes
let CURRENCY = CFG_SETTINGS?.currency || "ARS";
let LOCALE   = CFG_SETTINGS?.locale   || "es-AR";
let DECIMALS = Number.isInteger(CFG_SETTINGS?.decimals) ? CFG_SETTINGS.decimals : 2;

const money = (n)=> (Number(n)||0).toLocaleString(LOCALE, {
  style:"currency", currency:CURRENCY,
  minimumFractionDigits: DECIMALS, maximumFractionDigits: DECIMALS
});

const CLIENTS_KEY = "clients_db";

const todayISO = () => new Date().toISOString().split("T")[0];
const sanitizeKey = (s) => String(s).replace(/[^\w\d]/g, "_");
const rid = (p="id") => `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,7)}`;

function toast(msg, type = "info") {
  const bg = type === "error" ? "bg-rose-600" : type === "success" ? "bg-emerald-600" : "bg-sky-700";
  const el = document.createElement("div");
  el.className = `fixed top-4 right-4 z-[4000] px-4 py-3 rounded-xl text-white shadow-2xl ${bg}`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => {
    el.style.opacity = "0";
    el.style.transform = "translateX(12px)";
    setTimeout(() => el.remove(), 180);
  }, 2400);
}

function setupCanvas(ctx) {
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 2;
}

// Clientes (persistencia)
function getClients() {
  try { return JSON.parse(localStorage.getItem(CLIENTS_KEY) || "[]"); } catch { return []; }
}
function saveClients(list) {
  localStorage.setItem(CLIENTS_KEY, JSON.stringify(list || []));
}
function upsertClient(client) {
  const list = getClients();
  const idx = list.findIndex(c => c.id === client.id);
  if (idx >= 0) list[idx] = client; else list.push(client);
  saveClients(list);
  return client;
}

/* ============================
   === PDF: Helpers + Core ===
   ============================ */

// Paleta y helpers de dibujo (estética "oscura")
const THEME = {
  navy: [12, 24, 38],        // header/footer
  navySoft: [25, 39, 60],    // tiras de título de secciones
  textLight: [255, 255, 255],
  textMuted: [224, 230, 236],
  border: [225, 230, 236],
  pillBg: [245, 247, 250],   // cajitas info
  tableHead: [236, 238, 241],
  cardBg: [252, 253, 255],
  accent: [236, 83, 83],     // rojo del total
  redText: [206, 61, 61],    // rojo para el aviso sin recuadro
  ink: [33, 37, 41]
};

function toDMY(dateStr) {
  const d = dateStr ? new Date(dateStr) : new Date();
  const day = d.getDate();
  const month = d.getMonth() + 1;
  const year = d.getFullYear();
  return `${day}/${month}/${year}`; // sin cero a la izquierda
}
function addDays(dateStr, days) {
  const d = dateStr ? new Date(dateStr) : new Date();
  d.setDate(d.getDate() + (days || 0));
  return d.toISOString().slice(0, 10);
}
function getJsPDF() {
  if (window.jsPDF) return window.jsPDF;                 // v1
  if (window.jspdf && window.jspdf.jsPDF) return window.jspdf.jsPDF; // v2 UMD
  return null;
}
function ensurePdfLoaded() {
  return new Promise((resolve, reject) => {
    const hasJsPDF = !!getJsPDF();
    const hasAuto = !!(window.jspdf?.jsPDF?.API?.autoTable || window.jsPDF?.API?.autoTable);
    const load = (src) => new Promise((ok, bad) => {
      const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = bad; document.head.appendChild(s);
    });

    (async () => {
      if (!hasJsPDF) {
        await load("https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js");
      }
      if (!hasAuto) {
        await load("https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js");
      }
      resolve();
    })().catch(reject);
  });
}

// === Mini utilidades de dibujo
function setFill(pdf, rgb){ pdf.setFillColor(rgb[0], rgb[1], rgb[2]); }
function setStroke(pdf, rgb){ pdf.setDrawColor(rgb[0], rgb[1], rgb[2]); }
function setText(pdf, rgb){ pdf.setTextColor(rgb[0], rgb[1], rgb[2]); }
function pillHeader(pdf, label, x, y, w, h=24){
  setFill(pdf, THEME.navySoft);
  setText(pdf, THEME.textLight);
  pdf.roundedRect(x, y, w, h, 6, 6, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.text(label, x + 10, y + h/2 + 3);
}

// === Bloques de dibujo (estilo fusionado)
function drawHeader(pdf, pageWidth, margin, company) {
  const barH = 72; // +alto para incluir el aviso rojo debajo del estado
  const x = margin, y = margin, w = pageWidth - margin * 2;
  setFill(pdf, THEME.navy);
  pdf.roundedRect(x, y, w, barH, 10, 10, "F");

  const brand = (company?.brandName || company?.companyName || "MICROBOLLOS").toUpperCase();
  const legal = (company?.companyName || "").toUpperCase();

  // Izquierda: Marca
  setText(pdf, THEME.textLight);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  pdf.text(brand, x + 16, y + 22);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  setText(pdf, THEME.textMuted);
  if (legal) pdf.text(legal, x + 16, y + 38);

  // Derecha: Título documento
  setText(pdf, THEME.textLight);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16);
  pdf.text("PRESUPUESTO", x + w - 16, y + 22, { align: "right" });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  setText(pdf, THEME.textMuted);
  pdf.text("ESTADO: PRESUPUESTO", x + w - 16, y + 38, { align: "right" });

  // Aviso rojo dentro del contenedor azul, debajo del estado
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9.5);
  setText(pdf, THEME.redText);
  pdf.text("DOCUMENTO NO VÁLIDO COMO FACTURA", x + w - 16, y + 54, { align: "right" });

  return y + barH + 12;
}
function drawInfoRow(pdf, data, pageWidth, margin, yStart){
  const w = pageWidth - margin * 2;
  const gap = 10;
  const cols = 4;
  const itemW = (w - gap*(cols-1)) / cols;
  const itemH = 38;
  const x0 = margin;
  const labels = ["NÚMERO","FECHA","VÁLIDO HASTA","SUCURSAL"];
  const values = [
    data.numero || "-",
    toDMY(data.fecha),
    toDMY(addDays(data.fecha,30)),
    data.sucursalNombre || data.sucursalId || "-"
  ];

  for (let i=0;i<cols;i++){
    const xi = x0 + i*(itemW + gap);
    setFill(pdf, THEME.pillBg);
    setStroke(pdf, THEME.border);
    pdf.roundedRect(xi, yStart, itemW, itemH, 8, 8, "FD");

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.8);
    setText(pdf, THEME.ink);
    pdf.text(labels[i], xi + 12, yStart + 12);

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    setText(pdf, THEME.ink);
    const display = values[i] || "-";
    pdf.text(String(display), xi + 12, yStart + 25);
  }
  return yStart + itemH + 16;
}
function drawClientBlock(pdf, data, pageWidth, margin, yStart) {
  const w = pageWidth - margin * 2;
  // Cabecera oscura
  pillHeader(pdf, "DATOS DEL CLIENTE", margin, yStart, w);
  const cardY = yStart + 28;
  const cardH = 92;
  setFill(pdf, THEME.cardBg);
  setStroke(pdf, THEME.border);
  pdf.roundedRect(margin, cardY, w, cardH, 8, 8, "FD");

  const leftX = margin + 14;
  const rightX = margin + w/2 + 10;
  pdf.setFont("helvetica","normal");
  pdf.setFontSize(10);
  setText(pdf, THEME.ink);

  const linesL = [
    `NOMBRE: ${data.cliente?.nombre || "-"}`,
    `VEHÍCULO: ${data.cliente?.vehiculo || "-"}`,
    `MODELO: ${data.cliente?.modelo || "-"}`,
    `NÚMERO DE CHASIS: ${data.cliente?.chasis || "-"}`
  ];
  const linesR = [
    `TELÉFONO: ${data.cliente?.telefono || "-"}`,
    `PATENTE: ${data.cliente?.patente || "-"}`,
    `COMPAÑÍA DE SEGURO: ${data.cliente?.compania || "-"}`,
    ""
  ];
  let y = cardY + 18;
  const lh = 16;
  for (let i=0;i<linesL.length;i++){
    pdf.text(linesL[i], leftX, y + i*lh);
    if (linesR[i]) pdf.text(linesR[i], rightX, y + i*lh);
  }
  return cardY + cardH + 16;
}
function drawServicesTitle(pdf, pageWidth, margin, yStart) {
  const w = pageWidth - margin * 2;
  // Cabecera oscura
  pillHeader(pdf, "DETALLE DE SERVICIOS — TRABAJOS Y REPARACIONES", margin, yStart, w);
  return yStart + 28;
}
function buildTableRows(items) {
  const rows = [];
  (items || []).forEach((it) => {
    const cant = it.cantidad ?? 1;
    const desc = String(it.descripcion || "").replace(/^\[(SERVICIO|REPUESTO)\]\s*/i, "");
    const unit = typeof it.unit === "number"
      ? it.unit
      : parseFloat(String(it.unit || it.precio || "0").replace(/[^\d.,-]/g, "").replace(/\./g, "").replace(",", "."));
    const total = typeof it.total === "number"
      ? it.total
      : parseFloat(String(it.total || "0").replace(/[^\d.,-]/g, "").replace(/\./g, "").replace(",", "."));
    rows.push([String(cant), desc || "-", money(unit), money(total)]);
  });
  return rows;
}
function drawTable(pdf, data, pageWidth, margin, yStart) {
  const head = [["CANT.", "DESCRIPCIÓN", "PRECIO UNIT.", "TOTAL"]];
  const body = buildTableRows(data.items);
  let endY = yStart;

  if (pdf.autoTable) {
    pdf.autoTable({
      head, body, startY: yStart + 2,
      margin: { left: margin, right: margin },
      styles: { font: "helvetica", fontSize: 10, lineColor: THEME.border, lineWidth: 0.3, cellPadding: 6, textColor: THEME.ink },
      headStyles: { fillColor: THEME.tableHead, textColor: THEME.ink, fontStyle: "bold" },
      columnStyles: {
        0: { halign: "left", cellWidth: 60 },
        1: { cellWidth: pageWidth - margin * 2 - 60 - 110 - 100 },
        2: { halign: "right", cellWidth: 110 },
        3: { halign: "right", cellWidth: 100 },
      },
      didDrawPage(hook){ endY = hook.cursor.y; },
    });
  } else {
    // fallback manual
    const w = pageWidth - margin*2;
    setStroke(pdf, THEME.border);
    pdf.line(margin, yStart + 16, margin + w, yStart + 16);
    let y = yStart + 28;
    const rows = body;
    pdf.setFont("helvetica","bold"); pdf.setFontSize(10);
    pdf.text("CANT.", margin, y);
    pdf.text("DESCRIPCIÓN", margin + 60, y);
    pdf.text("PRECIO UNIT.", pageWidth - margin - 110, y, { align: "right" });
    pdf.text("TOTAL", pageWidth - margin, y, { align: "right" });
    y += 12;
    pdf.setFont("helvetica","normal");
    rows.forEach(r => {
      y += 16;
      pdf.text(r[0], margin, y);
      pdf.text(r[1].length > 90 ? r[1].slice(0,87)+"..." : r[1], margin + 60, y);
      pdf.text(r[2], pageWidth - margin - 110, y, { align: "right" });
      pdf.text(r[3], pageWidth - margin, y, { align: "right" });
    });
    endY = y + 4;
  }
  return endY + 10;
}

// NUEVO: Firma + Total en la misma fila (SIN cabecera "FIRMA DIGITAL")
function drawSignatureAndTotal(pdf, data, pageWidth, margin, yStart) {
  const w = pageWidth - margin * 2;
  const rowY = yStart; // sin cabecera
  const gap = 12;
  const totalW = 240;              // ancho del recuadro rojo
  const boxH  = 88;               // altura de ambos (firma y total)
  const signW = w - totalW - gap; // firma ocupa el resto

  // Caja de firma (izquierda)
  setFill(pdf, THEME.cardBg);
  setStroke(pdf, THEME.border);
  pdf.roundedRect(margin, rowY, signW, boxH, 8, 8, "FD");
  pdf.setFont("helvetica","normal");
  pdf.setFontSize(9);
  setText(pdf, [140,150,160]);
  pdf.text("Firma Digital - Microbollos Group", margin + 10, rowY + 16);

  if (data.firmaDataUrl) {
    try {
      // La firma se ajusta al alto del recuadro, misma altura que total.
      const imgH = boxH - 36;
      const imgW = imgH * 3; // firma apaisada
      const imgX = margin + 12;
      const imgY = rowY + boxH/2 - imgH/2 + 8;
      pdf.addImage(data.firmaDataUrl, "PNG", imgX, imgY, imgW, imgH);
    } catch {}
  }

  // Caja de TOTAL (derecha, roja)
  setFill(pdf, THEME.accent);
  setText(pdf, THEME.textLight);
  pdf.roundedRect(margin + signW + gap, rowY, totalW, boxH, 8, 8, "F");

  pdf.setFont("helvetica","bold");
  pdf.setFontSize(12);
  pdf.text("TOTAL", margin + signW + gap + 14, rowY + 20);
  pdf.setFont("helvetica","bold");
  pdf.setFontSize(16);
  const totalStr = money(data.subtotal ?? data.total ?? 0);
  pdf.text(totalStr, margin + signW + gap + 14, rowY + 46);

  return rowY + boxH + 10;
}

function drawFooter(pdf, data, pageWidth, margin, yStart, company) {
  // FECHA EMISIÓN sobre el footer
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9.5);
  setText(pdf, THEME.ink);
  pdf.text(`FECHA DE EMISIÓN: ${toDMY(data.fecha)}`, margin, yStart);

  const barH = 70;
  let y = yStart + 16;
  const w = pageWidth - margin * 2;

  // Footer azul oscuro
  setFill(pdf, THEME.navy);
  pdf.roundedRect(margin, y, w, barH, 10, 10, "F");

  // Columnas
  const leftX = margin + 14;
  const rightX = margin + w/2 + 8;
  setText(pdf, THEME.textLight);
  const brand = (company?.brandName || company?.companyName || "").toUpperCase();
  pdf.setFont("helvetica","bold"); pdf.setFontSize(10.5);
  pdf.text(`CONDICIONES GENERALES${brand ? ` ${brand}` : ""}`, leftX, y + 16);

  pdf.setFont("helvetica","normal"); pdf.setFontSize(9.5);
  const bullets = [
    "• PRESUPUESTO VÁLIDO POR 30 DÍAS",
    "• MANO DE OBRA GARANTIZADA"
  ];
  let ly = y + 32;
  bullets.forEach(b => { pdf.text(b, leftX, ly); ly += 12; });

  pdf.setFont("helvetica","normal"); pdf.setFontSize(9.5);
  const info = [
    company?.address ? `DIRECCIÓN: ${company.address}` : null,
    company?.phone   ? `TEL: ${company.phone}`         : null,
    company?.email   ? `EMAIL: ${company.email}`       : null
  ].filter(Boolean);

  let ry = y + 16;
  setText(pdf, THEME.textLight);
  pdf.setFont("helvetica","bold"); pdf.setFontSize(10);
  pdf.text("", rightX, ry); // (reservado por si querés un subtítulo)
  pdf.setFont("helvetica","normal"); pdf.setFontSize(9.5);
  ry += 4;
  info.forEach(line => { pdf.text(line, rightX, ry += 12); });

  return y + barH;
}

async function generateBudgetPDF(data = {}) {
  const JsPDF = getJsPDF();
  if (!JsPDF) throw new Error("jsPDF no cargado");
  const pdf = new JsPDF({ orientation: "p", unit: "pt", format: "a4" }); // 595x842

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 40;

  // Header + info
  let y = drawHeader(pdf, pageWidth, margin, data.company);
  y = drawInfoRow(pdf, data, pageWidth, margin, y);

  // Cliente
  y = drawClientBlock(pdf, data, pageWidth, margin, y);

  // Detalle + Tabla
  y = drawServicesTitle(pdf, pageWidth, margin, y);
  y = drawTable(pdf, data, pageWidth, margin, y);

  // Firma + Total (misma fila)
  // Si no entra completo, lo mandamos a nueva página
  const needRow = 88 + 16 + 70 + 30; // sin cabecera de firma
  if (y + needRow > pageHeight - margin) {
    pdf.addPage();
    y = margin;
  }
  y = drawSignatureAndTotal(pdf, data, pageWidth, margin, y);

  // Footer
  if (y + 100 > pageHeight - margin) {
    pdf.addPage();
    y = margin;
  }
  drawFooter(pdf, data, pageWidth, margin, y + 6, data.company);

  return pdf;
}

// (opc) Para compatibilidad: exponerla global si alguien la llama desde afuera
window.generateBudgetPDF = async (data) => { await ensurePdfLoaded(); return generateBudgetPDF(data); };

// ==== Helpers numeración (usa label derivado de índice de sucursal) ====
function extractSeqFromNumero(numero) {
  const m = String(numero || "").match(/(\d+)\s*$/);
  return m ? parseInt(m[1], 10) : 0;
}
function maxSeqForBranch(sucursal) {
  const list = JSON.parse(localStorage.getItem("budgets_list") || "[]");
  let max = 0;
  list.filter(b => b.sucursal === sucursal).forEach(b => {
    max = Math.max(max, extractSeqFromNumero(b.numero));
  });
  return max;
}
function labelForBranch(id){
  const b = (CFG_BRANCHES||[]).find(x=>x.id===id);
  if (!b) return String(id||"");
  if (b.code) return b.code; // si definís "code" en Sucursales
  const idx = (CFG_BRANCHES||[]).findIndex(x=>x.id===id);
  return String(idx >= 0 ? idx+1 : 0).padStart(4, "0"); // 0001, 0002, ...
}
function formatBudgetNumber(sucursalId, seq) {
  const label = labelForBranch(sucursalId);
  return `N° ${label || "----"} - ${String(seq).padStart(8, "0")}`;
}
function previewNextNumber(sucursal) {
  const next = maxSeqForBranch(sucursal) + 1;
  return formatBudgetNumber(sucursal, next);
}

export default {
  render() {
    return /*html*/ `
      <section data-page="budget" class="space-y-4">
        <!-- Estilado local de opciones del select para legibilidad -->
        <style>
          [data-page="budget"] select option{
            color:#e2e8f0;               /* slate-200 */
            background-color:#0b1220;    /* deep slate bg */
          }
          [data-page="budget"] .glass{ background:rgba(255,255,255,.04); backdrop-filter:blur(6px); }
          @media print { .print-only{ display:block !important } }
        </style>

        <h1 class="text-2xl font-semibold">Presupuesto</h1>

        <!-- Información del Presupuesto -->
        <div class="glass rounded-xl p-4 space-y-3">
          <div class="font-medium">Información del Presupuesto</div>
          <div class="grid md:grid-cols-3 gap-3 budget-info-row">
            <label class="text-sm relative z-50 overflow-visible">
              <span class="block mb-1 text-slate-300">Sucursal:</span>
              <select id="sucursal"
                class="w-full h-10 px-3 rounded bg-slate-900 text-slate-100 border border-white/10
                       focus:outline-none focus:ring focus:ring-indigo-500/40">
                <option value="">Seleccionar sucursal...</option>
              </select>
            </label>
            <label class="text-sm">
              <span class="block mb-1 text-slate-300">Número de Presupuesto:</span>
              <input id="budget-number" type="text" readonly placeholder="Selecciona una sucursal"
                class="w-full h-10 px-3 rounded bg-white/10 border border-white/10">
            </label>
            <label class="text-sm">
              <span class="block mb-1 text-slate-300">Fecha:</span>
              <input id="budget-date" type="date" readonly class="w-full h-10 px-3 rounded bg-white/10 border border-white/10">
            </label>
          </div>
        </div>

        <!-- Datos del Cliente -->
        <div class="glass rounded-xl p-4 space-y-5">
          <div class="font-medium">Datos del Cliente</div>

          <div class="grid md:grid-cols-[1fr_auto] gap-3 items-end">
            <label class="text-sm relative z-40">
              <span class="block mb-1 text-slate-300">Cliente Existente:</span>
              <select id="existing-client" class="w-full h-10 px-3 rounded bg-white/10 border border-white/10 text-slate-100">
                <option value="">Seleccionar cliente existente...</option>
              </select>
            </label>
            <div class="flex gap-2">
              <button id="new-client-btn" class="px-3 py-2 rounded bg-white/10 hover:bg-white/20">🧑‍💼 Nuevo Cliente</button>
              <button id="delete-client-btn" class="px-3 py-2 rounded bg-rose-700/80 hover:bg-rose-700 disabled:opacity-40" disabled>🗑 Eliminar Cliente</button>
            </div>
          </div>

          <div class="grid md:grid-cols-2 gap-3">
            <label class="text-sm">
              <span class="block mb-1 text-slate-300">Nombre o Razón Social *</span>
              <input id="nombre" class="w-full h-10 px-3 rounded bg-white/10 border border-white/10" />
            </label>
            <label class="text-sm">
              <span class="block mb-1 text-slate-300">Teléfono *</span>
              <input id="telefono" class="w-full h-10 px-3 rounded bg-white/10 border border-white/10" />
            </label>
          </div>

          <!-- Bloque: vehículos del cliente -->
          <div id="client-vehicles-block" class="hidden">
            <div class="font-medium mt-3 mb-2">Vehículos del cliente</div>
            <div class="flex flex-wrap gap-2 items-end">
              <label class="text-sm flex-1 min-w-[240px] relative z-40">
                <span class="block mb-1 text-slate-300">Seleccionar vehículo</span>
                <select id="client-vehicle" class="w-full h-10 px-3 rounded bg-white/10 border border-white/10 text-slate-100">
                  <option value="">(Sin seleccionar)</option>
                </select>
              </label>
              <button id="add-vehicle-btn" class="px-3 py-2 rounded bg-emerald-600/80 hover:bg-emerald-600">+ Añadir vehículo</button>
              <button id="delete-vehicle-btn" class="px-3 py-2 rounded bg-rose-700/80 hover:bg-rose-700 disabled:opacity-40" disabled>🗑 Eliminar vehículo</button>
            </div>
            <div class="text-xs text-slate-400 mt-1" id="vehicle-hint">Seleccioná un vehículo para rellenar el formulario de abajo, o usá “+ Añadir vehículo”.</div>
          </div>

          <!-- Información del Vehículo (form de edición / creación) -->
          <div class="space-y-3 mt-2">
            <div class="font-medium text-slate-200">Información del Vehículo</div>
            <div class="grid md:grid-cols-2 gap-3">
              <label class="text-sm">
                <span class="block mb-1 text-slate-300">Vehículo *</span>
                <input id="vehiculo" placeholder="Marca y Modelo (ej: Fiat Palio)" class="w-full h-10 px-3 rounded bg-white/10 border border-white/10" />
              </label>
              <label class="text-sm">
                <span class="block mb-1 text-slate-300">Patente *</span>
                <input id="patente" placeholder="Patente (ej: AAA111)" class="w-full h-10 px-3 rounded bg-white/10 border border-white/10" />
              </label>
            </div>
            <div class="grid md:grid-cols-2 gap-3">
              <label class="text-sm">
                <span class="block mb-1 text-slate-300">Año del Modelo</span>
                <input id="modelo" type="number" min="1900" max="2030" class="w-full h-10 px-3 rounded bg-white/10 border border-white/10" />
              </label>
              <label class="text-sm">
                <span class="block mb-1 text-slate-300">Compañía de Seguro</span>
                <input id="compania" class="w-full h-10 px-3 rounded bg-white/10 border border-white/10" />
              </label>
            </div>
            <label class="text-sm">
              <span class="block mb-1 text-slate-300">Número de Chasis</span>
              <input id="chasis" class="w-full h-10 px-3 rounded bg-white/10 border border-white/10" />
            </label>

            <div class="flex flex-wrap gap-2">
              <button id="save-client-btn" class="px-3 py-2 rounded bg-indigo-600/80 hover:bg-indigo-600">💾 Guardar Cliente</button>
            </div>
          </div>
        </div>

        <!-- Tabla de Items -->
        <div class="glass rounded-xl p-4 space-y-3">
          <div class="font-medium">Ítems</div>
          <div class="overflow-auto rounded-lg border border-white/10">
            <table class="w-full text-sm">
              <thead class="bg-white/5">
                <tr>
                  <th class="text-left px-3 py-2 w-20">Cantidad</th>
                  <th class="text-left px-3 py-2">Descripción</th>
                  <th class="text-left px-3 py-2 w-40">Precio Unitario</th>
                  <th class="text-left px-3 py-2 w-40">Total</th>
                  <th class="text-left px-3 py-2 w-24">Acciones</th>
                </tr>
              </thead>
              <tbody id="budget-items"></tbody>
            </table>
          </div>

          <div class="flex flex-wrap gap-2 items-center">
            <button id="add-item" class="px-3 py-2 rounded bg-amber-600/80 hover:bg-amber-600">+ Añadir Item</button>
            <button id="other-services" class="px-3 py-2 rounded bg-orange-500/80 hover:bg-orange-500">🛠️ Otros Trabajos</button>
            <button id="parts-manager" class="px-3 py-2 rounded bg-cyan-600/80 hover:bg-cyan-600">🔩 Repuestos</button>
            <span class="ml-auto text-sm">
              Subtotal: <span id="subtotal">$0.00</span> &nbsp;&nbsp;
              <strong>Total: <span id="total">$0.00</span></strong>
            </span>
          </div>

          <div class="flex flex-wrap gap-2 justify-end">
            <button id="signature-btn" class="px-3 py-2 rounded bg-sky-700/80 hover:bg-sky-700">✍️ Firma Digital</button>
            <button id="save-budget" class="px-3 py-2 rounded bg-green-600/80 hover:bg-green-600">💾 Guardar</button>
            <button id="download-pdf-direct" class="px-3 py-2 rounded bg-rose-600/80 hover:bg-rose-600">⬇️ Descargar PDF</button>
          </div>
        </div>

        <!-- Sección de impresión (firma/fecha) -->
        <div class="print-only hidden">
          <div class="signature-section flex items-center gap-6">
            <div>
              <canvas id="signature-canvas" width="300" height="100" class="bg-white rounded"></canvas>
              <div class="text-center text-xs text-slate-400 signature-placeholder">Firma Digital</div>
            </div>
            <div class="text-sm">
              <p><strong>Fecha de emisión:</strong> <span id="print-date"></span></p>
              <p><strong>Válido por:</strong> 30 días</p>
            </div>
          </div>
        </div>

        <!-- Modal: Añadir Item -->
        <div id="add-item-modal"
             class="fixed inset-0 z-[1000] hidden flex items-center justify-center bg-black/60">
          <div class="bg-slate-900 border border-white/10 rounded-xl w-[min(92vw,900px)] p-4">
            <div class="flex items-center justify-between">
              <h2 class="text-lg font-semibold">➕ Añadir Nuevo Ítem</h2>
              <button class="close-modal px-2 py-1 rounded hover:bg-white/10">✖</button>
            </div>
            <div class="mt-4 space-y-5">
              <div class="grid md:grid-cols-2 gap-4">
                <label class="text-sm block">
                  <span class="block mb-1 text-slate-300">Piezas del Vehículo</span>
                  <select id="part" class="w-full h-10 px-3 rounded bg-white/10 border border-white/10">
                    <option value="">Seleccionar pieza...</option>
                    <option>Paragolpes Delantero</option><option>Paragolpes Trasero</option>
                    <option>Puerta Delantera Izquierda</option><option>Puerta Delantera Derecha</option>
                    <option>Puerta Trasera Izquierda</option><option>Puerta Trasera Derecha</option>
                    <option>Capó</option><option>Baúl</option><option>Guardabarro Delantero Izq</option>
                    <option>Guardabarro Delantero Der</option><option>Guardabarro Trasero Izq</option>
                    <option>Guardabarro Trasero Der</option><option>Techo</option>
                    <option>Lateral Izquierdo</option><option>Lateral Derecho</option>
                    <option value="__otro__">Otro...</option>
                  </select>
                  <div id="custom-part-container" class="mt-2 hidden">
                    <div class="flex gap-2">
                      <input id="custom-part-input" class="flex-1 h-10 px-3 rounded bg-white/10 border border-white/10" placeholder="Escriba la pieza..." />
                      <button id="add-custom-part" class="px-3 py-2 rounded bg-emerald-600/80 hover:bg-emerald-600">Agregar</button>
                    </div>
                    <div id="custom-parts-list" class="mt-2 text-xs text-slate-400"></div>
                  </div>
                </label>

                <label class="text-sm block">
                  <span class="block mb-1 text-slate-300">Tipo de Trabajo</span>
                  <select id="work" class="w-full h-10 px-3 rounded bg-white/10 border border-white/10">
                    <option value="">Seleccionar trabajo...</option>
                    <option>Pintura Completa</option><option>Pintura Parcial</option>
                    <option>Chapa y Pintura</option><option>Desabolladura</option>
                    <option>Cambio de Pieza</option><option>Reparación de Chapa</option>
                    <option>Pulido</option><option>Masillado</option>
                    <option value="__otro__">Otro...</option>
                  </select>
                  <div id="custom-work-container" class="mt-2 hidden">
                    <div class="flex gap-2">
                      <input id="custom-work-input" class="flex-1 h-10 px-3 rounded bg-white/10 border border-white/10" placeholder="Escriba el trabajo..." />
                      <button id="add-custom-work" class="px-3 py-2 rounded bg-emerald-600/80 hover:bg-emerald-600">Agregar</button>
                    </div>
                    <div id="custom-works-list" class="mt-2 text-xs text-slate-400"></div>
                  </div>
                </label>
              </div>

              <label class="text-sm block">
                <span class="block mb-1 text-slate-300">Costo del Trabajo (ARS)</span>
                <input id="work-cost" type="number" min="0" step="0.01" class="w-full h-10 px-3 rounded bg-white/10 border border-white/10" placeholder="0.00">
              </label>

              <div>
                <div class="text-sm font-medium mb-1">Opciones</div>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
                  ${["Cambiar Pieza","Reparar","Pintar","Desabollar"].map(t=>`
                    <label class="flex items-center gap-2 bg-white/5 rounded px-3 py-2">
                      <input type="checkbox" class="accent-indigo-500"><span>${t}</span>
                    </label>
                  `).join("")}
                </div>
              </div>
            </div>

            <div class="mt-4 flex justify-end gap-2">
              <button class="btn-secondary close-modal px-3 py-2 rounded bg-white/10 hover:bg-white/20">Cancelar</button>
              <button id="confirm-add" class="btn-primary px-3 py-2 rounded bg-indigo-600/80 hover:bg-indigo-600">Añadir Ítem</button>
            </div>
          </div>
        </div>

        <!-- Modal: Otros Trabajos -->
        <div id="other-services-modal"
             class="fixed inset-0 z-[1000] hidden flex items-center justify-center bg-black/60">
          <div class="bg-slate-900 border border-white/10 rounded-xl w-[min(92vw,980px)] p-4">
            <div class="flex items-center justify-between">
              <h2 class="text-lg font-semibold">🧰 Otros Trabajos y Servicios</h2>
              <button id="close-services-modal" class="px-2 py-1 rounded hover:bg-white/10">✖</button>
            </div>

            <div class="mt-4 grid md:grid-cols-2 gap-4">
              <!-- Servicios disponibles -->
              <div class="glass rounded-lg p-3">
                <h3 class="font-medium mb-2">Servicios Disponibles</h3>
                <div class="grid grid-cols-2 sm:grid-cols-3 gap-2" id="services-grid">
                  ${[
                    ["desmontaje-montaje","🔧","Desmontaje/Montaje"],
                    ["repuestos","⚙️","Repuestos"],
                    ["pintura","🎨","Pintura"],
                    ["pulido","✨","Pulido"],
                    ["masillado","🧱","Masillado"],
                    ["lavado","🫧","Lavado"],
                    ["limpieza","🧽","Limpieza"],
                    ["diagnostico","🧠","Diagnóstico"],
                    ["otro-predef","➕","Otro (rápido)"]
                  ].map(([key,icon,label])=>`
                    <button class="service-item w-full text-left bg-white/5 hover:bg-white/10 rounded px-3 py-2" data-service="${key}">
                      <div class="text-xl">${icon}</div>
                      <div class="text-sm">${label}</div>
                    </button>
                  `).join("")}
                </div>

                <div class="mt-4">
                  <h4 class="font-medium mb-1">Servicios Personalizados</h4>
                  <div class="flex gap-2">
                    <input id="custom-service-name" class="flex-1 h-10 px-3 rounded bg-white/10 border border-white/10" placeholder="Nombre del servicio personalizado">
                    <button id="add-custom-service" class="px-3 py-2 rounded bg-emerald-600/80 hover:bg-emerald-600">Agregar</button>
                  </div>
                  <div id="custom-services-list" class="mt-2 grid sm:grid-cols-2 gap-2 text-sm"></div>
                </div>
              </div>

              <!-- Formulario del servicio elegido -->
              <div class="glass rounded-lg p-3">
                <h3 class="font-medium mb-2">Detalles del Servicio</h3>
                <div class="grid grid-cols-2 gap-3">
                  <label class="text-sm block">
                    <span class="block mb-1 text-slate-300">Cantidad</span>
                    <input id="service-quantity" type="number" min="1" value="1" class="w-full h-10 px-3 rounded bg-white/10 border border-white/10">
                  </label>
                  <label class="text-sm block">
                    <span class="block mb-1 text-slate-300">Costo (ARS)</span>
                    <input id="service-cost" type="number" min="0" step="0.01" class="w-full h-10 px-3 rounded bg-white/10 border border-white/10">
                  </label>
                </div>
                <label class="text-sm block mt-3">
                  <span class="block mb-1 text-slate-300">Descripción adicional (opcional)</span>
                  <textarea id="service-description" rows="3" class="w-full px-3 py-2 rounded bg-white/10 border border-white/10" placeholder="Detalles extra..."></textarea>
                </label>
              </div>
            </div>

            <div class="mt-4 flex justify-end gap-2">
              <button id="cancel-service" class="px-3 py-2 rounded bg-white/10 hover:bg-white/20">Cancelar</button>
              <button id="confirm-service" class="px-3 py-2 rounded bg-indigo-600/80 hover:bg-indigo-600" disabled>Agregar al Presupuesto</button>
            </div>
          </div>
        </div>

        <!-- Modal: Repuestos -->
        <div id="parts-modal"
             class="fixed inset-0 z-[1000] hidden flex items-center justify-center bg-black/60">
          <div class="bg-slate-900 border border-white/10 rounded-xl w-[min(92vw,980px)] p-4">
            <div class="flex items-center justify-between">
              <h2 class="text-lg font-semibold">🔩 Repuestos</h2>
              <button id="close-parts-modal" class="px-2 py-1 rounded hover:bg-white/10">✖</button>
            </div>

            <div class="mt-4 grid md:grid-cols-2 gap-4">
              <!-- Formulario -->
              <div class="glass rounded-lg p-3">
                <h3 class="font-medium mb-2">Formulario</h3>
                <label class="text-sm block">
                  <span class="block mb-1 text-slate-300">Nombre del repuesto</span>
                  <input id="part-name" class="w-full h-10 px-3 rounded bg-white/10 border border-white/10" placeholder="Ej: Farol delantero">
                </label>
                <div class="grid grid-cols-2 gap-3 mt-3">
                  <label class="text-sm block">
                    <span class="block mb-1 text-slate-300">Cantidad</span>
                    <input id="part-quantity" type="number" min="1" value="1" class="w-full h-10 px-3 rounded bg-white/10 border border-white/10">
                  </label>
                  <label class="text-sm block">
                    <span class="block mb-1 text-slate-300">Precio (ARS)</span>
                    <input id="part-price" type="number" min="0" step="0.01" class="w-full h-10 px-3 rounded bg-white/10 border border-white/10">
                  </label>
                </div>
                <label class="text-sm block mt-3">
                  <span class="block mb-1 text-slate-300">Descripción adicional (opcional)</span>
                  <textarea id="part-description" rows="2" class="w-full px-3 py-2 rounded bg-white/10 border border-white/10" placeholder="Detalles adicionales del repuesto"></textarea>
                </label>
                <div class="flex items-center justify-between mt-3">
                  <div class="text-sm">Total ítem: <span id="part-total" class="font-medium">$0.00</span></div>
                  <div class="flex gap-2">
                    <button id="add-part" class="px-3 py-2 rounded bg-emerald-600/80 hover:bg-emerald-600" disabled>Agregar repuesto</button>
                    <button id="clear-part-form" class="px-3 py-2 rounded bg-white/10 hover:bg-white/20">Limpiar</button>
                  </div>
                </div>
              </div>

              <!-- Vista previa -->
              <div class="glass rounded-lg p-3">
                <h3 class="font-medium mb-2">Repuestos a agregar <span id="parts-count" class="text-slate-400">(0)</span></h3>
                <div id="parts-preview" class="space-y-2 text-sm">
                  <div class="text-slate-400">No hay repuestos agregados aún</div>
                </div>
                <div class="mt-3 text-right text-sm">
                  Total de repuestos: <span id="parts-total-amount" class="font-medium">$0.00</span>
                </div>
              </div>
            </div>

            <div class="mt-4 flex justify-end gap-2">
              <button id="cancel-parts" class="px-3 py-2 rounded bg-white/10 hover:bg-white/20">Cancelar</button>
              <button id="confirm-parts" class="px-3 py-2 rounded bg-indigo-600/80 hover:bg-indigo-600">Agregar al Presupuesto</button>
            </div>
          </div>
        </div>

        <!-- Modal: Firma digital -->
        <div id="signature-modal"
             class="fixed inset-0 z-[1000] hidden flex items-center justify-center bg-black/60">
          <div class="bg-slate-900 border border-white/10 rounded-xl w-[min(92vw,720px)] p-4">
            <div class="flex items-center justify-between">
              <div class="font-medium">Firma Digital</div>
              <button id="close-signature" class="px-2 py-1 rounded hover:bg-white/10">✖</button>
            </div>
            <div class="mt-3 glass rounded-lg p-2">
              <canvas id="signature-canvas-modal" class="w-full h-60 bg-slate-950 rounded"></canvas>
            </div>
            <div class="mt-3 flex justify-end gap-2">
              <button id="clear-signature" class="px-3 py-2 rounded bg-white/10 hover:bg-white/20">Limpiar</button>
              <button id="save-signature" class="px-3 py-2 rounded bg-indigo-600/80 hover:bg-indigo-600">Guardar Firma</button>
            </div>
          </div>
        </div>

        <!-- Modal: Confirmar eliminación de vehículo -->
        <div id="confirm-del-veh-modal"
             class="fixed inset-0 z-[1000] hidden flex items-center justify-center bg-black/60">
          <div class="bg-slate-900 border border-white/10 rounded-xl w-[min(92vw,560px)] p-4">
            <h2 class="text-lg font-semibold">Eliminar vehículo</h2>
            <p class="mt-2 text-slate-300">¿Seguro que querés eliminar este vehículo? <strong>La acción no es reversible.</strong></p>
            <div id="del-veh-summary" class="mt-2 text-sm text-slate-400"></div>
            <div class="mt-4 flex justify-end gap-2">
              <button id="cancel-del-veh" class="px-3 py-2 rounded bg-white/10 hover:bg-white/20">Cancelar</button>
              <button id="confirm-del-veh" class="px-3 py-2 rounded bg-rose-700/80 hover:bg-rose-700">Eliminar</button>
            </div>
          </div>
        </div>

        <!-- Modal: Confirmar eliminación de cliente -->
        <div id="confirm-del-cli-modal"
             class="fixed inset-0 z-[1000] hidden flex items-center justify-center bg-black/60">
          <div class="bg-slate-900 border border-white/10 rounded-xl w-[min(92vw,560px)] p-4">
            <h2 class="text-lg font-semibold">Eliminar cliente</h2>
            <p class="mt-2 text-slate-300">¿Seguro que querés eliminar este cliente y <strong>todos sus vehículos</strong>? <strong>La acción no es irreversible.</strong></p>
            <div id="del-cli-summary" class="mt-2 text-sm text-slate-400"></div>
            <div class="mt-4 flex justify-end gap-2">
              <button id="cancel-del-cli" class="px-3 py-2 rounded bg-white/10 hover:bg-white/20">Cancelar</button>
              <button id="confirm-del-cli" class="px-3 py-2 rounded bg-rose-700/80 hover:bg-rose-700">Eliminar cliente</button>
            </div>
          </div>
        </div>
      </section>
    `;
  },

  mount(root) {
    // --- Refs base
    const selSucursal = root.querySelector("#sucursal");
    const numInput = root.querySelector("#budget-number");
    const dateInput = root.querySelector("#budget-date");

    // Cliente/vehículos
    const existingClientSel = root.querySelector("#existing-client");
    const newClientBtn = root.querySelector("#new-client-btn");
    const deleteClientBtn = root.querySelector("#delete-client-btn");
    const saveClientBtn = root.querySelector("#save-client-btn");
    const nombre = root.querySelector("#nombre");
    const telefono = root.querySelector("#telefono");

    const vehiclesBlock = root.querySelector("#client-vehicles-block");
    const vehicleSel = root.querySelector("#client-vehicle");
    const addVehicleBtn = root.querySelector("#add-vehicle-btn");
    const deleteVehicleBtn = root.querySelector("#delete-vehicle-btn");
    const vehiculo = root.querySelector("#vehiculo");
    const patente = root.querySelector("#patente");
    const modelo = root.querySelector("#modelo");
    const compania = root.querySelector("#compania");
    const chasis = root.querySelector("#chasis");

    // Modales confirm
    const delVehModal = root.querySelector("#confirm-del-veh-modal");
    const delVehSummary = root.querySelector("#del-veh-summary");
    const cancelDelVeh = root.querySelector("#cancel-del-veh");
    const confirmDelVeh = root.querySelector("#confirm-del-veh");

    const delCliModal = root.querySelector("#confirm-del-cli-modal");
    const delCliSummary = root.querySelector("#del-cli-summary");
    const cancelDelCli = root.querySelector("#cancel-del-cli");
    const confirmDelCli = root.querySelector("#confirm-del-cli");

    const itemsBody = root.querySelector("#budget-items");
    const subtotalEl = root.querySelector("#subtotal");
    const totalEl = root.querySelector("#total");

    // Toolbar
    const addItemBtn = root.querySelector("#add-item");
    const othersBtn = root.querySelector("#other-services");
    const partsBtn = root.querySelector("#parts-manager");
    const signBtn = root.querySelector("#signature-btn");
    const saveBtn = root.querySelector("#save-budget");
    const pdfBtn = root.querySelector("#download-pdf-direct");

    // Modal Add Item
    const addItemModal = root.querySelector("#add-item-modal");
    const closeAddItem = addItemModal.querySelectorAll(".close-modal");
    const partSelect = addItemModal.querySelector("#part");
    const workSelect = addItemModal.querySelector("#work");
    const workCost = addItemModal.querySelector("#work-cost");
    const confirmAdd = addItemModal.querySelector("#confirm-add");
    const customPartContainer = addItemModal.querySelector("#custom-part-container");
    const customPartInput = addItemModal.querySelector("#custom-part-input");
    const addCustomPart = addItemModal.querySelector("#add-custom-part");
    const customPartsList = addItemModal.querySelector("#custom-parts-list");
    const customWorkContainer = addItemModal.querySelector("#custom-work-container");
    const customWorkInput = addItemModal.querySelector("#custom-work-input");
    const addCustomWork = addItemModal.querySelector("#add-custom-work");
    const customWorksList = addItemModal.querySelector("#custom-works-list");
    const optionChecks = addItemModal.querySelectorAll("input[type='checkbox']");

    // Otros Trabajos
    const othersModal = root.querySelector("#other-services-modal");
    const closeServicesModal = root.querySelector("#close-services-modal");
    const cancelServiceBtn = root.querySelector("#cancel-service");
    const confirmServiceBtn = root.querySelector("#confirm-service");
    const serviceQuantity = root.querySelector("#service-quantity");
    const serviceCost = root.querySelector("#service-cost");
    const serviceDescription = root.querySelector("#service-description");
    const customServiceName = root.querySelector("#custom-service-name");
    const addCustomServiceBtn = root.querySelector("#add-custom-service");
    const customServicesList = root.querySelector("#custom-services-list");

    // Repuestos
    const partsModal = root.querySelector("#parts-modal");
    const closePartsModal = root.querySelector("#close-parts-modal");
    const cancelPartsBtn = root.querySelector("#cancel-parts");
    const confirmPartsBtn = root.querySelector("#confirm-parts");
    const partNameInput = root.querySelector("#part-name");
    const partQuantityInput = root.querySelector("#part-quantity");
    const partPriceInput = root.querySelector("#part-price");
    const partTotalInput = root.querySelector("#part-total");
    const partDescriptionInput = root.querySelector("#part-description");
    const addPartBtn = root.querySelector("#add-part");
    const clearPartFormBtn = root.querySelector("#clear-part-form");
    const partsPreview = root.querySelector("#parts-preview");
    const partsCount = root.querySelector("#parts-count");
    const partsTotalAmount = root.querySelector("#parts-total-amount");

    // Firma
    const signModal = root.querySelector("#signature-modal");
    const closeSign = root.querySelector("#close-signature");
    const clearSign = root.querySelector("#clear-signature");
    const saveSign = root.querySelector("#save-signature");
    const signCanvas = root.querySelector("#signature-canvas-modal");
    const printCanvas = root.querySelector("#signature-canvas");
    const printDate = root.querySelector("#print-date");
    const signCtx = signCanvas.getContext("2d");
    const printCtx = printCanvas.getContext("2d");

    // ===== Init
    dateInput.value = todayISO();

    function paintBranchesIntoSelect(keepValue = null){
      const current = keepValue ?? selSucursal.value;
      selSucursal.innerHTML = `<option value="">Seleccionar sucursal...</option>` +
        (CFG_BRANCHES||[]).map(b=>`<option value="${b.id}">${b.name || b.address || b.cuit || b.id}</option>`).join("");
      // conservar selección si sigue existiendo
      selSucursal.value = (CFG_BRANCHES||[]).some(b=>b.id===current) ? current : "";
      if (!selSucursal.value){
        numInput.value = "";
        numInput.placeholder = "Selecciona una sucursal";
      }
    }
    paintBranchesIntoSelect();

    // Reaccionar a cambios del panel de Configuración
    document.addEventListener("cfg:branches-updated", (e)=>{
      CFG_BRANCHES = e.detail?.branches || [];
      paintBranchesIntoSelect();
    });
    document.addEventListener("cfg:settings-updated", (e)=>{
      CFG_SETTINGS = e.detail?.settings || CFG_SETTINGS;
      CURRENCY = CFG_SETTINGS.currency || CURRENCY;
      LOCALE   = CFG_SETTINGS.locale   || LOCALE;
      DECIMALS = Number.isInteger(CFG_SETTINGS.decimals) ? CFG_SETTINGS.decimals : DECIMALS;
      // refrescar valores formateados
      updateTotals();
      try { if (printDate) printDate.textContent = new Date().toLocaleDateString(LOCALE); } catch {}
      toast("Ajustes aplicados al módulo Presupuesto ✅", "success");
    });

    // === Numeración vinculada a budgets_list ==========================
    // Estado de edición
    let currentBudgetKey = null;
    let isEditing = false;

    // Vista previa al elegir sucursal (no persiste nada)
    selSucursal.addEventListener("change", () => {
      if (!selSucursal.value) {
        numInput.value = "";
        numInput.placeholder = "Selecciona una sucursal";
        return;
      }
      // Si estoy editando, no toco el número original
      if (isEditing) return;
      numInput.value = previewNextNumber(selSucursal.value);
      toast(`Número sugerido: ${numInput.value}`, "success");
    });

    // === CLIENTES & VEHÍCULOS ===
    let selectedClientId = null;
    let selectedVehicleId = null; // null => creando uno nuevo

    function loadClientsIntoSelect(selectId = existingClientSel, keepId = null) {
      const clients = getClients();
      selectId.innerHTML = `<option value="">Seleccionar cliente existente...</option>` +
        clients.map(c => `<option value="${c.id}">${c.name} — ${c.phone || "s/tel"}</option>`).join("");
      if (keepId) selectId.value = keepId;
      deleteClientBtn.disabled = !selectId.value;
    }

    function loadVehiclesIntoSelect(client, keepVehicleId = null) {
      if (!client || !client.vehicles?.length) {
        vehiclesBlock.classList.add("hidden");
        vehicleSel.innerHTML = `<option value="">(Nuevo vehículo)</option>`;
        selectedVehicleId = null;
        deleteVehicleBtn.disabled = true;
        return;
      }
      vehiclesBlock.classList.remove("hidden");
      vehicleSel.innerHTML = client.vehicles.map(v => {
        const label = `${v.vehiculo || "Vehículo"} ${v.patente ? `— ${v.patente}` : ""}`;
        return `<option value="${v.id}">${label}</option>`;
      }).join("");
      vehicleSel.insertAdjacentHTML("afterbegin", `<option value="">(Nuevo vehículo)</option>`);
      vehicleSel.value = keepVehicleId ?? client.vehicles[0].id ?? "";
      selectedVehicleId = vehicleSel.value || null;
      deleteVehicleBtn.disabled = !selectedVehicleId;
      const current = client.vehicles.find(v => v.id === selectedVehicleId);
      fillVehicleForm(current || null);
    }

    function clearClientForm() {
      existingClientSel.value = "";
      selectedClientId = null;
      nombre.value = "";
      telefono.value = "";
      vehiclesBlock.classList.add("hidden");
      selectedVehicleId = null;
      deleteClientBtn.disabled = true;
      deleteVehicleBtn.disabled = true;
      fillVehicleForm(null);
    }

    function fillClientForm(client) {
      nombre.value = client?.name || "";
      telefono.value = client?.phone || "";
    }

    function getClientFormData() {
      return {
        name: (nombre.value || "").trim(),
        phone: (telefono.value || "").trim()
      };
    }

    function fillVehicleForm(v) {
      vehiculo.value = v?.vehiculo || "";
      patente.value = v?.patente || "";
      modelo.value = v?.modelo || "";
      compania.value = v?.compania || "";
      chasis.value = v?.chasis || "";
    }

    function getVehicleFormData() {
      return {
        id: selectedVehicleId || rid("veh"),
        vehiculo: (vehiculo.value || "").trim(),
        patente: (patente.value || "").trim(),
        modelo: (modelo.value || "").trim(),
        compania: (compania.value || "").trim(),
        chasis: (chasis.value || "").trim()
      };
    }

    // Cargar clientes en el select al iniciar
    loadClientsIntoSelect();

    // Selección de cliente existente
    existingClientSel.addEventListener("change", () => {
      const id = existingClientSel.value || null;
      selectedClientId = id;
      const clients = getClients();
      const client = clients.find(c => c.id === id) || null;
      fillClientForm(client);
      loadVehiclesIntoSelect(client);
      deleteClientBtn.disabled = !id;
    });

    // Botón Nuevo Cliente
    newClientBtn.addEventListener("click", () => {
      clearClientForm();
      toast("Modo: Nuevo cliente", "info");
    });

    // Botón Añadir vehículo (prepara el form en blanco y marca 'nuevo')
    addVehicleBtn.addEventListener("click", () => {
      vehiclesBlock.classList.remove("hidden");
      selectedVehicleId = null; // nuevo
      vehicleSel.value = "";
      deleteVehicleBtn.disabled = true;
      fillVehicleForm(null);
      toast("Completá los datos para añadir un vehículo nuevo", "info");
    });

    // Cambio de vehículo seleccionado
    vehicleSel.addEventListener("change", () => {
      selectedVehicleId = vehicleSel.value || null;
      deleteVehicleBtn.disabled = !selectedVehicleId;
      const clients = getClients();
      const client = clients.find(c => c.id === selectedClientId);
      if (!client) return;
      const v = client.vehicles?.find(v => v.id === selectedVehicleId) || null;
      fillVehicleForm(v); // si es null => deja el form en blanco (nuevo)
    });

    // Guardar Cliente (crea/actualiza cliente + agrega/actualiza vehículo)
    saveClientBtn.addEventListener("click", () => {
      const clientData = getClientFormData();
      if (!clientData.name) { toast("El nombre del cliente es obligatorio", "error"); return; }
      if (!clientData.phone) { toast("El teléfono es obligatorio", "error"); return; }

      const vehicleData = getVehicleFormData();
      if (!vehicleData.vehiculo || !vehicleData.patente) {
        toast("Vehículo y patente son obligatorios", "error"); return;
      }

      let clients = getClients();
      let client;
      if (selectedClientId) {
        client = clients.find(c => c.id === selectedClientId);
        if (!client) {
          client = { id: selectedClientId, name: clientData.name, phone: clientData.phone, vehicles: [] };
          clients.push(client);
        }
        client.name = clientData.name;
        client.phone = clientData.phone;
        client.vehicles = Array.isArray(client.vehicles) ? client.vehicles : [];
        const idxV = client.vehicles.findIndex(v => v.id === selectedVehicleId);
        if (idxV >= 0) client.vehicles[idxV] = vehicleData;
        else client.vehicles.push(vehicleData);

        upsertClient(client);
        loadClientsIntoSelect(existingClientSel, client.id);
        loadVehiclesIntoSelect(client, vehicleData.id);
        selectedClientId = client.id;
        selectedVehicleId = vehicleData.id;
        toast("Cliente actualizado ✅", "success");
      } else {
        client = {
          id: rid("cli"),
          name: clientData.name,
          phone: clientData.phone,
          vehicles: [vehicleData],
          createdAt: new Date().toISOString()
        };
        upsertClient(client);
        loadClientsIntoSelect(existingClientSel, client.id);
        fillClientForm(client);
        loadVehiclesIntoSelect(client, vehicleData.id);
        selectedClientId = client.id;
        selectedVehicleId = vehicleData.id;
        toast("Cliente creado ✅", "success");
      }
      deleteClientBtn.disabled = !selectedClientId;
      deleteVehicleBtn.disabled = !selectedVehicleId;
    });

    // --- Eliminar Vehículo (modal)
    function openDelVehModal() { delVehModal.classList.remove("hidden"); }
    function closeDelVehModal() { delVehModal.classList.add("hidden"); }
    deleteVehicleBtn.addEventListener("click", () => {
      if (!selectedClientId || !selectedVehicleId) return;
      const client = getClients().find(c => c.id === selectedClientId);
      const v = client?.vehicles?.find(v => v.id === selectedVehicleId);
      delVehSummary.textContent = v ? `${v.vehiculo || ""} ${v.patente ? "— "+v.patente : ""}` : "";
      openDelVehModal();
    });
    cancelDelVeh.addEventListener("click", closeDelVehModal);
    delVehModal.addEventListener("click", (e)=>{ if(e.target===delVehModal) closeDelVehModal(); });
    confirmDelVeh.addEventListener("click", () => {
      if (!selectedClientId || !selectedVehicleId) return;
      const list = getClients();
      const ci = list.findIndex(c => c.id === selectedClientId);
      if (ci < 0) return;
      const client = list[ci];
      client.vehicles = (client.vehicles || []).filter(v => v.id !== selectedVehicleId);
      saveClients(list);
      loadVehiclesIntoSelect(client, null);
      selectedVehicleId = null;
      deleteVehicleBtn.disabled = true;
      fillVehicleForm(null);
      toast("Vehículo eliminado", "info");
      closeDelVehModal();
    });

    // --- Eliminar Cliente (modal)
    function openDelCliModal(){ delCliModal.classList.remove("hidden"); }
    function closeDelCliModal(){ delCliModal.classList.add("hidden"); }
    deleteClientBtn.addEventListener("click", () => {
      if (!selectedClientId) return;
      const cli = getClients().find(c => c.id === selectedClientId);
      delCliSummary.textContent = cli ? `${cli.name} — ${cli.phone || "s/tel"} (${(cli.vehicles||[]).length} vehículo/s)` : "";
      openDelCliModal();
    });
    cancelDelCli.addEventListener("click", closeDelCliModal);
    delCliModal.addEventListener("click",(e)=>{ if(e.target===delCliModal) closeDelCliModal(); });
    confirmDelCli.addEventListener("click", () => {
      if (!selectedClientId) return;
      const list = getClients().filter(c => c.id !== selectedClientId);
      saveClients(list);
      clearClientForm();
      loadClientsIntoSelect(existingClientSel);
      toast("Cliente eliminado", "info");
      closeDelCliModal();
    });

    // === Tabla + Totales
    function updateTotals() {
      let subtotal = 0;
      itemsBody.querySelectorAll("tr").forEach(tr => {
        const cell = tr.querySelector("td:nth-child(4)");
        if (!cell) return;
        const num = parseFloat(
          cell.textContent.replace(/[^\d.,-]/g, "").replace(/\./g, "").replace(",", ".")
        ) || 0;
        subtotal += num;
      });
      subtotalEl.textContent = money(subtotal);
      totalEl.textContent = money(subtotal);
      return subtotal;
    }
    function appendRow({ cantidad = 1, descripcion, unit, total }) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="px-3 py-2">${cantidad}</td>
        <td class="px-3 py-2 text-left">${descripcion}</td>
        <td class="px-3 py-2">${money(unit)}</td>
        <td class="px-3 py-2">${money(total)}</td>
        <td class="px-3 py-2">
          <button class="delete-item px-2 py-1 rounded bg-rose-600/80 hover:bg-rose-600" title="Eliminar">🗑</button>
        </td>`;
      tr.querySelector(".delete-item").addEventListener("click", () => {
        tr.remove();
        updateTotals();
      });
      itemsBody.appendChild(tr);
      updateTotals();
    }
    function collectItemsForPdf() {
      const arr = [];
      itemsBody.querySelectorAll("tr").forEach(tr => {
        const tds = tr.querySelectorAll("td");
        if (tds.length >= 4) {
          const cantidad = parseFloat((tds[0].textContent||"1").replace(",",".")); 
          const unit = parseFloat(tds[2].textContent.replace(/[^\d.,-]/g,"").replace(/\./g,"").replace(",",".")); 
          const total = parseFloat(tds[3].textContent.replace(/[^\d.,-]/g,"").replace(/\./g,"").replace(",",".")); 
          arr.push({
            cantidad: isNaN(cantidad)?1:cantidad,
            descripcion: tds[1].textContent.trim(),
            unit: isNaN(unit)?0:unit,
            total: isNaN(total)?0:total
          });
        }
      });
      return arr;
    }

    // === Modal "Añadir Item"
    function showAddItem() { addItemModal.classList.remove("hidden"); }
    function hideAddItem() { addItemModal.classList.add("hidden"); }
    addItemBtn.addEventListener("click", showAddItem);
    addItemModal.addEventListener("click", (e) => { if (e.target === addItemModal) hideAddItem(); });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        [addItemModal, othersModal, partsModal, signModal, delVehModal, delCliModal].forEach(m => !m.classList.contains("hidden") && m.classList.add("hidden"));
      }
    });
    closeAddItem.forEach(b => b.addEventListener("click", hideAddItem));

    partSelect.addEventListener("change", () => customPartContainer.classList.toggle("hidden", partSelect.value !== "__otro__"));
    workSelect.addEventListener("change", () => customWorkContainer.classList.toggle("hidden", workSelect.value !== "__otro__"));
    addCustomPart.addEventListener("click", () => {
      const v = customPartInput.value.trim(); if (!v) return;
      partSelect.add(new Option(v, v)); partSelect.value = v; customPartsList.textContent = `Agregada: ${v}`;
    });
    addCustomWork.addEventListener("click", () => {
      const v = customWorkInput.value.trim(); if (!v) return;
      workSelect.add(new Option(v, v)); workSelect.value = v; customWorksList.textContent = `Agregado: ${v}`;
    });
    confirmAdd.addEventListener("click", () => {
      if (!partSelect.value) { toast("Seleccioná una pieza", "error"); return; }
      if (!workSelect.value) { toast("Seleccioná un trabajo", "error"); return; }
      const cost = parseFloat(workCost.value);
      if (!cost || cost <= 0) { toast("Costo inválido", "error"); return; }
      const opts = [...optionChecks].filter(c => c.checked).map(c => c.nextElementSibling.textContent.trim());
      const desc = `[SERVICIO] ${partSelect.value} - ${workSelect.value}${opts.length ? ` (${opts.join(", ")})` : ""}`;
      appendRow({ cantidad: 1, descripcion: desc, unit: cost, total: cost });
      hideAddItem();
      toast("Ítem agregado", "success");
    });

    // === Otros Trabajos (con servicios personalizados CRUD)
    let selectedService = null;
    let customServices = JSON.parse(localStorage.getItem("customServices") || "[]");

    const openOthers = () => { othersModal.classList.remove("hidden"); resetOthers(); loadCustomServices(); };
    const closeOthers = () => { othersModal.classList.add("hidden"); resetOthers(); };

    othersBtn.addEventListener("click", openOthers);
    closeServicesModal.addEventListener("click", closeOthers);
    cancelServiceBtn.addEventListener("click", closeOthers);
    othersModal.addEventListener("click", (e) => { if (e.target === othersModal) closeOthers(); });

    function clearAllServiceSelections() {
      othersModal.querySelectorAll(".service-item").forEach(i => i.classList.remove("ring","ring-indigo-500/50"));
      customServicesList.querySelectorAll(".service-card").forEach(i => i.classList.remove("ring","ring-indigo-500/50"));
    }

    function resetOthers() {
      selectedService = null;
      serviceQuantity.value = "1";
      serviceCost.value = "";
      serviceDescription.value = "";
      confirmServiceBtn.disabled = true;
      clearAllServiceSelections();
    }

    function updateConfirmBtn() {
      const hasService = selectedService !== null;
      const hasCost = parseFloat(serviceCost.value) > 0;
      confirmServiceBtn.disabled = !(hasService && hasCost);
    }
    ["input", "change"].forEach(ev => {
      serviceQuantity.addEventListener(ev, updateConfirmBtn);
      serviceCost.addEventListener(ev, updateConfirmBtn);
    });

    // Selección de servicios predefinidos
    othersModal.addEventListener("click", (e) => {
      const item = e.target.closest(".service-item");
      if (!item) return;
      clearAllServiceSelections();
      item.classList.add("ring","ring-indigo-500/50");
      selectedService = item.dataset.service || item.textContent.trim();
      updateConfirmBtn();
    });

    // ----- Servicios personalizados CRUD -----
    function persistCustomServices() {
      localStorage.setItem("customServices", JSON.stringify(customServices));
    }

    function loadCustomServices(selectedId = null) {
      if (!Array.isArray(customServices)) customServices = [];
      if (!customServices.length) {
        customServicesList.innerHTML = `<div class="text-slate-400 text-sm">No hay servicios personalizados aún</div>`;
        return;
      }
      customServicesList.innerHTML = customServices.map(s => `
        <div class="service-card group flex items-center justify-between bg-white/5 hover:bg-white/10 rounded px-3 py-2"
             data-id="${s.id}">
          <button class="use-service text-left flex-1 truncate">${s.name}</button>
          <div class="ml-2 opacity-90 flex gap-1 shrink-0">
            <button class="edit-service px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-xs" title="Editar">✏️</button>
            <button class="delete-service px-2 py-1 rounded bg-rose-600/80 hover:bg-rose-600 text-xs" title="Eliminar">🗑</button>
          </div>
        </div>
      `).join("");

      if (selectedId) {
        const card = customServicesList.querySelector(`.service-card[data-id="${selectedId}"]`);
        card?.classList.add("ring","ring-indigo-500/50");
      }
    }

    function renderServiceCardEditing(card, currentName) {
      card.innerHTML = `
        <input type="text" class="edit-input flex-1 h-9 mr-2 px-3 rounded bg-white/10 border border-white/10"
               value="${currentName}">
        <div class="flex gap-1">
          <button class="save-service px-2 py-1 rounded bg-emerald-600/80 hover:bg-emerald-600 text-xs">Guardar</button>
          <button class="cancel-edit px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-xs">Cancelar</button>
        </div>
      `;
    }

    addCustomServiceBtn.addEventListener("click", () => {
      const name = customServiceName.value.trim();
      if (!name) { toast("Ingresá un nombre", "error"); return; }
      const obj = { id: rid("srv"), name };
      customServices.push(obj);
      persistCustomServices();
      customServiceName.value = "";
      loadCustomServices(obj.id);
      toast("Servicio agregado a favoritos", "success");
    });

    customServicesList.addEventListener("click", (e) => {
      const card = e.target.closest(".service-card");
      if (!card) return;
      const id = card.dataset.id;
      const idx = customServices.findIndex(s => s.id === id);
      if (idx < 0) return;

      if (e.target.classList.contains("use-service")) {
        clearAllServiceSelections();
        card.classList.add("ring","ring-indigo-500/50");
        selectedService = customServices[idx].name;
        updateConfirmBtn();
        return;
      }

      if (e.target.classList.contains("edit-service")) {
        renderServiceCardEditing(card, customServices[idx].name);
        card.querySelector(".edit-input")?.focus();
        return;
      }

      if (e.target.classList.contains("save-service")) {
        const input = card.querySelector(".edit-input");
        const newName = (input?.value || "").trim();
        if (!newName) { toast("El nombre no puede estar vacío", "error"); return; }
        customServices[idx].name = newName;
        persistCustomServices();
        loadCustomServices(id);
        toast("Servicio modificado ✅", "success");
        if (selectedService) { selectedService = newName; updateConfirmBtn(); }
        return;
      }

      if (e.target.classList.contains("cancel-edit")) {
        loadCustomServices();
        return;
      }

      if (e.target.classList.contains("delete-service")) {
        if (!confirm("¿Eliminar este servicio personalizado?")) return;
        customServices.splice(idx, 1);
        persistCustomServices();
        loadCustomServices();
        clearAllServiceSelections();
        selectedService = null;
        updateConfirmBtn();
        toast("Servicio eliminado", "info");
        return;
      }
    });

    confirmServiceBtn.addEventListener("click", () => {
      if (!selectedService) return;
      const quantity = Math.max(1, parseInt(serviceQuantity.value || "1", 10));
      const cost = parseFloat(serviceCost.value || "0");
      if (!(cost > 0)) { toast("Costo inválido", "error"); return; }
      const extra = serviceDescription.value.trim();
      const fullDesc = extra ? `${selectedService} - ${extra}` : selectedService;
      appendRow({ cantidad: quantity, descripcion: `[SERVICIO] ${fullDesc}`, unit: cost, total: quantity * cost });
      closeOthers();
      toast("Servicio agregado al presupuesto", "success");
    });

    // === Repuestos
    let tempParts = [];
    const openParts = () => { partsModal.classList.remove("hidden"); resetParts(); };
    const closeParts = () => { partsModal.classList.add("hidden"); resetParts(); };
    partsBtn.addEventListener("click", openParts);
    closePartsModal.addEventListener("click", closeParts);
    cancelPartsBtn.addEventListener("click", closeParts);
    partsModal.addEventListener("click", (e) => { if (e.target === partsModal) closeParts(); });

    function calcPartTotal() {
      const q = Math.max(1, parseInt(partQuantityInput.value || "1", 10));
      const p = parseFloat(partPriceInput.value || "0");
      const t = q * (p > 0 ? p : 0);
      partTotalInput.textContent = money(t);
      addPartBtn.disabled = !(partNameInput.value.trim() && p > 0 && q > 0);
    }
    function clearPartForm() {
      partNameInput.value = ""; partQuantityInput.value = "1"; partPriceInput.value = ""; partDescriptionInput.value = "";
      calcPartTotal();
    }
    function resetParts() {
      tempParts = [];
      clearPartForm();
      updatePartsPreview();
    }
    partQuantityInput.addEventListener("input", calcPartTotal);
    partPriceInput.addEventListener("input", calcPartTotal);
    partNameInput.addEventListener("input", calcPartTotal);

    addPartBtn.addEventListener("click", () => {
      const name = partNameInput.value.trim(); if (!name) return;
      const quantity = Math.max(1, parseInt(partQuantityInput.value || "1", 10));
      const price = parseFloat(partPriceInput.value || "0"); if (!(price > 0)) return;
      const desc = partDescriptionInput.value.trim();
      const newPart = { id: rid("rep"), name, quantity, price, total: quantity * price, description: desc };
      tempParts.push(newPart);
      clearPartForm();
      updatePartsPreview();
      toast("Repuesto agregado a la lista", "success");
    });
    clearPartFormBtn.addEventListener("click", clearPartForm);

    function updatePartsPreview() {
      if (!tempParts.length) {
        partsPreview.innerHTML = `<div class="text-slate-400">No hay repuestos agregados aún</div>`;
      } else {
        partsPreview.innerHTML = tempParts.map(p => `
          <div class="flex items-start justify-between gap-3 glass rounded p-2" data-id="${p.id}">
            <div>
              <div class="font-medium">${p.name}</div>
              ${p.description ? `<div class="text-xs text-slate-400">${p.description}</div>` : ""}
              <div class="text-xs">${p.quantity} × ${money(p.price)} = <strong>${money(p.total)}</strong></div>
            </div>
            <button class="del-part px-2 py-1 rounded bg-rose-600/80 hover:bg-rose-600 text-xs">🗑</button>
          </div>
        `).join("");
      }
      partsCount.textContent = `(${tempParts.length})`;
      const totalAmount = tempParts.reduce((s, p) => s + p.total, 0);
      partsTotalAmount.textContent = money(totalAmount);
    }
    partsPreview.addEventListener("click", (e) => {
      const btn = e.target.closest(".del-part"); if (!btn) return;
      const card = btn.closest("[data-id]"); const id = card?.dataset.id;
      tempParts = tempParts.filter(p => p.id !== id);
      updatePartsPreview();
      toast("Repuesto eliminado de la lista", "info");
    });

    confirmPartsBtn.addEventListener("click", () => {
      if (!tempParts.length) { toast("No hay repuestos para agregar", "error"); return; }
      tempParts.forEach(p => {
        const fullDesc = p.description ? `${p.name} - ${p.description}` : p.name;
        appendRow({ cantidad: p.quantity, descripcion: `[REPUESTO] ${fullDesc}`, unit: p.price, total: p.total });
      });
      closeParts();
      toast(`${tempParts.length} repuesto(s) agregado(s)`, "success");
    });

    // === Firma digital
    function resizeSignCanvas() {
      const rect = signCanvas.getBoundingClientRect(); const ratio = window.devicePixelRatio || 1;
      signCanvas.width = rect.width * ratio; signCanvas.height = rect.height * ratio;
      signCtx.setTransform(ratio, 0, 0, ratio, 0, 0); setupCanvas(signCtx);
    }
    let drawing = false, last = null;
    const pos = (ev, canvas) => { const r = canvas.getBoundingClientRect(); const x = (ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left; const y = (ev.touches ? ev.touches[0].clientY : ev.clientY) - r.top; return { x, y }; };
    function showSign() { signModal.classList.remove("hidden"); resizeSignCanvas(); loadSignatureToEdit(); }
    function hideSign() { signModal.classList.add("hidden"); }
    function clearSignature() { signCtx.clearRect(0, 0, signCanvas.width, signCanvas.height); }
    function saveSignature() {
      const data = signCanvas.toDataURL("image/png"); localStorage.setItem("digital_signature", data);
      const img = new Image();
      img.onload = () => {
        printCtx.clearRect(0, 0, printCanvas.width, printCanvas.height);
        printCtx.drawImage(img, 0, 0, printCanvas.width, printCanvas.height);
        root.querySelector(".signature-placeholder")?.classList.add("hidden");
      };
      img.src = data;
      toast("Firma guardada ✅", "success"); hideSign();
    }
    function loadSignatureToEdit() {
      const data = localStorage.getItem("digital_signature"); if (!data) return;
      const img = new Image(); img.onload = () => { signCtx.drawImage(img, 0, 0, signCanvas.width, signCanvas.height); }; img.src = data;
    }
    signCanvas.addEventListener("mousedown", e => { drawing = true; last = pos(e, signCanvas); });
    signCanvas.addEventListener("mousemove", e => { if (!drawing) return; const p = pos(e, signCanvas); signCtx.beginPath(); signCtx.moveTo(last.x, last.y); signCtx.lineTo(p.x, p.y); signCtx.stroke(); last = p; });
    window.addEventListener("mouseup", () => drawing = false);
    signCanvas.addEventListener("touchstart", e => { e.preventDefault(); drawing = true; last = pos(e, signCanvas); });
    signCanvas.addEventListener("touchmove", e => { e.preventDefault(); if (!drawing) return; const p = pos(e, signCanvas); signCtx.beginPath(); signCtx.moveTo(last.x, last.y); signCtx.lineTo(p.x, p.y); signCtx.stroke(); last = p; });
    window.addEventListener("touchend", () => drawing = false);
    signBtn.addEventListener("click", showSign);
    closeSign.addEventListener("click", hideSign);
    clearSign.addEventListener("click", clearSignature);
    saveSign.addEventListener("click", saveSignature);
    if (printDate) printDate.textContent = new Date().toLocaleDateString(LOCALE);

    // === Guardar presupuesto
    function collectItems() {
      const arr = [];
      itemsBody.querySelectorAll("tr").forEach(tr => {
        const tds = tr.querySelectorAll("td");
        if (tds.length >= 4) {
          arr.push({
            cantidad: tds[0].textContent.trim(),
            descripcion: tds[1].textContent.trim(),
            precio: tds[2].textContent.trim(),
            total: tds[3].textContent.trim()
          });
        }
      });
      return arr;
    }

    function saveBudget() {
      const suc = selSucursal.value;
      let num = (numInput.value || "").trim();

      if (!suc) { toast("Seleccioná una sucursal", "error"); return; }
      if (itemsBody.children.length === 0) { toast("Agregá al menos un ítem", "error"); return; }

      // Si es NUEVO, asignamos número real ahora (derivado de budgets_list)
      if (!isEditing) {
        const next = maxSeqForBranch(suc) + 1;
        num = formatBudgetNumber(suc, next);
        numInput.value = num; // reflejar en UI
      }

      const clientData = {
        idCliente: selectedClientId,
        nombre: nombre.value,
        telefono: telefono.value,
        vehiculo: vehiculo.value,
        patente: patente.value,
        modelo: modelo.value,
        compania: compania.value,
        chasis: chasis.value,
        idVehiculo: selectedVehicleId
      };

      const items = collectItems();
      const sucName = (CFG_BRANCHES.find(b=>b.id===suc)?.name) || "";

      const data = {
        numero: num,
        sucursal: suc,
        sucursalNombre: sucName,
        fecha: dateInput.value || todayISO(),
        cliente: clientData,
        items,
        subtotal: subtotalEl.textContent,
        total: totalEl.textContent,
        fechaCreacion: new Date().toISOString()
      };

      const key = isEditing ? currentBudgetKey : `budget_${sanitizeKey(num)}`;
      localStorage.setItem(key, JSON.stringify(data));

      // Índice budgets_list
      const list = JSON.parse(localStorage.getItem("budgets_list") || "[]");
      const summary = {
        numero: num,
        sucursal: suc,
        sucursalNombre: sucName,
        fecha: data.fecha,
        cliente: clientData.nombre || "Sin nombre",
        total: totalEl.textContent,
        key
      };

      const idx = list.findIndex(b => b.key === key);
      if (idx >= 0) list[idx] = summary; else list.push(summary);
      localStorage.setItem("budgets_list", JSON.stringify(list));

      toast(`Presupuesto ${num} ${isEditing ? "actualizado" : "guardado"} ✅`, "success");
      if (!isEditing) {
        // Actualizar vista previa del próximo número
        numInput.value = previewNextNumber(suc);
      }
    }
    saveBtn.addEventListener("click", saveBudget);

    // === PDF integrado
    function collectBudgetDataForPdf() {
      const sucId = selSucursal.value;
      const suc = (CFG_BRANCHES.find(b => b.id === sucId)?.name) || "";
      const items = collectItemsForPdf();
      const subtotalNum = items.reduce((s, i) => s + (i.total || 0), 0);
      const signature = localStorage.getItem("digital_signature") || null;

      const company = {
        companyName: CFG_SETTINGS?.companyName || "",
        brandName:   CFG_SETTINGS?.brandName   || "",
        address:     CFG_SETTINGS?.address     || "",
        phone:       CFG_SETTINGS?.phone       || "",
        email:       CFG_SETTINGS?.email       || ""
      };

      return {
        numero: numInput.value || "",
        fecha: dateInput.value || todayISO(),
        sucursalId: sucId,
        sucursalNombre: suc,
        cliente: {
          id: selectedClientId,
          nombre: nombre.value || "",
          telefono: telefono.value || "",
          vehiculo: vehiculo.value || "",
          patente: patente.value || "",
          modelo: modelo.value || "",
          compania: compania.value || "",
          chasis: chasis.value || "",
          idVehiculo: selectedVehicleId
        },
        items,
        subtotal: subtotalNum,
        total: subtotalNum,
        subtotalStr: money(subtotalNum),
        totalStr: money(subtotalNum),
        firmaDataUrl: signature,
        company
      };
    }

    pdfBtn.addEventListener("click", async () => {
      const data = collectBudgetDataForPdf();
      try {
        await ensurePdfLoaded();
        const pdf = await generateBudgetPDF(data);
        const cleanNum = (data.numero || "SIN").replace(/[^\w\d]/g, "-");
        pdf.save(`Presupuesto-${cleanNum}.pdf`);
      } catch (e) {
        console.error("PDF error:", e);
        window.print();
      }
    });

    // === Cargar presupuesto para editar (si venís desde "Presupuestos")
    (function loadEditIfAny(){
      const editKey = sessionStorage.getItem("editBudgetKey");
      if (!editKey) return;

      sessionStorage.removeItem("editBudgetKey");
      const b = JSON.parse(localStorage.getItem(editKey) || "null");
      if (!b) { toast("No se encontró el presupuesto para editar", "error"); return; }

      isEditing = true;
      currentBudgetKey = editKey;

      // Sucursal y número (conservar número original)
      if (b.sucursal) selSucursal.value = b.sucursal;
      // refrescar opciones por si no existen aún
      paintBranchesIntoSelect(b.sucursal);
      numInput.value = b.numero || (selSucursal.value ? previewNextNumber(selSucursal.value) : "");
      dateInput.value = (b.fecha || todayISO());

      // Cliente / vehículo
      selectedClientId  = b.cliente?.idCliente || null;
      selectedVehicleId = b.cliente?.idVehiculo || null;

      nombre.value   = b.cliente?.nombre   || "";
      telefono.value = b.cliente?.telefono || "";
      vehiculo.value = b.cliente?.vehiculo || "";
      patente.value  = b.cliente?.patente  || "";
      modelo.value   = b.cliente?.modelo   || "";
      compania.value = b.cliente?.compania || "";
      chasis.value   = b.cliente?.chasis   || "";

      // Ítems
      itemsBody.innerHTML = "";
      (b.items || []).forEach(it => {
        const cantidad = parseFloat(String(it.cantidad || "1").replace(",", ".")) || 1;
        const unit = typeof it.unit === "number"
          ? it.unit
          : parseFloat(String(it.precio ?? it.unit ?? "0").replace(/[^\d.,-]/g,"").replace(/\./g,"").replace(",", "."));
        const total = typeof it.total === "number"
          ? it.total
          : parseFloat(String(it.total || "0").replace(/[^\d.,-]/g,"").replace(/\./g,"").replace(",", ".")); 
        appendRow({
          cantidad,
          descripcion: it.descripcion || "-",
          unit: isNaN(unit) ? 0 : unit,
          total: isNaN(total) ? cantidad * (isNaN(unit)?0:unit) : total
        });
      });

      updateTotals();
      toast(`Editando ${b.numero}`, "info");
    })();
  }
};
