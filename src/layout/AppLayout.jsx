import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import Header from "../components/Header.jsx";
import Sidebar from "../components/Sidebar.jsx";
import Breadcrumb from "../components/Breadcrumb.jsx";
import { firebaseLogout, logInteraction } from "../firebase/auth.js";
import {
  clearAuthState,
  getCurrentUser,
  readAuthState,
  writeAuthState,
} from "../utils/roles.js";

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const INACTIVITY_MS = 40 * 60 * 1000;
    const MAX_SESSION_MS = 9 * 60 * 60 * 1000;
    const CUTOFF_HOUR = 5;

    const pad2 = (n) => String(n).padStart(2, "0");
    const formatLocalDateKey = (date) =>
      `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(
        date.getDate()
      )}`;
    const getBusinessDayKey = (ts) => {
      const d = new Date(ts);
      if (Number.isFinite(CUTOFF_HOUR) && d.getHours() < CUTOFF_HOUR) {
        d.setDate(d.getDate() - 1);
      }
      return formatLocalDateKey(d);
    };

    let lastActivityWriteAt = 0;
    let logoutInProgress = false;

    const ensureSession = () => {
      const { user, session } = readAuthState();
      if (!user) return { user: null, session: null };
      const now = Date.now();
      const loginAt =
        session && Number.isFinite(session.loginAt) ? session.loginAt : now;
      const lastActivityAt =
        session && Number.isFinite(session.lastActivityAt)
          ? session.lastActivityAt
          : now;
      const dayKey =
        session && typeof session.dayKey === "string" && session.dayKey
          ? session.dayKey
          : getBusinessDayKey(loginAt);
      const normalized = { loginAt, lastActivityAt, dayKey };
      if (
        !session ||
        session.loginAt !== normalized.loginAt ||
        session.lastActivityAt !== normalized.lastActivityAt ||
        session.dayKey !== normalized.dayKey
      ) {
        writeAuthState({ user, session: normalized });
      }
      return { user, session: normalized };
    };

    const getExpiryReason = ({ session }) => {
      if (!session) return null;
      const now = Date.now();
      const currentDayKey = getBusinessDayKey(now);
      if (session.dayKey && session.dayKey !== currentDayKey)
        return "corte_diario";
      if (
        Number.isFinite(session.loginAt) &&
        now - session.loginAt > MAX_SESSION_MS
      )
        return "duracion_maxima";
      if (
        Number.isFinite(session.lastActivityAt) &&
        now - session.lastActivityAt > INACTIVITY_MS
      )
        return "inactividad";
      return null;
    };

    const forceLogout = async (reason) => {
      if (logoutInProgress) return;
      logoutInProgress = true;
      const { user } = readAuthState();
      if (user?.id || user?._id) {
        const actor = {
          id: user.id || user._id,
          name: user.name || "",
          email: user.email || "",
          role: user.role || "",
        };
        logInteraction({
          type: "user_logged_out",
          actor,
          target: {
            id: user.id || user._id,
            name: user.name || "",
            email: user.email || "",
          },
          details: { auto: true, reason: String(reason || "") },
        }).catch(() => {});
      }
      try {
        await firebaseLogout();
      } catch {
        void 0;
      }
      clearAuthState();
      navigate("/login", {
        replace: true,
        state: { reason: String(reason || "") },
      });
    };

    const check = () => {
      const { user, session } = ensureSession();
      if (!user) return;
      const reason = getExpiryReason({ session });
      if (reason) void forceLogout(reason);
    };

    const touchActivity = () => {
      if (logoutInProgress) return;
      const now = Date.now();
      if (now - lastActivityWriteAt < 10 * 1000) return;
      lastActivityWriteAt = now;
      const { user, session } = ensureSession();
      if (!user || !session) return;
      writeAuthState({
        user,
        session: { ...session, lastActivityAt: now },
      });
    };

    const onStorage = (e) => {
      if (e.key !== "auth") return;
      const { user } = readAuthState();
      if (!user) {
        navigate("/login", { replace: true });
        return;
      }
      check();
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") check();
    };

    check();
    const interval = setInterval(check, 30 * 1000);

    window.addEventListener("mousemove", touchActivity, { passive: true });
    window.addEventListener("mousedown", touchActivity, { passive: true });
    window.addEventListener("keydown", touchActivity);
    window.addEventListener("touchstart", touchActivity, { passive: true });
    window.addEventListener("scroll", touchActivity, { passive: true });
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      clearInterval(interval);
      window.removeEventListener("mousemove", touchActivity);
      window.removeEventListener("mousedown", touchActivity);
      window.removeEventListener("keydown", touchActivity);
      window.removeEventListener("touchstart", touchActivity);
      window.removeEventListener("scroll", touchActivity);
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [navigate]);

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
