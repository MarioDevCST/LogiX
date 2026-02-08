export default function Header({ onToggleSidebar }) {
  return (
    <header className="header">
      <button className="icon-button" onClick={onToggleSidebar} aria-label="Toggle sidebar">☰</button>
      <div className="header-title">LogiX</div>
      <div className="header-actions">
        <input className="search" placeholder="Buscar..." />
      </div>
    </header>
  )
}