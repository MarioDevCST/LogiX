import "./client.js";
import { connectFirestoreEmulator } from "firebase/firestore";
import { firebaseDb } from "./auth.js";

const useFirestoreEmulator =
  import.meta.env.DEV &&
  String(import.meta.env.VITE_USE_FIRESTORE_EMULATOR || "")
    .trim()
    .toLowerCase() === "true";

if (useFirestoreEmulator && firebaseDb) {
  const key = "__logix_firestore_emulator_connected__";
  if (!globalThis[key]) {
    globalThis[key] = true;
    connectFirestoreEmulator(firebaseDb, "127.0.0.1", 8080);
  }
}
