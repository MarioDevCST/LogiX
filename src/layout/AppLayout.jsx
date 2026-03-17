import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import Header from "../components/Header.jsx";
import Sidebar from "../components/Sidebar.jsx";
import Breadcrumb from "../components/Breadcrumb.jsx";
import { getCurrentUser } from "../utils/roles.js";

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const user = getCurrentUser();
    if (!user) {
      navigate("/login", { replace: true, state: { from: location.pathname } });
      return;
    }
    if (user.active === false) {
      navigate("/inactive", { replace: true });
    }
  }, [navigate, location.pathname]);

  return (
    <div className="app-root">
      <Header onToggleSidebar={() => setCollapsed((v) => !v)} />
      <div className="app-container">
        <Sidebar collapsed={collapsed} />
        <main className="main-content">
          <Breadcrumb />
          <Outlet />
        </main>
      </div>
    </div>
  );
}
