import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import Modal from "../components/Modal.jsx";
import Snackbar from "../components/Snackbar.jsx";
import {
  getCurrentRole,
  hasPermission,
  PERMISSIONS,
  getCurrentUser,
  ROLES,
} from "../utils/roles.js";
import {
  fetchAllConsignees,
  fetchAllLocations,
  fetchAllPallets,
  fetchAllResponsables,
  fetchAllShips,
  fetchAllUsers,
  deleteLoadById,
  fetchLoadById,
  createLoadReport,
  createPallet,
  fusePallets,
  updateLoadById,
  logInteraction,
  fetchLatestLoadReportByLoadId,
} from "../firebase/auth.js";

const ESTADO_VIAJE_OPTIONS = [
  "Preparando",
  "Cargando",
  "Viajando",
  "Entregado",
  "Cancelado",
];
const CARGA_OPTIONS = [
  "Seco",
  "Refrigerado",
  "Congelado",
  "Técnico",
  "Fruta y verdura",
  "Repuestos",
];
const ENTREGA_OPTIONS = ["Provisión", "Repuesto", "Técnico"];

function getTipoColors(tipo) {
  const t = String(tipo || "")
    .trim()
    .toLowerCase();
  if (t === "seco") return { color: "#f59e0b", strong: "#b45309" };
  if (t === "refrigerado") return { color: "#22c55e", strong: "#15803d" };
  if (t === "congelado") return { color: "#3b82f6", strong: "#1d4ed8" };
  if (t === "técnico" || t === "tecnico")
    return { color: "#a78bfa", strong: "#6d28d9" };
  if (t === "fruta y verdura") return { color: "#14b8a6", strong: "#0f766e" };
  if (t === "repuestos") return { color: "#ef4444", strong: "#991b1b" };
  return { color: "#9ca3af", strong: "#374151" };
}

function getTipoLabel(tipo) {
  const t = String(tipo || "")
    .trim()
    .toLowerCase();
  if (t === "seco") return "Seco";
  if (t === "refrigerado") return "Refr.";
  if (t === "congelado") return "Cong.";
  if (t === "técnico" || t === "tecnico") return "Tec";
  if (t === "fruta y verdura") return "Fr";
  if (t === "repuestos" || t === "repuesto") return "Rep";
  return t ? t[0].toUpperCase() : "";
}

