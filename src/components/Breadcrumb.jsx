import { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  fetchCompanyById,
  fetchConsigneeById,
  fetchLoadById,
  fetchLocationById,
  fetchMessageById,
  fetchPalletById,
  fetchShipById,
  fetchUserById,
} from "../firebase/auth.js";

const titleMap = {
  app: "Dashboard",
  admin: "Administración",
  usuarios: "Usuarios",
  colecciones: "Colecciones",
  consignatarios: "Consignatarios",
  barcos: "Barcos",
  empresas: "Empresas",
  localizaciones: "Localizaciones",
  mensajes: "Mensajes",
  interacciones: "Interacciones",
  logistica: "Logística",
  cargas: "Cargas",
  "carga-palets": "Carga de Palets",
  palets: "Palets",
};

const detailResolvers = {
  usuarios: {
    fetch: fetchUserById,
    label: (u) => u?.name || u?.email || u?.id || "",
  },
  barcos: {
    fetch: fetchShipById,
    label: (s) => s?.nombre_del_barco || s?.id || "",
  },
  mensajes: {
    fetch: fetchMessageById,
    label: (m) => m?.titulo || m?.id || "",
  },
  localizaciones: {
    fetch: fetchLocationById,
    label: (l) => l?.nombre || l?.id || "",
  },
  empresas: {
    fetch: fetchCompanyById,
    label: (c) => c?.nombre || c?.id || "",
  },
  consignatarios: {
    fetch: fetchConsigneeById,
    label: (c) => c?.nombre || c?.id || "",
  },
  cargas: {
    fetch: fetchLoadById,
    label: (l) =>
      l?.nombre ||
      (Array.isArray(l?.entrega) ? l.entrega.filter(Boolean).join(", ") : "") ||
      l?.id ||
      "",
  },
  palets: {
    fetch: fetchPalletById,
    label: (p) => p?.nombre || p?.numero_palet || p?.id || "",
  },
};

export default function Breadcrumb() {
  const { pathname } = useLocation();
  const segments = useMemo(
    () => pathname.split("/").filter(Boolean),
    [pathname]
  );
  const [labelByPath, setLabelByPath] = useState({});

  const currentResolver = useMemo(() => {
    const last = segments[segments.length - 1];
    const prev = segments[segments.length - 2];
    if (!last || !prev) return null;
    if (titleMap[last]) return null;
    const resolver = detailResolvers[prev];
    return resolver ? { resolver, id: last } : null;
  }, [segments]);

  useEffect(() => {
    let mounted = true;
    if (!currentResolver)
      return () => {
        mounted = false;
      };
    if (labelByPath[pathname])
      return () => {
        mounted = false;
      };

    const run = async () => {
      try {
        const entity = await currentResolver.resolver.fetch(currentResolver.id);
        if (!mounted) return;
        const label = currentResolver.resolver.label(entity);
        setLabelByPath((prev) => ({
          ...prev,
          [pathname]: String(label || "").trim(),
        }));
      } catch {
        if (!mounted) return;
        setLabelByPath((prev) => ({ ...prev, [pathname]: "" }));
      }
    };

    run();
    return () => {
      mounted = false;
    };
  }, [currentResolver, pathname, labelByPath]);

  const resolvedCurrentLabel = labelByPath[pathname] || "";

  // Construye rutas acumulativas para cada segmento
  const crumbs = segments.map((seg, idx) => {
    const to = "/" + segments.slice(0, idx + 1).join("/");
    const isLast = idx === segments.length - 1;
    const base = titleMap[seg] || seg;
    if (!isLast) return { label: base, to };
    if (!currentResolver) return { label: base, to };
    return { label: resolvedCurrentLabel || "...", to };
  });

  if (segments.length <= 1) return null; // Oculta en landing o raíz

  return (
    <nav className="breadcrumb" aria-label="Breadcrumb">
      <ol className="breadcrumb-list">
        <li className="breadcrumb-item">
          <NavLink to="/app" className="breadcrumb-link">
            Inicio
          </NavLink>
        </li>
        {crumbs.slice(1).map((c, i) => (
          <li key={i} className="breadcrumb-item">
            <span className="breadcrumb-sep">/</span>
            {i < crumbs.slice(1).length - 1 ? (
              <NavLink to={c.to} className="breadcrumb-link">
                {c.label}
              </NavLink>
            ) : (
              <span className="breadcrumb-current">{c.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
