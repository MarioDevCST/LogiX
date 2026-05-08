import Modal from "./Modal.jsx";

export default function PalletFuseModal({
  open,
  sourceNumero,
  targetNumero,
  baseCandidates,
  baseValue,
  onBaseChange,
  onClose,
  onSubmit,
}) {
  const candidates = Array.isArray(baseCandidates) ? baseCandidates : [];
  const showBase = candidates.length > 1;
  return (
    <Modal
      open={open}
      title="Fusionar palets"
      onClose={onClose}
      onSubmit={onSubmit}
      submitLabel="Fusionar"
      width={520}
      bodyStyle={{ gridTemplateColumns: "1fr" }}
    >
      <div style={{ fontSize: 16 }}>
        ¿Desea fusionar los palets {sourceNumero || "-"} y {targetNumero || "-"}?
      </div>
      {showBase ? (
        <div style={{ marginTop: 12, display: "grid", gap: 6 }}>
          <div className="label">Base final</div>
          <select
            className="select"
            value={String(baseValue || "")}
            onChange={(e) => onBaseChange?.(e.target.value)}
          >
            {candidates.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>
      ) : null}
    </Modal>
  );
}

