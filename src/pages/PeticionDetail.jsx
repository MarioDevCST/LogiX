import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Modal from "../components/Modal.jsx";
import Snackbar from "../components/Snackbar.jsx";
import {
  createLoad,
  createShip as createShipFirebase,
  fetchAllConsignees,
  fetchAllLocations,
  fetchAllResponsables,
  fetchAllShips,
  fetchAllUsers,
  fetchFeatureOptions,
  fetchPeticionById,
  fetchShipById,
  updatePeticionById,
} from "../firebase/auth.js";
import { getCurrentUser } from "../utils/roles.js";
import { getCurrentRole, ROLES } from "../utils/roles.js";

const ENTREGA_OPTIONS = ["Provisión", "Repuesto", "Técnico"];

function formatDate(value) {
  if (!value) return "";
  const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return String(value);
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(d.getTime())) return String(value);
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

export default function PeticionDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const role = getCurrentRole();
  const canView =
    role === ROLES.LOGISTICA || role === ROLES.ADMIN || role === ROLES.OFICINA;
  const canModify = role === ROLES.LOGISTICA || role === ROLES.ADMIN;
  const [peticionesDisabled, setPeticionesDisabled] = useState(false);
  const [featureLoaded, setFeatureLoaded] = useState(false);

  const [loading, setLoading] = useState(true);
  const [peticion, setPeticion] = useState(null);
  const [ship, setShip] = useState(null);
  const [openCreateLoad, setOpenCreateLoad] = useState(false);
  const [openCreateShip, setOpenCreateShip] = useState(false);
  const [returnToCreateLoadAfterShip, setReturnToCreateLoadAfterShip] =
    useState(false);
  const [ships, setShips] = useState([]);
  const [users, setUsers] = useState([]);
  const [responsables, setResponsables] = useState([]);
  const [consignees, setConsignees] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loadForm, setLoadForm] = useState({
    barco: "",
    barco_manual_nombre: "",
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
  const [shipForm, setShipForm] = useState({
    nombre_del_barco: "",
    empresa: "",
    enlace: "",
  });
  const [snack, setSnack] = useState({
    open: false,
    message: "",
    type: "success",
  });

  useEffect(() => {
    if (!canView) return;
    let mounted = true;
    fetchFeatureOptions()
      .then((opts) => {
        if (!mounted) return;
        setPeticionesDisabled(!!opts?.disable_peticiones);
        setFeatureLoaded(true);
      })
      .catch(() => {
        if (!mounted) return;
        setPeticionesDisabled(false);
        setFeatureLoaded(true);
      });
    return () => {
      mounted = false;
    };
  }, [canView]);

  useEffect(() => {
    if (!canView) return;
    if (!featureLoaded) return;
    if (peticionesDisabled && role !== ROLES.ADMIN) {
      setLoading(false);
      setPeticion(null);
      setShip(null);
      return;
    }
    let mounted = true;
    const run = async () => {
      try {
        setLoading(true);
        const pid = String(id || "").trim();
        if (!pid) {
          setPeticion(null);
          return;
        }
        const p = await fetchPeticionById(pid);
        if (!mounted) return;
        setPeticion(p);
        const barcoId = String(p?.barco || "").trim();
        if (barcoId) {
          fetchShipById(barcoId)
            .then((s) => {
              if (!mounted) return;
              setShip(s);
            })
            .catch(() => {
              if (!mounted) return;
              setShip(null);
            });
        } else {
          setShip(null);
        }
      } catch (e) {
        if (!mounted) return;
        setPeticion(null);
        setShip(null);
        setSnack({
          open: true,
          message: String(e?.message || "No se pudo cargar la petición"),
          type: "error",
        });
      } finally {
        if (mounted) setLoading(false);
      }
    };
    run();
    return () => {
      mounted = false;
    };
  }, [id, canView, featureLoaded, peticionesDisabled, role]);

  const barcoLabel = useMemo(() => {
    if (!peticion) return "";
    return (
      String(peticion?.barco_nombre || "").trim() ||
      String(ship?.nombre_del_barco || "").trim() ||
      String(peticion?.barco || "").trim()
    );
  }, [peticion, ship]);

  const petitionResolved = useMemo(() => {
    const estado = String(peticion?.estado || "")
      .trim()
      .toLowerCase();
    return estado === "realizado" || estado === "convertida";
  }, [peticion?.estado]);

  useEffect(() => {
    if (!openCreateLoad) return;
    let mounted = true;
    Promise.all([
      fetchAllShips(),
      fetchAllUsers(),
      fetchAllResponsables(),
      fetchAllConsignees(),
      fetchAllLocations(),
    ])
      .then(
        ([shipList, usersList, responsablesList, consigneesList, locList]) => {
          if (!mounted) return;
          const normalize = (x) => ({
            ...x,
            _id: x?._id || x?.id,
            id: x?.id || x?._id,
          });
          setShips((Array.isArray(shipList) ? shipList : []).map(normalize));
          setUsers((Array.isArray(usersList) ? usersList : []).map(normalize));
          setResponsables(
            (Array.isArray(responsablesList) ? responsablesList : []).map(
              normalize,
            ),
          );
          setConsignees(
            (Array.isArray(consigneesList) ? consigneesList : []).map(
              normalize,
            ),
          );
          setLocations((Array.isArray(locList) ? locList : []).map(normalize));
        },
      )
      .catch((e) => {
        if (!mounted) return;
        setSnack({
          open: true,
          message: String(e?.message || "No se pudieron cargar los catálogos"),
          type: "error",
        });
      });
    return () => {
      mounted = false;
    };
  }, [openCreateLoad]);

  const openCreateLoadModal = () => {
    if (!peticion) return;
    const barcoId = String(peticion?.barco || "").trim();
    const barcoNombre = String(peticion?.barco_nombre || "").trim();
    setLoadForm({
      barco: barcoId || "__manual__",
      barco_manual_nombre: barcoId ? "" : barcoNombre,
      entrega: [],
      chofer: "",
      responsable: "",
      consignatario: "",
      terminal_entrega: "",
      fecha_de_carga: "",
      hora_de_carga: "",
      fecha_de_descarga: String(peticion?.fecha_de_descarga || "").trim(),
      hora_de_descarga: "",
      cash: false,
      lancha: false,
      estado_viaje: "Preparando",
    });
    setOpenCreateLoad(true);
  };

  const submitCreateLoad = async () => {
    try {
      const barcoValue = String(loadForm.barco || "").trim();
      const manualName = String(loadForm.barco_manual_nombre || "").trim();
      let barcoId = barcoValue;
      if (barcoValue === "__manual__") {
        const normalized = manualName.toLowerCase();
        const existing = ships.find(
          (s) =>
            String(s?.nombre_del_barco || "")
              .trim()
              .toLowerCase() === normalized,
        );
        if (existing) {
          barcoId = String(existing?._id || existing?.id || "").trim();
        }
      }
      if (!barcoId || barcoId === "__manual__") {
        setSnack({
          open: true,
          message: "Selecciona o crea un barco para continuar",
          type: "error",
        });
        return;
      }
      if (!String(loadForm.fecha_de_carga || "").trim()) {
        setSnack({
          open: true,
          message: "La fecha de carga es obligatoria",
          type: "error",
        });
        return;
      }
      const created = await createLoad({
        barco: barcoId,
        entrega: Array.isArray(loadForm.entrega) ? loadForm.entrega : [],
        chofer: loadForm.chofer || "",
        responsable: loadForm.responsable || "",
        consignatario: loadForm.consignatario || "",
        terminal_entrega: loadForm.terminal_entrega || "",
        fecha_de_carga: loadForm.fecha_de_carga || "",
        hora_de_carga: loadForm.hora_de_carga || "",
        fecha_de_descarga: loadForm.fecha_de_descarga || "",
        hora_de_descarga: loadForm.hora_de_descarga || "",
        cash: !!loadForm.cash,
        lancha: !!loadForm.lancha,
        estado_viaje: loadForm.estado_viaje || "Preparando",
        creado_por: getCurrentUser()?.name || "Testing",
      });
      const loadId = String(created?.id || created?._id || "").trim();
      const petitionId = String(peticion?._id || peticion?.id || "").trim();
      if (petitionId && loadId) {
        await updatePeticionById(petitionId, {
          estado: "Realizado",
          load_id: loadId,
        });
      }
      setPeticion((prev) =>
        prev
          ? {
              ...prev,
              estado: "Realizado",
              load_id: loadId || prev.load_id || "",
            }
          : prev,
      );
      setOpenCreateLoad(false);
      setSnack({
        open: true,
        message: "Carga creada desde petición",
        type: "success",
      });
    } catch (e) {
      setSnack({
        open: true,
        message: String(e?.message || "No se pudo crear la carga"),
        type: "error",
      });
    }
  };

  const submitCreateShip = async () => {
    try {
      const name = String(shipForm.nombre_del_barco || "").trim();
      if (!name) {
        setSnack({
          open: true,
          message: "El nombre del barco es obligatorio",
          type: "error",
        });
        return;
      }
      const created = await createShipFirebase({
        nombre_del_barco: name,
        empresa: "",
        enlace: "",
        creado_por: getCurrentUser()?.name || "Testing",
      });
      const createdId = String(created?._id || created?.id || "").trim();
      if (!createdId) throw new Error("No se pudo crear el barco");
      setShips((prev) => [
        ...prev,
        {
          ...created,
          _id: created?._id || created?.id,
          id: created?.id || created?._id,
        },
      ]);
      setOpenCreateShip(false);
      setShipForm({ nombre_del_barco: "", empresa: "", enlace: "" });
      if (returnToCreateLoadAfterShip) {
        setOpenCreateLoad(true);
        setReturnToCreateLoadAfterShip(false);
      }
      setLoadForm((prev) => ({
        ...prev,
        barco: createdId,
        barco_manual_nombre: "",
      }));
      setSnack({ open: true, message: "Barco creado", type: "success" });
    } catch (e) {
      setSnack({
        open: true,
        message: String(e?.message || "No se pudo crear el barco"),
        type: "error",
      });
    }
  };

  if (!canView) {
    return (
      <>
        <section className="card">
          <div className="card-header">
            <h2 className="card-title">Petición</h2>
          </div>
          <div style={{ padding: 16, color: "var(--text-secondary)" }}>
            No tienes permisos para ver esta petición.
          </div>
        </section>
        <Snackbar
          open={snack.open}
          message={snack.message}
          type={snack.type}
          onClose={() => setSnack((s) => ({ ...s, open: false }))}
        />
      </>
    );
  }
  if (featureLoaded && peticionesDisabled && role !== ROLES.ADMIN) {
    return (
      <>
        <section className="card">
          <div className="card-header">
            <h2 className="card-title">Petición</h2>
          </div>
          <div style={{ padding: 16, color: "var(--text-secondary)" }}>
            La funcionalidad de Peticiones está deshabilitada.
          </div>
        </section>
        <Snackbar
          open={snack.open}
          message={snack.message}
          type={snack.type}
          onClose={() => setSnack((s) => ({ ...s, open: false }))}
        />
      </>
    );
  }

  return (
    <>
      <section className="card">
        <div
          className="card-header"
          style={{ justifyContent: "space-between" }}
        >
          <h2 className="card-title">Petición</h2>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className="secondary-button"
              onClick={() => navigate("/app/logistica/peticiones")}
            >
              Volver
            </button>
            <button
              type="button"
              className="primary-button"
              disabled={loading || !peticion || petitionResolved || !canModify}
              onClick={openCreateLoadModal}
            >
              Crear carga
            </button>
          </div>
        </div>

        <div style={{ padding: 16, display: "grid", gap: 12 }}>
          {loading ? (
            <div style={{ color: "var(--text-secondary)" }}>Cargando...</div>
          ) : !peticion ? (
            <div style={{ color: "var(--text-secondary)" }}>
              No existe la petición.
            </div>
          ) : (
            <>
              <div style={{ display: "grid", gap: 6 }}>
                <div className="label">Barco</div>
                <div style={{ fontWeight: 700 }}>{barcoLabel || "—"}</div>
              </div>

              <div style={{ display: "grid", gap: 6 }}>
                <div className="label">Fecha de descarga</div>
                <div style={{ fontWeight: 700 }}>
                  {formatDate(peticion?.fecha_de_descarga) || "—"}
                </div>
              </div>

              <div style={{ display: "grid", gap: 6 }}>
                <div className="label">Estado</div>
                <div style={{ fontWeight: 700 }}>
                  {String(peticion?.estado || "Pendiente")}
                </div>
              </div>

              <div style={{ display: "grid", gap: 6 }}>
                <div className="label">Creado por</div>
                <div style={{ fontWeight: 700 }}>
                  {String(peticion?.creado_por_name || "") || "—"}
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      <Modal
        open={openCreateLoad}
        title="Crear carga desde petición"
        onClose={() => setOpenCreateLoad(false)}
        onSubmit={submitCreateLoad}
        submitLabel="Crear carga"
        width={700}
      >
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ display: "grid", gap: 6 }}>
            <div className="label">Barco</div>
            <select
              className="select"
              value={loadForm.barco}
              onChange={(e) =>
                setLoadForm((p) => ({
                  ...p,
                  barco: e.target.value,
                  barco_manual_nombre:
                    e.target.value === "__manual__"
                      ? p.barco_manual_nombre
                      : "",
                }))
              }
            >
              <option value="">Selecciona barco</option>
              <option value="__manual__">Otro (escribir nombre)</option>
              {ships
                .slice()
                .sort((a, b) =>
                  String(a?.nombre_del_barco || "").localeCompare(
                    String(b?.nombre_del_barco || ""),
                    "es",
                  ),
                )
                .map((s) => {
                  const sid = String(s?._id || s?.id || "");
                  return (
                    <option key={sid} value={sid}>
                      {String(s?.nombre_del_barco || sid)}
                    </option>
                  );
                })}
            </select>
          </div>

          {loadForm.barco === "__manual__" && (
            <div style={{ display: "grid", gap: 8 }}>
              <div className="label">Nombre del barco</div>
              <input
                className="input"
                value={loadForm.barco_manual_nombre}
                onChange={(e) =>
                  setLoadForm((p) => ({
                    ...p,
                    barco_manual_nombre: e.target.value,
                  }))
                }
                placeholder="Nombre del barco"
              />
              {(() => {
                const name = String(loadForm.barco_manual_nombre || "").trim();
                if (!name) return null;
                const exists = ships.some(
                  (s) =>
                    String(s?.nombre_del_barco || "")
                      .trim()
                      .toLowerCase() === name.toLowerCase(),
                );
                if (exists) return null;
                return (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                      border: "1px dashed var(--border)",
                      borderRadius: 10,
                      padding: "10px 12px",
                      background: "var(--hover)",
                    }}
                  >
                    <div
                      style={{ fontSize: 13, color: "var(--text-secondary)" }}
                    >
                      El barco no existe en catálogo.
                    </div>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => {
                        setReturnToCreateLoadAfterShip(true);
                        setShipForm({
                          nombre_del_barco: name,
                          empresa: "",
                          enlace: "",
                        });
                        setOpenCreateLoad(false);
                        setOpenCreateShip(true);
                      }}
                    >
                      Crear barco
                    </button>
                  </div>
                );
              })()}
            </div>
          )}

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
                value={loadForm.fecha_de_carga}
                onChange={(e) =>
                  setLoadForm((p) => ({ ...p, fecha_de_carga: e.target.value }))
                }
              />
              <input
                type="time"
                className="input"
                value={loadForm.hora_de_carga}
                onChange={(e) =>
                  setLoadForm((p) => ({ ...p, hora_de_carga: e.target.value }))
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
                value={loadForm.fecha_de_descarga}
                onChange={(e) =>
                  setLoadForm((p) => ({
                    ...p,
                    fecha_de_descarga: e.target.value,
                  }))
                }
              />
              <input
                type="time"
                className="input"
                value={loadForm.hora_de_descarga}
                onChange={(e) =>
                  setLoadForm((p) => ({
                    ...p,
                    hora_de_descarga: e.target.value,
                  }))
                }
              />
            </div>
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            <div className="label">Entrega</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {ENTREGA_OPTIONS.map((opt) => (
                <label
                  key={opt}
                  style={{ display: "flex", alignItems: "center", gap: 4 }}
                >
                  <input
                    type="checkbox"
                    checked={loadForm.entrega.includes(opt)}
                    onChange={(e) =>
                      setLoadForm((p) => ({
                        ...p,
                        entrega: e.target.checked
                          ? [...p.entrega, opt]
                          : p.entrega.filter((v) => v !== opt),
                      }))
                    }
                  />
                  {opt}
                </label>
              ))}
            </div>
          </div>

          <div className="form-row">
            <div>
              <div className="label">Responsable</div>
              <select
                className="select"
                value={loadForm.responsable}
                onChange={(e) =>
                  setLoadForm((p) => ({ ...p, responsable: e.target.value }))
                }
              >
                <option value="">Sin responsable</option>
                {responsables.map((r) => {
                  const rid = String(r?._id || r?.id || "");
                  return (
                    <option key={rid} value={rid}>
                      {String(r?.nombre || r?.name || rid)}
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <div className="label">Chofer</div>
              <select
                className="select"
                value={loadForm.chofer}
                onChange={(e) =>
                  setLoadForm((p) => ({ ...p, chofer: e.target.value }))
                }
              >
                <option value="">Sin chofer</option>
                {users
                  .filter((u) => String(u?.role || "") === "driver")
                  .map((u) => {
                    const uid = String(u?._id || u?.id || "");
                    return (
                      <option key={uid} value={uid}>
                        {String(u?.name || u?.nombre || uid)}
                      </option>
                    );
                  })}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div>
              <div className="label">Consignatario</div>
              <select
                className="select"
                value={loadForm.consignatario}
                onChange={(e) =>
                  setLoadForm((p) => ({ ...p, consignatario: e.target.value }))
                }
              >
                <option value="">Sin consignatario</option>
                {consignees.map((c) => {
                  const cid = String(c?._id || c?.id || "");
                  return (
                    <option key={cid} value={cid}>
                      {String(c?.nombre || c?.name || cid)}
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <div className="label">Terminal de entrega</div>
              <select
                className="select"
                value={loadForm.terminal_entrega}
                onChange={(e) =>
                  setLoadForm((p) => ({
                    ...p,
                    terminal_entrega: e.target.value,
                  }))
                }
              >
                <option value="">Sin terminal</option>
                {locations.map((l) => {
                  const lid = String(l?._id || l?.id || "");
                  return (
                    <option key={lid} value={lid}>
                      {String(l?.nombre || lid)}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        open={openCreateShip}
        title="Crear barco"
        onClose={() => {
          setOpenCreateShip(false);
          if (returnToCreateLoadAfterShip) {
            setOpenCreateLoad(true);
            setReturnToCreateLoadAfterShip(false);
          }
        }}
        onSubmit={submitCreateShip}
        submitLabel="Crear"
      >
        <div style={{ display: "grid", gap: 8 }}>
          <div className="label">Nombre del barco</div>
          <input
            className="input"
            value={shipForm.nombre_del_barco}
            onChange={(e) =>
              setShipForm((p) => ({ ...p, nombre_del_barco: e.target.value }))
            }
            placeholder="Nombre del barco"
          />
        </div>
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
