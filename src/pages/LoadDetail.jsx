import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Modal from "../components/Modal.jsx";
import Snackbar from "../components/Snackbar.jsx";
import {
  getCurrentRole,
  hasPermission,
  PERMISSIONS,
  getCurrentUser,
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
  createPallet,
  fusePallets,
  updateLoadById,
  logInteraction,
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

function buildHojaCargaPageHtml({ cliente, fechaPrevistaEntrega, numeros }) {
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
  const buildRows = (offset) => {
    const rows = [];
    for (let i = 0; i < 15; i += 1) {
      const n = nums[offset + i] ?? "";
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
      <div class="sheet-rot">
        <div class="sheet-top">
          <div></div>
          <div class="sheet-title">HOJA DE CARGA</div>
        </div>

        <div class="sheet-meta">
          <div class="meta-row">
            <span class="meta-label">CLIENTE:</span>
            <span class="meta-value">${escapeHtml(cliente || "-")}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">FECHA PREVISTA DE ENTREGA:</span>
            <span class="meta-value">${escapeHtml(
              fechaPrevistaEntrega || "-"
            )}</span>
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

        <div class="sheet-grid">
          <table class="sheet-table" aria-label="Tabla palets 1-15">
            <thead><tr>${ths}</tr></thead>
            <tbody>${buildRows(0)}</tbody>
          </table>
          <table class="sheet-table" aria-label="Tabla palets 16-30">
            <thead><tr>${ths}</tr></thead>
            <tbody>${buildRows(15)}</tbody>
          </table>
        </div>

        <div class="sheet-footer">
          <div class="footer-title">PALETS QUE SE REMONTAN:</div>
          <div class="footer-lines">
            <div class="line"></div>
            <div class="line"></div>
            <div class="line"></div>
          </div>
        </div>
      </div>
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
        })
      );
    }
  }
  if (includeNumbers) {
    for (let n = numbersFrom; n <= numbersTo; n += 1) {
      const big = escapeHtml(String(n));
      pages.push(`
        <div class="page numero-page">
          <div class="top">
            <div class="small-circle">${big}</div>
          </div>
          <div class="ship">${escapeHtml(shipName || "")}</div>
          <div class="big">${big}</div>
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
          padding: 0;
        }
        .sheet-rot {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 297mm;
          height: 210mm;
          transform: translate(-50%, -50%) rotate(-90deg);
          transform-origin: center;
          padding: 12mm 12mm 14mm;
        }
        .sheet-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 6mm;
        }
        .sheet-title {
          font-weight: 700;
          font-size: 28px;
          letter-spacing: 0.5px;
          color: #111827;
          text-transform: uppercase;
        }
        .sheet-meta {
          display: grid;
          gap: 4px;
          font-size: 13px;
          color: #111827;
          margin-bottom: 8mm;
        }
        .meta-row { display: flex; gap: 8px; }
        .meta-label { font-weight: 700; white-space: nowrap; }
        .meta-value { font-weight: 700; }
        .sheet-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10mm;
          align-items: start;
        }
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
          padding: 3px 4px;
        }
        .sheet-table th {
          text-align: center;
          font-weight: 700;
          font-size: 9px;
          line-height: 1.15;
        }
        .sheet-table td {
          height: 18px;
          vertical-align: middle;
        }
        .c-num { width: 12%; text-align: center; font-weight: 700; }
        .c-tipo { width: 44%; }
        .c-quien { width: 28%; }
        .c-camion { width: 16%; }
        .sheet-footer {
          margin-top: 10mm;
          display: grid;
          gap: 6px;
        }
        .footer-title { font-weight: 700; font-size: 12px; }
        .footer-lines {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 12mm;
        }
        .footer-lines .line {
          border-bottom: 1px solid #111827;
          height: 18px;
        }
        .top {
          position: absolute;
          top: 14mm;
          left: 18mm;
          right: 18mm;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
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
          width: 54px;
          height: 54px;
          border: 3px solid #111827;
          border-radius: 999px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 24px;
        }
        .ship {
          margin-top: 20mm;
          text-align: center;
          font-size: 56px;
          font-weight: 500;
          letter-spacing: 2px;
          color: #111827;
          text-transform: uppercase;
          line-height: 1.05;
          padding: 0 8mm;
          word-break: break-word;
        }
        .big {
          margin-top: 38mm;
          text-align: center;
          font-size: 280px;
          font-weight: 800;
          color: #111827;
          line-height: 1;
        }
        .bottom {
          position: absolute;
          left: 18mm;
          right: 18mm;
          bottom: 18mm;
          border-top: 2px dashed #9ca3af;
          padding-top: 10mm;
          display: grid;
          gap: 8px;
          font-size: 24px;
          letter-spacing: 0.5px;
          color: #111827;
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
          body { background: white; }
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
            l.terminal_entrega?._id || l.terminal_entrega || ""
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
          r.status === "fulfilled" && Array.isArray(r.value) ? r.value : []
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

  const currentUser = getCurrentUser();
  const role = getCurrentRole() || currentUser?.role || null;
  const canManageLoads =
    hasPermission(role, PERMISSIONS.MANAGE_LOADS) ||
    String(role || "")
      .trim()
      .toLowerCase() === "dispatcher";
  const canManagePallets =
    hasPermission(role, PERMISSIONS.MANAGE_PALLETS) ||
    canManageLoads ||
    String(role || "")
      .trim()
      .toLowerCase() === "dispatcher";
  const canDeleteLoad =
    String(role || "")
      .trim()
      .toLowerCase() === "dispatcher";

  const folioMeta = useMemo(() => {
    if (!load) return { shipName: "", dateLabel: "-", portLabel: "-" };
    const barcoId = String(load?.barco?._id || load?.barco || "");
    const terminalEntregaId = String(
      load?.terminal_entrega?._id || load?.terminal_entrega || ""
    );
    const ship =
      ships.find((s) => String(s?._id || s?.id || "") === barcoId) ||
      (load?.barco && typeof load.barco === "object" ? load.barco : null);
    const terminal =
      locations.find(
        (l) => String(l?._id || l?.id || "") === terminalEntregaId
      ) ||
      (load?.terminal_entrega && typeof load.terminal_entrega === "object"
        ? load.terminal_entrega
        : null);
    const shipName = String(ship?.nombre_del_barco || "").trim();
    const dateLabel = formatDateLabel(load?.fecha_de_carga);
    const puerto = String(terminal?.puerto || "").trim();
    const nombre = String(terminal?.nombre || "").trim();
    const portLabel = (puerto || nombre || "-").toUpperCase();
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
        `¿Seguro que deseas borrar la carga "${label || String(id || "")}"?`
      )
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

  if (!load) return <p>Cargando...</p>;

  const loadId = String(load?._id || load?.id || id || "");

  const palletsInLoad = (() => {
    const byRelation = pallets.filter(
      (p) => String(p.carga?._id || p.carga) === String(loadId)
    );
    const byArrayIds = Array.isArray(load.palets)
      ? load.palets.map((p) => String(p?._id || p?.id || p)).filter(Boolean)
      : [];
    const byId = new Map(
      byRelation.map((p) => [String(p._id || p.id), p]).filter((p) => p[0])
    );
    byArrayIds.forEach((pid) => {
      const found = pallets.find((p) => String(p._id || p.id) === String(pid));
      if (found) byId.set(String(found._id || found.id), found);
    });
    return Array.from(byId.values());
  })();

  const totalPallets = palletsInLoad.length;
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
    { europeo: 0, americano: 0 }
  );

  const fuseTarget = palletsInLoad.find(
    (p) => String(p._id) === String(fuseTargetId)
  );
  const fuseOthers = palletsInLoad.filter(
    (p) => String(p._id) !== String(fuseTargetId)
  );
  const fuseParsedNumbers = parseNumeroPaletsInput(fuseNumbers);
  const fuseMatchedByNumbers = palletsInLoad.filter(
    (p) =>
      fuseParsedNumbers.includes(String(p.numero_palet)) &&
      String(p._id) !== String(fuseTargetId)
  );
  const fuseMissingNumbers = fuseParsedNumbers.filter(
    (n) =>
      !palletsInLoad.some(
        (p) =>
          String(p.numero_palet) === String(n) &&
          String(p._id) !== String(fuseTargetId)
      )
  );

  const openFuseModal = () => {
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
          fuseSourceIds.some((sid) => String(sid) === String(p?._id))
        )
      : fuseMatchedByNumbers;
    const baseCandidates = Array.from(
      new Set(
        [
          normalizeBase(fuseTarget?.base),
          ...selectedSources.map((p) => normalizeBase(p?.base)),
        ]
          .map((v) => String(v || "").trim())
          .filter(Boolean)
      )
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
        }))
      );
      if (l) {
        setForm({
          barco: String(l.barco?._id || l.barco || ""),
          entrega: Array.isArray(l.entrega) ? l.entrega : [],
          chofer: String(l.chofer?._id || l.chofer || ""),
          responsable: String(l.responsable?._id || l.responsable || ""),
          consignatario: String(l.consignatario?._id || l.consignatario || ""),
          terminal_entrega: String(
            l.terminal_entrega?._id || l.terminal_entrega || ""
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
          .filter(Boolean)
      )
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
        }))
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
    (p) => String(p._id) === String(fuseDnDSourceId)
  );
  const fuseDnDTarget = palletsInLoad.find(
    (p) => String(p._id) === String(fuseDnDTargetId)
  );

  const shipById = new Map(
    ships.map((s) => [String(s._id || s.id || ""), s]).filter((p) => p[0])
  );
  const userById = new Map(
    users.map((u) => [String(u._id || u.id || ""), u]).filter((p) => p[0])
  );
  const consigneeById = new Map(
    consignees.map((c) => [String(c._id || c.id || ""), c]).filter((p) => p[0])
  );
  const locationById = new Map(
    locations.map((l) => [String(l._id || l.id || ""), l]).filter((p) => p[0])
  );

  const barcoId = String(load?.barco?._id || load?.barco || "");
  const choferId = String(load?.chofer?._id || load?.chofer || "");
  const consignatarioId = String(
    load?.consignatario?._id || load?.consignatario || ""
  );
  const terminalEntregaId = String(
    load?.terminal_entrega?._id || load?.terminal_entrega || ""
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

  return (
    <section className="card">
      <div className="card-header">
        <h2 className="card-title">Detalle carga</h2>
        <div style={{ display: "flex", gap: 8 }}>
          {canManageLoads && (
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
          {canManagePallets && (
            <button
              className="icon-button"
              onClick={openFuseModal}
              title="Fusionar palets"
            >
              <span className="material-symbols-outlined">call_merge</span>
            </button>
          )}
          <button
            className="icon-button"
            onClick={() => setOpenCreatePallet(true)}
            title="Crear palet"
          >
            <span className="material-symbols-outlined">add_box</span>
          </button>
          {canManageLoads && (
            <button
              className="icon-button"
              onClick={openFolioModal}
              title="Número"
            >
              <span className="material-symbols-outlined">description</span>
            </button>
          )}
          {canDeleteLoad && (
            <button
              className="icon-button"
              onClick={handleDelete}
              title="Borrar carga"
              disabled={deleting}
            >
              <span className="material-symbols-outlined">delete</span>
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

        <div className="card" style={{ marginTop: 12 }}>
          <div className="card-header">
            <h3 className="card-title">Resumen palets</h3>
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
                    const avatarText = (() => {
                      if (nombre && !nombre.includes(" - ")) return nombre;
                      if (numero) return numero;
                      if (nombre) return nombre.split(" - ")[0];
                      return "?";
                    })();
                    const title = (() => {
                      const n = String(p?.nombre || "").trim();
                      if (n) return n;
                      if (numero) return numero;
                      return "Palet";
                    })();
                    const subtitle = [tipo, base].filter(Boolean).join(" · ");
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
                          if (!idStr) return;
                          if (isTouchMode) {
                            e.stopPropagation();
                            if (isDoubleTap(idStr)) {
                              clearDnDState();
                              navigate(`/app/palets/${pid}`);
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
                          navigate(`/app/palets/${pid}`);
                        }}
                      >
                        <div className="card-item-header">
                          <div
                            className="avatar"
                            style={{
                              fontSize: String(avatarText).length > 3 ? 12 : 16,
                              padding: 4,
                              textAlign: "center",
                              lineHeight: "14px",
                            }}
                          >
                            {avatarText}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div
                              className="card-item-title"
                              style={{ fontSize: 16, lineHeight: "20px" }}
                            >
                              {title}
                            </div>
                            <div className="card-item-sub">
                              {subtitle || " "}
                            </div>
                          </div>
                        </div>
                        <div className="card-item-meta">
                          {tipo && <span className="chip">{tipo}</span>}
                          {base && <span className="chip">{base}</span>}
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
                .filter(Boolean)
            )
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
                prev.filter((pid) => String(pid) !== String(nextTarget))
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
                  fuseSourceIds.some((sid) => String(sid) === String(p?._id))
                )
              : fuseMatchedByNumbers;
          const baseCandidates = Array.from(
            new Set(
              [
                normalizeBase(fuseTarget?.base),
                ...selectedSources.map((p) => normalizeBase(p?.base)),
              ]
                .map((v) => String(v || "").trim())
                .filter(Boolean)
            )
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
                  (pid) => String(pid) === String(p._id)
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
              <button
                className="secondary-button"
                onClick={() => setFolioStep("config")}
              >
                Cambiar rango
              </button>
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
                    "es"
                  )
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
                  a.localeCompare(b, "es")
                );
                return sortedPorts.map((port) => (
                  <optgroup key={port} label={port}>
                    {groups[port]
                      .slice()
                      .sort((a, b) =>
                        String(a.nombre || "").localeCompare(
                          String(b.nombre || ""),
                          "es"
                        )
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
                  (o) => o.value
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

      <Snackbar
        open={snack.open}
        message={snack.message}
        type={snack.type}
        onClose={() => setSnack({ ...snack, open: false })}
      />
    </section>
  );
}
