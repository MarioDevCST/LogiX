import { useEffect, useMemo, useState } from "react";
import { subscribeFeatureOptions } from "../firebase/auth.js";
import { FeatureOptionsContext } from "./featureOptionsContext.js";

export function FeatureOptionsProvider({ children }) {
  const [featureOptions, setFeatureOptions] = useState({
    peticiones_enabled: true,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let first = true;
    let unsubscribe = null;
    try {
      unsubscribe = subscribeFeatureOptions((opts) => {
        setFeatureOptions(opts || { peticiones_enabled: true });
        if (first) {
          first = false;
          setLoading(false);
        }
      });
    } catch {
      setFeatureOptions({ peticiones_enabled: true });
      setLoading(false);
    }
    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, []);

  const value = useMemo(
    () => ({
      featureOptions,
      loading,
    }),
    [featureOptions, loading],
  );

  return (
    <FeatureOptionsContext.Provider value={value}>
      {children}
    </FeatureOptionsContext.Provider>
  );
}
