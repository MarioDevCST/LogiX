import { useState } from "react";
import { Link } from "react-router-dom";

export default function Landing() {
  const [logoOk, setLogoOk] = useState(true);

  return (
    <div className="landing">
      <div className="landing-card">
        {logoOk ? (
          <img
            className="landing-logo-img"
            src="/logo.png"
            alt="LogiX"
            onError={() => setLogoOk(false)}
          />
        ) : (
          <div className="landing-logo-text">LogiX</div>
        )}
        <h1 className="landing-title">Gestión de reparto para tu logística</h1>
        <p className="landing-subtitle">
          Optimiza rutas, asigna pedidos y controla el estado de tus entregas
          con una interfaz clara y rápida.
        </p>
        <Link to="/login" className="primary-button">
          Entrar
        </Link>
      </div>
      <footer className="landing-footer">
        © {new Date().getFullYear()} LogiX
      </footer>
    </div>
  );
}
