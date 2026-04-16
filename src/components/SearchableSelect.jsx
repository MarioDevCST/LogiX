import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

export default function SearchableSelect({
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
  const menuRef = useRef(null);
  const [menuPos, setMenuPos] = useState(null);

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
      const menuEl = menuRef.current;
      if (el && el.contains(e.target)) return;
      if (menuEl && menuEl.contains(e.target)) return;
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

  useEffect(() => {
    if (!open) return;
    const update = () => {
      const el = rootRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setMenuPos({
        top: rect.bottom + 6,
        left: rect.left,
        width: rect.width,
      });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
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
        <span
          style={{
            color: selected ? "inherit" : "var(--text-secondary)",
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {selected ? selected.label : placeholder}
        </span>
        <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
          {open ? "expand_less" : "expand_more"}
        </span>
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              position: "fixed",
              top: menuPos?.top ?? 0,
              left: menuPos?.left ?? 0,
              width: menuPos?.width ?? undefined,
              zIndex: 2000,
              background: "#fff",
              border: "1px solid var(--border)",
              borderRadius: 10,
              boxShadow: "0 8px 20px rgba(0,0,0,0.08)",
              overflow: "hidden",
            }}
          >
            <div
              style={{ padding: 10, borderBottom: "1px solid var(--border)" }}
            >
              <input
                className="input"
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setOpen(false);
                    setQuery("");
                  }
                }}
              />
            </div>
            <div
              style={{
                maxHeight,
                overflowY: "auto",
                overscrollBehavior: "contain",
              }}
            >
              {filtered.length === 0 ? (
                <div style={{ padding: 12, color: "var(--text-secondary)" }}>
                  Sin resultados
                </div>
              ) : (
                filtered.map((o) => {
                  const val = String(o?.value ?? "");
                  const isSelected = val === String(value ?? "");
                  return (
                    <button
                      key={val || o?.label}
                      type="button"
                      onClick={() => {
                        onChange?.(val);
                        setOpen(false);
                        setQuery("");
                      }}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        padding: "10px 12px",
                        border: "none",
                        background: isSelected ? "var(--hover)" : "#fff",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 10,
                      }}
                    >
                      <span
                        style={{
                          minWidth: 0,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {o?.label}
                      </span>
                      {isSelected && (
                        <span className="material-symbols-outlined">check</span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
