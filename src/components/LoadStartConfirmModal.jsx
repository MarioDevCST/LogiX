import Modal from "./Modal.jsx";

export default function LoadStartConfirmModal({ open, onClose, onConfirm }) {
  return (
    <Modal
      open={open}
      title="Advertencia"
      onClose={onClose}
      onSubmit={onConfirm}
      submitLabel="Sí"
      cancelLabel="Cancelar"
      width={520}
      bodyStyle={{ gridTemplateColumns: "1fr" }}
    >
      <div style={{ fontSize: 16 }}>
        Desea cambiar el estado de la carga e iniciar la carga?
      </div>
    </Modal>
  );
}

