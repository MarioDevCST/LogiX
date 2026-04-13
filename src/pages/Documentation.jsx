import { useEffect, useMemo, useRef, useState } from "react";
import EnvBadge from "../components/EnvBadge.jsx";
import Modal from "../components/Modal.jsx";
import {
  fetchAllCompanies,
  fetchAllConsignees,
  fetchAllLoads,
  fetchAllLocations,
  fetchAllPallets,
  fetchAllShips,
} from "../firebase/auth.js";

function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "Selecciona",
  searchPlaceholder = "Buscar...",
  disabled = false,
  maxHeight = 260,
} = {}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef(null);

  const selected = useMemo(() => {
    const val = String(value ?? "");
    return (options || []).find((o) => String(o?.value ?? "") === val) || null;
  }, [options, value]);

  const filtered = useMemo(() => {
    const q = String(query || "")
      .trim()
      .toLowerCase();
    const list = Array.isArray(options) ? options : [];
    if (!q) return list;
    return list.filter((o) =>
      String(o?.label || "")
        .toLowerCase()
        .includes(q),
    );
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      const el = rootRef.current;
      if (!el) return;
      if (el.contains(e.target)) return;
      setOpen(false);
      setQuery("");
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("touchstart", onDown, { passive: true });
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("touchstart", onDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      <button
        type="button"
        className="input"
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setOpen((v) => !v);
        }}
        style={{
          width: "100%",
          textAlign: "left",
          cursor: disabled ? "not-allowed" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <span style={{ color: selected ? "inherit" : "var(--text-secondary)" }}>
          {selected ? selected.label : placeholder}
        </span>
        <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
          {open ? "expand_less" : "expand_more"}
        </span>
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            zIndex: 200,
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 10,
            boxShadow: "0 10px 30px rgba(0,0,0,0.10)",
            padding: 10,
          }}
        >
          <input
            className="input"
            style={{ width: "100%", height: 36, marginBottom: 8 }}
            placeholder={searchPlaceholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div
            style={{
              display: "grid",
              gap: 6,
              maxHeight,
              overflowY: "auto",
              paddingRight: 4,
            }}
          >
            {filtered.length === 0 ? (
              <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>
                Sin resultados
              </div>
            ) : (
              filtered.map((opt) => (
                <button
                  key={String(opt?.value ?? opt?.label ?? "")}
                  type="button"
                  onClick={() => {
                    onChange?.(String(opt?.value ?? ""));
                    setOpen(false);
                    setQuery("");
                  }}
                  style={{
                    border: "none",
                    background: "transparent",
                    textAlign: "left",
                    cursor: "pointer",
                    padding: "8px 10px",
                    borderRadius: 8,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                  }}
                >
                  <span style={{ fontWeight: 600 }}>{opt?.label}</span>
                  {String(value ?? "") === String(opt?.value ?? "") && (
                    <span className="material-symbols-outlined">check</span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Documentation() {
  const updatedAt = useMemo(() => {
    return new Intl.DateTimeFormat("es-ES", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  }, []);

  const FIXED_CMR_REMITENTE_NOMBRE = "EIS MARÍTIMO S.A. (BARCELONA)";
  const FIXED_CMR_REMITENTE_DIRECCION =
    "CARRER DE L'ATLANTIC Nº 132-136\nPOLÍGONO ZAL BARCELONA\n08040 - BARCELONA (SPAIN)";
  const FIXED_CMR_PLACE_OF_TAKING_OVER =
    "EIS MARITIMO, S.A. (DELEGACIÓN DE BARCELONA)";
  const FIXED_CMR_ESTABLECIDO_EN = "EIS MARÏTIMO, S.A.";
  const FIXED_CARTA_EMPRESA_NOMBRE = "EIS MARÍTIMO S.A. (BARCELONA)";
  const FIXED_CARTA_EMPRESA_DIRECCION =
    "CARRER DE L'ATLANTIC Nº 132-136\nPOLÍGONO ZAL BARCELONA\n08040 - BARCELONA (SPAIN)";

  const [openCmr, setOpenCmr] = useState(false);
  const [openCartaPorte, setOpenCartaPorte] = useState(false);
  const getEmptyCmr = () => ({
    load_id: "",
    remitente_empresa_id: "",
    remitente_nombre: FIXED_CMR_REMITENTE_NOMBRE,
    remitente_direccion: FIXED_CMR_REMITENTE_DIRECCION,
    destinatario_terminal_id: "",
    destinatario_nombre: "",
    destinatario_direccion: "",
    lugar_entrega: "",
    lugar_entrega_terminal_id: "",
    lugar_carga: FIXED_CMR_PLACE_OF_TAKING_OVER,
    fecha_carga: "",
    documentos_anexos: "",
    portador_empresa_id: "",
    portador_nombre: "",
    portador_direccion: "",
    matricula_tractora: "",
    matricula_remolque: "",
    mercancia: "",
    temperatura: "",
    palets: "",
    peso_bruto_kg: "",
    volumen_m3: "",
    sello_seguridad: "",
    instrucciones: "",
    total_cantidad: "",
    fecha_entrega_estimada: "",
    establecido_en: "",
    establecido_fecha: "",
  });
  const [cmr, setCmr] = useState(getEmptyCmr);
  const getDefaultCmrFormSections = () => ({
    asignar: true,
    destinatario: true,
    carga: true,
    documentos: false,
    portador: false,
    mercancia: false,
    medidas: false,
    instrucciones: false,
    establecido: false,
  });
  const [cmrFormSections, setCmrFormSections] = useState(
    getDefaultCmrFormSections,
  );

  const CmrSection = ({ id, title, children }) => {
    const isOpen = !!cmrFormSections[id];
    const toggle = () => {
      setCmrFormSections((p) => ({ ...p, [id]: !p[id] }));
    };
    return (
      <div
        style={{
          border: "1px solid var(--border)",
          borderRadius: 10,
          background: "#fff",
          overflow: "visible",
        }}
      >
        <button
          type="button"
          onClick={toggle}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            fontWeight: 800,
            width: "100%",
            border: "none",
            background: "transparent",
            padding: "10px 12px",
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          <span>{title}</span>
          <span
            className="material-symbols-outlined"
            style={{
              fontSize: 20,
              color: "var(--text-secondary)",
            }}
          >
            {isOpen ? "expand_less" : "expand_more"}
          </span>
        </button>
        {isOpen && (
          <div
            style={{
              display: "grid",
              gap: 10,
              padding: "10px 12px 12px 12px",
              borderTop: "1px solid var(--border)",
            }}
          >
            {children}
          </div>
        )}
      </div>
    );
  };

  const getDefaultCartaFormSections = () => ({
    asignar: true,
    datos: true,
    empresas: false,
    transportista: false,
    destinatario: false,
    mercancia: false,
    medidas: false,
  });
  const [cartaFormSections, setCartaFormSections] = useState(
    getDefaultCartaFormSections,
  );

  const CartaSection = ({ id, title, children }) => {
    const isOpen = !!cartaFormSections[id];
    const toggle = () => {
      setCartaFormSections((p) => ({ ...p, [id]: !p[id] }));
    };
    return (
      <div
        style={{
          border: "1px solid var(--border)",
          borderRadius: 10,
          background: "#fff",
          overflow: "visible",
        }}
      >
        <button
          type="button"
          onClick={toggle}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            fontWeight: 800,
            width: "100%",
            border: "none",
            background: "transparent",
            padding: "10px 12px",
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          <span>{title}</span>
          <span
            className="material-symbols-outlined"
            style={{
              fontSize: 20,
              color: "var(--text-secondary)",
            }}
          >
            {isOpen ? "expand_less" : "expand_more"}
          </span>
        </button>
        {isOpen && (
          <div
            style={{
              display: "grid",
              gap: 10,
              padding: "10px 12px 12px 12px",
              borderTop: "1px solid var(--border)",
            }}
          >
            {children}
          </div>
        )}
      </div>
    );
  };

  const getEmptyCartaPorte = () => ({
    load_id: "",
    fecha_transporte: "",
    origen_carga: "",
    destino_carga: "",
    destino_terminal_id: "",
    matricula_tractora: "",
    matricula_remolque: "",
    empresa_cargadora_id: "",
    empresa_cargadora_nombre: FIXED_CARTA_EMPRESA_NOMBRE,
    empresa_cargadora_direccion: FIXED_CARTA_EMPRESA_DIRECCION,
    empresa_expedidora_id: "",
    empresa_expedidora_nombre: FIXED_CARTA_EMPRESA_NOMBRE,
    empresa_expedidora_direccion: FIXED_CARTA_EMPRESA_DIRECCION,
    empresa_transportista_id: "",
    empresa_transportista_nombre: "",
    empresa_transportista_direccion: "",
    conductor_nombre: "",
    conductor_dni: "",
    precinto: "",
    destinatario_nombre: "",
    destinatario_direccion: "",
    mercancia: "",
    temperatura: "",
    bultos: "",
    peso_kg: "",
  });
  const [cartaPorte, setCartaPorte] = useState(getEmptyCartaPorte);

  const [locations, setLocations] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [consignees, setConsignees] = useState([]);
  const [ships, setShips] = useState([]);
  const [loads, setLoads] = useState([]);
  const [pallets, setPallets] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(false);

  useEffect(() => {
    const palets = String(cmr.palets ?? "").trim();
    const total = String(cmr.total_cantidad ?? "").trim();
    const isAutoTotal = total ? /^\d+\s*PALLETS$/i.test(total) : true;
    if (!isAutoTotal) return;
    const next = palets ? `${palets} PALLETS` : "";
    if (total === next) return;
    setCmr((p) => ({ ...p, total_cantidad: next }));
  }, [cmr.palets, cmr.total_cantidad]);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        setCatalogLoading(true);
        const results = await Promise.allSettled([
          fetchAllLocations(),
          fetchAllCompanies(),
          fetchAllConsignees(),
          fetchAllShips(),
          fetchAllLoads(),
          fetchAllPallets(),
        ]);
        const locs =
          results[0]?.status === "fulfilled" && Array.isArray(results[0].value)
            ? results[0].value
            : [];
        const comps =
          results[1]?.status === "fulfilled" && Array.isArray(results[1].value)
            ? results[1].value
            : [];
        const lds =
          results[4]?.status === "fulfilled" && Array.isArray(results[4].value)
            ? results[4].value
            : [];
        const pals =
          results[5]?.status === "fulfilled" && Array.isArray(results[5].value)
            ? results[5].value
            : [];
        const cons =
          results[2]?.status === "fulfilled" && Array.isArray(results[2].value)
            ? results[2].value
            : [];
        const shs =
          results[3]?.status === "fulfilled" && Array.isArray(results[3].value)
            ? results[3].value
            : [];
        if (!mounted) return;
        const normalize = (x) => ({
          ...x,
          _id: x?._id || x?.id,
          id: x?.id || x?._id,
        });
        setLocations(locs.map(normalize));
        setCompanies(comps.map(normalize));
        setConsignees(cons.map(normalize));
        setShips(shs.map(normalize));
        setLoads(lds.map(normalize));
        setPallets(pals.map(normalize));
      } finally {
        if (mounted) setCatalogLoading(false);
      }
    };
    run();
    return () => {
      mounted = false;
    };
  }, []);

  const fechaTransporteLabel = useMemo(() => {
    const raw = String(cartaPorte.fecha_transporte || "").trim();
    if (!raw) return "";
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return raw;
    const weekday = new Intl.DateTimeFormat("es-ES", {
      weekday: "long",
    }).format(d);
    const day = new Intl.DateTimeFormat("es-ES", { day: "2-digit" }).format(d);
    const month = new Intl.DateTimeFormat("es-ES", { month: "long" }).format(d);
    const year = new Intl.DateTimeFormat("es-ES", { year: "numeric" }).format(
      d,
    );
    return `${weekday}, ${day} de ${month} de ${year}`.toUpperCase();
  }, [cartaPorte.fecha_transporte]);

  const cmrFechaCargaLabel = useMemo(() => {
    const raw = String(cmr.fecha_carga || "").trim();
    if (!raw) return "";
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return raw;
    return new Intl.DateTimeFormat("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(d);
  }, [cmr.fecha_carga]);

  const terminalOptions = useMemo(() => {
    return locations
      .map((l) => {
        const id = String(l?._id || l?.id || "").trim();
        if (!id) return null;
        const puerto = String(l?.puerto || "").trim();
        const nombre = String(l?.nombre || "").trim();
        const label = `${puerto ? `${puerto} · ` : ""}${nombre}`.trim();
        return { value: id, label: label || id };
      })
      .filter(Boolean)
      .sort((a, b) => String(a.label).localeCompare(String(b.label), "es"));
  }, [locations]);

  const companyOptions = useMemo(() => {
    return companies
      .map((c) => {
        const id = String(c?._id || c?.id || "").trim();
        if (!id) return null;
        const nombre = String(c?.nombre || "").trim();
        return { value: id, label: nombre || id };
      })
      .filter(Boolean)
      .sort((a, b) => String(a.label).localeCompare(String(b.label), "es"));
  }, [companies]);

  const companyById = useMemo(() => {
    return new Map(
      companies
        .map((c) => [String(c?._id || c?.id || "").trim(), c])
        .filter((p) => p[0]),
    );
  }, [companies]);

  const getMixedId = useMemo(() => {
    return (value) => {
      if (!value) return "";
      if (typeof value === "object") {
        return String(value?._id || value?.id || value?.docId || "").trim();
      }
      return String(value || "").trim();
    };
  }, []);

  const getShipName = (value) => {
    if (!value) return "";
    if (typeof value === "object") {
      return String(
        value?.nombre_del_barco || value?.nombre || value?.name || "",
      ).trim();
    }
    const id = String(value || "").trim();
    return String(shipById.get(id)?.nombre_del_barco || "").trim();
  };

  const getConsigneeName = (value) => {
    if (!value) return "";
    if (typeof value === "object") {
      return String(value?.nombre || value?.name || "").trim();
    }
    const id = String(value || "").trim();
    return String(consigneeById.get(id)?.nombre || "").trim();
  };

  const getLocationLabel = (value) => {
    const id = getMixedId(value);
    if (!id) return "";
    const loc = locationById.get(id);
    if (!loc) return "";
    const puerto = String(loc.puerto || "").trim();
    const nombre = String(loc.nombre || "").trim();
    return `${puerto ? `${puerto} · ` : ""}${nombre}`.trim();
  };

  const locationById = useMemo(() => {
    return new Map(
      locations
        .map((l) => [String(l?._id || l?.id || "").trim(), l])
        .filter((p) => p[0]),
    );
  }, [locations]);

  const shipById = useMemo(() => {
    return new Map(
      ships
        .map((s) => [String(s?._id || s?.id || "").trim(), s])
        .filter((p) => p[0]),
    );
  }, [ships]);

  const consigneeById = useMemo(() => {
    return new Map(
      consignees
        .map((c) => [String(c?._id || c?.id || "").trim(), c])
        .filter((p) => p[0]),
    );
  }, [consignees]);

  const loadOptions = useMemo(() => {
    return loads
      .map((l) => {
        const id = String(l?._id || l?.id || "").trim();
        if (!id) return null;
        const nombre = String(l?.nombre || "").trim();
        const barcoId = getMixedId(l?.barco);
        const barcoNombre = barcoId
          ? String(shipById.get(barcoId)?.nombre_del_barco || "").trim()
          : "";
        const terminalId = getMixedId(l?.terminal_entrega);
        const terminalObj = terminalId ? locationById.get(terminalId) : null;
        const terminalLabel = terminalObj
          ? `${
              String(terminalObj.puerto || "").trim()
                ? `${String(terminalObj.puerto || "").trim()} · `
                : ""
            }${String(terminalObj.nombre || "").trim()}`.trim()
          : "";
        const fecha = String(l?.fecha_de_carga || "").trim();
        const label = `${nombre || "Carga"}${
          barcoNombre ? ` · ${barcoNombre}` : ""
        }${terminalLabel ? ` · ${terminalLabel}` : ""}${fecha ? ` · ${fecha}` : ""}`;
        return { value: id, label };
      })
      .filter(Boolean)
      .sort((a, b) => String(a.label).localeCompare(String(b.label), "es"));
  }, [getMixedId, loads, locationById, shipById]);

  const loadById = useMemo(() => {
    return new Map(
      loads
        .map((l) => [String(l?._id || l?.id || "").trim(), l])
        .filter((p) => p[0]),
    );
  }, [loads]);

  const palletCountByLoadId = useMemo(() => {
    const map = new Map();
    for (const p of pallets) {
      const cargaId = String(p?.carga?._id || p?.carga || "").trim();
      if (!cargaId) continue;
      map.set(cargaId, (map.get(cargaId) || 0) + 1);
    }
    return map;
  }, [pallets]);

  const terminalLabel = useMemo(() => {
    const id = String(cartaPorte.destino_terminal_id || "").trim();
    if (!id) return "";
    const found = terminalOptions.find((o) => String(o.value) === id);
    return found ? String(found.label || "").trim() : "";
  }, [cartaPorte.destino_terminal_id, terminalOptions]);

  const destinoLabel = useMemo(() => {
    const manual = String(cartaPorte.destino_carga || "").trim();
    return manual || terminalLabel || "";
  }, [cartaPorte.destino_carga, terminalLabel]);

  const createCartaPortePdf = () => {
    const escapeHtml = (value) =>
      String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");

    const html = `<!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Carta de Porte</title>
          <style>
            :root { color-scheme: light; }
            @page { size: A4; margin: 10mm; }
            html, body { height: 100%; }
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; margin: 0; color: #111; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .page { border: 2px solid #111; padding: 18px; width: 100%; box-sizing: border-box; min-height: 277mm; display: flex; flex-direction: column; }
            .top { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
            .title { font-weight: 800; font-size: 18px; text-align: center; flex: 1; }
            .logo { height: 42px; width: auto; object-fit: contain; }
            .line { border-top: 2px solid #111; margin-top: 12px; }
            .row { padding: 10px 0; font-size: 12px; }
            .label { font-weight: 700; }
            .value { font-weight: 800; }
            .grid2 { display: grid; grid-template-columns: 1fr 1fr; border-top: 2px solid #111; }
            .cell { padding: 10px; font-size: 12px; }
            .cell + .cell { border-left: 2px solid #111; }
            .block { border-top: 2px solid #111; padding: 10px; font-size: 12px; }
            .mono { white-space: pre-wrap; }
            .sign { border-top: 2px solid #111; padding: 14px 10px; margin-top: auto; }
            .signgrid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 12px; }
            @media print { body { margin: 0; } }
          </style>
        </head>
        <body>
          <div class="page">
            <div class="top">
              <img class="logo" src="/logo-eis-maritimo.png" alt="EIS Marítimo" />
              <div class="title">CARTA DE PORTE NACIONAL</div>
            </div>
            <div class="line"></div>
            <div class="row"><span class="label">FECHA DE TRANSPORTE:</span> <span class="value">${escapeHtml(
              fechaTransporteLabel || "—",
            )}</span></div>
            <div class="line"></div>
            <div class="row"><span class="label">ORIGEN DE LA CARGA:</span> <span class="value">${escapeHtml(
              String(cartaPorte.origen_carga || "").toUpperCase() || "—",
            )}</span></div>
            <div class="line"></div>
            <div class="row"><span class="label">DESTINO DE LA CARGA:</span> <span class="value">${escapeHtml(
              String(destinoLabel || "").toUpperCase() || "—",
            )}</span></div>
            <div class="line"></div>
            <div class="grid2">
              <div class="cell"><div class="label">MATRÍCULA TRACTORA:</div><div class="value" style="margin-top:4px">${escapeHtml(
                String(cartaPorte.matricula_tractora || "").toUpperCase() ||
                  "—",
              )}</div></div>
              <div class="cell"><div class="label">MATRÍCULA REMOLQUE:</div><div class="value" style="margin-top:4px">${escapeHtml(
                String(cartaPorte.matricula_remolque || "").toUpperCase() ||
                  "—",
              )}</div></div>
            </div>
            <div class="grid2">
              <div class="cell">
                <div class="label">EMPRESA CARGADORA</div>
                <div style="margin-top:6px"><span class="label">NOMBRE:</span> <span class="value">${escapeHtml(
                  String(
                    cartaPorte.empresa_cargadora_nombre || "",
                  ).toUpperCase() || "—",
                )}</span></div>
                <div style="margin-top:2px" class="mono"><span class="label">DIRECCIÓN:</span> <span class="value">${escapeHtml(
                  String(cartaPorte.empresa_cargadora_direccion || "")
                    .toUpperCase()
                    .trim() || "—",
                )}</span></div>
              </div>
              <div class="cell">
                <div class="label">EMPRESA EXPEDIDORA</div>
                <div style="margin-top:6px"><span class="label">NOMBRE:</span> <span class="value">${escapeHtml(
                  String(
                    cartaPorte.empresa_expedidora_nombre || "",
                  ).toUpperCase() || "—",
                )}</span></div>
                <div style="margin-top:2px" class="mono"><span class="label">DIRECCIÓN:</span> <span class="value">${escapeHtml(
                  String(cartaPorte.empresa_expedidora_direccion || "")
                    .toUpperCase()
                    .trim() || "—",
                )}</span></div>
              </div>
            </div>
            <div class="block">
              <div class="label">EMPRESA TRANSPORTISTA</div>
              <div style="margin-top:6px"><span class="label">NOMBRE:</span> <span class="value">${escapeHtml(
                String(
                  cartaPorte.empresa_transportista_nombre || "",
                ).toUpperCase() || "—",
              )}</span></div>
              <div style="margin-top:2px" class="mono"><span class="label">DIRECCIÓN:</span> <span class="value">${escapeHtml(
                String(cartaPorte.empresa_transportista_direccion || "")
                  .toUpperCase()
                  .trim() || "—",
              )}</span></div>
              <div style="margin-top:2px"><span class="label">CONDUCTOR:</span> <span class="value">${escapeHtml(
                String(cartaPorte.conductor_nombre || "").toUpperCase() || "—",
              )}</span>${
                cartaPorte.conductor_dni
                  ? ` <span class="label">, DNI ${escapeHtml(
                      String(cartaPorte.conductor_dni || "").toUpperCase(),
                    )}</span>`
                  : ""
              }</div>
              <div style="margin-top:2px"><span class="label">PRECINTO:</span> <span class="value">${escapeHtml(
                String(cartaPorte.precinto || "").toUpperCase() || "—",
              )}</span></div>
            </div>
            <div class="block">
              <div class="label">DESTINATARIO</div>
              <div style="margin-top:6px"><span class="label">NOMBRE:</span> <span class="value">${escapeHtml(
                String(cartaPorte.destinatario_nombre || "").toUpperCase() ||
                  "—",
              )}</span></div>
              <div style="margin-top:2px" class="mono"><span class="label">DIRECCIÓN:</span> <span class="value">${escapeHtml(
                String(cartaPorte.destinatario_direccion || "")
                  .toUpperCase()
                  .trim() || "—",
              )}</span></div>
            </div>
            <div class="block">
              <div class="label">MERCANCÍA TRANSPORTADA: <span style="font-style:italic;font-weight:600">Naturaleza, peso y número de bultos</span></div>
              <div style="margin-top:6px"><span class="label">TEMPERATURA:</span> <span class="value">${escapeHtml(
                String(cartaPorte.temperatura || "").toUpperCase() || "—",
              )}</span></div>
              <div style="margin-top:6px;font-weight:800;text-align:center">${escapeHtml(
                (String(cartaPorte.bultos || "").trim()
                  ? `${String(cartaPorte.bultos || "").trim()} PALETS${
                      String(cartaPorte.mercancia || "").trim()
                        ? ` · ${String(cartaPorte.mercancia || "").trim()}`
                        : ""
                    }`
                  : String(cartaPorte.mercancia || "") || "—"
                ).toUpperCase(),
              )}</div>
              <div style="display:flex;justify-content:flex-end;margin-top:6px;font-weight:800">${escapeHtml(
                cartaPorte.peso_kg
                  ? `${String(cartaPorte.peso_kg).trim()} KG`
                  : "—",
              )}</div>
            </div>
            <div class="sign">
              <div class="signgrid">
                <div style="min-height:80px">Vº Bº Plataforma</div>
                <div style="text-align:right;min-height:80px">Vº Bº Transportista</div>
              </div>
            </div>
          </div>
          <script>
            window.addEventListener('load', () => {
              setTimeout(() => {
                window.focus();
                window.print();
              }, 50);
            });
          </script>
        </body>
      </html>`;

    const w = window.open("", "_blank");
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  const createCmrPdf = () => {
    const escapeHtml = (value) =>
      String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");

    const toUpper = (value) =>
      String(value ?? "")
        .trim()
        .toUpperCase();
    const paletsLabel = String(cmr.palets ?? "").trim();
    const totalCantidad =
      String(cmr.total_cantidad || "").trim() ||
      (paletsLabel ? `${paletsLabel} PALLETS` : "");

    const html = `<!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>CMR</title>
          <style>
            :root { color-scheme: light; }
            @page { size: A4; margin: 10mm; }
            html, body { height: 100%; }
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; margin: 0; color: #111; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .page { border: 1px solid #9ca3af; width: 100%; box-sizing: border-box; min-height: 277mm; display: flex; flex-direction: column; }
            .grid2 { display: grid; grid-template-columns: 1.2fr 1fr; gap: 10px; padding: 10px; }
            .box { border: 1px solid #9ca3af; padding: 10px; }
            .small { font-size: 10px; color: #374151; }
            .strong { font-weight: 800; }
            .mono { white-space: pre-wrap; }
            .title { font-size: 28px; line-height: 28px; font-weight: 900; }
            .section { margin: 10px; border: 1px solid #9ca3af; }
            .row2 { display: grid; grid-template-columns: 1fr 1fr; }
            .cell { padding: 10px; }
            .cell + .cell { border-left: 1px solid #9ca3af; }
            .sep { border-top: 1px solid #9ca3af; }
            .row3 { display: grid; grid-template-columns: 1fr 1fr 1fr; }
            .row4 { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; }
            .bigNum { font-size: 20px; line-height: 22px; font-weight: 900; }
            .bigKg { font-size: 22px; line-height: 24px; font-weight: 900; }
            .logo { height: 34px; width: auto; object-fit: contain; margin-top: 6px; }
            .sign { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin: 10px; margin-top: auto; }
            .signBox { border: 1px solid #9ca3af; padding: 10px; min-height: 84px; font-size: 10px; color: #374151; }
            @media print { body { margin: 0; } }
          </style>
        </head>
        <body>
          <div class="page">
            <div class="grid2">
              <div class="box">
                <div class="small">Remitente / Expéditeur / Sender</div>
                <div class="strong">${escapeHtml(toUpper(cmr.remitente_nombre) || "—")}</div>
                <div class="mono strong" style="margin-top:2px">${escapeHtml(
                  toUpper(cmr.remitente_direccion) || "—",
                )}</div>
                <img class="logo" src="/logo-eis-maritimo.png" alt="EIS Marítimo" />
              </div>
              <div class="box">
                <div class="title">CMR</div>
                <div class="small" style="margin-top:6px">Carta de porte internacional · Lettre de voiture internationale</div>
              </div>
            </div>

            <div class="section">
              <div class="row2">
                <div class="cell">
                  <div class="small">Destinatario / Destinataire / Consignee</div>
                  <div class="strong" style="margin-top:4px">${escapeHtml(
                    toUpper(cmr.destinatario_nombre) || "—",
                  )}</div>
                  <div class="mono strong" style="margin-top:2px">${escapeHtml(
                    toUpper(cmr.destinatario_direccion) || "—",
                  )}</div>
                </div>
                <div class="cell">
                  <div class="small">Portador / Carrier</div>
                  <div class="strong" style="margin-top:4px">${escapeHtml(
                    toUpper(cmr.portador_nombre) || "—",
                  )}</div>
                  <div class="mono strong" style="margin-top:2px">${escapeHtml(
                    toUpper(cmr.portador_direccion) || "—",
                  )}</div>
                  <div style="margin-top:6px" class="row2">
                    <div>
                      <div class="small">Tractora</div>
                      <div class="strong">${escapeHtml(
                        toUpper(cmr.matricula_tractora) || "—",
                      )}</div>
                    </div>
                    <div>
                      <div class="small">Remolque</div>
                      <div class="strong">${escapeHtml(
                        toUpper(cmr.matricula_remolque) || "—",
                      )}</div>
                    </div>
                  </div>
                </div>
              </div>
              <div class="sep"></div>
              <div class="row2">
                <div class="cell">
                  <div class="small">Lugar previsto de entrega / Lieu prévu de livraison / Place of delivery</div>
                  <div class="strong" style="margin-top:4px">${escapeHtml(
                    toUpper(cmr.lugar_entrega) || "—",
                  )}</div>
                </div>
                <div class="cell">
                  <div class="small">Lugar y fecha de carga / Lieu et date de prise en charge / Place and date of taking over</div>
                  <div class="strong" style="margin-top:4px">${escapeHtml(
                    toUpper(FIXED_CMR_PLACE_OF_TAKING_OVER) || "—",
                  )}${cmrFechaCargaLabel ? ` · ${escapeHtml(cmrFechaCargaLabel)}` : ""}</div>
                </div>
              </div>
              <div class="sep"></div>
              <div class="cell">
                <div class="small">Documentos anexos / Documents annexés / Documents attached</div>
                <div class="strong" style="margin-top:4px">${escapeHtml(
                  toUpper(cmr.documentos_anexos) || "—",
                )}</div>
              </div>
            </div>

            <div class="section">
              <div class="row3">
                <div class="cell">
                  <div class="small">Nº bultos</div>
                  <div class="bigNum">${escapeHtml(
                    paletsLabel ? `${paletsLabel} PALLETS` : "—",
                  )}</div>
                </div>
                <div class="cell">
                  <div class="small">Naturaleza de la mercancía</div>
                  <div class="mono strong" style="margin-top:6px">${escapeHtml(
                    toUpper(cmr.mercancia) || "—",
                  )}</div>
                  <div style="margin-top:6px">
                    <span class="small">Temperatura: </span>
                    <span class="strong">${escapeHtml(
                      toUpper(cmr.temperatura) || "—",
                    )}</span>
                  </div>
                  <div style="margin-top:6px">
                    <span class="small">Sello de seguridad / Security seal: </span>
                    <span class="strong">${escapeHtml(
                      toUpper(cmr.sello_seguridad) || "—",
                    )}</span>
                  </div>
                </div>
                <div class="cell">
                  <div class="small">Peso bruto (kg)</div>
                  <div class="bigKg">${escapeHtml(
                    String(cmr.peso_bruto_kg || "").trim()
                      ? `${String(cmr.peso_bruto_kg).trim()} KG`
                      : "—",
                  )}</div>
                  <div style="margin-top:10px" class="small">
                    Volumen m3: <span class="strong">${escapeHtml(
                      String(cmr.volumen_m3 || "").trim() || "—",
                    )}</span>
                  </div>
                </div>
              </div>
              <div class="sep"></div>
              <div class="cell">
                <div class="small">Instrucciones / Instructions</div>
                <div class="strong" style="margin-top:4px">${escapeHtml(
                  toUpper(cmr.instrucciones) || "—",
                )}</div>
              </div>
              <div class="sep"></div>
              <div class="cell">
                <div class="small">Cantidad total / Total quantity</div>
                <div class="strong" style="margin-top:4px">${escapeHtml(
                  toUpper(totalCantidad) || "—",
                )}</div>
              </div>
            </div>

            <div class="section">
              <div class="cell">
                <div class="small">Establecido en / Établi à / Established in</div>
                <div class="strong" style="margin-top:4px">${escapeHtml(
                  toUpper(FIXED_CMR_ESTABLECIDO_EN) || "—",
                )}${cmrFechaCargaLabel ? ` · ${escapeHtml(cmrFechaCargaLabel)}` : ""}</div>
              </div>
            </div>

            <div class="sign">
              <div class="signBox">Firma remitente / Signature expéditeur / Sender signature</div>
              <div class="signBox">Firma transportista / Signature transporteur / Carrier signature</div>
              <div class="signBox">Firma destinatario / Signature destinataire / Consignee signature</div>
            </div>
          </div>

          <script>
            window.addEventListener('load', () => {
              setTimeout(() => {
                window.focus();
                window.print();
              }, 50);
            });
          </script>
        </body>
      </html>`;

    const w = window.open("", "_blank");
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  return (
    <>
      <section className="card">
        <div className="card-header">
          <h2 className="card-title">Documentación</h2>
          <EnvBadge />
        </div>
        <div style={{ padding: 16, display: "grid", gap: 12 }}>
          <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>
            Última actualización: {updatedAt}
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              className="primary-button"
              onClick={() => {
                setCmr(getEmptyCmr());
                setCmrFormSections(getDefaultCmrFormSections());
                setOpenCmr(true);
              }}
              title="Crear CMR"
            >
              Crear CMR
            </button>
            <button
              type="button"
              className="primary-button"
              onClick={() => {
                setCartaPorte(getEmptyCartaPorte());
                setCartaFormSections(getDefaultCartaFormSections());
                setOpenCartaPorte(true);
              }}
              title="Crear Carta de Porte"
            >
              Crear Carta de Porte
            </button>
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ fontWeight: 700 }}>Secciones</div>
            <div style={{ color: "var(--text-secondary)" }}>
              Esta página está preparada para añadir guías internas, flujos de
              trabajo y preguntas frecuentes.
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              <span>• Cargas</span>
              <span>• Palets</span>
              <span>• Agenda diaria</span>
              <span>• Roles y permisos</span>
            </div>
          </div>
        </div>
      </section>

      <Modal
        open={openCmr}
        title="Crear CMR"
        onClose={() => setOpenCmr(false)}
        cancelLabel="Cerrar"
        onCancel={() => setOpenCmr(false)}
        onSubmit={createCmrPdf}
        submitLabel="Crear PDF"
        width="min(1100px, 95vw)"
        bodyStyle={{
          gridTemplateColumns: "minmax(320px, 380px) minmax(360px, 1fr)",
          overflow: "hidden",
          maxHeight: "none",
          minHeight: 0,
        }}
      >
        <div
          style={{
            display: "grid",
            gap: 10,
            overflow: "auto",
            minWidth: 0,
            minHeight: 0,
            paddingRight: 4,
            height: "100%",
          }}
        >
          <CmrSection id="asignar" title="Asignar carga">
            <div className="label">Asignar carga (opcional)</div>
            <SearchableSelect
              value={cmr.load_id}
              onChange={(id) => {
                const loadId = String(id || "").trim();
                const load = loadById.get(loadId);
                setCmr((p) => {
                  if (!loadId || !load) {
                    return {
                      ...p,
                      load_id: "",
                      remitente_empresa_id: "",
                      remitente_nombre: FIXED_CMR_REMITENTE_NOMBRE,
                      remitente_direccion: FIXED_CMR_REMITENTE_DIRECCION,
                      destinatario_terminal_id: "",
                      destinatario_nombre: "",
                      destinatario_direccion: "",
                      lugar_entrega_terminal_id: "",
                      lugar_entrega: "",
                      lugar_carga: FIXED_CMR_PLACE_OF_TAKING_OVER,
                      mercancia: "",
                      palets: "",
                      total_cantidad: "",
                      instrucciones: "",
                      fecha_carga: "",
                      documentos_anexos: "",
                    };
                  }
                  const barcoNombre = getShipName(load.barco);
                  const terminalId = getMixedId(load.terminal_entrega);
                  const terminalLabel = getLocationLabel(load.terminal_entrega);
                  const consignatarioNombre = getConsigneeName(
                    load.consignatario,
                  );
                  const entrega = Array.isArray(load.entrega)
                    ? load.entrega
                    : [];
                  const fechaCargaIso = (() => {
                    const v = load.fecha_de_carga;
                    if (!v) return "";
                    if (typeof v === "string" && v.includes("-")) return v;
                    return "";
                  })();
                  const paletsCountNumber =
                    palletCountByLoadId.get(loadId) ||
                    (Array.isArray(load.palets) ? load.palets.length : 0);
                  const paletsCount = paletsCountNumber
                    ? String(paletsCountNumber)
                    : "";
                  const mercancia = entrega.length ? entrega.join(" / ") : "";
                  const instrucciones =
                    barcoNombre || terminalLabel
                      ? `ENTREGAR AL BUQUE ${
                          barcoNombre || "—"
                        } EN ${terminalLabel || "—"}`
                      : "";
                  const destinatarioNombre =
                    barcoNombre || consignatarioNombre || terminalLabel || "";
                  return {
                    ...p,
                    load_id: loadId,
                    remitente_empresa_id: "",
                    remitente_nombre: FIXED_CMR_REMITENTE_NOMBRE,
                    remitente_direccion: FIXED_CMR_REMITENTE_DIRECCION,
                    destinatario_terminal_id: terminalId,
                    destinatario_nombre:
                      destinatarioNombre ||
                      `${barcoNombre || ""}${
                        terminalLabel ? ` · ${terminalLabel}` : ""
                      }`.trim(),
                    destinatario_direccion: terminalLabel,
                    lugar_entrega_terminal_id: terminalId,
                    lugar_entrega: `${destinatarioNombre}${
                      destinatarioNombre && terminalLabel ? " · " : ""
                    }${terminalLabel}`.trim(),
                    lugar_carga: FIXED_CMR_PLACE_OF_TAKING_OVER,
                    mercancia,
                    palets: paletsCount,
                    total_cantidad: paletsCount ? `${paletsCount} PALLETS` : "",
                    instrucciones,
                    fecha_carga: fechaCargaIso,
                    documentos_anexos: consignatarioNombre
                      ? "DOCUMENTS & INVOICES"
                      : "",
                  };
                });
              }}
              options={loadOptions}
              placeholder={
                catalogLoading ? "Cargando..." : "Selecciona una carga"
              }
              searchPlaceholder="Buscar carga..."
              disabled={catalogLoading}
            />
          </CmrSection>

          <CmrSection id="destinatario" title="Destinatario">
            <SearchableSelect
              value={cmr.destinatario_terminal_id}
              onChange={(id) => {
                const opt = terminalOptions.find(
                  (o) => String(o.value) === String(id),
                );
                setCmr((p) => ({
                  ...p,
                  destinatario_terminal_id: String(id || ""),
                  destinatario_nombre: opt
                    ? String(opt.label || "")
                    : p.destinatario_nombre,
                }));
              }}
              options={terminalOptions}
              placeholder={catalogLoading ? "Cargando..." : "Puerto / Terminal"}
              searchPlaceholder="Buscar terminal..."
              disabled={catalogLoading}
            />
            <input
              className="input"
              value={cmr.destinatario_nombre}
              onChange={(e) =>
                setCmr((p) => ({ ...p, destinatario_nombre: e.target.value }))
              }
              placeholder="Nombre"
            />
            <textarea
              className="input"
              value={cmr.destinatario_direccion}
              onChange={(e) =>
                setCmr((p) => ({
                  ...p,
                  destinatario_direccion: e.target.value,
                }))
              }
              placeholder="Dirección"
              rows={2}
              style={{ resize: "vertical" }}
            />
          </CmrSection>

          <CmrSection id="carga" title="Carga">
            <input
              className="input"
              value={cmr.lugar_carga}
              readOnly
              placeholder="Lugar de carga"
            />
            <input
              className="input"
              type="date"
              value={cmr.fecha_carga}
              onChange={(e) =>
                setCmr((p) => ({ ...p, fecha_carga: e.target.value }))
              }
            />
          </CmrSection>

          <CmrSection id="documentos" title="Documentos anexos">
            <input
              className="input"
              value={cmr.documentos_anexos}
              onChange={(e) =>
                setCmr((p) => ({ ...p, documentos_anexos: e.target.value }))
              }
              placeholder="Ej: DOCUMENTS & INVOICES"
            />
          </CmrSection>

          <CmrSection id="portador" title="Portador">
            <SearchableSelect
              value={cmr.portador_empresa_id}
              onChange={(id) => {
                const company = companyById.get(String(id || "").trim());
                const opt = companyOptions.find(
                  (o) => String(o.value) === String(id),
                );
                setCmr((p) => ({
                  ...p,
                  portador_empresa_id: String(id || ""),
                  portador_nombre: opt
                    ? String(opt.label || "")
                    : p.portador_nombre,
                  portador_direccion:
                    company && String(company.direccion || "").trim()
                      ? String(company.direccion || "")
                      : p.portador_direccion,
                }));
              }}
              options={companyOptions}
              placeholder={catalogLoading ? "Cargando..." : "Elegir empresa"}
              searchPlaceholder="Buscar empresa..."
              disabled={catalogLoading}
            />
            <input
              className="input"
              value={cmr.portador_nombre}
              onChange={(e) =>
                setCmr((p) => ({ ...p, portador_nombre: e.target.value }))
              }
              placeholder="Nombre"
            />
            <textarea
              className="input"
              value={cmr.portador_direccion}
              onChange={(e) =>
                setCmr((p) => ({ ...p, portador_direccion: e.target.value }))
              }
              placeholder="Dirección"
              rows={2}
              style={{ resize: "vertical" }}
            />
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
              }}
            >
              <div style={{ display: "grid", gap: 6 }}>
                <div className="label">Matrícula tractora</div>
                <input
                  className="input"
                  value={cmr.matricula_tractora}
                  onChange={(e) =>
                    setCmr((p) => ({
                      ...p,
                      matricula_tractora: e.target.value,
                    }))
                  }
                  placeholder="Ej: 9190KZN"
                />
              </div>
              <div style={{ display: "grid", gap: 6 }}>
                <div className="label">Matrícula remolque</div>
                <input
                  className="input"
                  value={cmr.matricula_remolque}
                  onChange={(e) =>
                    setCmr((p) => ({
                      ...p,
                      matricula_remolque: e.target.value,
                    }))
                  }
                  placeholder="Ej: R1073BCR-3555"
                />
              </div>
            </div>
          </CmrSection>

          <CmrSection id="mercancia" title="Mercancía">
            <div className="label">Naturaleza de la mercancía</div>
            <textarea
              className="input"
              value={cmr.mercancia}
              onChange={(e) =>
                setCmr((p) => ({ ...p, mercancia: e.target.value }))
              }
              placeholder="Ej: PROVISIONES PARA EL BARCO..."
              rows={2}
              style={{ resize: "vertical" }}
            />
          </CmrSection>

          <CmrSection id="medidas" title="Palets y medidas">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
              }}
            >
              <div style={{ display: "grid", gap: 6 }}>
                <div className="label">Palets</div>
                <input
                  className="input"
                  value={cmr.palets}
                  onChange={(e) =>
                    setCmr((p) => ({ ...p, palets: e.target.value }))
                  }
                  placeholder="Ej: 25"
                />
              </div>
              <div style={{ display: "grid", gap: 6 }}>
                <div className="label">Temperatura</div>
                <input
                  className="input"
                  value={cmr.temperatura}
                  onChange={(e) =>
                    setCmr((p) => ({ ...p, temperatura: e.target.value }))
                  }
                  placeholder="Ej: -20 / +5"
                />
              </div>
              <div style={{ display: "grid", gap: 6 }}>
                <div className="label">Peso bruto (kg)</div>
                <input
                  className="input"
                  value={cmr.peso_bruto_kg}
                  onChange={(e) =>
                    setCmr((p) => ({ ...p, peso_bruto_kg: e.target.value }))
                  }
                  placeholder="Ej: 16301"
                />
              </div>
              <div style={{ display: "grid", gap: 6 }}>
                <div className="label">Volumen (m3)</div>
                <input
                  className="input"
                  value={cmr.volumen_m3}
                  onChange={(e) =>
                    setCmr((p) => ({ ...p, volumen_m3: e.target.value }))
                  }
                  placeholder="Opcional"
                />
              </div>
              <div style={{ display: "grid", gap: 6, gridColumn: "1 / -1" }}>
                <div className="label">Sello de seguridad</div>
                <input
                  className="input"
                  value={cmr.sello_seguridad}
                  onChange={(e) =>
                    setCmr((p) => ({ ...p, sello_seguridad: e.target.value }))
                  }
                  placeholder="Ej: 000003631"
                />
              </div>
            </div>
          </CmrSection>

          <CmrSection id="instrucciones" title="Instrucciones">
            <div className="label">Instrucciones del remitente</div>
            <input
              className="input"
              value={cmr.instrucciones}
              onChange={(e) =>
                setCmr((p) => ({ ...p, instrucciones: e.target.value }))
              }
              placeholder="Ej: ENTREGAR AL BUQUE..."
            />
          </CmrSection>

          <CmrSection id="establecido" title="Establecido en">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
              }}
            >
              <div style={{ display: "grid", gap: 6 }}>
                <div className="label">Establecido en</div>
                <input
                  className="input"
                  value={cmr.establecido_en}
                  onChange={(e) =>
                    setCmr((p) => ({ ...p, establecido_en: e.target.value }))
                  }
                  placeholder="Ej: BARCELONA"
                />
              </div>
              <div style={{ display: "grid", gap: 6 }}>
                <div className="label">Fecha</div>
                <input
                  className="input"
                  type="date"
                  value={cmr.establecido_fecha}
                  onChange={(e) =>
                    setCmr((p) => ({ ...p, establecido_fecha: e.target.value }))
                  }
                />
              </div>
            </div>
          </CmrSection>
        </div>

        <div
          style={{
            padding: 8,
            overflow: "auto",
            minWidth: 0,
            minHeight: 0,
            background: "var(--bg-alt)",
            borderRadius: 10,
            border: "1px solid var(--border)",
            height: "100%",
          }}
        >
          <div
            style={{
              background: "#fff",
              border: "1px solid #9ca3af",
              borderRadius: 4,
              padding: 12,
              maxWidth: 760,
              margin: "0 auto",
              color: "#111",
              fontFamily:
                '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
              fontSize: 11,
              lineHeight: "14px",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1.2fr 1fr",
                gap: 10,
              }}
            >
              <div
                style={{
                  border: "1px solid #9ca3af",
                  padding: 10,
                  minHeight: 92,
                  display: "grid",
                  gap: 4,
                }}
              >
                <div style={{ fontSize: 10, color: "#374151" }}>
                  Remitente / Expéditeur / Sender
                </div>
                <div style={{ fontWeight: 800 }}>
                  {String(cmr.remitente_nombre || "").toUpperCase() || "—"}
                </div>
                <div style={{ whiteSpace: "pre-wrap", fontWeight: 700 }}>
                  {String(cmr.remitente_direccion || "").toUpperCase() || "—"}
                </div>
                <img
                  src="/logo-eis-maritimo.png"
                  alt="EIS Marítimo"
                  style={{
                    height: 34,
                    width: "auto",
                    objectFit: "contain",
                    marginTop: 6,
                  }}
                />
              </div>
              <div
                style={{
                  border: "1px solid #9ca3af",
                  padding: 10,
                  minHeight: 92,
                }}
              >
                <div
                  style={{ fontWeight: 900, fontSize: 28, lineHeight: "28px" }}
                >
                  CMR
                </div>
                <div style={{ marginTop: 6, fontSize: 10, color: "#374151" }}>
                  Carta de porte internacional · Lettre de voiture
                  internationale
                </div>
                <div style={{ marginTop: 6, fontSize: 10, color: "#6b7280" }}>
                  Preview (plantilla)
                </div>
              </div>
            </div>

            <div
              style={{
                marginTop: 10,
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
              }}
            >
              <div
                style={{
                  border: "1px solid #9ca3af",
                  padding: 10,
                  minHeight: 86,
                }}
              >
                <div style={{ fontSize: 10, color: "#374151" }}>
                  Destinatario / Destinataire / Consignee
                </div>
                <div style={{ fontWeight: 800, marginTop: 4 }}>
                  {String(cmr.destinatario_nombre || "").toUpperCase() || "—"}
                </div>
                <div
                  style={{
                    fontWeight: 700,
                    whiteSpace: "pre-wrap",
                    marginTop: 2,
                  }}
                >
                  {String(cmr.destinatario_direccion || "").toUpperCase() ||
                    "—"}
                </div>
              </div>
              <div
                style={{
                  border: "1px solid #9ca3af",
                  padding: 10,
                  minHeight: 86,
                }}
              >
                <div style={{ fontSize: 10, color: "#374151" }}>
                  Portador / Carrier
                </div>
                <div style={{ fontWeight: 800, marginTop: 4 }}>
                  {String(cmr.portador_nombre || "").toUpperCase() || "—"}
                </div>
                <div
                  style={{
                    fontWeight: 700,
                    whiteSpace: "pre-wrap",
                    marginTop: 2,
                  }}
                >
                  {String(cmr.portador_direccion || "").toUpperCase() || "—"}
                </div>
                <div
                  style={{
                    marginTop: 6,
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 8,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 10, color: "#374151" }}>
                      Tractora
                    </div>
                    <div style={{ fontWeight: 900 }}>
                      {String(cmr.matricula_tractora || "").toUpperCase() ||
                        "—"}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: "#374151" }}>
                      Remolque
                    </div>
                    <div style={{ fontWeight: 900 }}>
                      {String(cmr.matricula_remolque || "").toUpperCase() ||
                        "—"}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 10, border: "1px solid #9ca3af" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 0,
                }}
              >
                <div style={{ padding: 10, borderRight: "1px solid #9ca3af" }}>
                  <div style={{ fontSize: 10, color: "#374151" }}>
                    Lugar previsto de entrega / Lieu prévu de livraison / Place
                    of delivery
                  </div>
                  <div style={{ fontWeight: 800, marginTop: 4 }}>
                    {String(cmr.lugar_entrega || "").toUpperCase() || "—"}
                  </div>
                </div>
                <div style={{ padding: 10 }}>
                  <div style={{ fontSize: 10, color: "#374151" }}>
                    Lugar y fecha de carga / Lieu et date de prise en charge /
                    Place and date of taking over
                  </div>
                  <div style={{ fontWeight: 800, marginTop: 4 }}>
                    {String(
                      FIXED_CMR_PLACE_OF_TAKING_OVER || "",
                    ).toUpperCase() || "—"}
                    {cmrFechaCargaLabel ? ` · ${cmrFechaCargaLabel}` : ""}
                  </div>
                </div>
              </div>
              <div style={{ borderTop: "1px solid #9ca3af", padding: 10 }}>
                <div style={{ fontSize: 10, color: "#374151" }}>
                  Documentos anexos / Documents annexés / Documents attached
                </div>
                <div style={{ fontWeight: 800, marginTop: 4 }}>
                  {String(cmr.documentos_anexos || "").toUpperCase() || "—"}
                </div>
              </div>
            </div>

            <div style={{ marginTop: 10, border: "1px solid #9ca3af" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: 0,
                }}
              >
                <div style={{ padding: 10, borderRight: "1px solid #9ca3af" }}>
                  <div style={{ fontSize: 10, color: "#374151" }}>
                    Nº bultos
                  </div>
                  <div
                    style={{
                      fontWeight: 900,
                      fontSize: 20,
                      lineHeight: "22px",
                    }}
                  >
                    {String(cmr.total_cantidad ?? "").trim()
                      ? String(cmr.total_cantidad ?? "")
                          .trim()
                          .toUpperCase()
                      : String(cmr.palets ?? "").trim()
                        ? `${String(cmr.palets ?? "").trim()} PALLETS`
                        : "—"}
                  </div>
                </div>
                <div style={{ padding: 10, borderRight: "1px solid #9ca3af" }}>
                  <div style={{ fontSize: 10, color: "#374151" }}>
                    Naturaleza mercancía
                  </div>
                  <div
                    style={{
                      fontWeight: 800,
                      marginTop: 6,
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {String(cmr.mercancia || "").toUpperCase() || "—"}
                  </div>
                  <div style={{ marginTop: 6 }}>
                    <span style={{ fontSize: 10, color: "#374151" }}>
                      Temperatura:{" "}
                    </span>
                    <span style={{ fontWeight: 900 }}>
                      {String(cmr.temperatura || "").toUpperCase() || "—"}
                    </span>
                  </div>
                  <div style={{ marginTop: 6 }}>
                    <span style={{ fontSize: 10, color: "#374151" }}>
                      Sello de seguridad / Security seal:{" "}
                    </span>
                    <span style={{ fontWeight: 900 }}>
                      {String(cmr.sello_seguridad || "").toUpperCase() || "—"}
                    </span>
                  </div>
                </div>
                <div style={{ padding: 10 }}>
                  <div style={{ fontSize: 10, color: "#374151" }}>
                    Peso bruto (kg)
                  </div>
                  <div
                    style={{
                      fontWeight: 900,
                      fontSize: 22,
                      lineHeight: "24px",
                    }}
                  >
                    {String(cmr.peso_bruto_kg || "").trim()
                      ? `${String(cmr.peso_bruto_kg).trim()} KG`
                      : "—"}
                  </div>
                  <div
                    style={{ marginTop: 10, fontSize: 10, color: "#374151" }}
                  >
                    Volumen m3:{" "}
                    <span style={{ fontWeight: 800 }}>
                      {String(cmr.volumen_m3 || "").trim() || "—"}
                    </span>
                  </div>
                </div>
              </div>
              <div style={{ borderTop: "1px solid #9ca3af", padding: 10 }}>
                <div style={{ fontSize: 10, color: "#374151" }}>
                  Instrucciones / Instructions
                </div>
                <div style={{ fontWeight: 800, marginTop: 4 }}>
                  {String(cmr.instrucciones || "").toUpperCase() || "—"}
                </div>
              </div>
            </div>

            <div
              style={{
                marginTop: 10,
                border: "1px solid #9ca3af",
                padding: 10,
              }}
            >
              <div style={{ fontSize: 10, color: "#374151" }}>
                Establecido en / Établi à / Established in
              </div>
              <div style={{ fontWeight: 800, marginTop: 4 }}>
                {String(FIXED_CMR_ESTABLECIDO_EN || "").toUpperCase() || "—"}
                {cmrFechaCargaLabel ? ` · ${cmrFechaCargaLabel}` : ""}
              </div>
            </div>

            <div
              style={{
                marginTop: 10,
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: 10,
              }}
            >
              <div
                style={{
                  border: "1px solid #9ca3af",
                  padding: 10,
                  minHeight: 84,
                  fontSize: 10,
                  color: "#374151",
                }}
              >
                Firma remitente / Signature expéditeur / Sender signature
              </div>
              <div
                style={{
                  border: "1px solid #9ca3af",
                  padding: 10,
                  minHeight: 84,
                  fontSize: 10,
                  color: "#374151",
                }}
              >
                Firma transportista / Signature transporteur / Carrier signature
              </div>
              <div
                style={{
                  border: "1px solid #9ca3af",
                  padding: 10,
                  minHeight: 84,
                  fontSize: 10,
                  color: "#374151",
                }}
              >
                Firma destinatario / Signature destinataire / Consignee
                signature
              </div>
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        open={openCartaPorte}
        title="Crear Carta de Porte"
        onClose={() => setOpenCartaPorte(false)}
        cancelLabel="Cerrar"
        onCancel={() => setOpenCartaPorte(false)}
        onSubmit={createCartaPortePdf}
        submitLabel="Crear PDF"
        width="min(1100px, 95vw)"
        bodyStyle={{
          gridTemplateColumns: "minmax(320px, 380px) minmax(360px, 1fr)",
          overflow: "hidden",
          maxHeight: "none",
          minHeight: 0,
        }}
      >
        <div
          style={{
            display: "grid",
            gap: 10,
            overflow: "auto",
            minWidth: 0,
            minHeight: 0,
            paddingRight: 4,
            height: "100%",
            alignContent: "start",
          }}
        >
          <CartaSection id="asignar" title="Asignar carga (opcional)">
            <SearchableSelect
              value={cartaPorte.load_id}
              onChange={(id) => {
                const loadId = String(id || "").trim();
                const load = loadById.get(loadId);
                setCartaPorte((p) => {
                  if (!loadId || !load) return getEmptyCartaPorte();

                  const terminalId = getMixedId(load.terminal_entrega);
                  const terminalLabelFromLoad = getLocationLabel(
                    load.terminal_entrega,
                  );
                  const barcoNombre = getShipName(load.barco);
                  const consignatarioNombre = getConsigneeName(
                    load.consignatario,
                  );
                  const entrega = Array.isArray(load.entrega)
                    ? load.entrega
                    : load.entrega
                      ? [String(load.entrega)]
                      : [];
                  const mercancia = entrega.length ? entrega.join(" / ") : "";
                  const fechaCargaIso = (() => {
                    const v = load.fecha_de_carga;
                    if (!v) return "";
                    if (typeof v === "string" && v.includes("-")) return v;
                    return "";
                  })();
                  const paletsCountNumber =
                    palletCountByLoadId.get(loadId) ||
                    (Array.isArray(load.palets) ? load.palets.length : 0);
                  const paletsCount = paletsCountNumber
                    ? String(paletsCountNumber)
                    : "";
                  const destinatarioNombre =
                    barcoNombre ||
                    consignatarioNombre ||
                    terminalLabelFromLoad ||
                    "";
                  const choferNombre =
                    typeof load.chofer === "object" && load.chofer
                      ? String(load.chofer.nombre || load.chofer.name || "")
                      : "";

                  return {
                    ...p,
                    load_id: loadId,
                    fecha_transporte: fechaCargaIso,
                    origen_carga: FIXED_CARTA_EMPRESA_NOMBRE,
                    destino_terminal_id: terminalId,
                    destino_carga: terminalLabelFromLoad,
                    destinatario_nombre: destinatarioNombre,
                    destinatario_direccion: terminalLabelFromLoad,
                    mercancia,
                    bultos: paletsCount,
                    conductor_nombre: choferNombre || p.conductor_nombre,
                    empresa_cargadora_id: "",
                    empresa_cargadora_nombre: FIXED_CARTA_EMPRESA_NOMBRE,
                    empresa_cargadora_direccion: FIXED_CARTA_EMPRESA_DIRECCION,
                    empresa_expedidora_id: "",
                    empresa_expedidora_nombre: FIXED_CARTA_EMPRESA_NOMBRE,
                    empresa_expedidora_direccion: FIXED_CARTA_EMPRESA_DIRECCION,
                  };
                });
              }}
              options={loadOptions}
              placeholder={
                catalogLoading ? "Cargando..." : "Selecciona una carga"
              }
              searchPlaceholder="Buscar carga..."
              disabled={catalogLoading}
            />
          </CartaSection>

          <CartaSection id="datos" title="Datos del transporte">
            <div style={{ display: "grid", gap: 6 }}>
              <div className="label">Fecha de transporte</div>
              <input
                className="input"
                type="date"
                value={cartaPorte.fecha_transporte}
                onChange={(e) =>
                  setCartaPorte((p) => ({
                    ...p,
                    fecha_transporte: e.target.value,
                  }))
                }
              />
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              <div className="label">Origen de la carga</div>
              <input
                className="input"
                value={cartaPorte.origen_carga}
                onChange={(e) =>
                  setCartaPorte((p) => ({ ...p, origen_carga: e.target.value }))
                }
                placeholder="Dirección / ubicación"
              />
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              <div className="label">Destino de la carga</div>
              <div style={{ display: "grid", gap: 8 }}>
                <SearchableSelect
                  value={cartaPorte.destino_terminal_id}
                  onChange={(id) => {
                    const opt = terminalOptions.find(
                      (o) => String(o.value) === String(id),
                    );
                    setCartaPorte((p) => ({
                      ...p,
                      destino_terminal_id: String(id || ""),
                      destino_carga: opt
                        ? String(opt.label || "")
                        : p.destino_carga,
                    }));
                  }}
                  options={terminalOptions}
                  placeholder={
                    catalogLoading ? "Cargando..." : "Puerto / Terminal"
                  }
                  searchPlaceholder="Buscar terminal..."
                  disabled={catalogLoading}
                />
                <input
                  className="input"
                  value={cartaPorte.destino_carga}
                  onChange={(e) =>
                    setCartaPorte((p) => ({
                      ...p,
                      destino_carga: e.target.value,
                      destino_terminal_id: p.destino_terminal_id,
                    }))
                  }
                  placeholder="Destino (texto libre)"
                />
              </div>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
              }}
            >
              <div style={{ display: "grid", gap: 6 }}>
                <div className="label">Matrícula tractora</div>
                <input
                  className="input"
                  value={cartaPorte.matricula_tractora}
                  onChange={(e) =>
                    setCartaPorte((p) => ({
                      ...p,
                      matricula_tractora: e.target.value,
                    }))
                  }
                />
              </div>
              <div style={{ display: "grid", gap: 6 }}>
                <div className="label">Matrícula remolque</div>
                <input
                  className="input"
                  value={cartaPorte.matricula_remolque}
                  onChange={(e) =>
                    setCartaPorte((p) => ({
                      ...p,
                      matricula_remolque: e.target.value,
                    }))
                  }
                />
              </div>
            </div>
          </CartaSection>

          <CartaSection id="empresas" title="Empresas">
            <div style={{ display: "grid", gap: 6 }}>
              <div className="label">Empresa cargadora (fija)</div>
              <input
                className="input"
                value={cartaPorte.empresa_cargadora_nombre}
                readOnly
              />
              <textarea
                className="input"
                value={cartaPorte.empresa_cargadora_direccion}
                readOnly
                rows={3}
                style={{ resize: "vertical" }}
              />
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              <div className="label">Empresa expedidora (fija)</div>
              <input
                className="input"
                value={cartaPorte.empresa_expedidora_nombre}
                readOnly
              />
              <textarea
                className="input"
                value={cartaPorte.empresa_expedidora_direccion}
                readOnly
                rows={3}
                style={{ resize: "vertical" }}
              />
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              <div className="label">Empresa transportista</div>
              <SearchableSelect
                value={cartaPorte.empresa_transportista_id}
                onChange={(id) => {
                  const company = companyById.get(String(id || "").trim());
                  const opt = companyOptions.find(
                    (o) => String(o.value) === String(id),
                  );
                  setCartaPorte((p) => ({
                    ...p,
                    empresa_transportista_id: String(id || ""),
                    empresa_transportista_nombre: opt
                      ? String(opt.label || "")
                      : p.empresa_transportista_nombre,
                    empresa_transportista_direccion:
                      company && String(company.direccion || "").trim()
                        ? String(company.direccion || "")
                        : p.empresa_transportista_direccion,
                  }));
                }}
                options={companyOptions}
                placeholder={catalogLoading ? "Cargando..." : "Elegir empresa"}
                searchPlaceholder="Buscar empresa..."
                disabled={catalogLoading}
              />
              <input
                className="input"
                value={cartaPorte.empresa_transportista_nombre}
                onChange={(e) =>
                  setCartaPorte((p) => ({
                    ...p,
                    empresa_transportista_nombre: e.target.value,
                  }))
                }
                placeholder="Nombre"
              />
              <textarea
                className="input"
                value={cartaPorte.empresa_transportista_direccion}
                onChange={(e) =>
                  setCartaPorte((p) => ({
                    ...p,
                    empresa_transportista_direccion: e.target.value,
                  }))
                }
                placeholder="Dirección"
                rows={2}
                style={{ resize: "vertical" }}
              />
            </div>
          </CartaSection>

          <CartaSection id="transportista" title="Transportista">
            <div style={{ display: "grid", gap: 6 }}>
              <div className="label">Conductor</div>
              <input
                className="input"
                value={cartaPorte.conductor_nombre}
                onChange={(e) =>
                  setCartaPorte((p) => ({
                    ...p,
                    conductor_nombre: e.target.value,
                  }))
                }
                placeholder="Nombre y apellidos"
              />
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              <div className="label">DNI</div>
              <input
                className="input"
                value={cartaPorte.conductor_dni}
                onChange={(e) =>
                  setCartaPorte((p) => ({
                    ...p,
                    conductor_dni: e.target.value,
                  }))
                }
              />
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              <div className="label">Precinto</div>
              <input
                className="input"
                value={cartaPorte.precinto}
                onChange={(e) =>
                  setCartaPorte((p) => ({ ...p, precinto: e.target.value }))
                }
              />
            </div>
          </CartaSection>

          <CartaSection id="destinatario" title="Destinatario">
            <input
              className="input"
              value={cartaPorte.destinatario_nombre}
              onChange={(e) =>
                setCartaPorte((p) => ({
                  ...p,
                  destinatario_nombre: e.target.value,
                }))
              }
              placeholder="Nombre"
            />
            <textarea
              className="input"
              value={cartaPorte.destinatario_direccion}
              onChange={(e) =>
                setCartaPorte((p) => ({
                  ...p,
                  destinatario_direccion: e.target.value,
                }))
              }
              placeholder="Dirección"
              rows={2}
              style={{ resize: "vertical" }}
            />
          </CartaSection>

          <CartaSection id="mercancia" title="Mercancía transportada">
            <textarea
              className="input"
              value={cartaPorte.mercancia}
              onChange={(e) =>
                setCartaPorte((p) => ({ ...p, mercancia: e.target.value }))
              }
              placeholder="Naturaleza y número de bultos"
              rows={2}
              style={{ resize: "vertical" }}
            />
          </CartaSection>

          <CartaSection id="medidas" title="Medidas (Palets, Temp, Peso)">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
              }}
            >
              <div style={{ display: "grid", gap: 6 }}>
                <div className="label">Palets</div>
                <input
                  className="input"
                  value={cartaPorte.bultos}
                  onChange={(e) =>
                    setCartaPorte((p) => ({ ...p, bultos: e.target.value }))
                  }
                  placeholder="Ej: 5"
                />
              </div>
              <div style={{ display: "grid", gap: 6 }}>
                <div className="label">Temperatura</div>
                <input
                  className="input"
                  value={cartaPorte.temperatura}
                  onChange={(e) =>
                    setCartaPorte((p) => ({
                      ...p,
                      temperatura: e.target.value,
                    }))
                  }
                  placeholder="Ej: -20ºC / +5ºC / SECO"
                />
              </div>
              <div style={{ display: "grid", gap: 6, gridColumn: "1 / -1" }}>
                <div className="label">Peso (kg)</div>
                <input
                  className="input"
                  value={cartaPorte.peso_kg}
                  onChange={(e) =>
                    setCartaPorte((p) => ({ ...p, peso_kg: e.target.value }))
                  }
                  placeholder="Ej: 2000"
                />
              </div>
            </div>
          </CartaSection>
        </div>

        <div
          style={{
            padding: 8,
            overflow: "auto",
            minWidth: 0,
            minHeight: 0,
            background: "var(--bg-alt)",
            borderRadius: 10,
            border: "1px solid var(--border)",
            height: "100%",
          }}
        >
          <div
            style={{
              background: "#fff",
              border: "2px solid #111",
              borderRadius: 4,
              padding: 18,
              maxWidth: 620,
              margin: "0 auto",
              color: "#111",
              fontFamily:
                '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 12,
              }}
            >
              <img
                src="/logo-eis-maritimo.png"
                alt="EIS Marítimo"
                style={{ height: 44, width: "auto", objectFit: "contain" }}
              />
              <div style={{ textAlign: "center", flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: 18 }}>
                  CARTA DE PORTE NACIONAL
                </div>
              </div>
            </div>

            <div style={{ borderTop: "2px solid #111", marginTop: 12 }} />

            <div style={{ padding: "10px 0", fontSize: 12 }}>
              <span style={{ fontWeight: 700 }}>FECHA DE TRANSPORTE:</span>{" "}
              <span style={{ fontWeight: 800 }}>
                {fechaTransporteLabel || "—"}
              </span>
            </div>
            <div style={{ borderTop: "2px solid #111" }} />

            <div style={{ padding: "10px 0", fontSize: 12 }}>
              <span style={{ fontWeight: 700 }}>ORIGEN DE LA CARGA:</span>{" "}
              <span style={{ fontWeight: 800 }}>
                {String(cartaPorte.origen_carga || "").toUpperCase() || "—"}
              </span>
            </div>
            <div style={{ borderTop: "2px solid #111" }} />

            <div style={{ padding: "10px 0", fontSize: 12 }}>
              <span style={{ fontWeight: 700 }}>DESTINO DE LA CARGA:</span>{" "}
              <span style={{ fontWeight: 800 }}>
                {String(destinoLabel || "").toUpperCase() || "—"}
              </span>
            </div>
            <div style={{ borderTop: "2px solid #111" }} />

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                borderTop: "2px solid #111",
              }}
            >
              <div
                style={{
                  padding: 10,
                  fontSize: 12,
                  borderRight: "2px solid #111",
                }}
              >
                <div style={{ fontWeight: 700 }}>MATRÍCULA TRACTORA:</div>
                <div style={{ fontWeight: 800, marginTop: 4 }}>
                  {String(cartaPorte.matricula_tractora || "").toUpperCase() ||
                    "—"}
                </div>
              </div>
              <div style={{ padding: 10, fontSize: 12 }}>
                <div style={{ fontWeight: 700 }}>MATRÍCULA REMOLQUE:</div>
                <div style={{ fontWeight: 800, marginTop: 4 }}>
                  {String(cartaPorte.matricula_remolque || "").toUpperCase() ||
                    "—"}
                </div>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                borderTop: "2px solid #111",
              }}
            >
              <div
                style={{
                  padding: 10,
                  fontSize: 12,
                  borderRight: "2px solid #111",
                }}
              >
                <div style={{ fontWeight: 700 }}>EMPRESA CARGADORA</div>
                <div style={{ marginTop: 6 }}>
                  <div>
                    <span style={{ fontWeight: 700 }}>NOMBRE:</span>{" "}
                    <span style={{ fontWeight: 800 }}>
                      {String(
                        cartaPorte.empresa_cargadora_nombre || "",
                      ).toUpperCase() || "—"}
                    </span>
                  </div>
                  <div style={{ marginTop: 2, whiteSpace: "pre-wrap" }}>
                    <span style={{ fontWeight: 700 }}>DIRECCIÓN:</span>{" "}
                    <span style={{ fontWeight: 800 }}>
                      {String(cartaPorte.empresa_cargadora_direccion || "")
                        .toUpperCase()
                        .trim() || "—"}
                    </span>
                  </div>
                </div>
              </div>
              <div style={{ padding: 10, fontSize: 12 }}>
                <div style={{ fontWeight: 700 }}>EMPRESA EXPEDIDORA</div>
                <div style={{ marginTop: 6 }}>
                  <div>
                    <span style={{ fontWeight: 700 }}>NOMBRE:</span>{" "}
                    <span style={{ fontWeight: 800 }}>
                      {String(
                        cartaPorte.empresa_expedidora_nombre || "",
                      ).toUpperCase() || "—"}
                    </span>
                  </div>
                  <div style={{ marginTop: 2, whiteSpace: "pre-wrap" }}>
                    <span style={{ fontWeight: 700 }}>DIRECCIÓN:</span>{" "}
                    <span style={{ fontWeight: 800 }}>
                      {String(cartaPorte.empresa_expedidora_direccion || "")
                        .toUpperCase()
                        .trim() || "—"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div
              style={{ borderTop: "2px solid #111", padding: 10, fontSize: 12 }}
            >
              <div style={{ fontWeight: 700 }}>EMPRESA TRANSPORTISTA</div>
              <div style={{ marginTop: 6 }}>
                <div>
                  <span style={{ fontWeight: 700 }}>NOMBRE:</span>{" "}
                  <span style={{ fontWeight: 800 }}>
                    {String(
                      cartaPorte.empresa_transportista_nombre || "",
                    ).toUpperCase() || "—"}
                  </span>
                </div>
                <div style={{ marginTop: 2, whiteSpace: "pre-wrap" }}>
                  <span style={{ fontWeight: 700 }}>DIRECCIÓN:</span>{" "}
                  <span style={{ fontWeight: 800 }}>
                    {String(cartaPorte.empresa_transportista_direccion || "")
                      .toUpperCase()
                      .trim() || "—"}
                  </span>
                </div>
                <div style={{ marginTop: 2 }}>
                  <span style={{ fontWeight: 700 }}>CONDUCTOR:</span>{" "}
                  <span style={{ fontWeight: 800 }}>
                    {String(cartaPorte.conductor_nombre || "").toUpperCase() ||
                      "—"}
                  </span>
                  {cartaPorte.conductor_dni ? (
                    <span style={{ fontWeight: 700 }}>
                      {` , DNI ${String(cartaPorte.conductor_dni || "").toUpperCase()}`}
                    </span>
                  ) : null}
                </div>
                <div style={{ marginTop: 2 }}>
                  <span style={{ fontWeight: 700 }}>PRECINTO:</span>{" "}
                  <span style={{ fontWeight: 800 }}>
                    {String(cartaPorte.precinto || "").toUpperCase() || "—"}
                  </span>
                </div>
              </div>
            </div>

            <div
              style={{ borderTop: "2px solid #111", padding: 10, fontSize: 12 }}
            >
              <div style={{ fontWeight: 700 }}>DESTINATARIO</div>
              <div style={{ marginTop: 6 }}>
                <div>
                  <span style={{ fontWeight: 700 }}>NOMBRE:</span>{" "}
                  <span style={{ fontWeight: 800 }}>
                    {String(
                      cartaPorte.destinatario_nombre || "",
                    ).toUpperCase() || "—"}
                  </span>
                </div>
                <div style={{ marginTop: 2, whiteSpace: "pre-wrap" }}>
                  <span style={{ fontWeight: 700 }}>DIRECCIÓN:</span>{" "}
                  <span style={{ fontWeight: 800 }}>
                    {String(cartaPorte.destinatario_direccion || "")
                      .toUpperCase()
                      .trim() || "—"}
                  </span>
                </div>
              </div>
            </div>

            <div
              style={{ borderTop: "2px solid #111", padding: 10, fontSize: 12 }}
            >
              <div style={{ fontWeight: 700 }}>
                MERCANCÍA TRANSPORTADA:{" "}
                <span style={{ fontStyle: "italic", fontWeight: 600 }}>
                  Naturaleza, peso y número de bultos
                </span>
              </div>
              <div style={{ marginTop: 6 }}>
                <span style={{ fontWeight: 700 }}>TEMPERATURA:</span>{" "}
                <span style={{ fontWeight: 800 }}>
                  {String(cartaPorte.temperatura || "").toUpperCase() || "—"}
                </span>
              </div>
              <div
                style={{ marginTop: 6, fontWeight: 800, textAlign: "center" }}
              >
                {String(cartaPorte.bultos || "").trim()
                  ? `${String(cartaPorte.bultos || "").trim()} PALETS${
                      String(cartaPorte.mercancia || "").trim()
                        ? ` · ${String(cartaPorte.mercancia || "").trim()}`
                        : ""
                    }`.toUpperCase()
                  : String(cartaPorte.mercancia || "").toUpperCase() || "—"}
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  marginTop: 6,
                  fontWeight: 800,
                }}
              >
                {cartaPorte.peso_kg
                  ? `${String(cartaPorte.peso_kg).trim()} KG`
                  : "—"}
              </div>
            </div>

            <div style={{ borderTop: "2px solid #111", padding: "14px 10px" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                  fontSize: 12,
                }}
              >
                <div style={{ minHeight: 80 }}>Vº Bº Plataforma</div>
                <div style={{ textAlign: "right", minHeight: 80 }}>
                  Vº Bº Transportista
                </div>
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}
