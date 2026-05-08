export default function NumericPad({ onDigit, onDelete, onAccept, disabled }) {
  const digits = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: 12,
        background: "#fff",
        padding: 10,
        boxShadow: "0 8px 20px rgba(0,0,0,0.08)",
        width: 180,
      }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 8,
        }}
      >
        {digits.slice(0, 9).map((d) => (
          <button
            key={d}
            type="button"
            className="secondary-button"
            disabled={disabled}
            onClick={() => onDigit?.(d)}
            style={{ padding: "10px 0", fontWeight: 800 }}
          >
            {d}
          </button>
        ))}
        <button
          type="button"
          className="secondary-button"
          disabled={disabled}
          onClick={() => onDelete?.()}
          style={{ padding: "10px 0", fontWeight: 800 }}
          title="Borrar"
        >
          ⌫
        </button>
        <button
          type="button"
          className="secondary-button"
          disabled={disabled}
          onClick={() => onDigit?.("0")}
          style={{ padding: "10px 0", fontWeight: 800 }}
        >
          0
        </button>
        <button
          type="button"
          className="primary-button"
          disabled={disabled}
          onClick={() => onAccept?.()}
          style={{ padding: "10px 0", fontWeight: 800 }}
          title="Aceptar"
        >
          OK
        </button>
      </div>
    </div>
  );
}

