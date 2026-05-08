import { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import DataTable from "../components/DataTable.jsx";
import CardGrid from "../components/CardGrid.jsx";
import Modal from "../components/Modal.jsx";
import Snackbar from "../components/Snackbar.jsx";
import Pagination from "../components/Pagination.jsx";
import Calendar from "../components/Calendar.jsx";
import SearchableSelect from "../components/SearchableSelect.jsx";
import FormField from "../components/FormField.jsx";
import {
  getCurrentRole,
  hasPermission,
  PERMISSIONS,
  getCurrentUser,
  ROLES,
} from "../utils/roles.js";
import {
  createLoad,
  createShip as createShipFirebase,
  createPallet as createPalletFirebase,
  createUser as createUserFirebase,
  fetchAllCompanies,
  fetchAllConsignees,
  fetchAllLoads,
  fetchAllLocations,
  fetchAllPallets,
  fetchAllResponsables,
  fetchAllShips,
  fetchAllUsers,
  fetchLoadsByChoferId,
  logInteraction,
  updatePeticionById,
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

const esCompare = (a, b) =>
  String(a || "").localeCompare(String(b || ""), "es", {
    sensitivity: "base",
    numeric: true,
  });

export default function Loads() {
  const allColumns = useMemo(
    () => [
      { key: "status_indicator", header: "" },
      { key: "nombre", header: "Nombre" },
      { key: "barco", header: "Barco" },
      { key: "entrega", header: "Entrega" },
      { key: "chofer", header: "Chofer" },
      { key: "consignatario", header: "Consignatario" },
      { key: "terminal_entrega", header: "Terminal entrega" },
      { key: "carga", header: "Tipo de carga" },
      { key: "total_palets", header: "Palets" },
      { key: "estado_viaje", header: "Estado viaje" },
      { key: "cash_lancha", header: "Cash/Lancha" },
      { key: "fecha_de_carga", header: "Fecha de carga" },
      { key: "hora_de_carga", header: "Hora de carga" },
      { key: "fecha_de_descarga", header: "Fecha de descarga" },
      { key: "hora_de_descarga", header: "Hora de descarga" },
    ],
    [],
  );

  const navigate = useNavigate();
  const location = useLocation();
  const todayIso = useMemo(() => {
    const d = new Date();
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${yyyy}-${mm}-${dd}`;
  }, []);
  const [view, setView] = useState("table");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [peticionFromId, setPeticionFromId] = useState("");
  const [openExportAgenda, setOpenExportAgenda] = useState(false);
  const [exportStep, setExportStep] = useState("config");
  const [exportStart, setExportStart] = useState(todayIso);
  const [exportEnd, setExportEnd] = useState(todayIso);
  const [exportUseCurrentFilters, setExportUseCurrentFilters] = useState(true);
  const [exportMode, setExportMode] = useState("all");
  const [exportSelectedIds, setExportSelectedIds] = useState([]);
  const [form, setForm] = useState({
    barco: "",
    entrega: [],
    chofer: "",
    responsable: "",
    consignatario: "",
    terminal_entrega: "",
    fecha_de_carga: "",
    hora_de_carga: "",
    fecha_de_descarga: "",
    hora_de_descarga: "",
    cash: false,
    lancha: false,
    estado_viaje: "Preparando",
  });
  const [ships, setShips] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [pallets, setPallets] = useState([]);
  const [users, setUsers] = useState([]);
  const [responsables, setResponsables] = useState([]);
  const [consignees, setConsignees] = useState([]);
  const [locations, setLocations] = useState([]);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [snack, setSnack] = useState({
    open: false,
    message: "",
    type: "success",
  });
  const stageRaw =
    import.meta.env.VITE_APP_STAGE ||
    (import.meta.env.MODE || "").toUpperCase();
  const stage = String(stageRaw || "").toUpperCase();
  const isDev =
    !!import.meta.env.DEV || stage === "DEV" || stage === "DEVELOPMENT";
  const debugOverride = useMemo(() => {
    try {
      const params = new URLSearchParams(window.location.search || "");
      if (params.get("debugPerms") === "1") return true;
    } catch {
      void 0;
    }
    try {
      return localStorage.getItem("debugPerms") === "1";
    } catch {
      return false;
    }
  }, []);
  const debugEnabled = isDev || debugOverride;
  const [openDebug, setOpenDebug] = useState(false);
  useEffect(() => {
    if (debugOverride) setOpenDebug(true);
  }, [debugOverride]);

  // Filtros y agrupación
  const [estadoFilter, setEstadoFilter] = useState("");
  const [barcoFilter, setBarcoFilter] = useState("");
  const [choferFilter, setChoferFilter] = useState("");
  const [consignatarioFilter, setConsignatarioFilter] = useState("");
  const [terminalFilter, setTerminalFilter] = useState("");
  const [responsableFilter, setResponsableFilter] = useState("");
  const [groupBy, setGroupBy] = useState("none");
  const [sortBy, setSortBy] = useState("");
  const [sortDir, setSortDir] = useState("asc");
  const [showHistory, setShowHistory] = useState(false);
  const toolbarMenuRef = useRef(null);
  const searchInputRef = useRef(null);
  const [toolbarMenu, setToolbarMenu] = useState(null);
  const [toolbarSearch, setToolbarSearch] = useState("");
  const [filterMenuField, setFilterMenuField] = useState("estado_viaje");
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const [viewMenuSearch, setViewMenuSearch] = useState("");
  const allColumnKeys = useMemo(
    () => allColumns.map((c) => c.key),
    [allColumns],
  );
  const [visibleColumnKeys, setVisibleColumnKeys] = useState(() => {
    try {
      const raw = localStorage.getItem("loads_table_columns");
      const parsed = raw ? JSON.parse(raw) : null;
      if (Array.isArray(parsed) && parsed.length > 0) {
        const filtered = parsed
          .filter((k) => k !== "estado_carga")
          .map((k) => (k === "cash" || k === "lancha" ? "cash_lancha" : k));
        if (!filtered.includes("status_indicator"))
          filtered.unshift("status_indicator");
        const unique = [];
        for (const k of filtered) {
          if (!unique.includes(k)) unique.push(k);
        }
        return unique;
      }
    } catch (e) {
      void e;
    }
    return allColumnKeys;
  });
  useEffect(() => {
    try {
      localStorage.setItem(
        "loads_table_columns",
        JSON.stringify(visibleColumnKeys),
      );
    } catch {
      return;
    }
  }, [visibleColumnKeys]);

  useEffect(() => {
    if (!toolbarMenu && !viewMenuOpen) return undefined;
    const onDown = (e) => {
      const el = toolbarMenuRef.current;
      if (!el) return;
      if (el.contains(e.target)) return;
      setToolbarMenu(null);
      setViewMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [toolbarMenu, viewMenuOpen]);

  useEffect(() => {
    if (toolbarMenu !== "search") return;
    const id = window.setTimeout(() => {
      searchInputRef.current?.focus?.();
    }, 0);
    return () => window.clearTimeout(id);
  }, [toolbarMenu]);

  // mes de calendario
  const [calMonth, setCalMonth] = useState(() => new Date());
  const [calMode, setCalMode] = useState("week");
  const [calendarDateMode, setCalendarDateMode] = useState("carga");
  const prevPeriod = () =>
    setCalMonth((d) => {
      if (calMode === "week")
        return new Date(d.getFullYear(), d.getMonth(), d.getDate() - 7);
      if (calMode === "fortnight")
        return new Date(d.getFullYear(), d.getMonth(), d.getDate() - 14);
      return new Date(d.getFullYear(), d.getMonth() - 1, 1);
    });
  const nextPeriod = () =>
    setCalMonth((d) => {
      if (calMode === "week")
        return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7);
      if (calMode === "fortnight")
        return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 14);
      return new Date(d.getFullYear(), d.getMonth() + 1, 1);
    });

  // nuevos estados base para recomputar filas con palets
  const [loadDocs, setLoadDocs] = useState([]);

  // modales de creación rápida
  const [openCreateShip, setOpenCreateShip] = useState(false);
  const [shipForm, setShipForm] = useState({
    nombre_del_barco: "",
    empresa: "",
    enlace: "",
  });
  const [openCreateUser, setOpenCreateUser] = useState(false);
  const [userForm, setUserForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "consignee",
  });
  const [openCreatePallet, setOpenCreatePallet] = useState(false);
  const [palletForm, setPalletForm] = useState({
    numero_palet: "",
    tipo: "Seco",
    base: "Europeo",
  });

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

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        setLoading(true);
        const loadTask = isDriver
          ? fetchLoadsByChoferId(currentUserId)
          : fetchAllLoads();
        const results = await Promise.allSettled(
          [
            loadTask,
            fetchAllShips(),
            fetchAllConsignees(),
            fetchAllLocations(),
            ...(isDriver
              ? []
              : [
                  fetchAllPallets(),
                  fetchAllUsers(),
                  fetchAllCompanies(),
                  fetchAllResponsables(),
                ]),
          ].filter(Boolean),
        );
        const values = results.map((r) =>
          r.status === "fulfilled" && Array.isArray(r.value) ? r.value : [],
        );
        const loadsList = values[0] || [];
        const shipsList = values[1] || [];
        const consigneesList = values[2] || [];
        const locationsList = values[3] || [];
        const palletsList = isDriver ? [] : values[4] || [];
        const usersList = isDriver ? [] : values[5] || [];
        const companiesList = isDriver ? [] : values[6] || [];
        const responsablesList = isDriver ? [] : values[7] || [];
        if (!mounted) return;
        const normalize = (x) => ({
          ...x,
          _id: x?._id || x?.id,
          id: x?.id || x?._id,
        });
        setLoadDocs(loadsList.map(normalize));
        setShips(shipsList.map(normalize));
        setPallets(palletsList.map(normalize));
        setUsers(usersList.map(normalize));
        setCompanies(companiesList.map(normalize));
        setConsignees(consigneesList.map(normalize));
        setLocations(locationsList.map(normalize));
        setResponsables(responsablesList.map(normalize));
      } catch {
        if (!mounted) return;
        setLoadDocs([]);
        setShips([]);
        setPallets([]);
        setUsers([]);
        setCompanies([]);
        setConsignees([]);
        setLocations([]);
        setResponsables([]);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    run();
    return () => {
      mounted = false;
    };
  }, [currentUserId, isDriver]);

  const canExportAgenda =
    !isReadOnlyActions &&
    (roleNormalized === "admin" ||
      roleNormalized === "dispatcher" ||
      roleNormalized === "logistic");
  const canManageLoads =
    !isReadOnlyActions &&
    (hasPermission(role, PERMISSIONS.MANAGE_LOADS) ||
      String(role || "")
        .trim()
        .toLowerCase() === "dispatcher");
  const debugInfo = useMemo(() => {
    if (!openDebug) return null;
    const authRaw = String(localStorage.getItem("auth") || "");
    let authParsed = null;
    try {
      authParsed = JSON.parse(authRaw || "{}");
    } catch {
      authParsed = { parse_error: true };
    }
    const currentUser = getCurrentUser();
    const roleRaw = currentUser?.role ?? null;
    const roleResolved = role;
    const permissions = Object.values(PERMISSIONS).reduce((acc, p) => {
      acc[p] = hasPermission(roleResolved, p);
      return acc;
    }, {});
    return {
      env: {
        MODE: import.meta.env.MODE,
        DEV: !!import.meta.env.DEV,
        VITE_APP_STAGE: import.meta.env.VITE_APP_STAGE,
      },
      authRaw,
      authParsed,
      user: currentUser,
      roleRaw,
      roleResolved,
      permissions,
      canManageLoads,
    };
  }, [openDebug, role, canManageLoads]);

  useEffect(() => {
    const prefill = location?.state?.prefillFromPeticion || null;
    const id = String(prefill?.id || "").trim();
    const barco = String(prefill?.barco || "").trim();
    const fechaDescarga = String(prefill?.fecha_de_descarga || "").trim();
    if (!id) return;
    if (!canManageLoads) {
      setSnack({
        open: true,
        message: "No tienes permiso para crear cargas desde peticiones",
        type: "error",
      });
      navigate(location.pathname, { replace: true, state: null });
      return;
    }
    setPeticionFromId(id);
    setForm((prev) => ({
      ...prev,
      barco: barco || prev.barco,
      fecha_de_descarga: fechaDescarga || prev.fecha_de_descarga,
    }));
    setOpen(true);
    navigate(location.pathname, { replace: true, state: null });
  }, [location, canManageLoads, navigate]);

  const openExportAgendaModal = () => {
    if (!canExportAgenda) {
      setSnack({
        open: true,
        message: "No tienes permiso para exportar la agenda",
        type: "error",
      });
      return;
    }
    setExportStart(todayIso);
    setExportEnd(todayIso);
    setExportUseCurrentFilters(true);
    setExportMode("all");
    setExportSelectedIds([]);
    setExportStep("config");
    setOpenExportAgenda(true);
  };

  const closeExportAgendaModal = () => {
    setOpenExportAgenda(false);
    setExportStep("config");
  };

  const goExportPreview = () => {
    const startKey = String(exportStart || "").trim();
    const endKeyRaw = String(exportEnd || exportStart || "").trim();
    if (!startKey) {
      setSnack({
        open: true,
        message: "Selecciona una fecha de inicio",
        type: "error",
      });
      return;
    }
    const startMsRaw = new Date(`${startKey}T00:00:00`).getTime();
    const endMsRaw = new Date(`${endKeyRaw}T00:00:00`).getTime();
    if (Number.isNaN(startMsRaw) || Number.isNaN(endMsRaw)) {
      setSnack({
        open: true,
        message: "Rango de fechas inválido",
        type: "error",
      });
      return;
    }
    const startMs = Math.min(startMsRaw, endMsRaw);
    const endMs = Math.max(startMsRaw, endMsRaw);
    const effectiveStartKey =
      startMsRaw <= endMsRaw ? startKey : endKeyRaw || startKey;
    const effectiveEndKey =
      startMsRaw <= endMsRaw ? endKeyRaw || startKey : startKey;

    if (effectiveStartKey !== startKey || effectiveEndKey !== endKeyRaw) {
      setExportStart(effectiveStartKey);
      setExportEnd(effectiveEndKey);
    }

    const base = exportUseCurrentFilters ? filtered : rows;
    const candidates = base.filter((r) => {
      const k = String(r.fecha_de_carga_group || "");
      if (!k || k === "Sin fecha") return false;
      const ms = new Date(`${k}T00:00:00`).getTime();
      if (Number.isNaN(ms)) return false;
      if (ms < startMs) return false;
      if (ms > endMs) return false;
      return true;
    });

    if (candidates.length === 0) {
      setSnack({
        open: true,
        message: "No hay cargas en el rango seleccionado",
        type: "warning",
      });
      return;
    }

    if (exportMode === "select") {
      const selectedSet = new Set(exportSelectedIds.map((v) => String(v)));
      const selectedCount = candidates.reduce((acc, r) => {
        return acc + (selectedSet.has(String(r.id)) ? 1 : 0);
      }, 0);
      if (selectedCount === 0) {
        setSnack({
          open: true,
          message: "Selecciona al menos una carga",
          type: "error",
        });
        return;
      }
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
      type: "agenda_previewed",
      actor,
      target: {
        id: "",
        name: "export_agenda",
      },
      details: {
        start: effectiveStartKey,
        end: effectiveEndKey,
        useCurrentFilters: !!exportUseCurrentFilters,
        mode: String(exportMode || ""),
        candidatesCount: candidates.length,
        selectedCount:
          exportMode === "select"
            ? exportSelectedIds.length
            : candidates.length,
      },
    }).catch(() => {});
    setExportStep("preview");
  };

  const submitExportAgendaModal = () => {
    if (exportStep === "config") {
      goExportPreview();
      return;
    }
    if (exportPreviewRows.length === 0) {
      setSnack({
        open: true,
        message: "No hay cargas para exportar",
        type: "warning",
      });
      return;
    }
    printExportAgenda();
    closeExportAgendaModal();
  };

  const onCreate = () => {
    if (!canManageLoads) {
      setSnack({
        open: true,
        message: "No tienes permiso para crear cargas",
        type: "error",
      });
      return;
    }
    setOpen(true);
  };

  const submit = async () => {
    try {
      if (!form.barco || !form.fecha_de_carga) {
        setSnack({
          open: true,
          message: "Barco y Fecha de Carga son obligatorios",
          type: "error",
        });
        return;
      }
      const payload = {
        barco: form.barco,
        entrega: form.entrega,
        chofer: form.chofer || undefined,
        responsable: form.responsable || undefined,
        consignatario: form.consignatario || undefined,
        terminal_entrega: form.terminal_entrega || undefined,
        fecha_de_carga: form.fecha_de_carga || undefined,
        hora_de_carga: form.hora_de_carga || undefined,
        fecha_de_descarga: form.fecha_de_descarga || undefined,
        hora_de_descarga: form.hora_de_descarga || undefined,
        cash: !!form.cash,
        lancha: !!form.lancha,
        estado_viaje: form.estado_viaje,
        creado_por: getCurrentUser()?.name || "Testing",
      };
      const created = await createLoad(payload);
      if (!created) {
        setSnack({
          open: true,
          message: "Error creando carga",
          type: "error",
        });
        return;
      }
      setLoadDocs((prev) => [
        ...prev,
        {
          ...created,
          _id: created._id || created.id,
          id: created.id || created._id,
        },
      ]);
      if (peticionFromId) {
        const newLoadId = String(created?.id || created?._id || "").trim();
        const petitionId = String(peticionFromId || "").trim();
        setPeticionFromId("");
        if (petitionId && newLoadId) {
          updatePeticionById(petitionId, {
            estado: "Convertida",
            load_id: newLoadId,
            modificado_por_uid: currentUserId,
            modificado_por_name: getCurrentUser()?.name || "Testing",
            modificado_por_role: roleNormalized,
          }).catch(() => {});
        }
      }
      setOpen(false);
      setForm({
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
      setSnack({ open: true, message: "Carga creada", type: "success" });
    } catch (e) {
      const msg = String(e?.message || "");
      setSnack({
        open: true,
        message: msg || "Error de red creando carga",
        type: "error",
      });
    }
  };

  const createShip = async () => {
    try {
      if (!shipForm.nombre_del_barco) {
        setSnack({
          open: true,
          message: "El nombre del barco es obligatorio",
          type: "error",
        });
        return;
      }
      const company = companies.find(
        (c) => String(c._id || c.id) === String(shipForm.empresa),
      );
      const created = await createShipFirebase({
        ...shipForm,
        empresa_nombre: company?.nombre || "",
        creado_por: getCurrentUser()?.name || "Testing",
      });
      if (!created) {
        setSnack({
          open: true,
          message: "Error creando barco",
          type: "error",
        });
        return;
      }
      setShips((prev) => [
        ...prev,
        {
          ...created,
          _id: created._id || created.id,
          id: created.id || created._id,
        },
      ]);
      setOpenCreateShip(false);
      setShipForm({ nombre_del_barco: "", empresa: "", enlace: "" });
      setSnack({ open: true, message: "Barco creado", type: "success" });
    } catch (e) {
      const msg = String(e?.message || "");
      setSnack({
        open: true,
        message: msg || "Error de red creando barco",
        type: "error",
      });
    }
  };

  const createUser = async () => {
    try {
      if (!userForm.name || !userForm.email || !userForm.role) {
        setSnack({
          open: true,
          message: "Nombre, email y rol son obligatorios",
          type: "error",
        });
        return;
      }
      // Si el rol es consignatario, la contraseña es opcional
      if (userForm.role !== "consignee" && !userForm.password) {
        setSnack({
          open: true,
          message: "La contraseña es obligatoria para este rol",
          type: "error",
        });
        return;
      }
      const body = {
        name: userForm.name,
        email: userForm.email,
        role: userForm.role,
      };
      if (userForm.password) body.password = userForm.password;
      const created = await createUserFirebase(body);
      if (!created) {
        setSnack({
          open: true,
          message: "Error creando usuario",
          type: "error",
        });
        return;
      }
      setUsers((prev) => [
        ...prev,
        {
          ...created,
          _id: created._id || created.id,
          id: created.id || created._id,
        },
      ]);
      setOpenCreateUser(false);
      setUserForm({ name: "", email: "", password: "", role: "consignee" });
      setSnack({ open: true, message: "Usuario creado", type: "success" });
    } catch (e) {
      const code = String(e?.code || "");
      const msg = String(e?.message || "");
      const friendly =
        code === "auth/email-already-in-use"
          ? "El email ya está en uso"
          : code === "auth/invalid-email"
            ? "Email inválido"
            : code === "auth/weak-password"
              ? "Contraseña demasiado débil"
              : msg;
      setSnack({
        open: true,
        message: friendly || "Error creando usuario",
        type: "error",
      });
    }
  };

  const createPallet = async () => {
    try {
      if (!palletForm.numero_palet) {
        setSnack({
          open: true,
          message: "El número de palet es obligatorio",
          type: "error",
        });
        return;
      }
      const created = await createPalletFirebase({
        ...palletForm,
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
      setPalletForm({ numero_palet: "", tipo: "Seco", base: "Europeo" });
      setSnack({ open: true, message: "Palet creado", type: "success" });
    } catch (e) {
      const msg = String(e?.message || "");
      setSnack({
        open: true,
        message: msg || "Error creando palet",
        type: "error",
      });
    }
  };

  const formatDate = (d) => {
    if (!d) return "";
    const date = new Date(d);
    if (isNaN(date.getTime())) return "";
    const dd = String(date.getDate()).padStart(2, "0");
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const yyyy = date.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  };

  const toIsoDateKey = (d) => {
    if (!d) return "";
    const date = new Date(d);
    if (isNaN(date.getTime())) return "";
    const dd = String(date.getDate()).padStart(2, "0");
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const yyyy = date.getFullYear();
    return `${yyyy}-${mm}-${dd}`;
  };

  const parseIsoDateKey = (key) => {
    const m = String(key || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    const yyyy = Number(m[1]);
    const mm = Number(m[2]);
    const dd = Number(m[3]);
    const d = new Date(yyyy, mm - 1, dd);
    if (isNaN(d.getTime())) return null;
    return d;
  };

  // Derivar filas con todos los campos y conteo correcto de palets
  const rows = useMemo(() => {
    const shipById = new Map(
      ships.map((s) => [String(s._id || s.id || ""), s]).filter((p) => p[0]),
    );
    const userById = new Map(
      users.map((u) => [String(u._id || u.id || ""), u]).filter((p) => p[0]),
    );
    const consigneeById = new Map(
      consignees
        .map((c) => [String(c._id || c.id || ""), c])
        .filter((p) => p[0]),
    );
    const locationById = new Map(
      locations
        .map((l) => [String(l._id || l.id || ""), l])
        .filter((p) => p[0]),
    );
    const responsableById = new Map(
      responsables
        .map((r) => [String(r._id || r.id || ""), r])
        .filter((p) => p[0]),
    );
    const existingPalletIds = new Set(
      pallets.map((p) => String(p?._id || p?.id || "").trim()).filter(Boolean),
    );
    const palletById = new Map(
      pallets
        .map((p) => [String(p?._id || p?.id || "").trim(), p])
        .filter((pair) => pair[0]),
    );
    const tipoForms = {
      Seco: ["seco", "secos"],
      Refrigerado: ["refrigerado", "refrigerados"],
      Congelado: ["congelado", "congelados"],
      Técnico: ["técnico", "técnicos"],
      "Fruta y verdura": ["fruta y verdura", "fruta y verdura"],
      Repuestos: ["repuesto", "repuestos"],
    };
    return loadDocs.map((l) => {
      const paletsArray = Array.isArray(l.palets) ? l.palets : [];
      let totalPalets = 0;
      let paletsPorTipo = "";
      if (isDriver) {
        totalPalets = paletsArray.length;
      } else {
        const byRelation = pallets.filter(
          (p) => String(p.carga?._id || p.carga) === String(l._id),
        );
        const listFromArrayAll = paletsArray
          .map((p) => String(p?._id || p?.id || p || "").trim())
          .filter(Boolean);
        const listFromArray = listFromArrayAll.filter((pid) =>
          existingPalletIds.has(String(pid)),
        );
        const listFromRelation = byRelation
          .map((p) => String(p?._id || p?.id || "").trim())
          .filter(Boolean);
        const uniqueIds = new Set([...listFromArray, ...listFromRelation]);
        totalPalets = uniqueIds.size;
        const tipoCounts = {};
        for (const pid of uniqueIds) {
          const tipo = String(palletById.get(String(pid))?.tipo || "").trim();
          if (!tipo) continue;
          tipoCounts[tipo] = (tipoCounts[tipo] || 0) + 1;
        }
        paletsPorTipo = CARGA_OPTIONS.map((t) => {
          const n = Number(tipoCounts[t] || 0);
          if (!n) return null;
          const forms = tipoForms[t] || [String(t || "").toLowerCase()];
          const word =
            n === 1 ? forms[0] : forms[1] || `${String(forms[0] || "")}s`;
          return `${n} ${word}`;
        })
          .filter(Boolean)
          .join(", ");
      }

      const barcoId = String(l.barco?._id || l.barco || "");
      const choferId = String(l.chofer?._id || l.chofer || "");
      const consignatarioId = String(
        l.consignatario?._id || l.consignatario || "",
      );
      const terminalId = String(
        l.terminal_entrega?._id || l.terminal_entrega || "",
      );
      const responsableRaw = l.responsable;
      const responsableObj =
        responsableRaw && typeof responsableRaw === "object"
          ? responsableRaw
          : null;
      const responsableId = String(
        responsableObj?._id || responsableObj?.id || responsableRaw || "",
      );

      const ship = shipById.get(barcoId) || null;
      const chofer = userById.get(choferId) || null;
      const consignatario = consigneeById.get(consignatarioId) || null;
      const terminal = locationById.get(terminalId) || null;
      const responsable =
        responsableById.get(responsableId) ||
        (responsableObj ? responsableObj : null);

      const requiredPresent = [
        l.fecha_de_carga,
        barcoId,
        Array.isArray(l.entrega) ? l.entrega.length > 0 : !!l.entrega,
        choferId,
        consignatarioId,
        l.estado_viaje,
      ].every(Boolean);

      const hasPallets = totalPalets > 0;
      const indicatorColor = requiredPresent ? "#22c55e" : "#ef4444";
      const indicatorFill = hasPallets ? indicatorColor : "transparent";
      const indicatorTitle = requiredPresent
        ? hasPallets
          ? "Carga completa"
          : "Faltan palets"
        : hasPallets
          ? "Faltan datos"
          : "Faltan datos y palets";

      const statusIndicator = (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          title={indicatorTitle}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle
              cx="7"
              cy="7"
              r="6"
              stroke={indicatorColor}
              strokeWidth="2"
              fill={indicatorFill}
            />
          </svg>
        </div>
      );

      return {
        status_indicator: statusIndicator,
        id: l._id,
        nombre: l.nombre || "",
        barco: ship?.nombre_del_barco || l.barco?.nombre_del_barco || "",
        entrega: Array.isArray(l.entrega)
          ? l.entrega.join(", ")
          : l.entrega || "",
        chofer:
          chofer?.name ||
          l.chofer?.name ||
          (isDriver && String(currentUser?.name || "").trim()) ||
          "",
        chofer_id: choferId,
        consignatario: consignatario?.nombre || l.consignatario?.nombre || "",
        terminal_entrega:
          (terminal?.puerto ? `${terminal.puerto} · ` : "") +
          (terminal?.nombre || ""),
        carga: Array.isArray(l.carga) ? l.carga.join(", ") : l.carga || "",
        total_palets: totalPalets,
        palets_por_tipo: paletsPorTipo,
        estado_viaje: l.estado_viaje || "Preparando",
        cash_lancha: `${l.cash ? "Sí" : "No"}/${l.lancha ? "Sí" : "No"}`,
        fecha_de_carga: formatDate(l.fecha_de_carga),
        fecha_de_carga_raw: l.fecha_de_carga,
        fecha_de_carga_group: toIsoDateKey(l.fecha_de_carga) || "Sin fecha",
        hora_de_carga: l.hora_de_carga || "",
        fecha_de_descarga: formatDate(l.fecha_de_descarga),
        fecha_de_descarga_raw: l.fecha_de_descarga,
        fecha_de_descarga_group:
          toIsoDateKey(l.fecha_de_descarga) || "Sin fecha",
        hora_de_descarga: l.hora_de_descarga || "",
        responsable: String(responsableId || ""),
        responsable_nombre: String(responsable?.nombre || "").trim(),
        responsable_telefono: String(responsable?.telefono || "").trim(),
      };
    });
  }, [
    consignees,
    currentUser?.name,
    isDriver,
    loadDocs,
    locations,
    pallets,
    responsables,
    ships,
    users,
  ]);

  const scopedRows = useMemo(() => {
    const isHistoryStatus = (s) => s === "Entregado" || s === "Cancelado";
    return rows.filter((r) =>
      showHistory
        ? isHistoryStatus(r.estado_viaje)
        : !isHistoryStatus(r.estado_viaje),
    );
  }, [rows, showHistory]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return scopedRows.filter((r) => {
      const textOk =
        q === "" ||
        r.barco.toLowerCase().includes(q) ||
        (r.terminal_entrega || "").toLowerCase().includes(q) ||
        r.estado_viaje.toLowerCase().includes(q);
      const estadoOk = !estadoFilter || r.estado_viaje === estadoFilter;
      const barcoOk = !barcoFilter || r.barco === barcoFilter;
      const choferOk = !choferFilter || r.chofer === choferFilter;
      const consignatarioOk =
        !consignatarioFilter || r.consignatario === consignatarioFilter;
      const terminalOk =
        !terminalFilter || r.terminal_entrega === terminalFilter;
      const responsableOk =
        !responsableFilter || r.responsable_nombre === responsableFilter;
      return (
        textOk &&
        estadoOk &&
        barcoOk &&
        choferOk &&
        consignatarioOk &&
        terminalOk &&
        responsableOk
      );
    });
  }, [
    scopedRows,
    query,
    estadoFilter,
    barcoFilter,
    choferFilter,
    consignatarioFilter,
    terminalFilter,
    responsableFilter,
  ]);

  const sortedFiltered = useMemo(() => {
    if (!sortBy) return filtered;
    const dir = sortDir === "desc" ? -1 : 1;
    const toLower = (v) => String(v ?? "").toLowerCase();
    const toNum = (v) => {
      if (typeof v === "number") return v;
      const n = Number(String(v ?? "").trim());
      return Number.isFinite(n) ? n : 0;
    };
    const toDateMs = (key) => {
      const k = String(key || "");
      if (!k || k === "Sin fecha") return 0;
      const ms = new Date(`${k}T00:00:00`).getTime();
      return Number.isNaN(ms) ? 0 : ms;
    };
    const copy = filtered.slice();
    copy.sort((a, b) => {
      if (sortBy === "total_palets")
        return (toNum(a[sortBy]) - toNum(b[sortBy])) * dir;
      if (
        sortBy === "fecha_de_carga_group" ||
        sortBy === "fecha_de_descarga_group"
      )
        return (toDateMs(a[sortBy]) - toDateMs(b[sortBy])) * dir;
      return (
        toLower(a[sortBy]).localeCompare(toLower(b[sortBy]), "es", {
          sensitivity: "base",
        }) * dir
      );
    });
    return copy;
  }, [filtered, sortBy, sortDir]);

  const exportCandidates = useMemo(() => {
    const base = exportUseCurrentFilters ? filtered : rows;
    const startKey = String(exportStart || "").trim();
    const endKey = String(exportEnd || exportStart || "").trim();
    const startMs = startKey
      ? new Date(`${startKey}T00:00:00`).getTime()
      : null;
    const endMs = endKey ? new Date(`${endKey}T00:00:00`).getTime() : null;
    return base.filter((r) => {
      const k = String(r.fecha_de_carga_group || "");
      if (!k || k === "Sin fecha") return false;
      const ms = new Date(`${k}T00:00:00`).getTime();
      if (Number.isNaN(ms)) return false;
      if (typeof startMs === "number" && ms < startMs) return false;
      if (typeof endMs === "number" && ms > endMs) return false;
      return true;
    });
  }, [exportUseCurrentFilters, filtered, rows, exportStart, exportEnd]);

  const exportCandidateIdSet = useMemo(() => {
    return new Set(exportCandidates.map((r) => String(r.id)));
  }, [exportCandidates]);

  useEffect(() => {
    if (exportMode !== "select") return;
    setExportSelectedIds((prev) =>
      prev.map((v) => String(v)).filter((id) => exportCandidateIdSet.has(id)),
    );
  }, [exportMode, exportCandidateIdSet]);

  const exportSelected = useMemo(() => {
    if (exportMode === "all") return exportCandidates;
    const selectedSet = new Set(exportSelectedIds.map((v) => String(v)));
    return exportCandidates.filter((r) => selectedSet.has(String(r.id)));
  }, [exportMode, exportCandidates, exportSelectedIds]);

  const exportPreviewRows = useMemo(() => {
    return exportSelected.slice().sort((a, b) => {
      const d = String(a.fecha_de_carga_group || "").localeCompare(
        String(b.fecha_de_carga_group || ""),
        "es",
      );
      if (d !== 0) return d;
      const t = String(a.hora_de_carga || "").localeCompare(
        String(b.hora_de_carga || ""),
        "es",
      );
      if (t !== 0) return t;
      return String(a.barco || "").localeCompare(String(b.barco || ""), "es");
    });
  }, [exportSelected]);

  const exportSummary = useMemo(() => {
    const totalCargas = exportPreviewRows.length;
    const totalPalets = exportPreviewRows.reduce(
      (acc, r) => acc + (Number(r.total_palets) || 0),
      0,
    );
    const porEstado = exportPreviewRows.reduce((acc, r) => {
      const k = String(r.estado_viaje || "Sin estado");
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {});
    return { totalCargas, totalPalets, porEstado };
  }, [exportPreviewRows]);

  const printExportAgenda = () => {
    const escapeHtml = (value) =>
      String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");

    const startKey = String(exportStart || "").trim();
    const endKey = String(exportEnd || exportStart || "").trim();
    const titleRange =
      startKey && endKey && startKey !== endKey
        ? `${startKey} → ${endKey}`
        : startKey || endKey || "";
    const generatedAt = new Intl.DateTimeFormat("es-ES", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(new Date());

    const filtrosLabel = exportUseCurrentFilters
      ? `Filtros: estado=${estadoFilter || "Todos"}, barco=${
          barcoFilter || "Todos"
        }, búsqueda=${query ? `"${query}"` : "—"}`
      : "Filtros: sin filtros de pantalla";

    const estadosHtml = Object.entries(exportSummary.porEstado || {})
      .sort((a, b) => String(a[0]).localeCompare(String(b[0]), "es"))
      .map(
        ([k, v]) =>
          `<span class="pill">${escapeHtml(k)}: ${escapeHtml(v)}</span>`,
      )
      .join("");

    const loadsHtml = exportPreviewRows
      .map((r, idx) => {
        const entrega = String(r.entrega || "").trim();
        const carga = String(r.carga || "").trim();
        const responsableLabel = String(r.responsable_nombre || "").trim();
        const responsablePhone = String(r.responsable_telefono || "").trim();
        const responsableFull = responsableLabel
          ? responsablePhone
            ? `${responsableLabel} (${responsablePhone})`
            : responsableLabel
          : responsablePhone || "—";
        return `
          <section class="load">
            <div class="load-head">
              <div class="load-title">${escapeHtml(
                r.nombre || `Carga ${idx + 1}`,
              )}</div>
              <div class="load-meta">
                <span class="pill">${escapeHtml(r.estado_viaje || "")}</span>
                <span class="pill">${escapeHtml(
                  r.fecha_de_carga || "",
                )} ${escapeHtml(r.hora_de_carga || "")}</span>
                <span class="pill">${escapeHtml(r.barco || "")}</span>
              </div>
            </div>
            <div class="grid">
              <div>
                <div class="label">Entrega</div>
                <div class="value">${escapeHtml(entrega || "—")}</div>
              </div>
              <div>
                <div class="label">Terminal entrega</div>
                <div class="value">${escapeHtml(
                  r.terminal_entrega || "—",
                )}</div>
              </div>
              <div>
                <div class="label">Consignatario</div>
                <div class="value">${escapeHtml(r.consignatario || "—")}</div>
              </div>
              <div>
                <div class="label">Chofer</div>
                <div class="value">${escapeHtml(r.chofer || "—")}</div>
              </div>
              <div>
                <div class="label">Responsable</div>
                <div class="value">${escapeHtml(responsableFull)}</div>
              </div>
              <div>
                <div class="label">Tipo de carga</div>
                <div class="value">${escapeHtml(carga || "—")}</div>
              </div>
              <div>
                <div class="label">Palets</div>
                <div class="value">${escapeHtml(r.total_palets || 0)}</div>
              </div>
              <div>
                <div class="label">Palets por tipo</div>
                <div class="value">${escapeHtml(r.palets_por_tipo || "—")}</div>
              </div>
              <div>
                <div class="label">Descarga</div>
                <div class="value">${escapeHtml(
                  r.fecha_de_descarga || "",
                )} ${escapeHtml(r.hora_de_descarga || "")}</div>
              </div>
            </div>
            <div class="tasks">
              <div class="label">Checklist del día</div>
              <div class="taskline"></div>
              <div class="taskline"></div>
              <div class="taskline"></div>
            </div>
          </section>
        `;
      })
      .join("");

    const html = `<!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Agenda ${escapeHtml(titleRange)}</title>
          <style>
            :root { color-scheme: light; }
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; margin: 24px; color: #111827; }
            h1 { font-size: 20px; margin: 0 0 6px 0; }
            .sub { color: #6b7280; font-size: 12px; margin-bottom: 14px; }
            .summary { display: grid; grid-template-columns: 1fr; gap: 10px; border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px; margin-bottom: 16px; }
            .row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
            .pill { display: inline-flex; align-items: center; padding: 2px 8px; border: 1px solid #e5e7eb; border-radius: 999px; font-size: 12px; background: #fff; }
            .load { border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px; margin: 0 0 12px 0; break-inside: avoid; page-break-inside: avoid; }
            .load-head { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }
            .load-title { font-weight: 700; font-size: 14px; }
            .load-meta { display: flex; flex-wrap: wrap; gap: 6px; justify-content: flex-end; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 10px; }
            .label { font-size: 11px; color: #6b7280; margin-bottom: 2px; }
            .value { font-size: 13px; }
            .tasks { margin-top: 12px; }
            .taskline { height: 14px; border-bottom: 1px solid #d1d5db; margin-top: 10px; }
            @media print {
              body { margin: 12mm; }
              .load { break-inside: avoid; page-break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          <h1>Agenda diaria ${escapeHtml(titleRange)}</h1>
          <div class="sub">${escapeHtml(filtrosLabel)} · Generado: ${escapeHtml(
            generatedAt,
          )}</div>
          <div class="summary">
            <div class="row">
              <span class="pill">Cargas: ${escapeHtml(
                exportSummary.totalCargas,
              )}</span>
              <span class="pill">Palets: ${escapeHtml(
                exportSummary.totalPalets,
              )}</span>
            </div>
            <div class="row">${estadosHtml}</div>
          </div>
          ${loadsHtml || "<div>No hay cargas para exportar.</div>"}
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
    if (!w) {
      setSnack({
        open: true,
        message: "El navegador bloqueó la ventana emergente para exportar",
        type: "error",
      });
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return sortedFiltered.slice(start, end);
  }, [sortedFiltered, page, pageSize]);

  useEffect(() => {
    setVisibleColumnKeys((prev) => {
      const next = prev.filter((k) => allColumnKeys.includes(k));
      const ensured = next.length > 0 ? next : [allColumnKeys[0]];
      if (
        ensured.length === prev.length &&
        ensured.every((k, i) => k === prev[i])
      ) {
        return prev;
      }
      return ensured;
    });
  }, [allColumnKeys]);

  const toggleColumnKey = (key) => {
    setVisibleColumnKeys((prev) => {
      const exists = prev.includes(key);
      if (exists && prev.length === 1) return prev;
      if (exists) return prev.filter((k) => k !== key);
      return [...prev, key];
    });
  };

  const tableColumns = useMemo(() => {
    const keySet = new Set(visibleColumnKeys);
    const cols = allColumns.filter((c) => keySet.has(c.key));
    return cols.length > 0 ? cols : [allColumns[0]];
  }, [allColumns, visibleColumnKeys]);

  const groupLabel = useMemo(() => {
    if (
      groupBy !== "fecha_de_carga_group" &&
      groupBy !== "fecha_de_descarga_group"
    ) {
      return undefined;
    }
    return (key) => {
      const k = String(key || "");
      if (!k || k === "(Sin valor)" || k === "Sin fecha") return "Sin fecha";
      const d = parseIsoDateKey(k);
      if (!d) return k;
      return new Intl.DateTimeFormat("es-ES", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "2-digit",
      }).format(d);
    };
  }, [groupBy]);

  useEffect(() => {
    setPage(1);
  }, [
    query,
    estadoFilter,
    barcoFilter,
    choferFilter,
    consignatarioFilter,
    terminalFilter,
    responsableFilter,
    showHistory,
    sortBy,
    sortDir,
    groupBy,
  ]);

  useEffect(() => {
    const isHistoryStatus = (s) => s === "Entregado" || s === "Cancelado";
    if (showHistory) {
      if (estadoFilter && !isHistoryStatus(estadoFilter)) setEstadoFilter("");
    } else {
      if (estadoFilter && isHistoryStatus(estadoFilter)) setEstadoFilter("");
    }
  }, [showHistory, estadoFilter]);

  const goDetail = (row) => {
    if (row.id) navigate(`/app/logistica/cargas/${row.id}`);
  };

  useEffect(() => {
    if (view !== "table") {
      setToolbarMenu(null);
      setViewMenuOpen(false);
    }
  }, [view]);

  const filterDefs = useMemo(() => {
    const uniq = (getValue) => {
      const set = new Set();
      scopedRows.forEach((r) => {
        const v = String(getValue(r) || "").trim();
        if (v) set.add(v);
      });
      return Array.from(set).sort((a, b) =>
        String(a).localeCompare(String(b), "es", { sensitivity: "base" }),
      );
    };
    return [
      {
        key: "estado_viaje",
        label: "Estado viaje",
        value: estadoFilter,
        setValue: setEstadoFilter,
        options: uniq((r) => r.estado_viaje),
      },
      {
        key: "barco",
        label: "Barco",
        value: barcoFilter,
        setValue: setBarcoFilter,
        options: uniq((r) => r.barco),
      },
      {
        key: "chofer",
        label: "Chofer",
        value: choferFilter,
        setValue: setChoferFilter,
        options: uniq((r) => r.chofer),
      },
      {
        key: "consignatario",
        label: "Consignatario",
        value: consignatarioFilter,
        setValue: setConsignatarioFilter,
        options: uniq((r) => r.consignatario),
      },
      {
        key: "terminal_entrega",
        label: "Terminal entrega",
        value: terminalFilter,
        setValue: setTerminalFilter,
        options: uniq((r) => r.terminal_entrega),
      },
      {
        key: "responsable",
        label: "Responsable",
        value: responsableFilter,
        setValue: setResponsableFilter,
        options: uniq((r) => r.responsable_nombre),
      },
    ];
  }, [
    scopedRows,
    estadoFilter,
    barcoFilter,
    choferFilter,
    consignatarioFilter,
    terminalFilter,
    responsableFilter,
  ]);

  const groupDefs = useMemo(
    () => [
      { key: "none", label: "Sin agrupación" },
      { key: "barco", label: "Barco" },
      { key: "estado_viaje", label: "Estado viaje" },
      { key: "fecha_de_carga_group", label: "Fecha de carga" },
      { key: "fecha_de_descarga_group", label: "Fecha de descarga" },
    ],
    [],
  );

  const sortDefs = useMemo(
    () => [
      { key: "", label: "Sin ordenar" },
      { key: "fecha_de_carga_group", label: "Fecha de carga" },
      { key: "fecha_de_descarga_group", label: "Fecha de descarga" },
      { key: "barco", label: "Barco" },
      { key: "estado_viaje", label: "Estado viaje" },
      { key: "total_palets", label: "Palets" },
      { key: "nombre", label: "Nombre" },
    ],
    [],
  );

  const columnsInUse = useMemo(() => {
    if (visibleColumnKeys.length !== allColumnKeys.length) return true;
    const set = new Set(visibleColumnKeys);
    return allColumnKeys.some((k) => !set.has(k));
  }, [visibleColumnKeys, allColumnKeys]);
  const filtersInUse =
    !!estadoFilter ||
    !!barcoFilter ||
    !!choferFilter ||
    !!consignatarioFilter ||
    !!terminalFilter ||
    !!responsableFilter;
  const groupInUse = groupBy !== "none";
  const sortInUse = !!sortBy;
  const searchInUse = !!String(query || "").trim();
  const historyInUse = !!showHistory;

  return (
    <>
      <div
        ref={toolbarMenuRef}
        style={{
          position: "relative",
          marginBottom: 10,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            {[
              { key: "search", label: "", icon: "search", iconOnly: true },
              {
                key: "columns",
                label: "Ocultar campos",
                icon: "visibility_off",
              },
              { key: "filters", label: "Filtro", icon: "filter_list" },
              { key: "group", label: "Grupo", icon: "view_list" },
              { key: "sort", label: "Clasificar", icon: "sort" },
            ].map((b) => {
              const disabled = view !== "table";
              const active = toolbarMenu === b.key;
              const inUse =
                b.key === "columns"
                  ? columnsInUse
                  : b.key === "filters"
                    ? filtersInUse
                    : b.key === "group"
                      ? groupInUse
                      : b.key === "sort"
                        ? sortInUse
                        : b.key === "search"
                          ? searchInUse
                          : false;
              const background = active
                ? "#e0e7ff"
                : inUse
                  ? "#eef2ff"
                  : "#fff";
              const borderColor = active || inUse ? "#c7d2fe" : "#e5e7eb";
              return (
                <button
                  key={b.key}
                  type="button"
                  onClick={() => {
                    if (disabled) return;
                    setToolbarSearch("");
                    setToolbarMenu((cur) => (cur === b.key ? null : b.key));
                  }}
                  disabled={disabled}
                  style={{
                    height: 40,
                    padding: b.iconOnly ? "0 10px" : "0 12px",
                    border: `1px solid ${borderColor}`,
                    borderRadius: 8,
                    background,
                    cursor: disabled ? "not-allowed" : "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    fontWeight: 600,
                    color: "#374151",
                    opacity: disabled ? 0.6 : 1,
                  }}
                  aria-label={b.iconOnly ? "Buscar" : undefined}
                  title={b.iconOnly ? "Buscar" : undefined}
                >
                  <span className="material-symbols-outlined">{b.icon}</span>
                  {!b.iconOnly && b.label}
                </button>
              );
            })}
          </div>

          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              alignItems: "center",
              marginLeft: "auto",
            }}
          >
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div style={{ position: "relative" }}>
                <button
                  type="button"
                  onClick={() => {
                    setToolbarMenu(null);
                    setToolbarSearch("");
                    setViewMenuSearch("");
                    setViewMenuOpen((v) => !v);
                  }}
                  style={{
                    height: 40,
                    padding: "0 12px",
                    border: "1px solid #e5e7eb",
                    borderRadius: 8,
                    background: "#fff",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    fontWeight: 600,
                    color: "#374151",
                  }}
                  title="Cambiar vista"
                >
                  <span className="material-symbols-outlined">view_cozy</span>
                  Vista
                  <span className="material-symbols-outlined">
                    {viewMenuOpen ? "expand_less" : "expand_more"}
                  </span>
                </button>
                {viewMenuOpen && (
                  <div
                    style={{
                      position: "absolute",
                      right: 0,
                      top: 46,
                      width: 260,
                      maxWidth: "min(92vw, 260px)",
                      background: "#fff",
                      border: "1px solid #e5e7eb",
                      borderRadius: 10,
                      boxShadow: "0 10px 30px rgba(0,0,0,0.10)",
                      padding: 10,
                      zIndex: 70,
                    }}
                  >
                    <input
                      className="input"
                      style={{ width: "100%", height: 36, marginBottom: 8 }}
                      placeholder="Buscar..."
                      value={viewMenuSearch}
                      onChange={(e) => setViewMenuSearch(e.target.value)}
                    />
                    {[
                      { key: "table", label: "Tabla", icon: "table" },
                      { key: "cards", label: "Tarjetas", icon: "view_agenda" },
                      {
                        key: "calendar",
                        label: "Calendario",
                        icon: "calendar_month",
                      },
                      {
                        key: "day_list",
                        label: "Por días",
                        icon: "event_note",
                      },
                    ]
                      .filter((opt) => {
                        const q = String(viewMenuSearch || "")
                          .trim()
                          .toLowerCase();
                        if (!q) return true;
                        return String(opt.label || "")
                          .toLowerCase()
                          .includes(q);
                      })
                      .map((opt) => (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => {
                            setView(opt.key);
                            setViewMenuOpen(false);
                          }}
                          style={{
                            width: "100%",
                            textAlign: "left",
                            border: "none",
                            background:
                              view === opt.key ? "var(--hover)" : "transparent",
                            cursor: "pointer",
                            padding: "8px 10px",
                            borderRadius: 8,
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            fontWeight: 700,
                            color: "#111827",
                          }}
                        >
                          <span className="material-symbols-outlined">
                            {opt.icon}
                          </span>
                          <span style={{ flex: 1 }}>{opt.label}</span>
                          {view === opt.key && (
                            <span className="material-symbols-outlined">
                              check
                            </span>
                          )}
                        </button>
                      ))}
                  </div>
                )}
              </div>
              {view === "calendar" && (
                <>
                  <select
                    className="input"
                    value={calendarDateMode}
                    onChange={(e) => setCalendarDateMode(e.target.value)}
                    style={{ height: 40, width: 170 }}
                    title="Qué fechas mostrar"
                    aria-label="Qué fechas mostrar"
                  >
                    <option value="carga">Cargas</option>
                    <option value="descarga">Descargas</option>
                    <option value="ambos">Ambos</option>
                  </select>
                  <select
                    className="input"
                    value={calMode}
                    onChange={(e) => setCalMode(e.target.value)}
                    style={{ height: 40, width: 140 }}
                    title="Modo de vista"
                    aria-label="Modo de vista"
                  >
                    <option value="week">Semanal</option>
                    <option value="fortnight">Quincenal</option>
                    <option value="month">Mensual</option>
                  </select>
                </>
              )}
              {debugEnabled && (
                <button
                  type="button"
                  className="icon-button"
                  title="Debug permisos"
                  onClick={() => setOpenDebug(true)}
                >
                  <span className="material-symbols-outlined">bug_report</span>
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowHistory((v) => !v)}
              style={{
                marginLeft: "auto",
                height: 40,
                padding: "0 12px",
                border: `1px solid ${historyInUse ? "#c7d2fe" : "#e5e7eb"}`,
                borderRadius: 8,
                background: historyInUse ? "#eef2ff" : "#fff",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                fontWeight: 600,
                color: "#374151",
              }}
              title={showHistory ? "Ver cargas activas" : "Ver historial"}
              aria-label={showHistory ? "Ver cargas activas" : "Ver historial"}
            >
              <span className="material-symbols-outlined">history</span>
              {showHistory ? "Ver activas" : "Ver historial"}
            </button>

            {canExportAgenda && (
              <button
                type="button"
                onClick={openExportAgendaModal}
                style={{
                  height: 40,
                  padding: "0 12px",
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  background: "#fff",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  fontWeight: 600,
                  color: "#374151",
                }}
                title="Exportar agenda (PDF)"
              >
                <span className="material-symbols-outlined">
                  picture_as_pdf
                </span>
                Exportar agenda
              </button>
            )}
          </div>
        </div>

        {toolbarMenu && (
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 46,
              width: 520,
              maxWidth: "min(92vw, 520px)",
              background: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: 10,
              boxShadow: "0 10px 30px rgba(0,0,0,0.10)",
              padding: 10,
              zIndex: 60,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 8,
                marginBottom: 8,
              }}
            >
              <div style={{ fontWeight: 700 }}>
                {toolbarMenu === "search"
                  ? "Buscar"
                  : toolbarMenu === "columns"
                    ? "Ocultar campos"
                    : toolbarMenu === "filters"
                      ? "Filtro"
                      : toolbarMenu === "group"
                        ? "Grupo"
                        : "Clasificar"}
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => setToolbarMenu(null)}
                title="Cerrar"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {toolbarMenu !== "search" && (
              <input
                className="input"
                style={{ width: "100%", height: 36, marginBottom: 10 }}
                placeholder="Buscar..."
                value={toolbarSearch}
                onChange={(e) => setToolbarSearch(e.target.value)}
              />
            )}

            {toolbarMenu === "search" && (
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  ref={searchInputRef}
                  className="input"
                  style={{ width: "100%", height: 36 }}
                  placeholder="Buscar por barco, terminal o estado"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => setQuery("")}
                  title="Limpiar"
                  aria-label="Limpiar"
                  disabled={!String(query || "").trim()}
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
            )}

            {toolbarMenu === "columns" && (
              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => setVisibleColumnKeys(allColumnKeys)}
                    style={{
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                      color: "#2563eb",
                      fontWeight: 700,
                      padding: 0,
                    }}
                  >
                    Todas
                  </button>
                  <button
                    type="button"
                    onClick={() => setVisibleColumnKeys([allColumnKeys[0]])}
                    style={{
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                      color: "#2563eb",
                      fontWeight: 700,
                      padding: 0,
                    }}
                  >
                    Mínimo
                  </button>
                </div>
                <div
                  style={{
                    display: "grid",
                    gap: 6,
                    maxHeight: 360,
                    overflowY: "auto",
                    paddingRight: 4,
                  }}
                >
                  {allColumns
                    .filter((c) => {
                      const q = String(toolbarSearch || "")
                        .trim()
                        .toLowerCase();
                      if (!q) return true;
                      return String(c.header || "")
                        .toLowerCase()
                        .includes(q);
                    })
                    .map((c) => {
                      const checked = visibleColumnKeys.includes(c.key);
                      const disabled =
                        checked && visibleColumnKeys.length === 1;
                      return (
                        <label
                          key={c.key}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            padding: "6px 8px",
                            borderRadius: 8,
                            cursor: disabled ? "not-allowed" : "pointer",
                            opacity: disabled ? 0.6 : 1,
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={disabled}
                            onChange={() => toggleColumnKey(c.key)}
                          />
                          <span>{c.header}</span>
                        </label>
                      );
                    })}
                </div>
              </div>
            )}

            {toolbarMenu === "filters" &&
              (() => {
                const selected =
                  filterDefs.find((f) => f.key === filterMenuField) ||
                  filterDefs[0];
                const options = (selected?.options || []).filter((opt) => {
                  const q = String(toolbarSearch || "")
                    .trim()
                    .toLowerCase();
                  if (!q) return true;
                  return String(opt || "")
                    .toLowerCase()
                    .includes(q);
                });
                return (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "200px 1fr",
                      gap: 12,
                      alignItems: "start",
                    }}
                  >
                    <div
                      style={{
                        border: "1px solid #e5e7eb",
                        borderRadius: 10,
                        padding: 6,
                        maxHeight: 360,
                        overflowY: "auto",
                      }}
                    >
                      {filterDefs.map((f) => {
                        const active = f.key === selected.key;
                        return (
                          <button
                            key={f.key}
                            type="button"
                            onClick={() => {
                              setToolbarSearch("");
                              setFilterMenuField(f.key);
                            }}
                            style={{
                              width: "100%",
                              textAlign: "left",
                              border: "none",
                              background: active
                                ? "var(--hover)"
                                : "transparent",
                              cursor: "pointer",
                              padding: "8px 10px",
                              borderRadius: 8,
                              display: "grid",
                              gap: 2,
                            }}
                          >
                            <div style={{ fontWeight: 700, fontSize: 13 }}>
                              {f.label}
                            </div>
                            <div
                              style={{
                                color: "var(--text-secondary)",
                                fontSize: 12,
                              }}
                            >
                              {f.value ? f.value : "Todos"}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    <div
                      style={{
                        border: "1px solid #e5e7eb",
                        borderRadius: 10,
                        padding: 10,
                        maxHeight: 360,
                        overflowY: "auto",
                      }}
                    >
                      <div style={{ fontWeight: 700, marginBottom: 8 }}>
                        {selected.label}
                      </div>
                      <div style={{ display: "grid", gap: 6 }}>
                        <label
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            padding: "6px 8px",
                            borderRadius: 8,
                            cursor: "pointer",
                          }}
                        >
                          <input
                            type="radio"
                            name="filterValue"
                            checked={!selected.value}
                            onChange={() => selected.setValue("")}
                          />
                          <span>Todos</span>
                        </label>
                        {options.map((opt) => (
                          <label
                            key={opt}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                              padding: "6px 8px",
                              borderRadius: 8,
                              cursor: "pointer",
                            }}
                          >
                            <input
                              type="radio"
                              name="filterValue"
                              checked={selected.value === opt}
                              onChange={() => selected.setValue(opt)}
                            />
                            <span>{opt}</span>
                          </label>
                        ))}
                        {options.length === 0 && (
                          <div
                            style={{
                              color: "var(--text-secondary)",
                              fontSize: 13,
                            }}
                          >
                            Sin opciones
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}

            {toolbarMenu === "group" && (
              <div style={{ display: "grid", gap: 6 }}>
                {groupDefs
                  .filter((g) => {
                    const q = String(toolbarSearch || "")
                      .trim()
                      .toLowerCase();
                    if (!q) return true;
                    return String(g.label || "")
                      .toLowerCase()
                      .includes(q);
                  })
                  .map((g) => (
                    <label
                      key={g.key}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "6px 8px",
                        borderRadius: 8,
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="radio"
                        name="groupBy"
                        checked={groupBy === g.key}
                        onChange={() => setGroupBy(g.key)}
                      />
                      <span>{g.label}</span>
                    </label>
                  ))}
              </div>
            )}

            {toolbarMenu === "sort" && (
              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => setSortDir("asc")}
                    style={{
                      height: 32,
                      padding: "0 10px",
                      border: "1px solid #e5e7eb",
                      borderRadius: 999,
                      background: sortDir === "asc" ? "var(--hover)" : "#fff",
                      cursor: "pointer",
                      fontWeight: 700,
                    }}
                  >
                    Asc
                  </button>
                  <button
                    type="button"
                    onClick={() => setSortDir("desc")}
                    style={{
                      height: 32,
                      padding: "0 10px",
                      border: "1px solid #e5e7eb",
                      borderRadius: 999,
                      background: sortDir === "desc" ? "var(--hover)" : "#fff",
                      cursor: "pointer",
                      fontWeight: 700,
                    }}
                  >
                    Desc
                  </button>
                </div>
                <div style={{ display: "grid", gap: 6 }}>
                  {sortDefs
                    .filter((s) => {
                      const q = String(toolbarSearch || "")
                        .trim()
                        .toLowerCase();
                      if (!q) return true;
                      return String(s.label || "")
                        .toLowerCase()
                        .includes(q);
                    })
                    .map((s) => (
                      <label
                        key={s.key || "(none)"}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "6px 8px",
                          borderRadius: 8,
                          cursor: "pointer",
                        }}
                      >
                        <input
                          type="radio"
                          name="sortBy"
                          checked={sortBy === s.key}
                          onChange={() => setSortBy(s.key)}
                        />
                        <span>{s.label}</span>
                      </label>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {view === "table" ? (
        <DataTable
          title={showHistory ? "Historial" : "Cargas"}
          columns={tableColumns}
          data={paginated}
          loading={loading}
          groupBy={groupBy !== "none" ? groupBy : undefined}
          groupLabel={groupLabel}
          createLabel={canManageLoads ? "Crear carga" : undefined}
          onCreate={canManageLoads ? onCreate : undefined}
          onRowClick={goDetail}
        />
      ) : view === "cards" ? (
        <CardGrid
          title={showHistory ? "Historial" : "Cargas"}
          items={paginated.map((i) => ({
            ...i,
            name: i.nombre || i.entrega,
            subtitle: `${i.barco} · ${i.estado_viaje}`,
          }))}
          loading={loading}
          onCreate={canManageLoads ? onCreate : undefined}
          createLabel={canManageLoads ? "Crear carga" : undefined}
          onCardClick={goDetail}
        />
      ) : view === "day_list" ? (
        <div style={{ display: "grid", gap: 24, paddingBottom: 24 }}>
          {(() => {
            const groups = {};
            filtered.forEach((item) => {
              const d = item.fecha_de_carga_raw
                ? new Date(item.fecha_de_carga_raw)
                : null;
              const key =
                d && !isNaN(d.getTime())
                  ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
                      2,
                      "0",
                    )}-${String(d.getDate()).padStart(2, "0")}`
                  : "Sin fecha";
              if (!groups[key]) groups[key] = [];
              groups[key].push(item);
            });
            const sortedKeys = Object.keys(groups).sort();

            return sortedKeys.map((dateKey) => {
              const dateLabel =
                dateKey === "Sin fecha"
                  ? "Sin fecha"
                  : new Intl.DateTimeFormat("es-ES", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    }).format(new Date(dateKey));
              return (
                <div key={dateKey}>
                  <h3
                    style={{
                      fontSize: "1.1rem",
                      fontWeight: 600,
                      color: "var(--text-primary)",
                      marginBottom: 12,
                      textTransform: "capitalize",
                      borderBottom: "1px solid var(--border)",
                      paddingBottom: 8,
                    }}
                  >
                    {dateLabel}{" "}
                    <span
                      style={{
                        fontSize: "0.9rem",
                        color: "var(--text-secondary)",
                        fontWeight: 400,
                      }}
                    >
                      ({groups[dateKey].length})
                    </span>
                  </h3>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fill, minmax(300px, 1fr))",
                      gap: 16,
                    }}
                  >
                    {groups[dateKey].map((item) => (
                      <div
                        key={item.id}
                        className="card"
                        onClick={() => goDetail(item)}
                        style={{ cursor: "pointer", padding: 16 }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            marginBottom: 8,
                          }}
                        >
                          <span style={{ fontWeight: 600 }}>
                            {item.nombre || item.entrega}
                          </span>
                          <span
                            className={`status-badge status-${String(
                              item.estado_viaje,
                            )
                              .toLowerCase()
                              .replace(" ", "-")}`}
                          >
                            {item.estado_viaje}
                          </span>
                        </div>
                        <div
                          style={{
                            fontSize: "0.9rem",
                            color: "var(--text-secondary)",
                            display: "grid",
                            gap: 4,
                          }}
                        >
                          <div>🚢 {item.barco}</div>
                          {item.hora_de_carga && (
                            <div>🕒 {item.hora_de_carga}</div>
                          )}
                          <div>
                            📦 {item.carga}{" "}
                            {item.total_palets > 0 &&
                              `(${item.total_palets} palets)`}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            });
          })()}
        </div>
      ) : (
        <Calendar
          title={showHistory ? "Historial" : "Cargas"}
          items={filtered}
          loading={loading}
          month={calMonth}
          mode={calMode}
          onPrevMonth={prevPeriod}
          onNextMonth={nextPeriod}
          onItemClick={goDetail}
          dateKey={
            calendarDateMode === "descarga"
              ? "fecha_de_descarga_raw"
              : "fecha_de_carga_raw"
          }
          secondaryDateKey={
            calendarDateMode === "ambos" ? "fecha_de_descarga_raw" : undefined
          }
          statusKey="estado_viaje"
        />
      )}

      <Pagination
        page={page}
        pageSize={pageSize}
        total={filtered.length}
        onPageChange={(p) => setPage(Math.max(1, p))}
        onPageSizeChange={(s) => {
          setPageSize(s);
          setPage(1);
        }}
      />

      <Modal
        open={openExportAgenda}
        title={
          exportStep === "preview"
            ? "Vista previa · Exportar agenda"
            : "Exportar agenda"
        }
        onClose={closeExportAgendaModal}
        onSubmit={submitExportAgendaModal}
        submitLabel={exportStep === "preview" ? "Exportar PDF" : "Vista previa"}
        width={920}
        bodyStyle={{ gridTemplateColumns: "1fr" }}
      >
        {exportStep === "config" ? (
          <div style={{ display: "grid", gap: 12 }}>
            <FormField label="Rango de fechas (fecha de carga)">
              <div className="form-row">
                <FormField label="Desde">
                  <input
                    type="date"
                    className="input"
                    value={exportStart}
                    onChange={(e) => setExportStart(e.target.value)}
                  />
                </FormField>
                <FormField label="Hasta">
                  <input
                    type="date"
                    className="input"
                    value={exportEnd}
                    onChange={(e) => setExportEnd(e.target.value)}
                  />
                </FormField>
              </div>
            </FormField>

            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={exportUseCurrentFilters}
                onChange={(e) => setExportUseCurrentFilters(e.target.checked)}
              />
              Usar filtros actuales de la pantalla
            </label>

            <div
              style={{
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: 10,
                background: "var(--bg)",
              }}
            >
              <FormField label="Filtros" style={{ gap: 6 }}>
                <div style={{ fontSize: 13 }}>
                  {exportUseCurrentFilters ? (
                    <>
                      Estado: {estadoFilter || "Todos"} · Barco:{" "}
                      {barcoFilter || "Todos"} · Búsqueda:{" "}
                      {query ? `"${query}"` : "—"}
                    </>
                  ) : (
                    <>Sin filtros</>
                  )}
                </div>
              </FormField>
            </div>

            <FormField label="Qué cargas incluir" style={{ gap: 6 }}>
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                <label className="checkbox-row">
                  <input
                    type="radio"
                    name="exportMode"
                    checked={exportMode === "all"}
                    onChange={() => setExportMode("all")}
                  />
                  Todas las cargas del rango
                </label>
                <label className="checkbox-row">
                  <input
                    type="radio"
                    name="exportMode"
                    checked={exportMode === "select"}
                    onChange={() => setExportMode("select")}
                  />
                  Elegir cargas
                </label>
              </div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                Candidatas en rango: {exportCandidates.length}
              </div>
            </FormField>

            {exportMode === "select" && (
              <div style={{ display: "grid", gap: 8 }}>
                <label
                  style={{ display: "flex", alignItems: "center", gap: 8 }}
                >
                  <input
                    type="checkbox"
                    checked={
                      exportCandidates.length > 0 &&
                      exportSelectedIds.length === exportCandidates.length
                    }
                    onChange={(e) => {
                      if (e.target.checked) {
                        setExportSelectedIds(
                          exportCandidates.map((r) => String(r.id)),
                        );
                      } else {
                        setExportSelectedIds([]);
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
                    maxHeight: "45vh",
                    overflowY: "auto",
                    scrollbarGutter: "stable",
                    overscrollBehavior: "contain",
                    WebkitOverflowScrolling: "touch",
                    touchAction: "pan-y",
                  }}
                >
                  {exportCandidates.length === 0 ? (
                    <div style={{ color: "var(--text-secondary)" }}>
                      No hay cargas en el rango seleccionado.
                    </div>
                  ) : (
                    exportCandidates
                      .slice()
                      .sort((a, b) => {
                        const d = String(
                          a.fecha_de_carga_group || "",
                        ).localeCompare(
                          String(b.fecha_de_carga_group || ""),
                          "es",
                        );
                        if (d !== 0) return d;
                        const t = String(a.hora_de_carga || "").localeCompare(
                          String(b.hora_de_carga || ""),
                          "es",
                        );
                        if (t !== 0) return t;
                        return String(a.barco || "").localeCompare(
                          String(b.barco || ""),
                          "es",
                        );
                      })
                      .map((r) => {
                        const id = String(r.id);
                        const checked = exportSelectedIds.some(
                          (v) => String(v) === id,
                        );
                        return (
                          <label
                            key={id}
                            style={{
                              display: "flex",
                              alignItems: "flex-start",
                              justifyContent: "space-between",
                              gap: 10,
                              padding: "8px 0",
                              borderBottom: "1px solid #f1f3f4",
                              cursor: "pointer",
                            }}
                          >
                            <div style={{ display: "flex", gap: 10 }}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => {
                                  setExportSelectedIds((prev) => {
                                    const set = new Set(
                                      prev.map((x) => String(x)),
                                    );
                                    if (set.has(id)) set.delete(id);
                                    else set.add(id);
                                    return Array.from(set);
                                  });
                                }}
                              />
                              <div style={{ display: "grid", gap: 2 }}>
                                <div style={{ fontWeight: 700, fontSize: 13 }}>
                                  {r.barco || "—"} · {r.fecha_de_carga || "—"}{" "}
                                  {r.hora_de_carga || ""}
                                </div>
                                <div style={{ fontSize: 13 }}>
                                  Entrega: {r.entrega || "—"} · Palets:{" "}
                                  {Number(r.total_palets) || 0} · Estado:{" "}
                                  {r.estado_viaje || "—"}
                                </div>
                              </div>
                            </div>
                          </label>
                        );
                      })
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <button
                className="secondary-button"
                type="button"
                onClick={() => setExportStep("config")}
              >
                Volver
              </button>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <span className="chip">
                  Cargas: {exportSummary.totalCargas}
                </span>
                <span className="chip">
                  Palets: {exportSummary.totalPalets}
                </span>
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {Object.entries(exportSummary.porEstado || {})
                .sort((a, b) => String(a[0]).localeCompare(String(b[0]), "es"))
                .map(([k, v]) => (
                  <span key={k} className="chip">
                    {k}: {v}
                  </span>
                ))}
            </div>

            <div
              style={{
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: 10,
                maxHeight: "45vh",
                overflowY: "auto",
                scrollbarGutter: "stable",
              }}
            >
              {exportPreviewRows.length === 0 ? (
                <div style={{ color: "var(--text-secondary)" }}>
                  No hay cargas para exportar.
                </div>
              ) : (
                exportPreviewRows.map((r) => (
                  <div
                    key={String(r.id)}
                    style={{
                      display: "grid",
                      gap: 4,
                      padding: "10px 0",
                      borderBottom: "1px solid #f1f3f4",
                    }}
                  >
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <span className="chip">{r.estado_viaje || "—"}</span>
                      <span className="chip">
                        {r.fecha_de_carga || "—"} {r.hora_de_carga || ""}
                      </span>
                      <span className="chip">{r.barco || "—"}</span>
                    </div>
                    <div style={{ fontSize: 13 }}>
                      Entrega: {r.entrega || "—"} · Consignatario:{" "}
                      {r.consignatario || "—"} · Terminal:{" "}
                      {r.terminal_entrega || "—"}
                    </div>
                    <div style={{ fontSize: 13 }}>
                      Tipo: {r.carga || "—"} · Palets:{" "}
                      {Number(r.total_palets) || 0} · Descarga:{" "}
                      {r.fecha_de_descarga || ""} {r.hora_de_descarga || ""}
                    </div>
                    <div style={{ fontSize: 13 }}>
                      Responsable: {r.responsable_nombre || "—"}
                      {r.responsable_telefono
                        ? ` (${r.responsable_telefono})`
                        : ""}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
              Al exportar se abrirá el diálogo de impresión del navegador para
              guardar como PDF.
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={openDebug}
        title="Debug permisos"
        onClose={() => setOpenDebug(false)}
        onSubmit={() => setOpenDebug(false)}
        submitLabel="Cerrar"
        width={760}
        bodyStyle={{ gridTemplateColumns: "1fr" }}
      >
        <div style={{ display: "grid", gap: 12 }}>
          <FormField label="Env" style={{ gap: 6 }}>
            <pre
              style={{
                margin: 0,
                padding: 12,
                border: "1px solid var(--border)",
                borderRadius: 8,
                background: "#0b1020",
                color: "#e5e7eb",
                overflowX: "auto",
              }}
            >
              {JSON.stringify(debugInfo?.env || {}, null, 2)}
            </pre>
          </FormField>

          <FormField label="Auth (raw)" style={{ gap: 6 }}>
            <pre
              style={{
                margin: 0,
                padding: 12,
                border: "1px solid var(--border)",
                borderRadius: 8,
                background: "#0b1020",
                color: "#e5e7eb",
                overflowX: "auto",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {debugInfo?.authRaw || ""}
            </pre>
          </FormField>

          <FormField label="Auth (parsed)" style={{ gap: 6 }}>
            <pre
              style={{
                margin: 0,
                padding: 12,
                border: "1px solid var(--border)",
                borderRadius: 8,
                background: "#0b1020",
                color: "#e5e7eb",
                overflowX: "auto",
              }}
            >
              {JSON.stringify(debugInfo?.authParsed || {}, null, 2)}
            </pre>
          </FormField>

          <FormField label="Usuario" style={{ gap: 6 }}>
            <pre
              style={{
                margin: 0,
                padding: 12,
                border: "1px solid var(--border)",
                borderRadius: 8,
                background: "#0b1020",
                color: "#e5e7eb",
                overflowX: "auto",
              }}
            >
              {JSON.stringify(
                {
                  id: debugInfo?.user?.id || debugInfo?.user?._id || null,
                  name: debugInfo?.user?.name || "",
                  email: debugInfo?.user?.email || "",
                  roleRaw: debugInfo?.roleRaw,
                  roleResolved: debugInfo?.roleResolved,
                  canManageLoads: !!debugInfo?.canManageLoads,
                },
                null,
                2,
              )}
            </pre>
          </FormField>

          <FormField label="Permisos" style={{ gap: 6 }}>
            <pre
              style={{
                margin: 0,
                padding: 12,
                border: "1px solid var(--border)",
                borderRadius: 8,
                background: "#0b1020",
                color: "#e5e7eb",
                overflowX: "auto",
              }}
            >
              {JSON.stringify(debugInfo?.permissions || {}, null, 2)}
            </pre>
          </FormField>
        </div>
      </Modal>

      <Modal
        open={open}
        title="Crear carga"
        onClose={() => setOpen(false)}
        onSubmit={submit}
        submitLabel="Crear"
        width={640}
        bodyStyle={{ gridTemplateColumns: "1fr" }}
      >
        <div style={{ display: "grid", gap: 12 }}>
          {/* Datos básicos */}
          <FormField label="Barco">
            <SearchableSelect
              value={form.barco}
              onChange={(val) => setForm({ ...form, barco: val })}
              placeholder="Selecciona barco"
              searchPlaceholder="Buscar barco..."
              maxHeight={420}
              options={[
                { value: "", label: "Selecciona barco" },
                ...ships
                  .slice()
                  .sort((a, b) =>
                    String(a?.nombre_del_barco || "").localeCompare(
                      String(b?.nombre_del_barco || ""),
                      "es",
                    ),
                  )
                  .map((s) => ({
                    value: String(s?._id || s?.id || ""),
                    label: String(s?.nombre_del_barco || "").trim() || "-",
                  })),
              ]}
            />
          </FormField>

          <FormField label="Fecha y hora de carga">
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
          </FormField>

          <FormField label="Fecha y hora de descarga">
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
          </FormField>

          {/* Entrega */}
          <FormField label="Entrega">
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
          </FormField>

          {/* Personas */}
          <FormField label="Responsable" style={{ gap: 6 }}>
            <SearchableSelect
              value={form.responsable}
              onChange={(val) => setForm({ ...form, responsable: val })}
              placeholder="Sin responsable"
              searchPlaceholder="Buscar responsable..."
              options={[
                { value: "", label: "Sin responsable" },
                ...responsables
                  .slice()
                  .sort((a, b) =>
                    String(a?.nombre || "").localeCompare(
                      String(b?.nombre || ""),
                      "es",
                    ),
                  )
                  .map((r) => ({
                    value: String(r?._id || r?.id || ""),
                    label: `${String(r?.nombre || "").trim() || "-"}${
                      r?.email ? ` (${r.email})` : ""
                    }`,
                  })),
              ]}
            />
          </FormField>
          <FormField label="Chofer">
            <SearchableSelect
              value={form.chofer}
              onChange={(val) => setForm({ ...form, chofer: val })}
              placeholder="Sin chofer"
              searchPlaceholder="Buscar chofer..."
              options={[
                { value: "", label: "Sin chofer" },
                ...users
                  .filter((u) => u.role === "driver")
                  .slice()
                  .sort((a, b) =>
                    String(a?.name || "").localeCompare(
                      String(b?.name || ""),
                      "es",
                    ),
                  )
                  .map((u) => ({
                    value: String(u?._id || u?.id || ""),
                    label: `${String(u?.name || "").trim() || "-"}${
                      u?.email ? ` (${u.email})` : ""
                    }`,
                  })),
              ]}
            />
          </FormField>
          <FormField label="Consignatario">
            <SearchableSelect
              value={form.consignatario}
              onChange={(val) => setForm({ ...form, consignatario: val })}
              placeholder="Sin consignatario"
              searchPlaceholder="Buscar consignatario..."
              options={[
                { value: "", label: "Sin consignatario" },
                ...consignees
                  .slice()
                  .sort((a, b) =>
                    String(a?.nombre || "").localeCompare(
                      String(b?.nombre || ""),
                      "es",
                    ),
                  )
                  .map((c) => ({
                    value: String(c?._id || c?.id || ""),
                    label: `${String(c?.nombre || "").trim() || "-"}${
                      c?.email ? ` (${c.email})` : ""
                    }`,
                  })),
              ]}
            />
          </FormField>
          <FormField label="Terminal de entrega">
            <SearchableSelect
              value={form.terminal_entrega}
              onChange={(val) => setForm({ ...form, terminal_entrega: val })}
              placeholder="Sin terminal"
              searchPlaceholder="Buscar terminal..."
              options={[
                { value: "", label: "Sin terminal" },
                ...locations
                  .slice()
                  .sort((a, b) => {
                    const ap = String(a?.puerto || "").localeCompare(
                      String(b?.puerto || ""),
                      "es",
                    );
                    if (ap !== 0) return ap;
                    return String(a?.nombre || "").localeCompare(
                      String(b?.nombre || ""),
                      "es",
                    );
                  })
                  .map((l) => {
                    const puerto = String(l?.puerto || "").trim();
                    const nombre = String(l?.nombre || "").trim();
                    const ciudad = String(l?.ciudad || "").trim();
                    const label = `${puerto ? `${puerto} · ` : ""}${
                      nombre || "-"
                    }${ciudad ? ` (${ciudad})` : ""}`;
                    return {
                      value: String(l?._id || l?.id || ""),
                      label,
                    };
                  }),
              ]}
            />
          </FormField>

          {/* Opciones */}
          <FormField label="Opciones">
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
          </FormField>

          {/* Estado de carga */}
          <FormField label="Estado de Carga">
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
          </FormField>
        </div>
      </Modal>

      {/* Modal crear barco */}
      <Modal
        open={openCreateShip}
        title="Crear barco"
        onClose={() => setOpenCreateShip(false)}
        onSubmit={createShip}
        submitLabel="Crear"
      >
        <FormField label="Nombre del barco">
          <input
            className="input"
            value={shipForm.nombre_del_barco}
            onChange={(e) =>
              setShipForm({ ...shipForm, nombre_del_barco: e.target.value })
            }
            placeholder="Nombre del barco"
          />
        </FormField>
        <FormField label="Empresa (opcional)">
          <select
            className="input"
            value={shipForm.empresa}
            onChange={(e) =>
              setShipForm({ ...shipForm, empresa: e.target.value })
            }
          >
            <option value="">Sin empresa</option>
            {companies
              .slice()
              .sort((a, b) => esCompare(a?.nombre, b?.nombre))
              .map((c) => (
                <option key={c._id || c.id} value={c._id || c.id}>
                  {c.nombre}
                </option>
              ))}
          </select>
        </FormField>
        <FormField label="Enlace (opcional)">
          <input
            className="input"
            value={shipForm.enlace}
            onChange={(e) =>
              setShipForm({ ...shipForm, enlace: e.target.value })
            }
            placeholder="https://..."
          />
        </FormField>
      </Modal>

      {/* Modal crear usuario (consignatario sin contraseña) */}
      <Modal
        open={openCreateUser}
        title="Crear usuario"
        onClose={() => setOpenCreateUser(false)}
        onSubmit={createUser}
        submitLabel="Crear"
      >
        <FormField label="Nombre">
          <input
            className="input"
            value={userForm.name}
            onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
            placeholder="Nombre"
          />
        </FormField>
        <FormField label="Email">
          <input
            className="input"
            value={userForm.email}
            onChange={(e) =>
              setUserForm({ ...userForm, email: e.target.value })
            }
            placeholder="email@dominio.com"
          />
        </FormField>
        <FormField label="Rol">
          <select
            className="input"
            value={userForm.role}
            onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
          >
            <option value="driver">Chofer</option>
            <option value="mozo">Mozo</option>
            <option value="consignee">Consignatario</option>
            <option value="dispatcher">Dispatcher</option>
            <option value="manager">Manager</option>
          </select>
        </FormField>
        {userForm.role !== "consignee" && (
          <FormField label="Contraseña">
            <input
              className="input"
              type="password"
              value={userForm.password}
              onChange={(e) =>
                setUserForm({ ...userForm, password: e.target.value })
              }
              placeholder="Contraseña"
            />
          </FormField>
        )}
      </Modal>

      {/* Modal crear palet */}
      <Modal
        open={openCreatePallet}
        title="Crear palet"
        onClose={() => setOpenCreatePallet(false)}
        onSubmit={createPallet}
        submitLabel="Crear"
      >
        <FormField label="Número de palet">
          <input
            className="input"
            value={palletForm.numero_palet}
            onChange={(e) =>
              setPalletForm({ ...palletForm, numero_palet: e.target.value })
            }
            placeholder="Nº de palet"
          />
        </FormField>
        <FormField label="Tipo">
          <select
            className="select"
            value={palletForm.tipo}
            onChange={(e) =>
              setPalletForm({ ...palletForm, tipo: e.target.value })
            }
          >
            {CARGA_OPTIONS.slice()
              .sort(esCompare)
              .map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
          </select>
        </FormField>
        <FormField label="Base">
          <select
            className="select"
            value={palletForm.base || "Europeo"}
            onChange={(e) =>
              setPalletForm({ ...palletForm, base: e.target.value })
            }
          >
            <option value="Americano">Americano</option>
            <option value="Europeo">Europeo</option>
          </select>
        </FormField>
      </Modal>

      <Snackbar
        open={snack.open}
        message={snack.message}
        type={snack.type}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
      />
    </>
  );
}
