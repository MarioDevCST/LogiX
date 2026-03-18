export default function EnvBadge({ className = "" }) {
  const stageRaw =
    import.meta.env.VITE_APP_STAGE || (import.meta.env.MODE || "").toUpperCase();
  const stage = String(stageRaw || "").toUpperCase();
  const isDev = !!import.meta.env.DEV || stage === "DEV" || stage === "DEVELOPMENT";

  if (!isDev) return null;

  return (
    <div className={`env-badge${className ? ` ${className}` : ""}`}>
      Developer
    </div>
  );
}
