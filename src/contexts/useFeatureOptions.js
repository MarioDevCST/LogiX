import { useContext } from "react";
import { FeatureOptionsContext } from "./featureOptionsContext.js";

export function useFeatureOptions() {
  const ctx = useContext(FeatureOptionsContext);
  if (!ctx) {
    return {
      featureOptions: { peticiones_enabled: true },
      loading: true,
    };
  }
  return ctx;
}

