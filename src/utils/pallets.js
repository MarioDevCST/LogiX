export function getTipoColors(tipo) {
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

export function getTipoLabel(tipo) {
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

export function formatDateLabel(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

export function combineDateTime(dateValue, timeValue) {
  if (!dateValue) return null;
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return null;
  if (timeValue) {
    const [hh, mm] = String(timeValue).split(":");
    d.setHours(Number(hh) || 0, Number(mm) || 0, 0, 0);
  }
  return d;
}

export function normalizePalletNumber(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^\d+$/.test(raw)) return String(Number(raw));
  return raw.toLowerCase();
}

export function normalizePalletBase(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const lower = raw.toLowerCase();
  if (lower === "europeo") return "Europeo";
  if (lower === "americano") return "Americano";
  return raw;
}

