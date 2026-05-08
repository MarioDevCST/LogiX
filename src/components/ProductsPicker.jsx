import { useMemo, useState } from "react";

export default function ProductsPicker({
  catalog,
  items,
  onChangeItems,
  onError,
  disabled,
}) {
  const [search, setSearch] = useState("");
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [cantidad, setCantidad] = useState("");

  const suggestions = useMemo(() => {
    const q = String(search || "")
      .trim()
      .toLowerCase();
    if (!q) return [];
    const list = Array.isArray(catalog) ? catalog : [];
    const matches = list.filter((p) => {
      const code = String(p?.codigo || "")
        .trim()
        .toLowerCase();
      const name = String(p?.nombre_producto || "")
        .trim()
        .toLowerCase();
      return code.includes(q) || name.includes(q);
    });
    matches.sort((a, b) => {
      const aCode = String(a?.codigo || "").trim();
      const bCode = String(b?.codigo || "").trim();
      const aName = String(a?.nombre_producto || "").trim();
      const bName = String(b?.nombre_producto || "").trim();
      const aStarts =
        aCode.toLowerCase().startsWith(q) || aName.toLowerCase().startsWith(q);
      const bStarts =
        bCode.toLowerCase().startsWith(q) || bName.toLowerCase().startsWith(q);
      if (aStarts !== bStarts) return aStarts ? -1 : 1;
      const aLabel = `${aCode} ${aName}`.trim();
      const bLabel = `${bCode} ${bName}`.trim();
      return aLabel.localeCompare(bLabel, "es", { sensitivity: "base" });
    });
    return matches.slice(0, 10);
  }, [search, catalog]);

  const listItems = Array.isArray(items) ? items : [];
  const applyItems = (next) => {
    if (typeof onChangeItems === "function") onChangeItems(next);
  };

  const add = () => {
    const pid = String(selectedId || "").trim();
    const qtyNum = Number(String(cantidad || "").trim());
    const qty = Number.isFinite(qtyNum) ? qtyNum : 0;
    if (!pid) return onError?.("Selecciona un producto");
    if (!qty) return onError?.("La cantidad debe ser mayor que 0");

    const selected = (Array.isArray(catalog) ? catalog : []).find(
      (p) => String(p?.id || p?._id || "").trim() === pid,
    );
    if (!selected) return onError?.("Producto no encontrado");

    const code = String(selected?.codigo || "").trim();
    const name = String(selected?.nombre_producto || "").trim();

    const next = listItems.slice();
    const idx = next.findIndex(
      (it) =>
        String(it?.producto_id || "").trim() === pid ||
        String(it?.id || "").trim() === pid,
    );
    if (idx >= 0) {
      const prevQty =
        typeof next[idx]?.cantidad === "number"
          ? next[idx].cantidad
          : Number(String(next[idx]?.cantidad || "").trim());
      const merged = (Number.isFinite(prevQty) ? prevQty : 0) + qty;
      next[idx] = { ...next[idx], cantidad: merged };
      applyItems(next);
    } else {
      next.push({
        producto_id: pid,
        codigo: code,
        nombre_producto: name,
        cantidad: qty,
      });
      applyItems(next);
    }

    setSearch("");
    setSelectedId("");
    setCantidad("");
    setSuggestOpen(false);
  };

  return (
    <div>
      <div className="label">Productos</div>
      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <div style={{ flex: 1, position: "relative" }}>
            <input
              className="input"
              value={search}
              disabled={disabled}
              onChange={(e) => {
                setSearch(String(e.target.value || ""));
                setSuggestOpen(true);
                setSelectedId("");
              }}
              placeholder="Buscar por código o nombre"
              onFocus={() => setSuggestOpen(true)}
              onBlur={() => setTimeout(() => setSuggestOpen(false), 120)}
            />
            {suggestOpen && suggestions.length > 0 && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 6px)",
                  left: 0,
                  right: 0,
                  zIndex: 50,
                  background: "#fff",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  boxShadow: "0 8px 20px rgba(0,0,0,0.08)",
                  overflow: "hidden",
                  maxHeight: 240,
                  overflowY: "auto",
                }}
              >
                {suggestions.map((p) => {
                  const pid = String(p?.id || p?._id || "").trim();
                  const code = String(p?.codigo || "").trim();
                  const name = String(p?.nombre_producto || "").trim();
                  const estado = String(p?.estado || "").trim();
                  return (
                    <button
                      key={pid || `${code}-${name}`}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setSelectedId(pid);
                        setSearch(`${code || "—"} — ${name || "—"}`.trim());
                        setSuggestOpen(false);
                      }}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        padding: "10px 12px",
                        border: "none",
                        background: "#fff",
                        cursor: "pointer",
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 10,
                      }}
                    >
                      <span style={{ fontWeight: 800 }}>
                        {code || name || "—"}
                      </span>
                      <span
                        style={{
                          color: "var(--text-secondary)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {code && name ? name : estado ? `(${estado})` : "—"}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <input
            className="input"
            style={{ width: 140 }}
            type="number"
            step="0.01"
            min="0"
            disabled={disabled}
            value={cantidad}
            onChange={(e) => setCantidad(String(e.target.value || ""))}
            placeholder="Cantidad"
          />

          <button
            type="button"
            className="secondary-button"
            disabled={disabled}
            onClick={add}
          >
            Añadir
          </button>
        </div>

        {listItems.length > 0 ? (
          <div style={{ display: "grid", gap: 8 }}>
            {listItems.map((it, idx) => {
              const pid = String(it?.producto_id || it?.id || idx);
              const code = String(it?.codigo || "").trim();
              const name = String(it?.nombre_producto || "").trim();
              const qty =
                typeof it?.cantidad === "number"
                  ? it.cantidad
                  : Number(String(it?.cantidad || "").trim());
              const val = Number.isFinite(qty) ? qty : 0;
              return (
                <div
                  key={pid}
                  style={{
                    display: "flex",
                    gap: 10,
                    alignItems: "center",
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                    padding: 10,
                    background: "#fff",
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 800 }}>
                      {code || name || "—"}
                    </div>
                    <div
                      style={{
                        color: "var(--text-secondary)",
                        fontSize: 13,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {code && name ? name : pid}
                    </div>
                  </div>
                  <input
                    className="input"
                    style={{ width: 140 }}
                    type="number"
                    step="0.01"
                    min="0"
                    disabled={disabled}
                    value={String(val)}
                    onChange={(e) => {
                      const nextNum = Number(String(e.target.value || "").trim());
                      const nextVal = Number.isFinite(nextNum) ? nextNum : 0;
                      const next = listItems.slice();
                      next[idx] = { ...next[idx], cantidad: nextVal };
                      applyItems(next);
                    }}
                  />
                  <button
                    type="button"
                    className="icon-button"
                    title="Borrar"
                    disabled={disabled}
                    onClick={() => {
                      applyItems(listItems.filter((_, i) => i !== idx));
                    }}
                  >
                    <span className="material-symbols-outlined">delete</span>
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>
            No hay productos añadidos.
          </div>
        )}
      </div>
    </div>
  );
}

