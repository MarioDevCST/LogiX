export default function FormField({ label, hint, children, style }) {
  return (
    <div style={{ display: "grid", gap: 8, ...(style || {}) }}>
      {label ? <div className="label">{label}</div> : null}
      {hint ? (
        <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>
          {hint}
        </div>
      ) : null}
      {children}
    </div>
  );
}

