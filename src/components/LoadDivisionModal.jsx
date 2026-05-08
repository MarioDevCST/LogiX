import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Modal from "./Modal.jsx";
import FormField from "./FormField.jsx";

const normalizeMatricula = (value) =>
  String(value || "")
    .trim()
    .toUpperCase();

const buildLocalId = () => {
  const rand = Math.random().toString(16).slice(2);
  return `truck_${Date.now().toString(16)}_${rand}`;
};

const getPalletId = (p) => String(p?._id || p?.id || "").trim();

export default function LoadDivisionModal({
  open,
  load,
  pallets,
  hideLoaded = false,
  actor,
  variant = "modal",
  onTogglePallet,
  onClose,
  onSave,
  saving,
}) {
  const navigate = useNavigate();
  const loadId = String(load?._id || load?.id || "").trim();
  const palletsList = useMemo(() => {
    return Array.isArray(pallets) ? pallets : [];
  }, [pallets]);

  const initialTrucks = useMemo(() => {
    const raw = Array.isArray(load?.camiones) ? load.camiones : [];
    const normalized = raw
      .map((t) => ({
        id: String(t?.id || t?._id || "").trim() || buildLocalId(),
        alias: String(t?.alias || "").trim(),
        matricula: normalizeMatricula(t?.matricula),
        matricula_tractora: normalizeMatricula(t?.matricula_tractora),
        pallet_ids: Array.isArray(t?.pallet_ids)
          ? t.pallet_ids.map((v) => String(v)).filter(Boolean)
          : [],
        ready: !!t?.ready,
        loaded_at: t?.loaded_at || null,
        loaded_by: t?.loaded_by || null,
      }))
      .filter((t) => t.id);

    return normalized;
  }, [load]);

  const [mode, setMode] = useState("visual");
  const [trucks, setTrucks] = useState(initialTrucks);
  const [draggingPalletId, setDraggingPalletId] = useState("");
  const [addTruckOpen, setAddTruckOpen] = useState(false);
  const [pendingAlias, setPendingAlias] = useState("");
  const [pendingMatricula, setPendingMatricula] = useState("");
  const [pendingTractora, setPendingTractora] = useState("");
  const [truckMenuOpenId, setTruckMenuOpenId] = useState("");

  useEffect(() => {
    if (!open) return;
    setMode("visual");
    setTrucks(initialTrucks);
    setDraggingPalletId("");
    setAddTruckOpen(false);
    setPendingAlias("");
    setPendingMatricula("");
    setPendingTractora("");
    setTruckMenuOpenId("");
  }, [open, initialTrucks]);

  useEffect(() => {
    if (!truckMenuOpenId) return undefined;
    const onDocClick = () => setTruckMenuOpenId("");
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [truckMenuOpenId]);

  const palletById = useMemo(() => {
    const map = new Map();
    palletsList.forEach((p) => {
      const id = getPalletId(p);
      if (!id) return;
      map.set(id, p);
    });
    return map;
  }, [palletsList]);

  const allPalletIds = useMemo(
    () => palletsList.map(getPalletId).filter(Boolean),
    [palletsList],
  );

  const palletsVisibleList = useMemo(() => {
    if (!hideLoaded) return palletsList;
    return palletsList.filter((p) => p?.estado !== true);
  }, [hideLoaded, palletsList]);

  const hiddenLoadedCount = useMemo(() => {
    if (!hideLoaded) return 0;
    return palletsList.filter((p) => p?.estado === true).length;
  }, [hideLoaded, palletsList]);

  const assignedTruckIdByPalletId = useMemo(() => {
    const map = new Map();
    trucks.forEach((t) => {
      (Array.isArray(t.pallet_ids) ? t.pallet_ids : []).forEach((pid) => {
        const id = String(pid || "").trim();
        if (!id) return;
        map.set(id, t.id);
      });
    });
    return map;
  }, [trucks]);

  const unassignedIds = useMemo(() => {
    return allPalletIds.filter((pid) => !assignedTruckIdByPalletId.has(pid));
  }, [allPalletIds, assignedTruckIdByPalletId]);

  const unassignedLoadedCount = useMemo(() => {
    if (!hideLoaded) return 0;
    return unassignedIds.filter((pid) => {
      const p = palletById.get(String(pid));
      return p?.estado === true;
    }).length;
  }, [hideLoaded, palletById, unassignedIds]);

  const countLoadedForTruck = (truck) => {
    const ids = Array.isArray(truck?.pallet_ids) ? truck.pallet_ids : [];
    let loaded = 0;
    ids.forEach((pid) => {
      const p = palletById.get(String(pid));
      if (p?.estado === true) loaded += 1;
    });
    return { loaded, total: ids.length };
  };

  const isTruckReadyNow = (truck) => {
    return !!truck?.ready || !!truck?.loaded_at;
  };

  const canConfirmTruck = (truck) => {
    if (!loadId) return false;
    if (truck?.ready || truck?.loaded_at) return false;
    const { loaded, total } = countLoadedForTruck(truck);
    return total > 0 && loaded === total;
  };

  const usedMatriculas = useMemo(() => {
    return new Set(trucks.map((t) => normalizeMatricula(t?.matricula)));
  }, [trucks]);

  const canSubmitNewTruck = () => {
    const mat = normalizeMatricula(pendingMatricula);
    if (!mat) return false;
    if (usedMatriculas.has(mat)) return false;
    return true;
  };

  const submitNewTruck = () => {
    const mat = normalizeMatricula(pendingMatricula);
    if (!mat) return;
    if (usedMatriculas.has(mat)) return;
    const alias = String(pendingAlias || "").trim();
    const tractora = normalizeMatricula(pendingTractora);
    setTrucks((prev) => [
      ...prev,
      {
        id: buildLocalId(),
        alias,
        matricula: mat,
        matricula_tractora: tractora,
        pallet_ids: [],
        ready: false,
        loaded_at: null,
        loaded_by: null,
      },
    ]);
    setAddTruckOpen(false);
    setPendingAlias("");
    setPendingMatricula("");
    setPendingTractora("");
  };

  const goToDocumentation = (doc, truckId) => {
    const tid = String(truckId || "").trim();
    if (!loadId) return;
    const docKey =
      String(doc || "")
        .trim()
        .toLowerCase() === "cmr"
        ? "cmr"
        : "carta";
    const params = new URLSearchParams();
    params.set("doc", docKey);
    params.set("load", loadId);
    if (tid) params.set("truck", tid);
    navigate(`/app/logistica/documentacion?${params.toString()}`);
  };

  const removeTruck = (truckId) => {
    const id = String(truckId || "").trim();
    setTrucks((prev) => {
      const target = prev.find((t) => t.id === id);
      const idsToFree = Array.isArray(target?.pallet_ids)
        ? target.pallet_ids.map((v) => String(v)).filter(Boolean)
        : [];
      const next = prev.filter((t) => t.id !== id);
      if (idsToFree.length === 0) return next;
      return next.map((t) => {
        const pids = Array.isArray(t.pallet_ids) ? t.pallet_ids : [];
        return {
          ...t,
          pallet_ids: pids.filter((pid) => !idsToFree.includes(pid)),
        };
      });
    });
  };

  const assignPalletToTruck = (palletId, truckId) => {
    const pid = String(palletId || "").trim();
    const tid = String(truckId || "").trim();
    if (!pid) return;
    setTrucks((prev) => {
      const next = prev.map((t) => {
        const ids = Array.isArray(t.pallet_ids) ? t.pallet_ids : [];
        const filtered = ids.filter((x) => String(x) !== pid);
        return { ...t, pallet_ids: filtered };
      });
      if (!tid) return next;
      return next.map((t) => {
        if (t.id !== tid) return t;
        return { ...t, pallet_ids: [...t.pallet_ids, pid] };
      });
    });
  };

  const confirmTruckReady = (truckId) => {
    const id = String(truckId || "").trim();
    setTrucks((prev) =>
      prev.map((t) =>
        t.id === id
          ? {
              ...t,
              ready: true,
              loaded_at: new Date().toISOString(),
              loaded_by: actor
                ? {
                    id: String(actor?.id || actor?._id || "").trim(),
                    name: String(actor?.name || "").trim(),
                  }
                : t.loaded_by || null,
            }
          : t,
      ),
    );
  };

  const validate = () => {
    const list = Array.isArray(trucks) ? trucks : [];
    if (list.length === 0) return { ok: true, error: "" };
    const seen = new Set();
    for (const t of list) {
      const mat = normalizeMatricula(t?.matricula);
      if (!mat) return { ok: false, error: "La matrícula es obligatoria" };
      if (seen.has(mat))
        return { ok: false, error: "Las matrículas no pueden repetirse" };
      seen.add(mat);
    }
    return { ok: true, error: "" };
  };

  const allReady = useMemo(() => {
    if (trucks.length === 0) return true;
    return trucks.every((t) => isTruckReadyNow(t));
  }, [trucks]);

  const onSubmit = () => {
    if (!onSave) return;
    const res = validate();
    if (!res.ok) {
      onSave({ error: res.error });
      return;
    }
    const cleaned = trucks.map((t) => ({
      id: String(t.id),
      alias: String(t?.alias || "").trim(),
      matricula: normalizeMatricula(t.matricula),
      matricula_tractora: normalizeMatricula(t?.matricula_tractora),
      pallet_ids: Array.isArray(t.pallet_ids)
        ? Array.from(
            new Set(t.pallet_ids.map((v) => String(v)).filter(Boolean)),
          )
        : [],
      ready: !!t.ready,
      loaded_at: t.loaded_at || null,
      loaded_by: t.loaded_by || null,
    }));
    onSave({ camiones: cleaned });
  };

  const body = (
    <div style={{ display: "grid", gap: 12 }}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "grid", gap: 4 }}>
          <div style={{ fontWeight: 800, fontSize: 14 }}>
            {load?.nombre || loadId || "Carga"}
          </div>
          <div style={{ color: "var(--text-secondary)", fontSize: 12 }}>
            Camiones: {trucks.length} · Palets: {allPalletIds.length} · Sin
            asignar: {unassignedIds.length} · Listos: {allReady ? "Sí" : "No"}
            {hideLoaded ? ` · Ocultos: ${hiddenLoadedCount}` : ""}
          </div>
          {hideLoaded && unassignedLoadedCount > 0 ? (
            <div style={{ color: "#b45309", fontSize: 12, fontWeight: 700 }}>
              Hay {unassignedLoadedCount} palets cargados sin asignar (desactiva
              “Ocultar cargados” para verlos).
            </div>
          ) : null}
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <button
            type="button"
            className={
              mode === "visual" ? "primary-button" : "secondary-button"
            }
            onClick={() => setMode("visual")}
            style={{ height: 36, padding: "0 10px" }}
          >
            Visual
          </button>
          <button
            type="button"
            className={mode === "tabla" ? "primary-button" : "secondary-button"}
            onClick={() => setMode("tabla")}
            style={{ height: 36, padding: "0 10px" }}
          >
            Estándar
          </button>
        </div>
      </div>

      <div
        style={{
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: 12,
          background: "#fff",
          display: "grid",
          gap: 10,
          minHeight: 170,
        }}
      >
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            type="button"
            className="icon-button"
            title="Añadir camión"
            onClick={() => setAddTruckOpen(true)}
            disabled={saving}
          >
            <span className="material-symbols-outlined">add</span>
          </button>
        </div>

        {mode === "visual" ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr",
              gap: 12,
            }}
          >
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ fontWeight: 800, fontSize: 13 }}>
                Camiones (arrastra palets a una tarjeta)
              </div>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "flex-start",
                  gap: 10,
                }}
              >
                {trucks.length === 0 ? (
                  <div
                    style={{
                      border: "1px dashed var(--border)",
                      borderRadius: 12,
                      padding: 10,
                      background: "var(--hover)",
                      minHeight: 110,
                      width: 240,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--text-secondary)",
                      fontWeight: 700,
                    }}
                  >
                    Pulsa + para añadir un camión
                  </div>
                ) : null}
                {trucks.map((t) => {
                  const { loaded, total } = countLoadedForTruck(t);
                  const ready = isTruckReadyNow(t);
                  const alias = String(t?.alias || "").trim();
                  const tractora = normalizeMatricula(t?.matricula_tractora);
                  return (
                    <div
                      key={t.id}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        const pid =
                          e.dataTransfer.getData("text/palletId") ||
                          draggingPalletId;
                        assignPalletToTruck(pid, t.id);
                        setDraggingPalletId("");
                      }}
                      style={{
                        width: 240,
                        border: ready
                          ? "2px solid #16a34a"
                          : "1px solid var(--border)",
                        borderRadius: 12,
                        padding: 10,
                        background: ready ? "#ecfdf5" : "#fff",
                        display: "grid",
                        gap: 8,
                        minHeight: 110,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          justifyContent: "space-between",
                          gap: 8,
                        }}
                      >
                        <div style={{ display: "flex", gap: 10, minWidth: 0 }}>
                          <div
                            style={{
                              width: 44,
                              height: 44,
                              borderRadius: 12,
                              background: "#f59e0b",
                              display: "grid",
                              placeItems: "center",
                              flex: "0 0 auto",
                            }}
                            title="Camión"
                          >
                            <span
                              className="material-symbols-outlined"
                              style={{ color: "#fff", fontSize: 24 }}
                            >
                              local_shipping
                            </span>
                          </div>
                          <div style={{ display: "grid", gap: 4, minWidth: 0 }}>
                            <div
                              style={{
                                fontWeight: 900,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                              title={alias || t.matricula || ""}
                            >
                              {alias || t.matricula || "Camión"}
                            </div>
                            <div
                              style={{
                                fontSize: 12,
                                color: "var(--text-secondary)",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                              title={[
                                t.matricula ? `Matrícula: ${t.matricula}` : "",
                                tractora ? `Tractora: ${tractora}` : "",
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            >
                              {[
                                t.matricula
                                  ? `Matrícula: ${t.matricula}`
                                  : null,
                                tractora ? `Tractora: ${tractora}` : null,
                              ]
                                .filter(Boolean)
                                .join(" · ") || "Sin matrícula"}
                            </div>
                            <div
                              style={{
                                fontSize: 12,
                                color: "var(--text-secondary)",
                              }}
                            >
                              {loaded}/{total} cargados
                              {unassignedIds.length > 0
                                ? " · pendiente asignar"
                                : ""}
                            </div>
                          </div>
                        </div>
                        <div
                          style={{
                            position: "relative",
                            flex: "0 0 auto",
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            className="icon-button"
                            title="Acciones"
                            onClick={(e) => {
                              e.stopPropagation();
                              setTruckMenuOpenId((cur) =>
                                String(cur || "") === String(t.id)
                                  ? ""
                                  : String(t.id),
                              );
                            }}
                            disabled={saving}
                          >
                            <span className="material-symbols-outlined">
                              more_vert
                            </span>
                          </button>
                          {String(truckMenuOpenId || "") === String(t.id) ? (
                            <div
                              style={{
                                position: "absolute",
                                right: 0,
                                top: 34,
                                zIndex: 10,
                                background: "#fff",
                                border: "1px solid var(--border)",
                                borderRadius: 10,
                                boxShadow: "0 12px 30px rgba(15, 23, 42, 0.12)",
                                minWidth: 220,
                                padding: 6,
                                display: "grid",
                                gap: 4,
                              }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                className="secondary-button"
                                style={{
                                  justifyContent: "flex-start",
                                  height: 34,
                                  padding: "0 10px",
                                }}
                                disabled={!loadId}
                                onClick={() => {
                                  setTruckMenuOpenId("");
                                  goToDocumentation("cmr", t.id);
                                }}
                              >
                                Crear CMR
                              </button>
                              <button
                                type="button"
                                className="secondary-button"
                                style={{
                                  justifyContent: "flex-start",
                                  height: 34,
                                  padding: "0 10px",
                                }}
                                disabled={!loadId}
                                onClick={() => {
                                  setTruckMenuOpenId("");
                                  goToDocumentation("packing", t.id);
                                }}
                              >
                                Crear Packing List
                              </button>
                              <button
                                type="button"
                                className="secondary-button"
                                style={{
                                  justifyContent: "flex-start",
                                  height: 34,
                                  padding: "0 10px",
                                  color: "#b91c1c",
                                }}
                                disabled={
                                  saving ||
                                  (Array.isArray(t.pallet_ids) &&
                                    t.pallet_ids.length > 0)
                                }
                                onClick={() => {
                                  setTruckMenuOpenId("");
                                  removeTruck(t.id);
                                }}
                              >
                                Borrar
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <div
                        style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
                      >
                        <button
                          type="button"
                          className={
                            ready ? "secondary-button" : "primary-button"
                          }
                          disabled={!canConfirmTruck(t) || saving}
                          onClick={() => confirmTruckReady(t.id)}
                          style={{ height: 34, padding: "0 10px" }}
                          title={
                            canConfirmTruck(t)
                              ? "Marcar camión como cargado"
                              : ready
                                ? "Camión listo"
                                : "Para marcarlo listo, todos sus palets deben estar cargados"
                          }
                        >
                          {ready ? "Camión listo" : "Confirmar camión cargado"}
                        </button>

                        <button
                          type="button"
                          className="secondary-button"
                          disabled={saving}
                          onClick={() => {
                            if (!draggingPalletId) return;
                            assignPalletToTruck(draggingPalletId, t.id);
                            setDraggingPalletId("");
                          }}
                          style={{ height: 34, padding: "0 10px" }}
                          title="Asigna el palet seleccionado/arrastrado"
                        >
                          Asignar
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ fontWeight: 800, fontSize: 13 }}>Palets</div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: 10,
                }}
              >
                {palletsVisibleList.length === 0 ? (
                  <div style={{ color: "var(--text-secondary)" }}>
                    No hay palets para mostrar
                  </div>
                ) : null}
                {palletsVisibleList
                  .slice()
                  .sort((a, b) =>
                    String(a?.numero_palet || "").localeCompare(
                      String(b?.numero_palet || ""),
                      "es",
                      { numeric: true, sensitivity: "base" },
                    ),
                  )
                  .map((p) => {
                    const pid = getPalletId(p);
                    const assignedId = assignedTruckIdByPalletId.get(pid) || "";
                    const assignedTruck = trucks.find(
                      (t) => t.id === assignedId,
                    );
                    const label = String(p?.numero_palet || "").trim() || pid;
                    const tipo = String(p?.tipo || "").trim();
                    const loaded = p?.estado === true;
                    const assignedLabel = String(
                      assignedTruck?.alias || assignedTruck?.matricula || "",
                    ).trim();
                    return (
                      <div
                        key={pid}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData("text/palletId", pid);
                          setDraggingPalletId(pid);
                        }}
                        onDragEnd={() => setDraggingPalletId("")}
                        style={{
                          border: "1px solid var(--border)",
                          borderRadius: 12,
                          padding: 10,
                          background: loaded ? "#f8fafc" : "#fff",
                          display: "grid",
                          gap: 8,
                          cursor: "grab",
                          opacity: loaded ? 0.85 : 1,
                        }}
                        title={loaded ? "Cargado" : "Pendiente"}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 10,
                          }}
                        >
                          <div
                            style={{ display: "flex", gap: 10, minWidth: 0 }}
                          >
                            {typeof onTogglePallet === "function" ? (
                              <input
                                type="checkbox"
                                checked={loaded}
                                onChange={() => onTogglePallet(pid)}
                                style={{ marginTop: 3 }}
                              />
                            ) : null}
                            <div
                              style={{ display: "grid", gap: 2, minWidth: 0 }}
                            >
                              <div style={{ fontWeight: 900 }}>
                                {label} {loaded ? "✓" : ""}
                              </div>
                              <div
                                style={{
                                  color: "var(--text-secondary)",
                                  fontSize: 12,
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                                title={tipo || ""}
                              >
                                {tipo || "Sin tipo"}
                              </div>
                            </div>
                          </div>
                          <select
                            className="select"
                            value={assignedId}
                            onChange={(e) =>
                              assignPalletToTruck(pid, e.target.value)
                            }
                            style={{ height: 34 }}
                          >
                            <option value="">Sin camión</option>
                            {trucks.map((t) => (
                              <option key={t.id} value={t.id}>
                                {String(t?.alias || "").trim() ||
                                  t.matricula ||
                                  "Camión"}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            color: "var(--text-secondary)",
                          }}
                        >
                          {assignedLabel
                            ? `Camión: ${assignedLabel}`
                            : "Sin asignar"}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {palletsVisibleList.map((p) => {
              const pid = getPalletId(p);
              const label = String(p?.numero_palet || "").trim() || pid;
              const assignedId = assignedTruckIdByPalletId.get(pid) || "";
              return (
                <div
                  key={pid}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 260px",
                    gap: 10,
                    alignItems: "center",
                    borderBottom: "1px solid #f1f3f4",
                    paddingBottom: 10,
                  }}
                >
                  <div style={{ display: "flex", gap: 10, minWidth: 0 }}>
                    {typeof onTogglePallet === "function" ? (
                      <input
                        type="checkbox"
                        checked={p?.estado === true}
                        onChange={() => onTogglePallet(pid)}
                        style={{ marginTop: 3 }}
                      />
                    ) : null}
                    <div style={{ display: "grid", minWidth: 0 }}>
                      <div style={{ fontWeight: 800 }}>
                        {label} {p?.estado === true ? "✓" : ""}
                      </div>
                      <div
                        style={{
                          color: "var(--text-secondary)",
                          fontSize: 12,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {String(p?.tipo || "").trim() || "Sin tipo"}
                      </div>
                    </div>
                  </div>
                  <select
                    className="select"
                    value={assignedId}
                    onChange={(e) => assignPalletToTruck(pid, e.target.value)}
                  >
                    <option value="">Sin camión</option>
                    {trucks.map((t) => (
                      <option key={t.id} value={t.id}>
                        {String(t?.alias || "").trim() ||
                          t.matricula ||
                          "Camión"}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Modal
        open={addTruckOpen}
        title="Añadir camión"
        onClose={() => setAddTruckOpen(false)}
        onSubmit={submitNewTruck}
        submitLabel="Añadir"
        cancelLabel="Cancelar"
        width={560}
      >
        <div style={{ display: "grid", gap: 12 }}>
          <div className="form-row">
            <FormField label="Alias">
              <input
                className="input"
                value={pendingAlias}
                onChange={(e) => setPendingAlias(e.target.value)}
                placeholder="Ej: Camión 1 / Norte"
              />
            </FormField>
            <FormField label="Matrícula">
              <input
                className="input"
                value={pendingMatricula}
                onChange={(e) => setPendingMatricula(e.target.value)}
                placeholder="Ej: 9190KZN"
              />
            </FormField>
          </div>
          <FormField label="Matrícula tractora">
            <input
              className="input"
              value={pendingTractora}
              onChange={(e) => setPendingTractora(e.target.value)}
              placeholder="Ej: 1234ABC"
            />
          </FormField>
          {normalizeMatricula(pendingMatricula) &&
          usedMatriculas.has(normalizeMatricula(pendingMatricula)) ? (
            <div style={{ color: "#b91c1c", fontWeight: 700, fontSize: 13 }}>
              Esa matrícula ya existe en la división.
            </div>
          ) : null}
          {!canSubmitNewTruck() ? (
            <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>
              La matrícula es obligatoria y no puede repetirse.
            </div>
          ) : null}
        </div>
      </Modal>
    </div>
  );

  if (variant === "inline") {
    if (!open) return null;
    return (
      <div style={{ display: "grid", gap: 12 }}>
        {body}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            className="secondary-button"
            onClick={onClose}
            style={{ height: 36, padding: "0 10px" }}
          >
            Salir
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={onSubmit}
            disabled={saving}
            style={{ height: 36, padding: "0 10px" }}
          >
            {saving ? "Guardando..." : "Guardar división"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <Modal
      open={open}
      title="División de carga"
      onClose={onClose}
      onSubmit={onSubmit}
      submitLabel={saving ? "Guardando..." : "Guardar división"}
      cancelLabel="Cerrar"
      width={980}
      bodyStyle={{ gridTemplateColumns: "1fr" }}
      footerStyle={{ gap: 12 }}
    >
      {body}
    </Modal>
  );
}
