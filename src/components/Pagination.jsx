export default function Pagination({ page, pageSize, total, onPageChange, onPageSizeChange }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);

  return (
    <div className="pagination">
      <div className="pagination-info">
        <span>Mostrando {start}–{end} de {total}</span>
      </div>
      <div className="pagination-controls">
        <label>
          Tamaño página
          <select value={pageSize} onChange={(e) => onPageSizeChange(Number(e.target.value))}>
            {[5, 10, 20, 50].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
        <button onClick={() => onPageChange(1)} disabled={page === 1}>{'<<'}</button>
        <button onClick={() => onPageChange(page - 1)} disabled={page === 1}>{'<'}</button>
        <span>Página {page} / {totalPages}</span>
        <button onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}>{'>'}</button>
        <button onClick={() => onPageChange(totalPages)} disabled={page >= totalPages}>{'>>'}</button>
      </div>
    </div>
  );
}