export default function ToggleSwitch({
  checked,
  onChange,
  disabled = false,
  size = "md",
} = {}) {
  const isChecked = !!checked;
  const isDisabled = !!disabled;
  const w = size === "sm" ? 38 : 46;
  const h = size === "sm" ? 22 : 26;
  const pad = 3;
  const knob = h - pad * 2;
  const xOn = w - pad - knob;
  const xOff = pad;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isChecked}
      disabled={isDisabled}
      onClick={() => {
        if (isDisabled) return;
        onChange?.(!isChecked);
      }}
      style={{
        width: w,
        height: h,
        padding: 0,
        borderRadius: 999,
        border: "1px solid var(--border)",
        background: isChecked ? "#16a34a" : "var(--hover)",
        cursor: isDisabled ? "not-allowed" : "pointer",
        position: "relative",
        opacity: isDisabled ? 0.6 : 1,
        transition: "background 120ms ease",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: pad,
          left: isChecked ? xOn : xOff,
          width: knob,
          height: knob,
          borderRadius: "50%",
          background: "#fff",
          boxShadow: "0 1px 2px rgba(0,0,0,0.18)",
          transition: "left 120ms ease",
        }}
      />
    </button>
  );
}
