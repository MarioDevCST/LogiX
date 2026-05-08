import Modal from "./Modal.jsx";

export default function PalletDuplicateModal({ open, numero, onAccept }) {
  return (
    <Modal
      open={open}
      title="Número de palet duplicado"
      hideClose
      disableEscape
      onSubmit={onAccept}
      submitLabel="Aceptar"
    >
      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ fontWeight: 800 }}>
          No se puede utilizar el mismo número de palet dentro de la misma
          carga.
        </div>
        <div style={{ color: "var(--text-secondary)" }}>
          Número introducido:{" "}
          <span style={{ fontWeight: 800 }}>
            {String(numero || "").trim() || "—"}
          </span>
        </div>
        <div style={{ color: "var(--text-secondary)" }}>
          Introduce un número diferente para poder crear el palet.
        </div>
      </div>
    </Modal>
  );
}

