import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Modal from "../components/Modal.jsx";
import Snackbar from "../components/Snackbar.jsx";
import FormField from "../components/FormField.jsx";
import { getCurrentUser } from "../utils/roles.js";
import {
  deleteShipById,
  fetchAllCargoTypes,
  fetchAllCompanies,
  fetchAllResponsables,
  fetchShipById,
  updateShipById,
} from "../firebase/auth.js";

const SHIP_TYPE_OPTIONS = ["Mercante", "Ferry", "Crucero"];

const normalizeExternalUrl = (raw) => {
  const input = String(raw || "").trim();
  if (!input) return "";
  const withProto = /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(input)
    ? input
    : `https://${input}`;
  try {
    const url = new URL(withProto);
    if (!["http:", "https:"].includes(url.protocol)) return "";
    return url.toString();
  } catch {
    return "";
  }
};

const truncateText = (raw, maxChars = 20) => {
  const text = String(raw || "");
  const max = Math.max(1, Number(maxChars) || 1);
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(1, max - 1))}…`;
};

export default function ShipDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [ship, setShip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const current = getCurrentUser();
  const canDeleteShip = current?.role === "dispatcher";
  const [companies, setCompanies] = useState([]);
  const [responsables, setResponsables] = useState([]);
  const [cargoTypes, setCargoTypes] = useState([]);
  const [form, setForm] = useState({
    nombre_del_barco: "",
    empresa: "",
    responsable: "",
    tipo: "Mercante",
    cargo_type: "",
    enlace: "",
  });
  const [snack, setSnack] = useState({
    open: false,
    message: "",
    type: "success",
  });

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        setLoading(true);
        const results = await Promise.allSettled([
          fetchShipById(id),
          fetchAllCompanies(),
          fetchAllResponsables(),
          fetchAllCargoTypes(),
        ]);
        const s = results[0].status === "fulfilled" ? results[0].value : null;
        const companiesList =
          results[1].status === "fulfilled" && Array.isArray(results[1].value)
            ? results[1].value
            : [];
        const responsablesList =
          results[2].status === "fulfilled" && Array.isArray(results[2].value)
            ? results[2].value
            : [];
        const cargoTypesList =
          results[3].status === "fulfilled" && Array.isArray(results[3].value)
            ? results[3].value
            : [];
        if (!mounted) return;
        setShip(s);
        setCompanies(
          (companiesList || []).map((c) => ({
            ...c,
            id: c.id || c._id,
            _id: c._id || c.id,
          }))
        );
        setResponsables(
          (responsablesList || []).map((r) => ({
            ...r,
            id: r.id || r._id,
            _id: r._id || r.id,
          }))
        );
        setCargoTypes(
          (cargoTypesList || []).map((t) => ({
            ...t,
            id: t.id || t._id,
            _id: t._id || t.id,
          }))
        );
        setForm({
          nombre_del_barco: s?.nombre_del_barco || "",
          empresa: s?.empresa || "",
          responsable: s?.responsable || "",
          tipo: s?.tipo || "Mercante",
          cargo_type: s?.cargo_type || "",
          enlace: s?.enlace || "",
        });
      } catch {
        if (!mounted) return;
        setShip(null);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    run();
    return () => {
      mounted = false;
    };
  }, [id]);

  const submit = async () => {
    try {
      if (!form.nombre_del_barco) {
        setSnack({
          open: true,
          message: "El nombre del barco es obligatorio",
          type: "error",
        });
        return;
      }
      const company = companies.find(
        (c) => String(c._id || c.id) === String(form.empresa)
      );
      const responsable = responsables.find(
        (r) => String(r._id || r.id) === String(form.responsable)
      );
      const cargoType = cargoTypes.find(
        (t) => String(t._id || t.id) === String(form.cargo_type)
      );
      const updated = await updateShipById(id, {
        ...form,
        empresa: form.empresa || "",
        empresa_nombre: company?.nombre || "",
        responsable: form.responsable || "",
        responsable_nombre: responsable?.nombre || "",
        responsable_email: responsable?.email || "",
        cargo_type: form.cargo_type || "",
        cargo_type_nombre: cargoType?.nombre || "",
        modificado_por: getCurrentUser()?.name || "Testing",
      });
      if (!updated) {
        setSnack({ open: true, message: "Barco no encontrado", type: "error" });
        return;
      }
      setShip(updated);
      setOpen(false);
      setSnack({ open: true, message: "Barco actualizado", type: "success" });
    } catch (e) {
      setSnack({
        open: true,
        message: "Error actualizando barco",
        type: "error",
      });
    }
  };

  const companyName =
    ship?.empresa_nombre ||
    companies.find((c) => String(c._id || c.id) === String(ship?.empresa))
      ?.nombre ||
    String(ship?.empresa || "") ||
    "";
  const company = ship?.empresa
    ? companies.find((c) => String(c._id || c.id) === String(ship?.empresa))
    : null;
  const responsableName =
    ship?.responsable_nombre ||
    responsables.find(
      (r) => String(r._id || r.id) === String(ship?.responsable)
    )?.nombre ||
    String(ship?.responsable || "") ||
    "";
  const cargoTypeName =
    ship?.cargo_type_nombre ||
    cargoTypes.find((t) => String(t._id || t.id) === String(ship?.cargo_type))
      ?.nombre ||
    String(ship?.cargo_type || "") ||
    "";
  const enlaceHref = normalizeExternalUrl(ship?.enlace);
  const enlaceLabel = truncateText(String(ship?.enlace || "").trim(), 20);

  const handleDelete = async () => {
    if (!ship) return;
    const label = ship.nombre_del_barco || ship.id || "";
    if (!window.confirm(`¿Seguro que deseas borrar el barco "${label}"?`))
      return;
    try {
      await deleteShipById(id);
      setOpen(false);
      setSnack({ open: true, message: "Barco borrado", type: "success" });
      navigate("/app/admin/barcos");
    } catch {
      setSnack({ open: true, message: "Error borrando barco", type: "error" });
    }
  };

  if (loading) return <p>Cargando...</p>;
  if (!ship) return <p>Barco no disponible.</p>;

  return (
    <section className="card">
      <div className="card-header">
        <h2 className="card-title">Detalle barco</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="icon-button"
            onClick={() => setOpen(true)}
            title="Modificar"
          >
            <span className="material-symbols-outlined">edit</span>
          </button>
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
        <p>
          <strong>Nombre:</strong> {ship.nombre_del_barco}
        </p>
        <p>
          <strong>Empresa:</strong> {companyName || "-"}
        </p>
        <p>
          <strong>Responsable:</strong> {responsableName || "-"}
        </p>
        <p>
          <strong>Teléfono:</strong> {company?.telefono || "-"}
        </p>
        <p>
          <strong>Contacto:</strong> {company?.email || "-"}
        </p>
        <p>
          <strong>Tipo:</strong> {ship.tipo || "-"}
        </p>
        <p>
          <strong>Tipo de carga:</strong> {cargoTypeName || "-"}
        </p>
        <p>
          <strong>Enlace:</strong>{" "}
          {enlaceHref ? (
            <a
              href={enlaceHref}
              target="_blank"
              rel="noreferrer"
              title={String(ship.enlace || "").trim() || enlaceHref}
            >
              {enlaceLabel || truncateText(enlaceHref, 20)}
            </a>
          ) : (
            "-"
          )}
        </p>
      </div>

      <Modal
        open={open}
        title="Modificar barco"
        onClose={() => setOpen(false)}
        onSubmit={submit}
        submitLabel="Guardar"
      >
        <FormField label="Nombre del barco">
          <input
            className="input"
            value={form.nombre_del_barco}
            onChange={(e) =>
              setForm({ ...form, nombre_del_barco: e.target.value })
            }
          />
        </FormField>
        <FormField label="Empresa">
          <select
            className="input"
            value={form.empresa}
            onChange={(e) => setForm({ ...form, empresa: e.target.value })}
          >
            <option value="">Sin empresa</option>
            {companies.map((c) => (
              <option key={c._id || c.id} value={c._id || c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Responsable">
          <select
            className="input"
            value={form.responsable}
            onChange={(e) => setForm({ ...form, responsable: e.target.value })}
          >
            <option value="">Sin responsable</option>
            {responsables.map((r) => (
              <option key={r._id || r.id} value={r._id || r.id}>
                {r.nombre}
                {r.email ? ` (${r.email})` : ""}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Tipo">
          <select
            className="select"
            value={form.tipo}
            onChange={(e) => setForm({ ...form, tipo: e.target.value })}
          >
            {SHIP_TYPE_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Tipo de carga">
          <select
            className="input"
            value={form.cargo_type}
            onChange={(e) => setForm({ ...form, cargo_type: e.target.value })}
          >
            <option value="">Sin tipo</option>
            {cargoTypes
              .slice()
              .sort((a, b) =>
                String(a?.nombre || "").localeCompare(
                  String(b?.nombre || ""),
                  "es"
                )
              )
              .map((t) => (
                <option key={t._id || t.id} value={t._id || t.id}>
                  {t.nombre}
                </option>
              ))}
          </select>
        </FormField>
        <FormField label="Enlace (opcional)">
          <input
            className="input"
            value={form.enlace}
            onChange={(e) => setForm({ ...form, enlace: e.target.value })}
            placeholder="https://..."
          />
        </FormField>
        {canDeleteShip && (
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              className="secondary-button"
              style={{ borderColor: "#d93025", color: "#d93025" }}
              onClick={handleDelete}
              type="button"
              title="Eliminar barco"
            >
              Eliminar barco
            </button>
          </div>
        )}
      </Modal>

      <Snackbar
        open={snack.open}
        message={snack.message}
        type={snack.type}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
      />
    </section>
  );
}