function toDateInput(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatDateLabel(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildHojaCargaPageHtml({
  cliente,
  fechaPrevistaEntrega,
  numeros,
  logoUrl,
  poweredLogoUrl,
}) {
  const cols = [
    "Nº PALET",
    "SECO-REFRIGERADO-CONGELADO-REPUESTOS-TÉCNICO",
    "QUIEN COGE EL NÚMERO",
    "Nº DE CAMIÓN",
  ];
  const nums = Array.isArray(numeros)
    ? numeros
        .map((n) => String(n ?? "").trim())
        .filter((n) => n !== "")
        .slice(0, 30)
    : [];
  const buildRows = () => {
    const rows = [];
    for (let i = 0; i < 30; i += 1) {
      const n = nums[i] ?? "";
      rows.push(`
        <tr>
          <td class="c-num">${escapeHtml(n)}</td>
          <td class="c-tipo"></td>
          <td class="c-quien"></td>
          <td class="c-camion"></td>
        </tr>
      `);
    }
    return rows.join("");
  };
  const ths = cols.map((c) => `<th>${escapeHtml(c)}</th>`).join("");
  return `
    <div class="page sheet-page">
      <div class="sheet-top">
        <div></div>
        <div class="sheet-title">HOJA DE CARGA</div>
      </div>
      <div class="sheet-head">
        <div class="sheet-meta">
          <div class="meta-row">
            <span class="meta-label">CLIENTE:</span>
            <span class="meta-value">${escapeHtml(cliente || "-")}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">FECHA PREVISTA DE ENTREGA:</span>
            <span class="meta-value">${escapeHtml(fechaPrevistaEntrega || "-")}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">CARGADOR FINAL:</span>
            <span class="meta-value"></span>
          </div>
          <div class="meta-row">
            <span class="meta-label">FECHA DE CARGA FINAL:</span>
            <span class="meta-value"></span>
          </div>
        </div>
        ${
          String(logoUrl || "").trim()
            ? `<img class="sheet-logo" src="${escapeHtml(
                String(logoUrl || "").trim(),
              )}" alt="" />`
            : ""
        }
      </div>

      <table class="sheet-table" aria-label="Tabla palets 1-30">
        <thead><tr>${ths}</tr></thead>
        <tbody>${buildRows()}</tbody>
      </table>

      <div class="sheet-footer">
        <div class="footer-title">PALETS QUE SE REMONTAN:</div>
        <div class="footer-lines">
          <div class="line"></div>
          <div class="line"></div>
          <div class="line"></div>
        </div>
      </div>
      ${
        String(poweredLogoUrl || "").trim()
          ? `<div class="powered-by">
              <span>Powered by</span>
              <img src="${escapeHtml(
                String(poweredLogoUrl || "").trim(),
              )}" alt="" />
            </div>`
          : ""
      }
    </div>
  `;
}

function buildFoliosHtml({
  shipName,
  dateLabel,
  portLabel,
  numbersFrom,
  numbersTo,
  hojaFrom,
  hojaTo,
  includeHojaCarga,
  includeNumbers,
  logoUrl,
  poweredLogoUrl,
}) {
  const pages = [];
  if (includeHojaCarga) {
    const chunkSize = 30;
    for (let start = hojaFrom; start <= hojaTo; start += chunkSize) {
      const end = Math.min(hojaTo, start + chunkSize - 1);
      const nums = [];
      for (let n = start; n <= end; n += 1) nums.push(String(n));
      pages.push(
        buildHojaCargaPageHtml({
          cliente: shipName,
          fechaPrevistaEntrega: dateLabel,
          numeros: nums,
          logoUrl,
          poweredLogoUrl,
        }),
      );
    }
  }
  if (includeNumbers) {
    for (let n = numbersFrom; n <= numbersTo; n += 1) {
      const rawNumber = String(n);
      const trimmedNumber = rawNumber.trim();
      const big = escapeHtml(trimmedNumber);
      const digits = trimmedNumber.length;
      const bigClass =
        digits >= 3 ? "big big-3" : digits === 2 ? "big big-2" : "big big-1";
      pages.push(`
        <div class="page numero-page">
          <div class="top">
            <div class="small-circle">${big}</div>
            ${
              String(logoUrl || "").trim()
                ? `<img class="top-logo" src="${escapeHtml(
                    String(logoUrl || "").trim(),
                  )}" alt="" />`
                : ""
            }
          </div>
          <div class="ship">${escapeHtml(shipName || "")}</div>
          <div class="big-area">
            <div class="${bigClass}">${big}</div>
          </div>
          <div class="bottom">
            <div class="row">
              <span class="label">FECHA PREVISTA DE CARGA:</span>
              <span class="value">${escapeHtml(dateLabel || "-")}</span>
            </div>
            <div class="row">
              <span class="label">PUERTO:</span>
              <span class="value">${escapeHtml(portLabel || "-")}</span>
            </div>
          </div>
          ${
            String(poweredLogoUrl || "").trim()
              ? `<div class="powered-by">
                  <span>Powered by</span>
                  <img src="${escapeHtml(
                    String(poweredLogoUrl || "").trim(),
                  )}" alt="" />
                </div>`
              : ""
          }
        </div>
      `);
    }
  }
  return `<!doctype html>
  <html lang="es">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Números</title>
      <style>
        @page { size: A4 portrait; margin: 0; }
        * { box-sizing: border-box; }
        body { margin: 0; background: #e5e7eb; font-family: Arial, Helvetica, sans-serif; }
        .wrap { display: grid; gap: 16px; padding: 16px; }
        .page {
          width: 210mm;
          height: 297mm;
          background: white;
          margin: 0 auto;
          border: 1px solid #d1d5db;
          position: relative;
          padding: 22mm 18mm 18mm;
          overflow: hidden;
        }
        .sheet-page {
          padding: 16mm 18mm 14mm;
        }
        .sheet-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 4mm;
        }
        .sheet-title {
          font-weight: 700;
          font-size: 20px;
          letter-spacing: 0.5px;
          color: #111827;
          text-transform: uppercase;
        }
        .sheet-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10mm;
          margin-bottom: 4mm;
        }
        .sheet-meta {
          display: grid;
          gap: 3px;
          font-size: 11px;
          color: #111827;
          margin-bottom: 0;
        }
        .sheet-logo {
          height: calc(18mm - 10px);
          width: auto;
          max-width: 80mm;
          object-fit: contain;
        }
        .meta-row { display: flex; gap: 8px; }
        .meta-label { font-weight: 700; white-space: nowrap; }
        .meta-value { font-weight: 700; }
        .sheet-table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
          font-size: 10px;
          color: #111827;
        }
        .sheet-table th,
        .sheet-table td {
          border: 1px solid #111827;
          padding: 2px 4px;
        }
        .sheet-table th {
          text-align: center;
          font-weight: 700;
          font-size: 9px;
          line-height: 1.15;
        }
        .sheet-table td {
          height: 24px;
          vertical-align: middle;
        }
        .c-num { width: 12%; text-align: center; font-weight: 700; }
        .c-tipo { width: 44%; }
        .c-quien { width: 28%; }
        .c-camion { width: 16%; }
        .sheet-footer {
          margin-top: 4mm;
          display: grid;
          gap: 6px;
          padding-bottom: 14mm;
        }
        .footer-title { font-weight: 700; font-size: 11px; }
        .footer-lines {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 10mm;
        }
        .footer-lines .line {
          border-bottom: 1px solid #111827;
          height: 14px;
        }
        .top {
          position: static;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
        }
        .numero-page {
          padding: 14mm 18mm 18mm;
          display: grid;
          grid-template-rows: 34mm 52mm 1fr auto;
          align-content: stretch;
        }
        .top-logo {
          height: calc(24mm - 10px);
          width: auto;
          max-width: 80mm;
          object-fit: contain;
        }
        .powered-by {
          position: absolute;
          right: 18mm;
          bottom: 8mm;
          display: flex;
          align-items: flex-end;
          gap: 6px;
          font-size: 11px;
          color: #6b7280;
          background: rgba(255,255,255,0.75);
          padding: 4px 8px;
          border-radius: 10px;
        }
        .powered-by span {
          display: inline-block;
          line-height: 1;
          padding-bottom: 1mm;
          white-space: nowrap;
        }
        .powered-by img {
          height: 10mm;
          width: auto;
          object-fit: contain;
        }
        .brand {
          font-weight: 800;
          font-size: 24px;
          letter-spacing: 0.5px;
          color: #111827;
          opacity: 0.75;
          text-transform: lowercase;
        }
        .small-circle {
          width: 108px;
          height: 108px;
          border: 5px solid #111827;
          border-radius: 999px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 54px;
        }
        .ship {
          margin-top: 0;
          text-align: center;
          font-size: 72px;
          font-weight: 500;
          letter-spacing: 2px;
          color: #111827;
          text-transform: uppercase;
          line-height: 1.05;
          padding: 0 8mm;
          word-break: break-word;
          z-index: 3;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .big-area {
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }
        .big {
          margin-top: 0;
          text-align: center;
          font-weight: 800;
          color: #111827;
          line-height: 1;
          z-index: 1;
        }
        .big-1 { font-size: 155mm; }
        .big-2 { font-size: 130mm; }
        .big-3 { font-size: 110mm; }
        .bottom {
          border-top: 2px dashed #9ca3af;
          padding-top: 10mm;
          display: grid;
          gap: 8px;
          font-size: 24px;
          letter-spacing: 0.5px;
          color: #111827;
          z-index: 3;
          margin-bottom: 18mm;
        }
        .row {
          display: flex;
          justify-content: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .label { font-weight: 500; }
        .value { font-weight: 800; }

        @media print {
          html, body { background: white; margin: 0; padding: 0; }
          .wrap { padding: 0; gap: 0; }
          .page { margin: 0; border: none; page-break-after: always; }
        }
      </style>
    </head>
    <body>
      <div class="wrap">
        ${pages.join("")}
      </div>
    </body>
  </html>`;
}

function buildInformeCargaHtml({
  loadNombre,
  finishedLabel,
  cargadoPorLabel,
  choferName,
  consignatarioName,
  notas,
  palletsRows,
}) {
  return `<!doctype html>
  <html lang="es">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Informe de carga</title>
      <style>
        :root {
          --border: #e5e7eb;
          --text: #111827;
          --muted: #6b7280;
          --bg: #ffffff;
        }
        body {
          margin: 0;
          font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto,
            Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji";
          color: var(--text);
          background: var(--bg);
        }
        .wrap {
          padding: 24px;
          max-width: 980px;
          margin: 0 auto;
          display: grid;
          gap: 14px;
        }
        .header {
          display: grid;
          gap: 6px;
        }
        .title {
          font-size: 18px;
          font-weight: 900;
        }
        .subtitle {
          font-size: 13px;
          color: var(--muted);
        }
        .grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px 14px;
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 12px 14px;
        }
        .label {
          font-size: 12px;
          color: var(--muted);
          margin-bottom: 4px;
        }
        .value {
          font-weight: 700;
        }
        .notes {
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 12px 14px;
          display: grid;
          gap: 6px;
        }
        .notes .text {
          white-space: pre-wrap;
          line-height: 1.35;
          font-size: 13px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          border: 1px solid var(--border);
          border-radius: 12px;
          overflow: hidden;
        }
        th,
        td {
          padding: 10px 10px;
          border-bottom: 1px solid var(--border);
          font-size: 13px;
          vertical-align: top;
        }
        th {
          text-align: left;
          background: #f9fafb;
          font-weight: 800;
        }
        tr:last-child td {
          border-bottom: none;
        }
        .muted {
          color: var(--muted);
          font-weight: 600;
        }
        @media print {
          body { background: white; }
          .wrap { padding: 0; max-width: none; }
        }
      </style>
    </head>
    <body>
      <div class="wrap">
        <div class="header">
          <div class="title">INFORME DE CARGA</div>
          <div class="subtitle">${escapeHtml(loadNombre || "-")}</div>
          <div class="subtitle">Finalizado: ${escapeHtml(finishedLabel || "-")}</div>
        </div>

        <div class="grid">
          <div>
            <div class="label">Cargado por</div>
            <div class="value">${escapeHtml(cargadoPorLabel || "-")}</div>
          </div>
          <div>
            <div class="label">Chofer</div>
            <div class="value">${escapeHtml(choferName || "-")}</div>
          </div>
          <div>
            <div class="label">Consignatario</div>
            <div class="value">${escapeHtml(consignatarioName || "-")}</div>
          </div>
          <div>
            <div class="label">Palets</div>
            <div class="value">${escapeHtml(String(palletsRows.length))}</div>
          </div>
        </div>

        <div class="notes">
          <div class="label">Notas</div>
          <div class="text">${escapeHtml(String(notas || "").trim() || "-")}</div>
        </div>

        <table aria-label="Palets del informe">
          <thead>
            <tr>
              <th style="width: 120px;">Nº palet</th>
              <th style="width: 140px;">Tipo</th>
              <th style="width: 120px;">Base</th>
              <th>Productos</th>
            </tr>
          </thead>
          <tbody>
            ${palletsRows
              .map(
                (r) => `
              <tr>
                <td><span class="value">${escapeHtml(r.numero_palet || "-")}</span></td>
                <td>${escapeHtml(r.tipo || "-")}</td>
                <td>${escapeHtml(r.base || "-")}</td>
                <td class="muted">${escapeHtml(r.productos || "-")}</td>
              </tr>
            `,
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </body>
  </html>`;
}

function parseNumeroPaletsInput(value) {
  const raw = String(value || "");
  const tokens = raw
    .split(/[\s,;]+/)
    .map((t) => t.trim())
    .filter(Boolean);
  const out = [];
  for (const tok of tokens) {
    const match = tok.match(/^(\d+)\s*[-–]\s*(\d+)$/);
    if (match) {
      const a = Number(match[1]);
      const b = Number(match[2]);
      if (Number.isFinite(a) && Number.isFinite(b)) {
        const start = Math.min(a, b);
        const end = Math.max(a, b);
        if (end - start <= 500) {
          for (let n = start; n <= end; n += 1) out.push(String(n));
          continue;
        }
      }
    }
    out.push(tok);
  }
  return Array.from(new Set(out));
}

export default function LoadDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [load, setLoad] = useState(null);
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [ships, setShips] = useState([]);
  const [pallets, setPallets] = useState([]);
  const [users, setUsers] = useState([]);
  const [responsables, setResponsables] = useState([]);
  const [consignees, setConsignees] = useState([]);
  const [locations, setLocations] = useState([]);
  const [responsableQuery, setResponsableQuery] = useState("");
  const [form, setForm] = useState({
    barco: "",
    entrega: [],
    chofer: "",
    responsable: "",
    consignatario: "",
    terminal_entrega: "",
    palets: [],
    carga: [],
    fecha_de_carga: "",
    hora_de_carga: "",
    fecha_de_descarga: "",
    hora_de_descarga: "",
    cash: false,
    lancha: false,
    estado_viaje: "Preparando",
  });
  const [snack, setSnack] = useState({
    open: false,
    message: "",
    type: "success",
  });
  const [openFuse, setOpenFuse] = useState(false);
  const [fuseMode, setFuseMode] = useState("seleccion");
  const [fuseTargetId, setFuseTargetId] = useState("");
  const [fuseSourceIds, setFuseSourceIds] = useState([]);
  const [fuseNumbers, setFuseNumbers] = useState("");
  const [fuseSubmitting, setFuseSubmitting] = useState(false);
  const [fuseBaseChoice, setFuseBaseChoice] = useState("");
  const [openCreatePallet, setOpenCreatePallet] = useState(false);
  const [createPalletForm, setCreatePalletForm] = useState({
    numero_palet: "",
    tipo: "Seco",
    base: "Europeo",
    productos: "",
  });
  const [dragPalletId, setDragPalletId] = useState("");
  const [dragPalletTipo, setDragPalletTipo] = useState("");
  const [dragOverPalletId, setDragOverPalletId] = useState("");
  const [openFuseDnD, setOpenFuseDnD] = useState(false);
  const [fuseDnDSourceId, setFuseDnDSourceId] = useState("");
  const [fuseDnDTargetId, setFuseDnDTargetId] = useState("");
  const [fuseDnDBaseChoice, setFuseDnDBaseChoice] = useState("");
  const lastTapRef = useRef({ id: "", at: 0 });
  const isTouchMode = useMemo(() => {
    try {
      const coarse =
        typeof window !== "undefined" &&
        typeof window.matchMedia === "function" &&
        window.matchMedia("(pointer: coarse)").matches;
      const noHover =
        typeof window !== "undefined" &&
        typeof window.matchMedia === "function" &&
        window.matchMedia("(hover: none)").matches;
      const touchPoints =
        typeof navigator !== "undefined" &&
        Number(navigator.maxTouchPoints) > 0;
      return (
        (coarse && noHover) ||
        (touchPoints && noHover) ||
        (coarse && touchPoints)
      );
    } catch {
      return false;
    }
  }, []);
  const [openFolio, setOpenFolio] = useState(false);
  const [folioFrom, setFolioFrom] = useState(1);
  const [folioTo, setFolioTo] = useState(10);
  const [folioSheetFrom, setFolioSheetFrom] = useState(1);
  const [folioSheetTo, setFolioSheetTo] = useState(30);
  const [folioStep, setFolioStep] = useState("config");
  const [folioIncludeLoadSheet, setFolioIncludeLoadSheet] = useState(false);
  const [folioIncludeNumbers, setFolioIncludeNumbers] = useState(true);
  const [openLoadReport, setOpenLoadReport] = useState(false);
  const [loadReportLoading, setLoadReportLoading] = useState(false);
  const [loadReport, setLoadReport] = useState(null);
  const [loadReportExists, setLoadReportExists] = useState(false);
  const [markViajandoSubmitting, setMarkViajandoSubmitting] = useState(false);
  const [finalizeSubmitting, setFinalizeSubmitting] = useState(false);
  const [openDriverFinalize, setOpenDriverFinalize] = useState(false);

  const currentUser = getCurrentUser();
  const currentUserId = String(
    currentUser?._id || currentUser?.id || "",
  ).trim();
  const role = getCurrentRole() || currentUser?.role || null;
  const roleNormalized = String(role || "")
    .trim()
    .toLowerCase();
  const isOffice = roleNormalized === ROLES.OFICINA;
  const isDriver = roleNormalized === ROLES.CONDUCTOR;
  const isReadOnlyActions = isOffice || isDriver;

  // Carga detalle y precarga formulario
  useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        const l = await fetchLoadById(id);
        if (!mounted) return;
        setLoad(l);
        if (!l) return;
        setForm({
          barco: String(l.barco?._id || l.barco || ""),
          entrega: Array.isArray(l.entrega) ? l.entrega : [],
          chofer: String(l.chofer?._id || l.chofer || ""),
          responsable: String(l.responsable?._id || l.responsable || ""),
          consignatario: String(l.consignatario?._id || l.consignatario || ""),
          terminal_entrega: String(
            l.terminal_entrega?._id || l.terminal_entrega || "",
          ),
          palets: Array.isArray(l.palets) ? l.palets.map((p) => String(p)) : [],
          carga: Array.isArray(l.carga) ? l.carga : [],
          fecha_de_carga: toDateInput(l.fecha_de_carga),
          hora_de_carga: l.hora_de_carga || "",
          fecha_de_descarga: toDateInput(l.fecha_de_descarga),
          hora_de_descarga: l.hora_de_descarga || "",
          cash: !!l.cash,
          lancha: !!l.lancha,
          estado_viaje: l.estado_viaje || "Preparando",
        });
      } catch {
        if (!mounted) return;
        setLoad(null);
      }
    };
    run();
    return () => {
      mounted = false;
    };
  }, [id]);

  // Datos auxiliares para selects
  useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        const results = await Promise.allSettled([
          fetchAllShips(),
          fetchAllPallets(),
          fetchAllUsers(),
          fetchAllConsignees(),
          fetchAllLocations(),
          fetchAllResponsables(),
        ]);
        const values = results.map((r) =>
          r.status === "fulfilled" && Array.isArray(r.value) ? r.value : [],
        );
        const [
          shipsList,
          palletsList,
          usersList,
          consigneesList,
          locationsList,
          responsablesList,
        ] = values;
        if (!mounted) return;
        const normalize = (x) => ({
          ...x,
          _id: x?._id || x?.id,
          id: x?.id || x?._id,
        });
        setShips(shipsList.map(normalize));
        setPallets(palletsList.map(normalize));
        setUsers(usersList.map(normalize));
        setConsignees(consigneesList.map(normalize));
        setLocations(locationsList.map(normalize));
        setResponsables(responsablesList.map(normalize));
      } catch {
        if (!mounted) return;
        setShips([]);
        setPallets([]);
        setUsers([]);
        setConsignees([]);
        setLocations([]);
        setResponsables([]);
      }
    };
    run();
    return () => {
      mounted = false;
    };
  }, []);
  const canManageLoads =
    !isReadOnlyActions &&
    (hasPermission(role, PERMISSIONS.MANAGE_LOADS) ||
      String(role || "")
        .trim()
        .toLowerCase() === "dispatcher");
  const canManagePallets =
    !isReadOnlyActions &&
    (hasPermission(role, PERMISSIONS.MANAGE_PALLETS) ||
      canManageLoads ||
      String(role || "")
        .trim()
        .toLowerCase() === "dispatcher");
  const canDeleteLoad =
    !isReadOnlyActions &&
    (String(role || "")
      .trim()
      .toLowerCase() === ROLES.LOGISTICA ||
      String(role || "")
        .trim()
        .toLowerCase() === ROLES.ADMIN);

  const folioMeta = useMemo(() => {
    if (!load) return { shipName: "", dateLabel: "-", portLabel: "-" };
    const barcoId = String(load?.barco?._id || load?.barco || "");
    const terminalEntregaId = String(
      load?.terminal_entrega?._id || load?.terminal_entrega || "",
    );
    const ship =
      ships.find((s) => String(s?._id || s?.id || "") === barcoId) ||
      (load?.barco && typeof load.barco === "object" ? load.barco : null);
    const terminal =
      locations.find(
        (l) => String(l?._id || l?.id || "") === terminalEntregaId,
      ) ||
      (load?.terminal_entrega && typeof load.terminal_entrega === "object"
        ? load.terminal_entrega
        : null);
    const shipName = String(ship?.nombre_del_barco || "").trim();
    const dateLabel = formatDateLabel(load?.fecha_de_carga);
    const puerto = String(terminal?.puerto || "").trim();
    const nombre = String(terminal?.nombre || "").trim();
    const portLabelRaw =
      puerto && nombre && puerto.toLowerCase() !== nombre.toLowerCase()
        ? `${puerto} - ${nombre}`
        : puerto || nombre || "-";
    const portLabel = portLabelRaw.toUpperCase();
    return { shipName, dateLabel, portLabel };
  }, [load, ships, locations]);

  const folioHtml = useMemo(() => {
    if (!openFolio || folioStep !== "preview") return "";
    const numFrom = Number(folioFrom);
    const numTo = Number(folioTo);
    if (folioIncludeNumbers) {
      if (!Number.isFinite(numFrom) || !Number.isFinite(numTo)) return "";
    }
    const aNum = Math.min(numFrom, numTo);
    const bNum = Math.max(numFrom, numTo);
    if (folioIncludeNumbers && bNum - aNum > 500) return "";

    const sheetFrom = Number(folioSheetFrom);
    const sheetTo = Number(folioSheetTo);
    if (folioIncludeLoadSheet) {
      if (!Number.isFinite(sheetFrom) || !Number.isFinite(sheetTo)) return "";
    }
    const aSheet = Math.min(sheetFrom, sheetTo);
    const bSheet = Math.max(sheetFrom, sheetTo);
    if (folioIncludeLoadSheet && bSheet - aSheet > 500) return "";
    const logoUrl = (() => {
      try {
        if (typeof window === "undefined") return "";
        return new URL(
          "/logo-eis-maritimo.png",
          window.location.origin,
        ).toString();
      } catch {
        return "";
      }
    })();
    const poweredLogoUrl = (() => {
      try {
        if (typeof window === "undefined") return "";
        return new URL("/logo.png", window.location.origin).toString();
      } catch {
        return "";
      }
    })();
    return buildFoliosHtml({
      shipName: folioMeta.shipName,
      dateLabel: folioMeta.dateLabel,
      portLabel: folioMeta.portLabel,
      numbersFrom: folioIncludeNumbers ? aNum : 1,
      numbersTo: folioIncludeNumbers ? bNum : 1,
      hojaFrom: folioIncludeLoadSheet ? aSheet : 1,
      hojaTo: folioIncludeLoadSheet ? bSheet : 1,
      includeHojaCarga: folioIncludeLoadSheet,
      includeNumbers: folioIncludeNumbers,
      logoUrl,
      poweredLogoUrl,
    });
  }, [
    openFolio,
    folioStep,
    folioFrom,
    folioTo,
    folioSheetFrom,
    folioSheetTo,
    folioMeta,
    folioIncludeLoadSheet,
    folioIncludeNumbers,
  ]);

  const openFolioModal = () => {
    if (!canManageLoads) {
      setSnack({
        open: true,
        message: "No tienes permiso para imprimir números",
        type: "error",
      });
      return;
    }
    setFolioFrom(1);
    setFolioTo(10);
    setFolioSheetFrom(1);
    setFolioSheetTo(30);
    setFolioStep("config");
    setFolioIncludeLoadSheet(false);
    setFolioIncludeNumbers(true);
    setOpenFolio(true);
  };

  const closeFolioModal = () => {
    setOpenFolio(false);
    setFolioStep("config");
  };

  const goFolioPreview = () => {
    if (!folioIncludeNumbers && !folioIncludeLoadSheet) {
      setSnack({
        open: true,
        message: "Selecciona al menos una opción de impresión",
        type: "error",
      });
      return;
    }
    const from = Number(folioFrom);
    const to = Number(folioTo);
    const sheetFrom = Number(folioSheetFrom);
    const sheetTo = Number(folioSheetTo);

    if (folioIncludeNumbers) {
      if (!Number.isFinite(from) || !Number.isFinite(to)) {
        setSnack({ open: true, message: "Rango inválido", type: "error" });
        return;
      }
      const a = Math.min(from, to);
      const b = Math.max(from, to);
      if (a < 1 || b < 1) {
        setSnack({
          open: true,
          message: "Los números deben ser >= 1",
          type: "error",
        });
        return;
      }
      if (b - a > 500) {
        setSnack({
          open: true,
          message: "El rango es demasiado grande",
          type: "error",
        });
        return;
      }
      setFolioFrom(a);
      setFolioTo(b);
    }

    if (folioIncludeLoadSheet) {
      if (!Number.isFinite(sheetFrom) || !Number.isFinite(sheetTo)) {
        setSnack({
          open: true,
          message: "Rango de hoja de carga inválido",
          type: "error",
        });
        return;
      }
      const a = Math.min(sheetFrom, sheetTo);
      const b = Math.max(sheetFrom, sheetTo);
      if (a < 1 || b < 1) {
        setSnack({
          open: true,
          message: "El rango de hoja de carga debe ser >= 1",
          type: "error",
        });
        return;
      }
      if (b - a > 500) {
        setSnack({
          open: true,
          message: "El rango de hoja de carga es demasiado grande",
          type: "error",
        });
        return;
      }
      setFolioSheetFrom(a);
      setFolioSheetTo(b);
    }

    const actorUser = getCurrentUser();
    const actor =
      actorUser?.id || actorUser?._id
        ? {
            id: actorUser?.id || actorUser?._id,
            name: actorUser?.name || "",
            email: actorUser?.email || "",
            role: actorUser?.role || "",
          }
        : undefined;
    logInteraction({
      type: "numeros_previewed",
      actor,
      target: {
        id: String(load?._id || load?.id || id || ""),
        name: String(load?.nombre || folioMeta.shipName || ""),
      },
      details: {
        numbersFrom: folioIncludeNumbers ? Math.min(from, to) : null,
        numbersTo: folioIncludeNumbers ? Math.max(from, to) : null,
        hojaFrom: folioIncludeLoadSheet ? Math.min(sheetFrom, sheetTo) : null,
        hojaTo: folioIncludeLoadSheet ? Math.max(sheetFrom, sheetTo) : null,
        includeHojaCarga: !!folioIncludeLoadSheet,
        includeNumbers: !!folioIncludeNumbers,
        shipName: String(folioMeta.shipName || ""),
        dateLabel: String(folioMeta.dateLabel || ""),
        portLabel: String(folioMeta.portLabel || ""),
      },
    }).catch(() => {});
    setFolioStep("preview");
  };

  const printFolios = () => {
    const html = folioHtml;
    if (!html) {
      setSnack({
        open: true,
        message: "No hay previsualización disponible",
        type: "error",
      });
      return;
    }
    const w = window.open("", "_blank");
    if (!w) {
      setSnack({
        open: true,
        message: "El navegador bloqueó la ventana emergente para imprimir",
        type: "error",
      });
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
    setTimeout(() => {
      try {
        w.focus();
        w.print();
      } catch (e) {
        setSnack({
          open: true,
          message: String(e?.message || "") || "Error imprimiendo números",
          type: "error",
        });
      }
    }, 100);
  };

  const handleDelete = async () => {
    if (deleting) return;
    if (!load) return;
    const label = String(load.nombre || "").trim();
    if (
      !window.confirm(
        `¿Seguro que deseas borrar la carga "${label || String(id || "")}"?`,
      )
    )
      return;
    const confirmText = window.prompt(
      'Escribe "BORRAR" para confirmar el borrado definitivo:',
      "",
    );
    if (
      String(confirmText || "")
        .trim()
        .toLowerCase() !== "borrar"
    )
      return;
    try {
      setDeleting(true);
      await deleteLoadById(String(load?._id || load?.id || id));
      navigate("/app/logistica/cargas");
    } catch (e) {
      const msg = String(e?.message || "");
      setSnack({
        open: true,
        message: msg || "Error borrando carga",
        type: "error",
      });
    } finally {
      setDeleting(false);
    }
  };

  const submit = async () => {
    try {
      const payload = {
        barco: form.barco || undefined,
        entrega: form.entrega,
        chofer: form.chofer || undefined,
        responsable: form.responsable || undefined,
        palets: form.palets,
        carga: form.carga,
        consignatario: form.consignatario || undefined,
        terminal_entrega: form.terminal_entrega || undefined,
        fecha_de_carga: form.fecha_de_carga || undefined,
        hora_de_carga: form.hora_de_carga || undefined,
        fecha_de_descarga: form.fecha_de_descarga || undefined,
        hora_de_descarga: form.hora_de_descarga || undefined,
        cash: !!form.cash,
        lancha: !!form.lancha,
        estado_viaje: form.estado_viaje,
        modificado_por: getCurrentUser()?.name || "Testing",
      };
      const updated = await updateLoadById(id, payload);
      if (!updated) {
        setSnack({
          open: true,
          message: "Error actualizando carga",
          type: "error",
        });
        return;
      }
      setLoad(updated);
      setOpen(false);
      setSnack({ open: true, message: "Carga actualizada", type: "success" });
    } catch (e) {
      const msg = String(e?.message || "");
      setSnack({
        open: true,
        message: msg || "Error de red actualizando carga",
        type: "error",
      });
    }
  };

  const loadIdParam = String(id || "");
  useEffect(() => {
    let mounted = true;
    const run = async () => {
      if (!loadIdParam) return;
      if (load?.last_informe_resumen) {
        if (!mounted) return;
        setLoadReportExists(true);
        return;
      }
      const rep = await fetchLatestLoadReportByLoadId(loadIdParam, {
        loadNombre: load?.nombre || "",
      }).catch(() => null);
      if (!mounted) return;
      if (rep) {
        setLoadReportExists(true);
        setLoadReport(rep);
      } else {
        setLoadReportExists(false);
      }
    };
    run();
    return () => {
      mounted = false;
    };
  }, [loadIdParam, load?.last_informe_resumen, load?.nombre]);

  if (!load) return <p>Cargando...</p>;

  const loadId = String(load?._id || load?.id || id || "");

  const palletsInLoad = (() => {
    const byRelation = pallets.filter(
      (p) => String(p.carga?._id || p.carga) === String(loadId),
    );
    const byArrayIds = Array.isArray(load.palets)
      ? load.palets.map((p) => String(p?._id || p?.id || p)).filter(Boolean)
      : [];
    const byId = new Map(
      byRelation.map((p) => [String(p._id || p.id), p]).filter((p) => p[0]),
    );
    byArrayIds.forEach((pid) => {
      const found = pallets.find((p) => String(p._id || p.id) === String(pid));
      if (found) byId.set(String(found._id || found.id), found);
    });
    return Array.from(byId.values());
  })();

  const impliedHasLoadReport =
    palletsInLoad.some((p) => p?.estado === true) &&
    String(load?.estado_viaje || "")
      .trim()
      .toLowerCase() !== "preparando";
  const hasLoadReport =
    !!load?.last_informe_resumen || !!loadReportExists || impliedHasLoadReport;

  const formatMaybeDateTime = (value) => {
    if (!value) return "";
    let d = null;
    if (value && typeof value?.toDate === "function") d = value.toDate();
    else if (typeof value?.seconds === "number")
      d = new Date(value.seconds * 1000);
    else d = new Date(value);
    if (!d || Number.isNaN(d.getTime())) return "";
    return new Intl.DateTimeFormat("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  };

  const openLoadReportPreview = async () => {
    if (!hasLoadReport) return;
    if (!loadId) return;
    if (loadReportLoading) return;
    setOpenLoadReport(true);
    if (loadReport) return;
    try {
      setLoadReportLoading(true);
      const rep = await fetchLatestLoadReportByLoadId(loadId, {
        loadNombre: load?.nombre || "",
        palletIds: palletsInLoad.map((p) => String(p?._id || p?.id || "")),
      });
      setLoadReport(rep || null);
    } catch (e) {
      setLoadReport(null);
      const msg = String(e?.message || "").trim();
      setSnack({
        open: true,
        message: msg || "Error cargando el informe de carga",
        type: "error",
      });
    } finally {
      setLoadReportLoading(false);
    }
  };

  const generateLoadReport = async () => {
    if (!loadId) return;
    if (loadReportLoading) return;
    try {
      setLoadReportLoading(true);
      const existing = await fetchLatestLoadReportByLoadId(loadId, {
        loadNombre: load?.nombre || "",
        palletIds: palletsInLoad.map((p) => String(p?._id || p?.id || "")),
      }).catch(() => null);
      if (existing) {
        setLoadReport(existing);
        setLoadReportExists(true);
        return;
      }
      const palletIds = palletsInLoad
        .filter((p) => p?.estado === true)
        .map((p) => String(p?._id || p?.id || ""))
        .filter(Boolean);
      if (palletIds.length === 0) {
        setSnack({
          open: true,
          message: "No hay palets cargados para generar el informe",
          type: "error",
        });
        return;
      }
      const operator =
        currentUser &&
        (String(currentUser?._id || currentUser?.id || "").trim() ||
          String(currentUser?.name || "").trim())
          ? [
              {
                user_id: String(
                  currentUser?._id || currentUser?.id || "",
                ).trim(),
                name: String(currentUser?.name || "").trim(),
              },
            ]
          : [];
      await createLoadReport({
        load_id: loadId,
        load_nombre: String(load?.nombre || "").trim(),
        pallet_ids: palletIds,
        cargado_por: operator,
        cargado_a: {
          chofer_id: String(load?.chofer?._id || load?.chofer || "").trim(),
          chofer_name: String(
            choferObj?.name || choferObj?.nombre || "",
          ).trim(),
          consignatario_id: String(
            load?.consignatario?._id || load?.consignatario || "",
          ).trim(),
          consignatario_name: String(
            consignatarioObj?.nombre || consignatarioObj?.name || "",
          ).trim(),
        },
        notas: "",
        creado_por: String(currentUser?.name || "Sistema").trim(),
      });
      const rep = await fetchLatestLoadReportByLoadId(loadId, {
        loadNombre: load?.nombre || "",
        palletIds,
      }).catch(() => null);
      setLoadReport(rep || null);
      setLoadReportExists(!!rep);
      const updatedLoad = await fetchLoadById(loadId).catch(() => null);
      if (updatedLoad) setLoad(updatedLoad);
      setSnack({
        open: true,
        message: rep ? "Informe generado" : "Informe guardado",
        type: "success",
      });
    } catch (e) {
      const msg = String(e?.message || "").trim();
      setSnack({
        open: true,
        message: msg || "Error generando el informe de carga",
        type: "error",
      });
    } finally {
      setLoadReportLoading(false);
    }
  };

  const totalPallets = isDriver
    ? Array.isArray(load?.palets)
      ? load.palets.length
      : 0
    : palletsInLoad.length;
  const tipoCounts = palletsInLoad.reduce((acc, p) => {
    const t = p.tipo || "Sin tipo";
    acc[t] = (acc[t] || 0) + 1;
    return acc;
  }, {});
  const baseCounts = palletsInLoad.reduce(
    (acc, p) => {
      const b = String(p?.base || "")
        .trim()
        .toLowerCase();
      if (b === "europeo") acc.europeo += 1;
      if (b === "americano") acc.americano += 1;
      return acc;
    },
    { europeo: 0, americano: 0 },
  );

  const fuseTarget = palletsInLoad.find(
    (p) => String(p._id) === String(fuseTargetId),
  );
  const fuseOthers = palletsInLoad.filter(
    (p) => String(p._id) !== String(fuseTargetId),
  );
  const fuseParsedNumbers = parseNumeroPaletsInput(fuseNumbers);
  const fuseMatchedByNumbers = palletsInLoad.filter(
    (p) =>
      fuseParsedNumbers.includes(String(p.numero_palet)) &&
      String(p._id) !== String(fuseTargetId),
  );
  const fuseMissingNumbers = fuseParsedNumbers.filter(
    (n) =>
      !palletsInLoad.some(
        (p) =>
          String(p.numero_palet) === String(n) &&
          String(p._id) !== String(fuseTargetId),
      ),
  );

  const _openFuseModal = () => {
    if (palletsInLoad.length < 2) {
      setSnack({
        open: true,
        message: "Necesitas al menos 2 palets para fusionar",
        type: "error",
      });
      return;
    }
    setFuseMode("seleccion");
    setFuseNumbers("");
    setFuseSourceIds([]);
    setFuseTargetId(String(palletsInLoad[0]?._id || ""));
    setFuseBaseChoice(String(palletsInLoad[0]?.base || "").trim());
    setOpenFuse(true);
  };

  const submitFuse = async () => {
    if (fuseSubmitting) return;
    const targetId = String(fuseTargetId || "");
    if (!targetId) {
      setSnack({
        open: true,
        message: "Selecciona un palet destino",
        type: "error",
      });
      return;
    }

    const isSelectMode = fuseMode === "seleccion";
    const sourceIds = isSelectMode ? fuseSourceIds : [];
    const sourceNumbers = !isSelectMode ? fuseParsedNumbers : [];

    if (isSelectMode && sourceIds.length === 0) {
      setSnack({
        open: true,
        message: "Selecciona al menos un palet para fusionar",
        type: "error",
      });
      return;
    }
    if (!isSelectMode && sourceNumbers.length === 0) {
      setSnack({
        open: true,
        message: "Introduce números de palet para fusionar",
        type: "error",
      });
      return;
    }
    if (!isSelectMode && fuseMissingNumbers.length > 0) {
      setSnack({
        open: true,
        message: `Números no encontrados: ${fuseMissingNumbers.join(", ")}`,
        type: "error",
      });
      return;
    }

    const normalizeBase = (value) => {
      const raw = String(value || "").trim();
      if (!raw) return "";
      const lower = raw.toLowerCase();
      if (lower === "europeo") return "Europeo";
      if (lower === "americano") return "Americano";
      return raw;
    };
    const selectedSources = isSelectMode
      ? palletsInLoad.filter((p) =>
          fuseSourceIds.some((sid) => String(sid) === String(p?._id)),
        )
      : fuseMatchedByNumbers;
    const baseCandidates = Array.from(
      new Set(
        [
          normalizeBase(fuseTarget?.base),
          ...selectedSources.map((p) => normalizeBase(p?.base)),
        ]
          .map((v) => String(v || "").trim())
          .filter(Boolean),
      ),
    );
    const needsBaseChoice = baseCandidates.length > 1;
    const effectiveBaseChoice = normalizeBase(fuseBaseChoice);
    if (needsBaseChoice && !effectiveBaseChoice) {
      setSnack({
        open: true,
        message: `Elige base (${baseCandidates.join(" o ")}) para fusionar`,
        type: "error",
      });
      return;
    }

    if (!window.confirm("¿Seguro que quieres fusionar estos palets?")) return;

    try {
      setFuseSubmitting(true);
      await fusePallets({
        mode: isSelectMode ? "ids" : "numbers",
        targetPalletId: targetId,
        sourcePalletIds: isSelectMode ? sourceIds : undefined,
        sourcePalletNumbers: !isSelectMode ? sourceNumbers : undefined,
        baseChoice: needsBaseChoice ? effectiveBaseChoice : undefined,
        modificado_por: getCurrentUser()?.name || "Testing",
      });

      const [l, palletsList] = await Promise.all([
        fetchLoadById(id),
        fetchAllPallets(),
      ]);
      setLoad(l);
      setPallets(
        palletsList.map((x) => ({
          ...x,
          _id: x?._id || x?.id,
          id: x?.id || x?._id,
        })),
      );
      if (l) {
        setForm({
          barco: String(l.barco?._id || l.barco || ""),
          entrega: Array.isArray(l.entrega) ? l.entrega : [],
          chofer: String(l.chofer?._id || l.chofer || ""),
          responsable: String(l.responsable?._id || l.responsable || ""),
          consignatario: String(l.consignatario?._id || l.consignatario || ""),
          terminal_entrega: String(
            l.terminal_entrega?._id || l.terminal_entrega || "",
          ),
          palets: Array.isArray(l.palets) ? l.palets.map((p) => String(p)) : [],
          carga: Array.isArray(l.carga) ? l.carga : [],
          fecha_de_carga: toDateInput(l.fecha_de_carga),
          hora_de_carga: l.hora_de_carga || "",
          fecha_de_descarga: toDateInput(l.fecha_de_descarga),
          hora_de_descarga: l.hora_de_descarga || "",
          cash: !!l.cash,
          lancha: !!l.lancha,
          estado_viaje: l.estado_viaje || "Preparando",
        });
      }

      setOpenFuse(false);
      setSnack({ open: true, message: "Palets fusionados", type: "success" });
    } catch (e) {
      const msg = String(e?.message || "");
      setSnack({
        open: true,
        message: msg || "Error de red fusionando palets",
        type: "error",
      });
    } finally {
      setFuseSubmitting(false);
    }
  };

  const canDnDFuseTo = (targetPallet) => {
    if (!dragPalletId) return false;
    if (!targetPallet?._id) return false;
    if (String(targetPallet._id) === String(dragPalletId)) return false;
    return String(targetPallet.tipo || "") === String(dragPalletTipo || "");
  };

  const closeFuseDnD = () => {
    setOpenFuseDnD(false);
    setFuseDnDSourceId("");
    setFuseDnDTargetId("");
    setFuseDnDBaseChoice("");
    setDragPalletId("");
    setDragPalletTipo("");
    setDragOverPalletId("");
  };
  const clearDnDState = () => {
    setDragPalletId("");
    setDragPalletTipo("");
    setDragOverPalletId("");
  };
  const isDoubleTap = (id) => {
    const now = Date.now();
    const prev = lastTapRef.current || { id: "", at: 0 };
    lastTapRef.current = { id, at: now };
    return (
      String(prev.id || "") === String(id || "") &&
      now - Number(prev.at || 0) < 320
    );
  };

  const submitFuseDnD = async () => {
    if (fuseSubmitting) return;
    const targetId = String(fuseDnDTargetId || "");
    const sourceId = String(fuseDnDSourceId || "");
    if (!targetId || !sourceId) {
      closeFuseDnD();
      return;
    }

    const normalizeBase = (value) => {
      const raw = String(value || "").trim();
      if (!raw) return "";
      const lower = raw.toLowerCase();
      if (lower === "europeo") return "Europeo";
      if (lower === "americano") return "Americano";
      return raw;
    };
    const baseCandidates = Array.from(
      new Set(
        [normalizeBase(fuseDnDSource?.base), normalizeBase(fuseDnDTarget?.base)]
          .map((v) => String(v || "").trim())
          .filter(Boolean),
      ),
    );
    const needsBaseChoice = baseCandidates.length > 1;
    const effectiveBaseChoice = normalizeBase(fuseDnDBaseChoice);
    if (needsBaseChoice && !effectiveBaseChoice) {
      setSnack({
        open: true,
        message: `Elige base (${baseCandidates.join(" o ")}) para fusionar`,
        type: "error",
      });
      return;
    }

    try {
      setFuseSubmitting(true);
      await fusePallets({
        mode: "ids",
        targetPalletId: targetId,
        sourcePalletIds: [sourceId],
        baseChoice: needsBaseChoice ? effectiveBaseChoice : undefined,
        modificado_por: getCurrentUser()?.name || "Testing",
      });

      const [l, palletsList] = await Promise.all([
        fetchLoadById(id),
        fetchAllPallets(),
      ]);
      setLoad(l);
      setPallets(
        palletsList.map((x) => ({
          ...x,
          _id: x?._id || x?.id,
          id: x?.id || x?._id,
        })),
      );
      if (l) {
        setForm({
          barco: String(l.barco || ""),
          entrega: Array.isArray(l.entrega) ? l.entrega : [],
          chofer: String(l.chofer || ""),
          responsable: String(l.responsable || ""),
          consignatario: String(l.consignatario || ""),
          terminal_entrega: String(l.terminal_entrega || ""),
          palets: Array.isArray(l.palets) ? l.palets.map((p) => String(p)) : [],
          carga: Array.isArray(l.carga) ? l.carga : [],
          fecha_de_carga: toDateInput(l.fecha_de_carga),
          hora_de_carga: l.hora_de_carga || "",
          fecha_de_descarga: toDateInput(l.fecha_de_descarga),
          hora_de_descarga: l.hora_de_descarga || "",
          cash: !!l.cash,
          lancha: !!l.lancha,
          estado_viaje: l.estado_viaje || "Preparando",
        });
      }

      setSnack({ open: true, message: "Palets fusionados", type: "success" });
      closeFuseDnD();
    } catch (e) {
      const msg = String(e?.message || "");
      setSnack({
        open: true,
        message: msg || "Error de red fusionando palets",
        type: "error",
      });
    } finally {
      setFuseSubmitting(false);
    }
  };

  const fuseDnDSource = palletsInLoad.find(
    (p) => String(p._id) === String(fuseDnDSourceId),
  );
  const fuseDnDTarget = palletsInLoad.find(
    (p) => String(p._id) === String(fuseDnDTargetId),
  );

  const shipById = new Map(
    ships.map((s) => [String(s._id || s.id || ""), s]).filter((p) => p[0]),
  );
  const userById = new Map(
    users.map((u) => [String(u._id || u.id || ""), u]).filter((p) => p[0]),
  );
  const consigneeById = new Map(
    consignees.map((c) => [String(c._id || c.id || ""), c]).filter((p) => p[0]),
  );
  const locationById = new Map(
    locations.map((l) => [String(l._id || l.id || ""), l]).filter((p) => p[0]),
  );

  const barcoId = String(load?.barco?._id || load?.barco || "");
  const choferId = String(load?.chofer?._id || load?.chofer || "");
  const consignatarioId = String(
    load?.consignatario?._id || load?.consignatario || "",
  );
  const terminalEntregaId = String(
    load?.terminal_entrega?._id || load?.terminal_entrega || "",
  );

  const barcoObj =
    shipById.get(barcoId) ||
    (load?.barco && typeof load.barco === "object" ? load.barco : null);
  const choferObj =
    userById.get(choferId) ||
    (load?.chofer && typeof load.chofer === "object" ? load.chofer : null);
  const consignatarioObj =
    consigneeById.get(consignatarioId) ||
    (load?.consignatario && typeof load.consignatario === "object"
      ? load.consignatario
      : null);
  const terminalEntregaObj =
    locationById.get(terminalEntregaId) ||
    (load?.terminal_entrega && typeof load.terminal_entrega === "object"
      ? load.terminal_entrega
      : null);

  const exportLoadReportPdf = () => {
    if (!loadReport) return;
    const wantedIds = new Set(
      Array.isArray(loadReport?.pallet_ids)
        ? loadReport.pallet_ids.map((v) => String(v)).filter(Boolean)
        : [],
    );
    const palletsRows = palletsInLoad
      .filter((p) => {
        const pid = String(p?._id || p?.id || "").trim();
        if (!pid) return false;
        if (wantedIds.size > 0) return wantedIds.has(pid);
        return p?.estado === true;
      })
      .map((p) => ({
        numero_palet: String(p?.numero_palet || "").trim(),
        tipo: String(p?.tipo || "").trim(),
        base: String(p?.base || "").trim(),
        productos: String(p?.productos || "").trim(),
      }))
      .sort((a, b) =>
        String(a.numero_palet || "").localeCompare(
          String(b.numero_palet || ""),
          "es",
          {
            sensitivity: "base",
            numeric: true,
          },
        ),
      );

    const cargadoPorLabel =
      Array.isArray(loadReport.cargado_por) && loadReport.cargado_por.length > 0
        ? loadReport.cargado_por
            .map((u) => String(u?.name || u?.nombre || "").trim())
            .filter(Boolean)
            .join(", ") || "-"
        : "-";

    const html = buildInformeCargaHtml({
      loadNombre: loadReport.load_nombre || load?.nombre || loadId,
      finishedLabel: formatMaybeDateTime(loadReport.finished_at) || "-",
      cargadoPorLabel,
      choferName:
        String(loadReport?.cargado_a?.chofer_name || "").trim() ||
        String(choferObj?.name || choferObj?.nombre || "").trim() ||
        "-",
      consignatarioName:
        String(loadReport?.cargado_a?.consignatario_name || "").trim() ||
        String(
          consignatarioObj?.nombre || consignatarioObj?.name || "",
        ).trim() ||
        "-",
      notas: loadReport.notas || "",
      palletsRows,
    });

    if (!String(html || "").trim()) {
      setSnack({
        open: true,
        message: "No se pudo generar el contenido del informe",
        type: "error",
      });
      return;
    }

    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.style.opacity = "0";
    iframe.style.pointerEvents = "none";
    iframe.srcdoc = html;

    const cleanup = () => {
      if (iframe && iframe.parentNode) iframe.parentNode.removeChild(iframe);
    };

    const doPrint = () => {
      try {
        const pw = iframe.contentWindow;
        if (!pw) throw new Error("No se pudo acceder al documento del informe");
        pw.focus();
        pw.print();
      } catch (e) {
        const msg = String(e?.message || "").trim();
        setSnack({
          open: true,
          message: msg || "No se pudo abrir el diálogo de impresión",
          type: "error",
        });
      }
      window.setTimeout(cleanup, 1200);
    };

    iframe.addEventListener("load", () => {
      window.setTimeout(doPrint, 50);
    });

    document.body.appendChild(iframe);
    window.setTimeout(doPrint, 700);
  };

  const markAsViajando = async () => {
    if (!isDriver) return;
    if (!load) return;
    if (markViajandoSubmitting) return;
    const assignedChoferId = String(
      load?.chofer?._id || load?.chofer || "",
    ).trim();
    if (!assignedChoferId || assignedChoferId !== currentUserId) {
      setSnack({
        open: true,
        message: "Esta carga no está asociada a tu usuario",
        type: "error",
      });
      return;
    }
    const estadoKey = String(load?.estado_viaje || "")
      .trim()
      .toLowerCase();
    if (estadoKey === "viajando") return;
    if (!window.confirm('¿Marcar el estado del viaje como "Viajando"?')) return;
    try {
      setMarkViajandoSubmitting(true);
      const updated = await updateLoadById(id, {
        estado_viaje: "Viajando",
        modificado_por:
          String(currentUser?.name || "Testing").trim() || "Testing",
      });
      if (!updated) {
        setSnack({
          open: true,
          message: "No se pudo actualizar la carga",
          type: "error",
        });
        return;
      }
      setLoad(updated);
      setSnack({
        open: true,
        message: "Estado actualizado a Viajando",
        type: "success",
      });
    } catch (e) {
      setSnack({
        open: true,
        message: String(e?.message || "Error actualizando el estado"),
        type: "error",
      });
    } finally {
      setMarkViajandoSubmitting(false);
    }
  };

  const driverFinalizeTo = async (estado) => {
    if (!isDriver) return;
    if (!load) return;
    if (finalizeSubmitting) return;
    const assignedChoferId = String(
      load?.chofer?._id || load?.chofer || "",
    ).trim();
    if (!assignedChoferId || assignedChoferId !== currentUserId) {
      setSnack({
        open: true,
        message: "Esta carga no está asociada a tu usuario",
        type: "error",
      });
      return;
    }
    const estadoKey = String(load?.estado_viaje || "")
      .trim()
      .toLowerCase();
    if (estadoKey !== "viajando") return;
    const next = String(estado || "").trim();
    if (next !== "Entregado" && next !== "Cancelado") return;
    if (!window.confirm(`¿Finalizar la carga como "${next}"?`)) return;
    try {
      setFinalizeSubmitting(true);
      const updated = await updateLoadById(id, {
        estado_viaje: next,
        modificado_por:
          String(currentUser?.name || "Testing").trim() || "Testing",
      });
      if (!updated) {
        setSnack({
          open: true,
          message: "No se pudo actualizar la carga",
          type: "error",
        });
        return;
      }
      setLoad(updated);
      setOpenDriverFinalize(false);
      setSnack({
        open: true,
        message: `Estado actualizado a ${next}`,
        type: "success",
      });
    } catch (e) {
      setSnack({
        open: true,
        message: String(e?.message || "Error actualizando el estado"),
        type: "error",
      });
    } finally {
      setFinalizeSubmitting(false);
    }
  };

  return (
    <section className="card">
      <div className="card-header">
        <h2 className="card-title" style={{ whiteSpace: "nowrap" }}>
          Detalle carga
        </h2>
        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            flex: 1,
          }}
        >
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {!isReadOnlyActions && hasLoadReport && (
              <button
                className="icon-button"
                onClick={openLoadReportPreview}
                title="Ver informe de carga"
                disabled={loadReportLoading}
              >
                <span className="material-symbols-outlined">receipt_long</span>
              </button>
            )}
          </div>

          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              alignItems: "center",
              marginLeft: "auto",
            }}
          >
            {isDriver &&
              String(load?.chofer?._id || load?.chofer || "").trim() ===
                currentUserId && (
                <button
                  className="secondary-button"
                  onClick={markAsViajando}
                  disabled={
                    markViajandoSubmitting ||
                    String(load?.estado_viaje || "")
                      .trim()
                      .toLowerCase() === "viajando"
                  }
                  title='Marcar como "Viajando"'
                >
                  Marcar como Viajando
                </button>
              )}
            {isDriver &&
              String(load?.chofer?._id || load?.chofer || "").trim() ===
                currentUserId &&
              String(load?.estado_viaje || "")
                .trim()
                .toLowerCase() === "viajando" && (
                <button
                  className="secondary-button"
                  onClick={() => setOpenDriverFinalize(true)}
                  disabled={finalizeSubmitting}
                  title="Finalizar"
                >
                  Finalizar
                </button>
              )}
            {!isReadOnlyActions && canManageLoads && (
              <button
                className="icon-button"
                onClick={() => {
                  setResponsableQuery("");
                  setOpen(true);
                }}
                title="Modificar"
              >
                <span className="material-symbols-outlined">edit</span>
              </button>
            )}
            <button
              className="icon-button"
              onClick={() => navigate(-1)}
              title="Atrás"
            >
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
          </div>
        </div>
      </div>
      <div style={{ padding: 16 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            columnGap: 16,
            rowGap: 6,
            alignItems: "start",
          }}
        >
          <div>
            <strong>Barco:</strong> {barcoObj?.nombre_del_barco || "-"}
          </div>
          <div>
            <strong>Entrega:</strong>{" "}
            {Array.isArray(load.entrega) ? load.entrega.join(", ") : ""}
          </div>
          <div>
            <strong>Chofer:</strong> {choferObj?.name || "-"}
          </div>
          <div>
            <strong>Consignatario:</strong> {consignatarioObj?.nombre || "-"}
          </div>
          <div>
            <strong>Terminal entrega:</strong>{" "}
            {terminalEntregaObj
              ? (terminalEntregaObj.puerto
                  ? `${terminalEntregaObj.puerto} · `
                  : "") + (terminalEntregaObj.nombre || "-")
              : "-"}
          </div>
          <div>
            <strong>Palets de carga:</strong> {totalPallets}
          </div>
          <div>
            <strong>Estado viaje:</strong> {load.estado_viaje}
          </div>
          <div>
            <strong>Fecha de carga:</strong>{" "}
            {formatDateLabel(load.fecha_de_carga)}
            {load.hora_de_carga ? `, ${load.hora_de_carga}` : ""}
          </div>
          <div>
            <strong>Fecha de descarga:</strong>{" "}
            {formatDateLabel(load.fecha_de_descarga)}
            {load.hora_de_descarga ? `, ${load.hora_de_descarga}` : ""}
          </div>
          <div>
            <strong>Cash:</strong> {load.cash ? "Sí" : "No"}
          </div>
        </div>

        {canDeleteLoad && (
          <div
            style={{
              marginTop: 14,
              display: "flex",
              justifyContent: "flex-end",
            }}
          >
            <button
              className="primary-button"
              onClick={handleDelete}
              disabled={deleting}
              style={{ background: "#d93025" }}
              title="Borrar carga"
            >
              {deleting ? "Borrando..." : "Borrar carga"}
            </button>
          </div>
        )}

        <div
          className="card"
          style={{ marginTop: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}
        >
          <div className="card-header">
            <h3 className="card-title">Resumen palets</h3>
            {!isReadOnlyActions && canManageLoads && (
              <button
                className="secondary-button"
                onClick={openFolioModal}
                title="Imprimir números"
                style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
              >
                <span className="material-symbols-outlined">description</span>
                Números
              </button>
            )}
          </div>
          <div style={{ padding: 12 }}>
            <p>
              <strong>Total palets:</strong> {totalPallets}
            </p>
            {Object.keys(tipoCounts).length > 0 ? (
              <div
                style={{
                  display: "flex",
                  gap: 12,
                  flexWrap: "wrap",
                  marginTop: 6,
                }}
              >
                {Object.entries(tipoCounts).map(([tipo, count]) => (
                  <span
                    key={tipo}
                    style={{
                      background: "#eef2f7",
                      borderRadius: 6,
                      padding: "4px 8px",
                    }}
                  >
                    {tipo}: {count}
                  </span>
                ))}
              </div>
            ) : (
              <p style={{ color: "var(--text-secondary)" }}>Sin tipos</p>
            )}

            <div
              style={{
                display: "flex",
                gap: 12,
                flexWrap: "wrap",
                marginTop: 8,
              }}
            >
              <span
                style={{
                  background: "#eef2f7",
                  borderRadius: 6,
                  padding: "4px 8px",
                }}
              >
                Europeo: {baseCounts.europeo}
              </span>
              <span
                style={{
                  background: "#eef2f7",
                  borderRadius: 6,
                  padding: "4px 8px",
                }}
              >
                Americano: {baseCounts.americano}
              </span>
            </div>

            <div style={{ marginTop: 14 }}>
              {palletsInLoad.length === 0 ? (
                <div style={{ color: "var(--text-secondary)" }}>
                  Sin palets asociados
                </div>
              ) : (
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 12,
                    alignItems: "flex-start",
                  }}
                  onClick={(e) => {
                    if (!isTouchMode) return;
                    if (!dragPalletId) return;
                    const t = e.target;
                    if (
                      t &&
                      typeof t.closest === "function" &&
                      t.closest(".card-item")
                    )
                      return;
                    clearDnDState();
                  }}
                >
                  {palletsInLoad.map((p) => {
                    const pid = String(p?._id || p?.id || "");
                    const idStr = pid;
                    const isDragging = !!dragPalletId;
                    const isSource =
                      isDragging &&
                      idStr &&
                      String(idStr) === String(dragPalletId);
                    const isDroppable = isDragging && canDnDFuseTo(p);
                    const isDisabled = isDragging && !isSource && !isDroppable;
                    const isOver =
                      isDroppable &&
                      idStr &&
                      String(idStr) === String(dragOverPalletId);
                    const numero = String(p?.numero_palet || "").trim();
                    const nombre = String(p?.nombre || "").trim();
                    const tipo = String(p?.tipo || "").trim();
                    const base = String(p?.base || "").trim();
                    const isAmericano =
                      base.trim().toLowerCase() === "americano";
                    const colors = getTipoColors(tipo);
                    const accent = isAmericano ? colors.strong : colors.color;
                    const avatarText = numero || "?";
                    const baseKey = base.trim().toLowerCase();
                    const tipoLetter = getTipoLabel(tipo);
                    const baseLetter =
                      baseKey === "europeo"
                        ? "E"
                        : baseKey === "americano"
                          ? "A"
                          : baseKey
                            ? baseKey[0].toUpperCase()
                            : "";
                    const title =
                      tipoLetter && baseLetter
                        ? `${tipoLetter} · ${baseLetter}`
                        : tipoLetter
                          ? tipoLetter
                          : numero || "Palet";
                    const subtitle = "";
                    const creadoPor = String(p?.creado_por || "").trim();
                    return (
                      <div
                        key={pid || `${numero || nombre}`}
                        className="card-item"
                        draggable={!isTouchMode && canManagePallets}
                        style={{
                          cursor: isDragging
                            ? isSource
                              ? "grabbing"
                              : isDroppable
                                ? "copy"
                                : "not-allowed"
                            : isReadOnlyActions
                              ? "default"
                              : "pointer",
                          borderLeft: `${
                            isAmericano ? 10 : 6
                          }px solid ${accent}`,
                          width: "fit-content",
                          minWidth: 210,
                          maxWidth: 320,
                          opacity: isDisabled ? 0.45 : 1,
                          filter: isDisabled ? "grayscale(1)" : "none",
                          background: isOver ? "var(--hover)" : undefined,
                        }}
                        title={[tipo, base].filter(Boolean).join(" · ")}
                        onDragStart={(e) => {
                          if (isTouchMode) return;
                          if (!canManagePallets) return;
                          if (!idStr) return;
                          e.dataTransfer.effectAllowed = "copy";
                          try {
                            e.dataTransfer.setData("text/plain", String(idStr));
                          } catch {
                            void 0;
                          }
                          setDragPalletId(String(idStr));
                          setDragPalletTipo(String(tipo || ""));
                          setDragOverPalletId("");
                        }}
                        onDragEnd={() => {
                          if (isTouchMode) return;
                          setDragPalletId("");
                          setDragPalletTipo("");
                          setDragOverPalletId("");
                        }}
                        onDragOver={(e) => {
                          if (isTouchMode) return;
                          if (!canManagePallets) return;
                          if (!canDnDFuseTo(p)) return;
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "copy";
                          if (dragOverPalletId !== idStr)
                            setDragOverPalletId(idStr);
                        }}
                        onDrop={(e) => {
                          if (isTouchMode) return;
                          if (!canManagePallets) return;
                          if (!canDnDFuseTo(p)) return;
                          e.preventDefault();
                          setFuseDnDSourceId(String(dragPalletId));
                          setFuseDnDTargetId(String(idStr));
                          setFuseDnDBaseChoice(String(base || "").trim());
                          setOpenFuseDnD(true);
                          setDragPalletId("");
                          setDragPalletTipo("");
                          setDragOverPalletId("");
                        }}
                        onClick={(e) => {
                          if (isReadOnlyActions) return;
                          if (!idStr) return;
                          if (isTouchMode) {
                            e.stopPropagation();
                            if (isDoubleTap(idStr)) {
                              clearDnDState();
                              navigate(`/app/palets/${pid}`, {
                                state: { from: location.pathname },
                              });
                              return;
                            }
                            if (!canManagePallets) return;
                            if (!dragPalletId) {
                              setDragPalletId(String(idStr));
                              setDragPalletTipo(String(tipo || ""));
                              setDragOverPalletId("");
                              return;
                            }
                            if (String(idStr) === String(dragPalletId)) {
                              clearDnDState();
                              return;
                            }
                            if (!canDnDFuseTo(p)) {
                              setSnack({
                                open: true,
                                message:
                                  "Solo puedes fusionar palets del mismo tipo",
                                type: "error",
                              });
                              return;
                            }
                            setFuseDnDSourceId(String(dragPalletId));
                            setFuseDnDTargetId(String(idStr));
                            setFuseDnDBaseChoice(String(base || "").trim());
                            setOpenFuseDnD(true);
                            clearDnDState();
                            return;
                          }
                          if (dragPalletId) return;
                          navigate(`/app/palets/${pid}`, {
                            state: { from: location.pathname },
                          });
                        }}
                      >
                        <div className="card-item-header">
                          <div
                            className="avatar"
                            style={{
                              width: 48,
                              height: 48,
                              fontSize: String(avatarText).length > 3 ? 16 : 20,
                              padding: 0,
                              textAlign: "center",
                              lineHeight: 1,
                            }}
                          >
                            {avatarText}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div
                              className="card-item-title"
                              style={{ fontSize: 20, lineHeight: "22px" }}
                            >
                              {title}
                            </div>
                            <div className="card-item-sub">
                              {subtitle || " "}
                            </div>
                            <div
                              style={{
                                fontSize: 12,
                                color: "var(--text-secondary)",
                                marginTop: 2,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                              title={creadoPor || ""}
                            >
                              {creadoPor ? `Creado por: ${creadoPor}` : " "}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <Modal
        open={openFuseDnD}
        title="Fusionar palets"
        onClose={closeFuseDnD}
        onSubmit={submitFuseDnD}
        submitLabel="Fusionar"
        width={520}
        bodyStyle={{ gridTemplateColumns: "1fr" }}
      >
        <div style={{ fontSize: 16 }}>
          ¿Desea fusionar los palets {fuseDnDSource?.numero_palet || "-"} y{" "}
          {fuseDnDTarget?.numero_palet || "-"}?
        </div>
        {(() => {
          const normalizeBase = (value) => {
            const raw = String(value || "").trim();
            if (!raw) return "";
            const lower = raw.toLowerCase();
            if (lower === "europeo") return "Europeo";
            if (lower === "americano") return "Americano";
            return raw;
          };
          const baseCandidates = Array.from(
            new Set(
              [
                normalizeBase(fuseDnDSource?.base),
                normalizeBase(fuseDnDTarget?.base),
              ]
                .map((v) => String(v || "").trim())
                .filter(Boolean),
            ),
          );
          if (baseCandidates.length <= 1) return null;
          const value =
            normalizeBase(fuseDnDBaseChoice) ||
            normalizeBase(fuseDnDTarget?.base) ||
            baseCandidates[0] ||
            "";
          return (
            <div style={{ marginTop: 12, display: "grid", gap: 6 }}>
              <div className="label">Base final</div>
              <select
                className="select"
                value={value}
                onChange={(e) => setFuseDnDBaseChoice(e.target.value)}
              >
                {baseCandidates.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
          );
        })()}
      </Modal>

      <Modal
        open={openFuse}
        title="Fusionar palets"
        onClose={() => setOpenFuse(false)}
        onSubmit={submitFuse}
        submitLabel="Fusionar"
        width={720}
        bodyStyle={{
          gridTemplateColumns: "1fr",
          maxHeight: "80vh",
          overflow: "auto",
        }}
      >
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            onClick={() => {
              setFuseMode("seleccion");
              setFuseNumbers("");
              setFuseSourceIds([]);
            }}
            style={{
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: fuseMode === "seleccion" ? "var(--hover)" : "#fff",
              cursor: "pointer",
              fontWeight: fuseMode === "seleccion" ? 600 : 500,
            }}
          >
            Selección
          </button>
          <button
            onClick={() => {
              setFuseMode("numeros");
              setFuseSourceIds([]);
            }}
            style={{
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: fuseMode === "numeros" ? "var(--hover)" : "#fff",
              cursor: "pointer",
              fontWeight: fuseMode === "numeros" ? 600 : 500,
            }}
          >
            Números
          </button>
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          <div className="label">Palet destino</div>
          <select
            className="input"
            value={fuseTargetId}
            onChange={(e) => {
              const nextTarget = e.target.value;
              setFuseTargetId(nextTarget);
              setFuseSourceIds((prev) =>
                prev.filter((pid) => String(pid) !== String(nextTarget)),
              );
            }}
          >
            {palletsInLoad.map((p) => (
              <option key={p._id} value={p._id}>
                {p.numero_palet}
                {p.tipo ? ` · ${p.tipo}` : ""}
                {p.base ? ` · ${p.base}` : ""}
              </option>
            ))}
          </select>
          <div style={{ color: "var(--text-secondary)", fontSize: 12 }}>
            {fuseTarget
              ? `Destino: ${fuseTarget.numero_palet}${
                  fuseTarget.tipo ? ` · ${fuseTarget.tipo}` : ""
                }`
              : ""}
          </div>
        </div>

        {(() => {
          const normalizeBase = (value) => {
            const raw = String(value || "").trim();
            if (!raw) return "";
            const lower = raw.toLowerCase();
            if (lower === "europeo") return "Europeo";
            if (lower === "americano") return "Americano";
            return raw;
          };
          const selectedSources =
            fuseMode === "seleccion"
              ? palletsInLoad.filter((p) =>
                  fuseSourceIds.some((sid) => String(sid) === String(p?._id)),
                )
              : fuseMatchedByNumbers;
          const baseCandidates = Array.from(
            new Set(
              [
                normalizeBase(fuseTarget?.base),
                ...selectedSources.map((p) => normalizeBase(p?.base)),
              ]
                .map((v) => String(v || "").trim())
                .filter(Boolean),
            ),
          );
          if (baseCandidates.length <= 1) return null;
          const value =
            normalizeBase(fuseBaseChoice) ||
            normalizeBase(fuseTarget?.base) ||
            baseCandidates[0] ||
            "";
          return (
            <div style={{ display: "grid", gap: 8 }}>
              <div className="label">Base final</div>
              <select
                className="select"
                value={value}
                onChange={(e) => setFuseBaseChoice(e.target.value)}
              >
                {baseCandidates.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
          );
        })()}

        {fuseMode === "seleccion" ? (
          <div style={{ display: "grid", gap: 8 }}>
            <div className="label">Palets a fusionar</div>
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                checked={
                  fuseOthers.length > 0 &&
                  fuseSourceIds.length === fuseOthers.length
                }
                onChange={(e) => {
                  if (e.target.checked) {
                    setFuseSourceIds(fuseOthers.map((p) => String(p._id)));
                  } else {
                    setFuseSourceIds([]);
                  }
                }}
              />
              Seleccionar todos
            </label>
            <div
              style={{
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: 10,
                maxHeight: "55vh",
                overflowY: "scroll",
                scrollbarGutter: "stable",
                overscrollBehavior: "contain",
                WebkitOverflowScrolling: "touch",
                touchAction: "pan-y",
              }}
            >
              {fuseOthers.map((p) => {
                const checked = fuseSourceIds.some(
                  (pid) => String(pid) === String(p._id),
                );
                return (
                  <label
                    key={p._id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                      padding: "6px 0",
                      borderBottom: "1px solid #f1f3f4",
                    }}
                  >
                    <span
                      style={{ display: "flex", alignItems: "center", gap: 8 }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          const isChecked = e.target.checked;
                          setFuseSourceIds((prev) => {
                            const next = new Set(prev.map((v) => String(v)));
                            const idStr = String(p._id);
                            if (isChecked) next.add(idStr);
                            else next.delete(idStr);
                            return Array.from(next);
                          });
                        }}
                      />
                      <span>
                        {p.numero_palet}
                        {p.tipo ? ` · ${p.tipo}` : ""}
                        {p.base ? ` · ${p.base}` : ""}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
            <div style={{ color: "var(--text-secondary)", fontSize: 12 }}>
              Seleccionados: {fuseSourceIds.length}
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            <div className="label">Números de palet a fusionar</div>
            <textarea
              className="input"
              style={{ height: 110, resize: "vertical" }}
              placeholder="Ej: 12 13 14 o 12,13,14 o 12-20"
              value={fuseNumbers}
              onChange={(e) => setFuseNumbers(e.target.value)}
            />
            <div style={{ color: "var(--text-secondary)", fontSize: 12 }}>
              Encontrados: {fuseMatchedByNumbers.length}
              {fuseMissingNumbers.length > 0
                ? ` · No encontrados: ${fuseMissingNumbers.join(", ")}`
                : ""}
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={openFolio}
        title="Imprimir números"
        onClose={closeFolioModal}
        onSubmit={folioStep === "config" ? goFolioPreview : printFolios}
        submitLabel={folioStep === "config" ? "Previsualizar" : "Imprimir"}
        width={980}
        bodyStyle={{
          gridTemplateColumns: "1fr",
          maxHeight: "80vh",
          overflow: "auto",
        }}
      >
        {folioStep === "config" ? (
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "grid", gap: 6 }}>
              <div className="label">Rango de números</div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                }}
              >
                <div style={{ display: "grid", gap: 6 }}>
                  <div className="label">Desde</div>
                  <input
                    type="number"
                    className="input"
                    min={1}
                    value={folioFrom}
                    onChange={(e) => setFolioFrom(e.target.value)}
                  />
                </div>
                <div style={{ display: "grid", gap: 6 }}>
                  <div className="label">Hasta</div>
                  <input
                    type="number"
                    className="input"
                    min={1}
                    value={folioTo}
                    onChange={(e) => setFolioTo(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>
              {(() => {
                const sheetFrom = Number(folioSheetFrom);
                const sheetTo = Number(folioSheetTo);
                const from = Number(folioFrom);
                const to = Number(folioTo);
                const hasNumRange =
                  Number.isFinite(from) && Number.isFinite(to);
                const a = hasNumRange ? Math.min(from, to) : null;
                const b = hasNumRange ? Math.max(from, to) : null;
                const count =
                  typeof a === "number" && typeof b === "number"
                    ? b - a + 1
                    : 0;

                if (folioIncludeNumbers && folioIncludeLoadSheet) {
                  if (!hasNumRange) return "";
                  if (
                    Number.isFinite(sheetFrom) &&
                    Number.isFinite(sheetTo) &&
                    sheetFrom >= 1 &&
                    sheetTo >= 1
                  ) {
                    const sa = Math.min(sheetFrom, sheetTo);
                    const sb = Math.max(sheetFrom, sheetTo);
                    return `Se imprimirán ${count} números (${a}–${b}) y la hoja de carga (${sa}–${sb}).`;
                  }
                  return `Se imprimirán ${count} números (${a}–${b}) y la hoja de carga.`;
                }
                if (folioIncludeNumbers) {
                  if (!hasNumRange) return "";
                  return `Se imprimirán ${count} números (${a}–${b}).`;
                }
                if (folioIncludeLoadSheet) {
                  if (
                    !Number.isFinite(sheetFrom) ||
                    !Number.isFinite(sheetTo) ||
                    sheetFrom < 1 ||
                    sheetTo < 1
                  )
                    return "";
                  const sa = Math.min(sheetFrom, sheetTo);
                  const sb = Math.max(sheetFrom, sheetTo);
                  return `Se imprimirá la hoja de carga (${sa}–${sb}).`;
                }
                return "";
              })()}
            </div>

            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={folioIncludeNumbers}
                onChange={(e) => setFolioIncludeNumbers(e.target.checked)}
              />
              <span>Imprimir números</span>
            </label>

            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={folioIncludeLoadSheet}
                onChange={(e) => setFolioIncludeLoadSheet(e.target.checked)}
              />
              <span>Desea imprimir la hoja de carga?</span>
            </label>

            {folioIncludeLoadSheet && (
              <div style={{ display: "grid", gap: 6 }}>
                <div className="label">Rango hoja de carga</div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 10,
                  }}
                >
                  <div style={{ display: "grid", gap: 6 }}>
                    <div className="label">Desde</div>
                    <input
                      type="number"
                      className="input"
                      min={1}
                      value={folioSheetFrom}
                      onChange={(e) => setFolioSheetFrom(e.target.value)}
                    />
                  </div>
                  <div style={{ display: "grid", gap: 6 }}>
                    <div className="label">Hasta</div>
                    <input
                      type="number"
                      className="input"
                      min={1}
                      value={folioSheetTo}
                      onChange={(e) => setFolioSheetTo(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}

            <div
              style={{
                border: "1px solid var(--border)",
                borderRadius: 10,
                padding: 12,
                background: "#fff",
              }}
            >
              <div style={{ display: "grid", gap: 6 }}>
                <div>
                  <strong>Barco:</strong> {folioMeta.shipName || "-"}
                </div>
                <div>
                  <strong>Fecha prevista:</strong> {folioMeta.dateLabel || "-"}
                </div>
                <div>
                  <strong>Puerto:</strong> {folioMeta.portLabel || "-"}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              {!isReadOnlyActions && (
                <button
                  className="secondary-button"
                  onClick={() => setFolioStep("config")}
                >
                  Cambiar rango
                </button>
              )}
              <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>
                Vista previa
              </div>
            </div>
            <iframe
              title="Previsualización números"
              style={{
                width: "100%",
                height: "70vh",
                border: "1px solid var(--border)",
                borderRadius: 10,
                background: "#fff",
              }}
              srcDoc={folioHtml}
            />
          </div>
        )}
      </Modal>

      <Modal
        open={openLoadReport}
        title="Informe de carga"
        onClose={() => setOpenLoadReport(false)}
        cancelLabel="Cerrar"
        width={720}
        bodyStyle={{ gridTemplateColumns: "1fr" }}
      >
        {loadReportLoading ? (
          <div style={{ color: "var(--text-secondary)" }}>
            <span
              className="material-symbols-outlined"
              style={{ verticalAlign: "middle", marginRight: 6 }}
            >
              progress_activity
            </span>
            Cargando...
          </div>
        ) : !loadReport ? (
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ color: "var(--text-secondary)" }}>
              No hay informe para esta carga
            </div>
            {!isReadOnlyActions && (impliedHasLoadReport || canManageLoads) && (
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={generateLoadReport}
                  disabled={loadReportLoading}
                >
                  Generar informe
                </button>
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            <div
              style={{
                padding: "10px 12px",
                border: "1px solid var(--border)",
                borderRadius: 10,
                background: "var(--hover)",
                display: "grid",
                gap: 6,
              }}
            >
              <div style={{ fontWeight: 900 }}>
                {loadReport.load_nombre || load.nombre || loadId}
              </div>
              <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>
                Finalizado: {formatMaybeDateTime(loadReport.finished_at) || "-"}
              </div>
            </div>
            {!isReadOnlyActions && (
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={exportLoadReportPdf}
                >
                  Exportar PDF
                </button>
              </div>
            )}

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
              }}
            >
              <div>
                <div className="label">Cargado por</div>
                <div style={{ fontWeight: 700 }}>
                  {Array.isArray(loadReport.cargado_por) &&
                  loadReport.cargado_por.length > 0
                    ? loadReport.cargado_por
                        .map((u) => String(u?.name || u?.nombre || "").trim())
                        .filter(Boolean)
                        .join(", ") || "-"
                    : "-"}
                </div>
              </div>
              <div>
                <div className="label">Palets</div>
                <div style={{ fontWeight: 700 }}>
                  {Number(loadReport.pallet_count || 0)}
                </div>
              </div>
              <div>
                <div className="label">Chofer</div>
                <div style={{ fontWeight: 700 }}>
                  {String(loadReport.cargado_a?.chofer_name || "").trim() ||
                    "-"}
                </div>
              </div>
              <div>
                <div className="label">Consignatario</div>
                <div style={{ fontWeight: 700 }}>
                  {String(
                    loadReport.cargado_a?.consignatario_name || "",
                  ).trim() || "-"}
                </div>
              </div>
            </div>

            <div>
              <div className="label">Notas</div>
              <div
                style={{
                  whiteSpace: "pre-wrap",
                  padding: "10px 12px",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  background: "#fff",
                  minHeight: 72,
                }}
              >
                {String(loadReport.notas || "").trim() || "-"}
              </div>
            </div>

            {Array.isArray(loadReport.pallet_ids) &&
              loadReport.pallet_ids.length > 0 && (
                <div>
                  <div className="label">IDs de palets</div>
                  <div
                    style={{
                      padding: "10px 12px",
                      border: "1px solid var(--border)",
                      borderRadius: 10,
                      background: "#fff",
                      maxHeight: 180,
                      overflow: "auto",
                      display: "grid",
                      gap: 6,
                      fontFamily:
                        "ui-monospace, SFMono-Regular, Menlo, monospace",
                      fontSize: 12,
                    }}
                  >
                    {loadReport.pallet_ids.map((pid) => (
                      <div key={String(pid)}>{String(pid)}</div>
                    ))}
                  </div>
                </div>
              )}
          </div>
        )}
      </Modal>

      <Modal
        open={open}
        title="Modificar carga"
        onClose={() => setOpen(false)}
        onSubmit={submit}
        submitLabel="Guardar"
        width={640}
        bodyStyle={{ gridTemplateColumns: "1fr" }}
      >
        <div style={{ display: "grid", gap: 12 }}>
          {/* Datos básicos */}
          <div style={{ display: "grid", gap: 8 }}>
            <div className="label">Barco</div>
            <select
              className="input"
              value={form.barco}
              onChange={(e) => setForm({ ...form, barco: e.target.value })}
            >
              <option value="">Selecciona barco</option>
              {ships.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.nombre_del_barco}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            <div className="label">Fecha y hora de carga</div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
              }}
            >
              <input
                type="date"
                className="input"
                value={form.fecha_de_carga}
                onChange={(e) =>
                  setForm({ ...form, fecha_de_carga: e.target.value })
                }
              />
              <input
                type="time"
                className="input"
                value={form.hora_de_carga}
                onChange={(e) =>
                  setForm({ ...form, hora_de_carga: e.target.value })
                }
              />
            </div>
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            <div className="label">Fecha y hora de descarga</div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
              }}
            >
              <input
                type="date"
                className="input"
                value={form.fecha_de_descarga}
                onChange={(e) =>
                  setForm({ ...form, fecha_de_descarga: e.target.value })
                }
              />
              <input
                type="time"
                className="input"
                value={form.hora_de_descarga}
                onChange={(e) =>
                  setForm({ ...form, hora_de_descarga: e.target.value })
                }
              />
            </div>
          </div>

          {/* Entrega */}
          <div style={{ display: "grid", gap: 8 }}>
            <div className="label">Entrega</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {ENTREGA_OPTIONS.map((opt) => (
                <label
                  key={opt}
                  style={{ display: "flex", alignItems: "center", gap: 4 }}
                >
                  <input
                    type="checkbox"
                    checked={form.entrega.includes(opt)}
                    onChange={(e) => {
                      const next = e.target.checked
                        ? [...form.entrega, opt]
                        : form.entrega.filter((v) => v !== opt);
                      setForm({ ...form, entrega: next });
                    }}
                  />
                  {opt}
                </label>
              ))}
            </div>
          </div>

          {/* Personas */}
          <div style={{ display: "grid", gap: 6 }}>
            <div className="label">Responsable</div>
            <input
              className="input"
              value={responsableQuery}
              onChange={(e) => setResponsableQuery(e.target.value)}
              placeholder="Buscar responsable por nombre"
            />
            <select
              className="input"
              value={form.responsable}
              onChange={(e) =>
                setForm({ ...form, responsable: e.target.value })
              }
            >
              <option value="">Sin responsable</option>
              {responsables
                .filter((r) => {
                  const q = String(responsableQuery || "")
                    .trim()
                    .toLowerCase();
                  if (!q) return true;
                  return String(r.nombre || "")
                    .toLowerCase()
                    .includes(q);
                })
                .sort((a, b) =>
                  String(a.nombre || "").localeCompare(
                    String(b.nombre || ""),
                    "es",
                  ),
                )
                .map((r) => (
                  <option key={r._id} value={r._id}>
                    {r.nombre}
                    {r.email ? ` (${r.email})` : ""}
                  </option>
                ))}
            </select>
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            <div className="label">Chofer</div>
            <select
              className="input"
              value={form.chofer}
              onChange={(e) => setForm({ ...form, chofer: e.target.value })}
            >
              <option value="">Sin chofer</option>
              {users
                .filter((u) => u.role === "driver")
                .map((u) => (
                  <option key={u._id} value={u._id}>
                    {u.name} ({u.email})
                  </option>
                ))}
            </select>
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            <div className="label">Consignatario</div>
            <select
              className="input"
              value={form.consignatario}
              onChange={(e) =>
                setForm({ ...form, consignatario: e.target.value })
              }
            >
              <option value="">Sin consignatario</option>
              {consignees.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.nombre}
                  {c.email ? ` (${c.email})` : ""}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            <div className="label">Terminal de entrega</div>
            <select
              className="input"
              value={form.terminal_entrega}
              onChange={(e) =>
                setForm({ ...form, terminal_entrega: e.target.value })
              }
            >
              <option value="">Sin terminal</option>
              {(() => {
                const groups = {};
                locations.forEach((l) => {
                  const port =
                    String(l.puerto || "Sin puerto").trim() || "Sin puerto";
                  if (!groups[port]) groups[port] = [];
                  groups[port].push(l);
                });
                const sortedPorts = Object.keys(groups).sort((a, b) =>
                  a.localeCompare(b, "es"),
                );
                return sortedPorts.map((port) => (
                  <optgroup key={port} label={port}>
                    {groups[port]
                      .slice()
                      .sort((a, b) =>
                        String(a.nombre || "").localeCompare(
                          String(b.nombre || ""),
                          "es",
                        ),
                      )
                      .map((l) => (
                        <option key={l._id} value={l._id}>
                          {l.nombre}
                          {l.ciudad ? ` (${l.ciudad})` : ""}
                        </option>
                      ))}
                  </optgroup>
                ));
              })()}
            </select>
          </div>

          {/* Palets */}
          <div style={{ display: "grid", gap: 8 }}>
            <div className="label">Palets</div>
            <select
              multiple
              className="input"
              value={form.palets}
              onChange={(e) => {
                const selected = Array.from(e.target.selectedOptions).map(
                  (o) => o.value,
                );
                setForm({ ...form, palets: selected });
              }}
            >
              {pallets.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.numero_palet} ({p.tipo})
                </option>
              ))}
            </select>
          </div>

          {/* Tipo de carga */}
          <div style={{ display: "grid", gap: 8 }}>
            <div className="label">Tipo de carga</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {CARGA_OPTIONS.map((opt) => (
                <label
                  key={opt}
                  style={{ display: "flex", alignItems: "center", gap: 4 }}
                >
                  <input
                    type="checkbox"
                    checked={form.carga.includes(opt)}
                    onChange={(e) => {
                      const next = e.target.checked
                        ? [...form.carga, opt]
                        : form.carga.filter((v) => v !== opt);
                      setForm({ ...form, carga: next });
                    }}
                  />
                  {opt}
                </label>
              ))}
            </div>
          </div>

          {/* Opciones */}
          <div style={{ display: "grid", gap: 8 }}>
            <div className="label">Opciones</div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
              }}
            >
              <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input
                  type="checkbox"
                  checked={form.lancha}
                  onChange={(e) =>
                    setForm({ ...form, lancha: e.target.checked })
                  }
                />{" "}
                Es lancha
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input
                  type="checkbox"
                  checked={form.cash}
                  onChange={(e) => setForm({ ...form, cash: e.target.checked })}
                />{" "}
                Cobro en efectivo
              </label>
            </div>
          </div>

          {/* Estado de carga */}
          <div style={{ display: "grid", gap: 8 }}>
            <div className="label">Estado de Carga</div>
            <select
              className="select"
              value={form.estado_viaje}
              onChange={(e) =>
                setForm({ ...form, estado_viaje: e.target.value })
              }
            >
              {ESTADO_VIAJE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Modal>

      <Modal
        open={openCreatePallet}
        title="Crear palet"
        onClose={() => setOpenCreatePallet(false)}
        onSubmit={async () => {
          const numero = String(createPalletForm.numero_palet || "").trim();
          if (!numero) {
            setSnack({
              open: true,
              message: "El número de palet es obligatorio",
              type: "error",
            });
            return;
          }
          try {
            const created = await createPallet({
              ...createPalletForm,
              carga: String(id || ""),
              creado_por: getCurrentUser()?.name || "Testing",
            });
            if (!created) {
              setSnack({
                open: true,
                message: "Error creando palet",
                type: "error",
              });
              return;
            }
            setPallets((prev) => [
              ...prev,
              {
                ...created,
                _id: created._id || created.id,
                id: created.id || created._id,
              },
            ]);
            setOpenCreatePallet(false);
            setCreatePalletForm({
              numero_palet: "",
              tipo: "Seco",
              base: "Europeo",
              productos: "",
            });
            setSnack({ open: true, message: "Palet creado", type: "success" });
          } catch (e) {
            const msg = String(e?.message || "");
            setSnack({
              open: true,
              message: msg || "Error creando palet",
              type: "error",
            });
          }
        }}
        submitLabel="Crear"
      >
        <div style={{ display: "grid", gap: 12 }}>
          <div>
            <div className="label">Número de palet</div>
            <input
              className="input"
              value={createPalletForm.numero_palet}
              onChange={(e) =>
                setCreatePalletForm({
                  ...createPalletForm,
                  numero_palet: e.target.value,
                })
              }
              placeholder="Nº de palet"
            />
          </div>
          <div>
            <div className="label">Tipo</div>
            <select
              className="select"
              value={createPalletForm.tipo}
              onChange={(e) =>
                setCreatePalletForm({
                  ...createPalletForm,
                  tipo: e.target.value,
                })
              }
            >
              {CARGA_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div className="label">Base</div>
            <select
              className="select"
              value={createPalletForm.base}
              onChange={(e) =>
                setCreatePalletForm({
                  ...createPalletForm,
                  base: e.target.value,
                })
              }
            >
              <option value="Europeo">Europeo</option>
              <option value="Americano">Americano</option>
            </select>
          </div>
          <div>
            <div className="label">Productos</div>
            <textarea
              className="input"
              rows="4"
              value={createPalletForm.productos}
              onChange={(e) =>
                setCreatePalletForm({
                  ...createPalletForm,
                  productos: e.target.value,
                })
              }
            />
          </div>
        </div>
      </Modal>

      <Modal
        open={openDriverFinalize}
        title="Finalizar carga"
        onClose={() => setOpenDriverFinalize(false)}
        cancelLabel="Cerrar"
        width={520}
        bodyStyle={{ gridTemplateColumns: "1fr" }}
      >
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ fontSize: 15 }}>
            Selecciona el estado final de la carga.
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button
              type="button"
              className="secondary-button"
              disabled={finalizeSubmitting}
              onClick={() => driverFinalizeTo("Cancelado")}
            >
              Cancelado
            </button>
            <button
              type="button"
              className="primary-button"
              disabled={finalizeSubmitting}
              onClick={() => driverFinalizeTo("Entregado")}
            >
              Entregado
            </button>
          </div>
        </div>
      </Modal>

      <Snackbar
        open={snack.open}
        message={snack.message}
        type={snack.type}
        onClose={() => setSnack({ ...snack, open: false })}
      />
    </section>
  );
}
