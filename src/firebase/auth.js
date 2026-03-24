import {
  browserLocalPersistence,
  inMemoryPersistence,
  getAuth,
  setPersistence,
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import { getApps, initializeApp } from "firebase/app";
import {
  collection,
  addDoc,
  doc,
  deleteDoc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { firebaseApp } from "./client.js";

export const firebaseAuth = firebaseApp ? getAuth(firebaseApp) : null;
export const firebaseDb = firebaseApp ? getFirestore(firebaseApp) : null;

if (firebaseAuth) {
  setPersistence(firebaseAuth, browserLocalPersistence).catch(() => {});
}

function getSecondaryAuth() {
  if (!firebaseApp) throw new Error("Firebase no está configurado");
  const name = "logix-user-creator";
  const existing = getApps().find((a) => a.name === name);
  const secondaryApp = existing || initializeApp(firebaseApp.options, name);
  const auth = getAuth(secondaryApp);
  setPersistence(auth, inMemoryPersistence).catch(() => {});
  return auth;
}

function generateRandomPassword() {
  try {
    const bytes = new Uint8Array(24);
    globalThis.crypto?.getRandomValues?.(bytes);
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  }
}

async function ensureUserDocument({ uid, email, name, role, active }) {
  if (!firebaseDb) throw new Error("Firestore no está configurado");
  const ref = doc(firebaseDb, "user", uid);
  const existing = await withTimeout(getDoc(ref), 5000);
  const isNew = !existing.exists();
  const existingActive = existing.exists()
    ? existing.data()?.active
    : undefined;
  const resolvedActive =
    typeof active === "boolean"
      ? active
      : typeof existingActive === "boolean"
      ? existingActive
      : false;
  const resolvedRole = role || existing.data()?.role || "dispatcher";

  await withTimeout(
    setDoc(
      ref,
      {
        id: uid,
        name: name || "",
        email: email || "",
        role: resolvedRole,
        active: resolvedActive,
        ...(isNew ? { createdAt: serverTimestamp() } : {}),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    ),
    5000
  );
}

async function withTimeout(promise, ms) {
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => {
      const err = new Error("Firestore timeout");
      err.code = "firestore/timeout";
      reject(err);
    }, ms);
  });
  return Promise.race([promise, timeoutPromise]);
}

function getActorFromLocalStorage() {
  try {
    if (typeof localStorage === "undefined") return null;
    const parsed = JSON.parse(localStorage.getItem("auth") || "{}");
    const u = parsed?.user;
    if (!u) return null;
    return {
      id: u.id || u._id || null,
      name: u.name || "",
      email: u.email || "",
      role: u.role || "",
    };
  } catch {
    return null;
  }
}

export async function logInteraction({ type, actor, target, details }) {
  if (!firebaseDb) throw new Error("Firestore no está configurado");
  const resolvedActor = actor || getActorFromLocalStorage();
  const payload = {
    type: String(type || "").trim(),
    actor: resolvedActor || null,
    target: target || null,
    details: details || null,
    createdAt: serverTimestamp(),
  };
  if (!payload.type) return;
  await addDoc(collection(firebaseDb, "interactions"), payload);
}

export async function firebaseLogin(email, password) {
  if (!firebaseAuth) throw new Error("Firebase no está configurado");
  const cred = await signInWithEmailAndPassword(firebaseAuth, email, password);
  return cred.user;
}

export async function firebaseRegister({ email, password, name }) {
  if (!firebaseAuth) throw new Error("Firebase no está configurado");
  const cred = await createUserWithEmailAndPassword(
    firebaseAuth,
    email,
    password
  );
  if (name) {
    await updateProfile(cred.user, { displayName: name });
  }
  await withTimeout(
    ensureUserDocument({
      uid: cred.user.uid,
      email: cred.user.email || email,
      name: cred.user.displayName || name,
    }),
    3000
  ).catch(() => {});
  return cred.user;
}

export async function firebaseLogout() {
  if (!firebaseAuth) return;
  await signOut(firebaseAuth);
}

export async function getOrCreateUserProfile({ uid, email, name }) {
  if (!firebaseDb) throw new Error("Firestore no está configurado");
  const ref = doc(firebaseDb, "user", uid);
  const snap = await withTimeout(getDoc(ref), 5000);
  if (!snap.exists()) {
    await withTimeout(ensureUserDocument({ uid, email, name }), 5000);
    const snap2 = await withTimeout(getDoc(ref), 5000);
    const data = snap2.data() || {};
    return {
      id: uid,
      name: data.name || name || "",
      email: data.email || email || "",
      role: data.role || "dispatcher",
      active: typeof data.active === "boolean" ? data.active : false,
    };
  }
  const data = snap.data() || {};
  return {
    id: uid,
    name: data.name || name || "",
    email: data.email || email || "",
    role: data.role || "dispatcher",
    active: typeof data.active === "boolean" ? data.active : false,
  };
}

export async function fetchAllUsers() {
  if (!firebaseDb) throw new Error("Firestore no está configurado");
  const snap = await getDocs(collection(firebaseDb, "user"));
  const list = [];
  snap.forEach((d) => {
    const data = d.data() || {};
    list.push({
      id: data.id || d.id,
      name: data.name || "",
      email: data.email || "",
      role: data.role || "dispatcher",
      active: typeof data.active === "boolean" ? data.active : false,
      createdAt: data.createdAt || null,
      updatedAt: data.updatedAt || null,
    });
  });
  return list;
}

export async function fetchUserById(id) {
  if (!firebaseDb) throw new Error("Firestore no está configurado");
  const ref = doc(firebaseDb, "user", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data() || {};
  return {
    id: data.id || id,
    name: data.name || "",
    email: data.email || "",
    role: data.role || "dispatcher",
    active: typeof data.active === "boolean" ? data.active : false,
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || null,
  };
}

export async function updateUserById(id, updates) {
  if (!firebaseDb) throw new Error("Firestore no está configurado");
  const ref = doc(firebaseDb, "user", id);
  await updateDoc(ref, { ...updates, updatedAt: serverTimestamp() });
  const updated = await fetchUserById(id);
  if (updated) {
    withTimeout(
      logInteraction({
        type: "user_updated",
        target: {
          id: updated.id,
          name: updated.name || "",
          email: updated.email || "",
        },
        details: { updates: updates || {} },
      }),
      1500
    ).catch(() => {});
  }
  return updated;
}

export async function deleteUserById(id) {
  if (!firebaseDb) throw new Error("Firestore no está configurado");
  const current = await fetchUserById(id).catch(() => null);
  const ref = doc(firebaseDb, "user", String(id));
  await deleteDoc(ref);
  if (current) {
    queueInteraction({
      type: "user_deleted",
      target: {
        id: current.id,
        name: current.name || "",
        email: current.email || "",
      },
      details: { entity: "user" },
    });
  }
  return { ok: true };
}

export async function createUser(payload) {
  if (!firebaseDb) throw new Error("Firestore no está configurado");
  const name = String(payload?.name || "").trim();
  const email = String(payload?.email || "")
    .trim()
    .toLowerCase();
  const role = String(payload?.role || "").trim();
  const active =
    typeof payload?.active === "boolean" ? payload.active : undefined;

  if (!name) throw new Error("name es obligatorio");
  if (!email) throw new Error("email es obligatorio");
  if (!role) throw new Error("role es obligatorio");

  const rawPassword = String(payload?.password || "").trim();
  const password =
    rawPassword || (role === "consignee" ? generateRandomPassword() : "");
  if (!password) throw new Error("password es obligatorio");

  const secondaryAuth = getSecondaryAuth();
  const cred = await createUserWithEmailAndPassword(
    secondaryAuth,
    email,
    password
  );
  if (name) {
    await updateProfile(cred.user, { displayName: name });
  }
  await ensureUserDocument({
    uid: cred.user.uid,
    email: cred.user.email || email,
    name: cred.user.displayName || name,
    role,
    active,
  });
  await signOut(secondaryAuth).catch(() => {});

  const created = await fetchUserById(cred.user.uid);
  if (created) {
    queueInteraction({
      type: "user_created",
      target: {
        id: created.id,
        name: created.name || "",
        email: created.email || "",
      },
      details: { active: created.active, role: created.role || "" },
    });
  }
  return created;
}

export async function fetchInteractions({ limitCount = 200 } = {}) {
  if (!firebaseDb) throw new Error("Firestore no está configurado");
  const snap = await getDocs(
    query(
      collection(firebaseDb, "interactions"),
      orderBy("createdAt", "desc"),
      limit(Math.max(1, Number(limitCount) || 200))
    )
  );
  const list = [];
  snap.forEach((d) => {
    const data = d.data() || {};
    list.push({
      id: d.id,
      type: data.type || "",
      actor: data.actor || null,
      target: data.target || null,
      details: data.details || null,
      createdAt: data.createdAt || null,
    });
  });
  return list;
}

function getLoadLabelFromPayload(payload) {
  const name = String(payload?.carga_nombre || payload?.cargaName || "").trim();
  return name;
}

function isoDateOnly(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export async function fetchAllLoads() {
  const docs = await getAllDocsOrdered({
    collectionName: "loads",
    orderField: "fecha_creacion",
  });
  return docs.map(({ docId, data }) => ({
    ...mapCommonAudit(data, docId),
    nombre: data.nombre || "",
    fecha_de_carga: data.fecha_de_carga || "",
    hora_de_carga: data.hora_de_carga || "",
    fecha_de_descarga: data.fecha_de_descarga || "",
    hora_de_descarga: data.hora_de_descarga || "",
    barco: data.barco || "",
    entrega: Array.isArray(data.entrega) ? data.entrega : [],
    chofer: data.chofer || "",
    responsable: data.responsable || "",
    palets: Array.isArray(data.palets) ? data.palets : [],
    carga: Array.isArray(data.carga) ? data.carga : [],
    consignatario: data.consignatario || "",
    terminal_entrega: data.terminal_entrega || "",
    cash: !!data.cash,
    lancha: !!data.lancha,
    estado_viaje: data.estado_viaje || "Preparando",
  }));
}

export async function fetchLoadById(id) {
  if (!firebaseDb) throw new Error("Firestore no está configurado");
  const ref = doc(firebaseDb, "loads", String(id));
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data() || {};
  return {
    ...mapCommonAudit(data, snap.id),
    nombre: data.nombre || "",
    fecha_de_carga: data.fecha_de_carga || "",
    hora_de_carga: data.hora_de_carga || "",
    fecha_de_descarga: data.fecha_de_descarga || "",
    hora_de_descarga: data.hora_de_descarga || "",
    barco: data.barco || "",
    entrega: Array.isArray(data.entrega) ? data.entrega : [],
    chofer: data.chofer || "",
    responsable: data.responsable || "",
    palets: Array.isArray(data.palets) ? data.palets : [],
    carga: Array.isArray(data.carga) ? data.carga : [],
    consignatario: data.consignatario || "",
    terminal_entrega: data.terminal_entrega || "",
    cash: !!data.cash,
    lancha: !!data.lancha,
    estado_viaje: data.estado_viaje || "Preparando",
  };
}

export async function createLoad(payload) {
  if (!firebaseDb) throw new Error("Firestore no está configurado");
  const barco = String(payload?.barco || "").trim();
  const fecha_de_carga = String(payload?.fecha_de_carga || "").trim();
  if (!barco) throw new Error("barco es obligatorio");
  if (!fecha_de_carga) throw new Error("fecha_de_carga es obligatoria");

  const entrega = Array.isArray(payload?.entrega)
    ? payload.entrega.map((v) => String(v)).filter(Boolean)
    : [];
  const carga = Array.isArray(payload?.carga)
    ? payload.carga.map((v) => String(v)).filter(Boolean)
    : [];
  const palets = Array.isArray(payload?.palets)
    ? payload.palets.map((v) => String(v)).filter(Boolean)
    : [];

  const ship = await fetchShipById(barco).catch(() => null);
  const nombre =
    ship?.nombre_del_barco && fecha_de_carga
      ? `${ship.nombre_del_barco} - ${isoDateOnly(fecha_de_carga)}`
      : "";

  const ref = doc(collection(firebaseDb, "loads"));
  const id = ref.id;
  await setDoc(ref, {
    id,
    nombre,
    fecha_de_carga,
    hora_de_carga: String(payload?.hora_de_carga || ""),
    fecha_de_descarga: String(payload?.fecha_de_descarga || ""),
    hora_de_descarga: String(payload?.hora_de_descarga || ""),
    barco,
    entrega,
    chofer: String(payload?.chofer || ""),
    responsable: String(payload?.responsable || ""),
    palets,
    carga,
    consignatario: String(payload?.consignatario || ""),
    terminal_entrega: String(payload?.terminal_entrega || ""),
    cash: !!payload?.cash,
    lancha: !!payload?.lancha,
    estado_viaje: String(payload?.estado_viaje || "Preparando"),
    creado_por: String(payload?.creado_por || "Testing"),
    modificado_por: "",
    fecha_creacion: serverTimestamp(),
    fecha_modificacion: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const created = await fetchLoadById(id);
  if (created && Array.isArray(created.palets) && created.palets.length > 0) {
    const cargaNombre = created.nombre || "";
    await Promise.all(
      created.palets.map((pid) =>
        updatePalletById(pid, {
          carga: created.id,
          carga_nombre: cargaNombre,
        }).catch(() => null)
      )
    );
  }
  if (created) {
    await withTimeout(
      logInteraction({
        type: "load_created",
        target: { id: created.id, name: created.nombre || "" },
        details: {
          entity: "load",
          snapshot: {
            nombre: created.nombre || "",
            barco: created.barco || "",
            fecha_de_carga: created.fecha_de_carga || "",
            estado_viaje: created.estado_viaje || "",
          },
        },
      }),
      5000
    ).catch(() => {});
  }
  return created;
}

export async function updateLoadById(id, updates) {
  if (!firebaseDb) throw new Error("Firestore no está configurado");
  const ref = doc(firebaseDb, "loads", String(id));
  const current = await fetchLoadById(id);
  if (!current) return null;

  const modificado_por = String(updates?.modificado_por || "").trim();
  if (!modificado_por) throw new Error("modificado_por es obligatorio");

  const nextBarco =
    typeof updates?.barco !== "undefined"
      ? String(updates.barco || "")
      : current.barco;
  const nextFecha =
    typeof updates?.fecha_de_carga !== "undefined"
      ? String(updates.fecha_de_carga || "")
      : current.fecha_de_carga;

  let nombre = current.nombre || "";
  if (nextBarco && nextFecha) {
    const ship = await fetchShipById(nextBarco).catch(() => null);
    if (ship?.nombre_del_barco) {
      nombre = `${ship.nombre_del_barco} - ${isoDateOnly(nextFecha)}`;
    }
  }

  const patch = {
    ...updates,
    nombre,
    modificado_por,
    fecha_modificacion: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (Array.isArray(updates?.entrega)) patch.entrega = updates.entrega;
  if (Array.isArray(updates?.carga)) patch.carga = updates.carga;
  if (Array.isArray(updates?.palets)) patch.palets = updates.palets;

  const cleanedPatch = Object.fromEntries(
    Object.entries(patch).filter(([, v]) => typeof v !== "undefined")
  );
  await updateDoc(ref, cleanedPatch);

  const updated = await fetchLoadById(id);
  if (updated) {
    const didUpdatePalets = Array.isArray(updates?.palets);
    const nameChanged =
      String(updated.nombre || "") !== String(current.nombre || "");
    if (didUpdatePalets || nameChanged) {
      const prevIds = Array.isArray(current.palets)
        ? current.palets.map((v) => String(v)).filter(Boolean)
        : [];
      const nextIds = Array.isArray(updated.palets)
        ? updated.palets.map((v) => String(v)).filter(Boolean)
        : prevIds;

      const prevSet = new Set(prevIds);
      const nextSet = new Set(nextIds);
      const added = nextIds.filter((v) => !prevSet.has(String(v)));
      const removed = prevIds.filter((v) => !nextSet.has(String(v)));

      const cargaNombre = updated.nombre || "";
      const tasks = [];

      if (nameChanged) {
        nextIds.forEach((pid) => {
          tasks.push(
            updatePalletById(pid, {
              carga: updated.id,
              carga_nombre: cargaNombre,
            }).catch(() => null)
          );
        });
      } else {
        added.forEach((pid) => {
          tasks.push(
            updatePalletById(pid, {
              carga: updated.id,
              carga_nombre: cargaNombre,
            }).catch(() => null)
          );
        });
      }
      removed.forEach((pid) => {
        tasks.push(
          updatePalletById(pid, { carga: "", carga_nombre: "" }).catch(
            () => null
          )
        );
      });

      if (tasks.length > 0) await Promise.all(tasks);
    }
  }
  if (updated) {
    await withTimeout(
      logInteraction({
        type: "load_updated",
        target: { id: updated.id, name: updated.nombre || "" },
        details: { entity: "load", updates: updates || {} },
      }),
      5000
    ).catch(() => {});
  }
  return updated;
}

export async function deleteLoadById(id) {
  if (!firebaseDb) throw new Error("Firestore no está configurado");
  const current = await fetchLoadById(id).catch(() => null);
  const ref = doc(firebaseDb, "loads", String(id));
  await deleteDoc(ref);
  if (current && Array.isArray(current.palets) && current.palets.length > 0) {
    await Promise.all(
      current.palets.map((pid) =>
        updatePalletById(pid, { carga: "", carga_nombre: "" }).catch(() => null)
      )
    );
  }
  if (current) {
    await withTimeout(
      logInteraction({
        type: "load_deleted",
        target: { id: current.id, name: current.nombre || "" },
        details: { entity: "load" },
      }),
      5000
    ).catch(() => {});
  }
  return { ok: true };
}

export async function fetchAllPallets() {
  if (!firebaseDb) throw new Error("Firestore no está configurado");
  let snap;
  try {
    snap = await getDocs(
      query(
        collection(firebaseDb, "pallets"),
        orderBy("fecha_creacion", "desc")
      )
    );
  } catch {
    snap = await getDocs(collection(firebaseDb, "pallets"));
  }
  const list = [];
  snap.forEach((d) => {
    const data = d.data() || {};
    const id = data.id || d.id;
    list.push({
      _id: id,
      id,
      numero_palet: data.numero_palet || "",
      nombre: data.nombre || "",
      tipo: data.tipo || "Seco",
      base: data.base || "Europeo",
      estado: typeof data.estado === "boolean" ? data.estado : false,
      carga: data.carga || "",
      carga_nombre: data.carga_nombre || "",
      productos: data.productos || "",
      creado_por: data.creado_por || "",
      modificado_por: data.modificado_por || "",
      fecha_creacion: data.fecha_creacion || null,
      fecha_modificacion: data.fecha_modificacion || null,
      createdAt: data.createdAt || data.fecha_creacion || null,
      updatedAt: data.updatedAt || data.fecha_modificacion || null,
      contenedor: data.contenedor || "",
    });
  });
  return list;
}

export async function fetchPalletById(id) {
  if (!firebaseDb) throw new Error("Firestore no está configurado");
  const ref = doc(firebaseDb, "pallets", String(id));
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data() || {};
  const resolvedId = data.id || snap.id;
  return {
    _id: resolvedId,
    id: resolvedId,
    numero_palet: data.numero_palet || "",
    nombre: data.nombre || "",
    tipo: data.tipo || "Seco",
    base: data.base || "Europeo",
    estado: typeof data.estado === "boolean" ? data.estado : false,
    carga: data.carga || "",
    carga_nombre: data.carga_nombre || "",
    productos: data.productos || "",
    creado_por: data.creado_por || "",
    modificado_por: data.modificado_por || "",
    fecha_creacion: data.fecha_creacion || null,
    fecha_modificacion: data.fecha_modificacion || null,
    createdAt: data.createdAt || data.fecha_creacion || null,
    updatedAt: data.updatedAt || data.fecha_modificacion || null,
    contenedor: data.contenedor || "",
  };
}

export async function createPallet(payload) {
  if (!firebaseDb) throw new Error("Firestore no está configurado");
  const numero_palet = String(payload?.numero_palet || "").trim();
  const tipo = String(payload?.tipo || "").trim();
  const carga = String(payload?.carga || "").trim();
  if (!numero_palet) throw new Error("numero_palet es obligatorio");
  if (!tipo) throw new Error("tipo es obligatorio");

  const ref = doc(collection(firebaseDb, "pallets"));
  const id = ref.id;
  const cargaLabel = getLoadLabelFromPayload(payload);
  const nombre = `${numero_palet} - ${cargaLabel || "Sin carga"}`;
  const base = payload?.base ? String(payload.base) : "Europeo";
  const estado = typeof payload?.estado === "boolean" ? payload.estado : false;

  await setDoc(ref, {
    id,
    numero_palet,
    tipo,
    base,
    estado,
    carga: carga || "",
    carga_nombre: cargaLabel || "",
    nombre,
    productos: String(payload?.productos || ""),
    contenedor: String(payload?.contenedor || ""),
    creado_por: String(payload?.creado_por || "Testing"),
    modificado_por: "",
    fecha_creacion: serverTimestamp(),
    fecha_modificacion: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const created = await fetchPalletById(id);
  if (created) {
    queueInteraction({
      type: "pallet_created",
      target: { id: created.id, name: created.nombre || "" },
      details: {
        entity: "pallet",
        snapshot: {
          numero_palet: created.numero_palet || "",
          tipo: created.tipo || "",
          base: created.base || "",
          carga: created.carga || "",
          carga_nombre: created.carga_nombre || "",
        },
      },
    });
  }
  return created;
}

export async function updatePalletById(id, updates) {
  if (!firebaseDb) throw new Error("Firestore no está configurado");
  const ref = doc(firebaseDb, "pallets", String(id));
  const current = await fetchPalletById(id);
  if (!current) return null;

  const nextNumero =
    typeof updates?.numero_palet !== "undefined"
      ? String(updates.numero_palet || "").trim()
      : current.numero_palet;
  const nextCargaNombre =
    typeof updates?.carga_nombre !== "undefined"
      ? String(updates.carga_nombre || "").trim()
      : current.carga_nombre;
  const shouldUpdateNombre =
    typeof updates?.numero_palet !== "undefined" ||
    typeof updates?.carga_nombre !== "undefined";

  const patch = {
    ...updates,
    ...(typeof updates?.estado !== "undefined"
      ? {
          estado:
            typeof updates.estado === "boolean"
              ? updates.estado
              : !!updates.estado,
        }
      : {}),
    ...(shouldUpdateNombre
      ? { nombre: `${nextNumero} - ${nextCargaNombre || "Sin carga"}` }
      : {}),
    fecha_modificacion: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await updateDoc(ref, patch);
  const updated = await fetchPalletById(id);
  if (updated) {
    queueInteraction({
      type: "pallet_updated",
      target: { id: updated.id, name: updated.nombre || "" },
      details: { entity: "pallet", updates: updates || {} },
    });
  }
  return updated;
}

function mergeProductosText(texts) {
  const lines = [];
  for (const t of texts) {
    const raw = String(t || "");
    const split = raw.split(/\r?\n/);
    for (const s of split) {
      const trimmed = s.trim();
      if (trimmed) lines.push(trimmed);
    }
  }
  const seen = new Set();
  const out = [];
  for (const l of lines) {
    if (seen.has(l)) continue;
    seen.add(l);
    out.push(l);
  }
  return out.join("\n");
}

function splitNumeroParts(value) {
  const raw = String(value || "").trim();
  if (!raw) return [];
  return raw
    .split(/\s*\+\s*/g)
    .map((v) => v.trim())
    .filter(Boolean);
}

function sortNumeroParts(parts) {
  const isAllNumeric = parts.every((p) => /^\d+$/.test(p));
  if (isAllNumeric) return [...parts].sort((a, b) => Number(a) - Number(b));
  return [...parts].sort((a, b) =>
    a.localeCompare(b, "es", { numeric: true, sensitivity: "base" })
  );
}

export async function fusePallets({
  mode,
  targetPalletId,
  sourcePalletIds,
  sourcePalletNumbers,
  baseChoice,
  modificado_por,
} = {}) {
  if (!firebaseDb) throw new Error("Firestore no está configurado");
  const resolvedModificadoPor = String(modificado_por || "").trim();
  if (!resolvedModificadoPor) throw new Error("modificado_por es obligatorio");
  const targetId = String(targetPalletId || "").trim();
  if (!targetId) throw new Error("targetPalletId es obligatorio");

  const target = await fetchPalletById(targetId);
  if (!target) throw new Error("Palet destino no encontrado");
  if (!target.carga) throw new Error("El palet destino no tiene carga");

  const all = await fetchAllPallets();
  let sources = [];

  if (mode === "ids") {
    const ids = Array.isArray(sourcePalletIds) ? sourcePalletIds : [];
    const unique = Array.from(
      new Set(ids.map((v) => String(v || "").trim()).filter(Boolean))
    ).filter((v) => v !== String(target._id || target.id));
    if (unique.length === 0) throw new Error("Debe indicar palets origen");

    const byId = new Map(
      all.map((p) => [String(p._id || p.id || ""), p]).filter((p) => p[0])
    );
    const missing = unique.filter((v) => !byId.has(String(v)));
    if (missing.length > 0) {
      const e = new Error("Hay palets origen que no existen");
      e.missing = missing;
      throw e;
    }
    sources = unique.map((v) => byId.get(String(v)));
  } else if (mode === "numbers") {
    const nums = Array.isArray(sourcePalletNumbers) ? sourcePalletNumbers : [];
    const normalized = Array.from(
      new Set(nums.map((v) => String(v || "").trim()).filter(Boolean))
    ).filter((n) => n !== String(target.numero_palet));
    if (normalized.length === 0)
      throw new Error("Debe indicar números de palet a fusionar");

    sources = all.filter(
      (p) =>
        String(p.carga || "") === String(target.carga || "") &&
        normalized.includes(String(p.numero_palet || "")) &&
        String(p._id || p.id) !== String(target._id || target.id)
    );
    const foundNums = new Set(sources.map((p) => String(p.numero_palet || "")));
    const missing = normalized.filter((n) => !foundNums.has(String(n)));
    if (missing.length > 0) {
      const e = new Error("No se encontraron algunos números de palet");
      e.missing = missing;
      throw e;
    }
  } else {
    throw new Error("mode inválido");
  }

  const targetCarga = String(target.carga || "");
  const invalid = sources.find((p) => String(p.carga || "") !== targetCarga);
  if (invalid)
    throw new Error("Todos los palets deben pertenecer a la misma carga");

  const targetTipo = String(target.tipo || "");
  const differentTipo = sources.filter(
    (p) => String(p.tipo || "") !== targetTipo
  );
  if (differentTipo.length > 0)
    throw new Error("Solo se pueden fusionar palets del mismo tipo");

  const sourceIds = sources.map((p) => String(p._id || p.id));

  const normalizeBase = (value) => {
    const raw = String(value || "").trim();
    if (!raw) return "";
    const lower = raw.toLowerCase();
    if (lower === "europeo") return "Europeo";
    if (lower === "americano") return "Americano";
    return raw;
  };
  const baseCandidates = Array.from(
    new Set(
      [normalizeBase(target.base), ...sources.map((p) => normalizeBase(p.base))]
        .map((v) => String(v || "").trim())
        .filter(Boolean)
    )
  );
  const baseChoiceNormalized = normalizeBase(baseChoice);
  const mergedBase = (() => {
    if (baseCandidates.length <= 1)
      return baseCandidates[0] || normalizeBase(target.base);
    if (!baseChoiceNormalized)
      throw new Error(
        `Debes elegir base (${baseCandidates.join(" o ")}) para fusionar`
      );
    const ok = baseCandidates.some(
      (b) =>
        String(b).toLowerCase() === String(baseChoiceNormalized).toLowerCase()
    );
    if (!ok)
      throw new Error(
        `La base elegida debe ser una de: ${baseCandidates.join(", ")}`
      );
    return baseCandidates.find(
      (b) =>
        String(b).toLowerCase() === String(baseChoiceNormalized).toLowerCase()
    );
  })();

  const productosMerged = mergeProductosText([
    target.productos,
    ...sources.map((p) => p.productos),
  ]);

  const mergedNumeroParts = sortNumeroParts(
    Array.from(
      new Set(
        [
          ...splitNumeroParts(target.numero_palet),
          ...sources.flatMap((p) => splitNumeroParts(p.numero_palet)),
        ]
          .map((v) => String(v).trim())
          .filter(Boolean)
      )
    )
  );
  const numeroMerged = mergedNumeroParts.join("+");

  const loadRef = doc(firebaseDb, "loads", String(targetCarga));
  const loadSnap = await getDoc(loadRef);
  if (!loadSnap.exists()) throw new Error("Carga no encontrada");
  const loadData = loadSnap.data() || {};
  const loadLabel =
    String(loadData?.nombre || "").trim() ||
    String(target.carga_nombre || "").trim() ||
    "Sin carga";
  const numeroFinal = numeroMerged || target.numero_palet;
  const nombreFinal = `${numeroFinal} - ${loadLabel}`;

  await updateDoc(doc(firebaseDb, "pallets", String(targetId)), {
    productos: productosMerged,
    nombre: nombreFinal,
    numero_palet: numeroFinal,
    carga: String(targetCarga || ""),
    carga_nombre: loadLabel === "Sin carga" ? "" : loadLabel,
    ...(mergedBase ? { base: mergedBase } : {}),
    modificado_por: resolvedModificadoPor,
    fecha_modificacion: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const current = Array.isArray(loadData.palets) ? loadData.palets : [];
  const idsToRemove = new Set(sourceIds.map((v) => String(v)));
  const next = current.filter((pid) => !idsToRemove.has(String(pid)));
  if (!next.some((pid) => String(pid) === String(targetId)))
    next.push(targetId);

  await updateDoc(loadRef, {
    palets: next,
    modificado_por: resolvedModificadoPor,
    fecha_modificacion: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await Promise.all(
    sourceIds.map((sid) => deleteDoc(doc(firebaseDb, "pallets", String(sid))))
  );

  const updatedTarget = await fetchPalletById(targetId);
  queueInteraction({
    type: "pallets_fused",
    target: {
      id: targetId,
      name: updatedTarget?.nombre || target.nombre || "",
    },
    details: {
      entity: "pallet",
      mode: String(mode || ""),
      sourceIds,
      deletedIds: sourceIds,
      baseChoice: baseChoice || "",
      carga: targetCarga,
    },
  });
  return {
    ok: true,
    target: updatedTarget,
    deletedIds: sourceIds,
  };
}

export async function deletePalletById(id) {
  if (!firebaseDb) throw new Error("Firestore no está configurado");
  const current = await fetchPalletById(id).catch(() => null);
  const ref = doc(firebaseDb, "pallets", String(id));
  // Si el palet pertenece a una carga, eliminar la referencia residual en la carga
  if (current && current.carga) {
    try {
      const loadRef = doc(firebaseDb, "loads", String(current.carga));
      const loadSnap = await getDoc(loadRef);
      if (loadSnap.exists()) {
        const loadData = loadSnap.data() || {};
        const paletsArray = Array.isArray(loadData.palets)
          ? loadData.palets
          : [];
        const next = paletsArray.filter(
          (pid) =>
            String(pid) !== String(id) &&
            String(pid?._id || pid?.id || pid) !== String(id)
        );
        if (next.length !== paletsArray.length) {
          await updateDoc(loadRef, {
            palets: next,
            fecha_modificacion: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      }
    } catch {
      // silencioso: si falla la limpieza, continuamos con el borrado
    }
  }
  await deleteDoc(ref);
  if (current) {
    queueInteraction({
      type: "pallet_deleted",
      target: {
        id: current.id,
        name: current.nombre || current.numero_palet || "",
      },
      details: { entity: "pallet" },
    });
  }
  return { ok: true };
}

async function getAllDocsOrdered({ collectionName, orderField }) {
  if (!firebaseDb) throw new Error("Firestore no está configurado");
  let snap;
  try {
    snap = await getDocs(
      query(collection(firebaseDb, collectionName), orderBy(orderField, "desc"))
    );
  } catch {
    snap = await getDocs(collection(firebaseDb, collectionName));
  }
  const out = [];
  snap.forEach((d) => out.push({ docId: d.id, data: d.data() || {} }));
  return out;
}

function mapCommonAudit(data, docId) {
  const id = data.id || docId;
  return {
    _id: id,
    id,
    creado_por: data.creado_por || "",
    modificado_por: data.modificado_por || "",
    fecha_creacion: data.fecha_creacion || null,
    fecha_modificacion: data.fecha_modificacion || null,
    createdAt: data.createdAt || data.fecha_creacion || null,
    updatedAt: data.updatedAt || data.fecha_modificacion || null,
  };
}

function queueInteraction({ type, target, details }) {
  withTimeout(logInteraction({ type, target, details }), 1500).catch(() => {});
}

export async function fetchAllLocations() {
  const docs = await getAllDocsOrdered({
    collectionName: "locations",
    orderField: "fecha_creacion",
  });
  return docs.map(({ docId, data }) => ({
    ...mapCommonAudit(data, docId),
    nombre: data.nombre || "",
    ciudad: data.ciudad || "",
    puerto: data.puerto || "",
    coordenadas: data.coordenadas || "",
  }));
}

export async function fetchLocationById(id) {
  if (!firebaseDb) throw new Error("Firestore no está configurado");
  const ref = doc(firebaseDb, "locations", String(id));
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data() || {};
  return {
    ...mapCommonAudit(data, snap.id),
    nombre: data.nombre || "",
    ciudad: data.ciudad || "",
    puerto: data.puerto || "",
    coordenadas: data.coordenadas || "",
  };
}

export async function createLocation(payload) {
  if (!firebaseDb) throw new Error("Firestore no está configurado");
  const nombre = String(payload?.nombre || "").trim();
  if (!nombre) throw new Error("nombre es obligatorio");

  const ref = doc(collection(firebaseDb, "locations"));
  const id = ref.id;
  await setDoc(ref, {
    id,
    nombre,
    ciudad: String(payload?.ciudad || ""),
    puerto: String(payload?.puerto || ""),
    coordenadas: String(payload?.coordenadas || ""),
    creado_por: String(payload?.creado_por || "Testing"),
    modificado_por: "",
    fecha_creacion: serverTimestamp(),
    fecha_modificacion: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  const created = await fetchLocationById(id);
  if (created) {
    queueInteraction({
      type: "location_created",
      target: { id: created.id, name: created.nombre || "" },
      details: {
        entity: "location",
        snapshot: {
          nombre: created.nombre || "",
          ciudad: created.ciudad || "",
          puerto: created.puerto || "",
          coordenadas: created.coordenadas || "",
        },
      },
    });
  }
  return created;
}

export async function updateLocationById(id, updates) {
  if (!firebaseDb) throw new Error("Firestore no está configurado");
  const ref = doc(firebaseDb, "locations", String(id));
  const current = await fetchLocationById(id);
  if (!current) return null;
  await updateDoc(ref, {
    ...updates,
    fecha_modificacion: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  const updated = await fetchLocationById(id);
  if (updated) {
    queueInteraction({
      type: "location_updated",
      target: { id: updated.id, name: updated.nombre || "" },
      details: { entity: "location", updates: updates || {} },
    });
  }
  return updated;
}

export async function deleteLocationById(id) {
  if (!firebaseDb) throw new Error("Firestore no está configurado");
  const current = await fetchLocationById(id).catch(() => null);
  const ref = doc(firebaseDb, "locations", String(id));
  await deleteDoc(ref);
  if (current) {
    queueInteraction({
      type: "location_deleted",
      target: { id: current.id, name: current.nombre || "" },
      details: { entity: "location" },
    });
  }
  return { ok: true };
}

export async function fetchAllConsignees() {
  const docs = await getAllDocsOrdered({
    collectionName: "consignees",
    orderField: "fecha_creacion",
  });
  return docs.map(({ docId, data }) => ({
    ...mapCommonAudit(data, docId),
    nombre: data.nombre || "",
  }));
}

export async function fetchConsigneeById(id) {
  if (!firebaseDb) throw new Error("Firestore no está configurado");
  const ref = doc(firebaseDb, "consignees", String(id));
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data() || {};
  return {
    ...mapCommonAudit(data, snap.id),
    nombre: data.nombre || "",
  };
}

export async function createConsignee(payload) {
  if (!firebaseDb) throw new Error("Firestore no está configurado");
  const nombre = String(payload?.nombre || "").trim();
  if (!nombre) throw new Error("nombre es obligatorio");

  const ref = doc(collection(firebaseDb, "consignees"));
  const id = ref.id;
  await setDoc(ref, {
    id,
    nombre,
    creado_por: String(payload?.creado_por || "Testing"),
    modificado_por: "",
    fecha_creacion: serverTimestamp(),
    fecha_modificacion: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  const created = await fetchConsigneeById(id);
  if (created) {
    queueInteraction({
      type: "consignee_created",
      target: { id: created.id, name: created.nombre || "" },
      details: {
        entity: "consignee",
        snapshot: { nombre: created.nombre || "" },
      },
    });
  }
  return created;
}

export async function updateConsigneeById(id, updates) {
  if (!firebaseDb) throw new Error("Firestore no está configurado");
  const ref = doc(firebaseDb, "consignees", String(id));
  const current = await fetchConsigneeById(id);
  if (!current) return null;
  await updateDoc(ref, {
    ...updates,
    fecha_modificacion: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  const updated = await fetchConsigneeById(id);
  if (updated) {
    queueInteraction({
      type: "consignee_updated",
      target: { id: updated.id, name: updated.nombre || "" },
      details: { entity: "consignee", updates: updates || {} },
    });
  }
  return updated;
}

export async function deleteConsigneeById(id) {
  if (!firebaseDb) throw new Error("Firestore no está configurado");
  const current = await fetchConsigneeById(id).catch(() => null);
  const ref = doc(firebaseDb, "consignees", String(id));
  await deleteDoc(ref);
  if (current) {
    queueInteraction({
      type: "consignee_deleted",
      target: { id: current.id, name: current.nombre || "" },
      details: { entity: "consignee" },
    });
  }
  return { ok: true };
}

export async function fetchAllCargoTypes() {
  const docs = await getAllDocsOrdered({
    collectionName: "cargo_types",
    orderField: "fecha_creacion",
  });
  return docs.map(({ docId, data }) => ({
    ...mapCommonAudit(data, docId),
    nombre: data.nombre || "",
  }));
}

export async function fetchCargoTypeById(id) {
  if (!firebaseDb) throw new Error("Firestore no está configurado");
  const ref = doc(firebaseDb, "cargo_types", String(id));
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data() || {};
  return {
    ...mapCommonAudit(data, snap.id),
    nombre: data.nombre || "",
  };
}

export async function createCargoType(payload) {
  if (!firebaseDb) throw new Error("Firestore no está configurado");
  const nombre = String(payload?.nombre || "").trim();
  if (!nombre) throw new Error("nombre es obligatorio");

  const ref = doc(collection(firebaseDb, "cargo_types"));
  const id = ref.id;
  await setDoc(ref, {
    id,
    nombre,
    creado_por: String(payload?.creado_por || "Testing"),
    modificado_por: "",
    fecha_creacion: serverTimestamp(),
    fecha_modificacion: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  const created = await fetchCargoTypeById(id);
  if (created) {
    queueInteraction({
      type: "cargo_type_created",
      target: { id: created.id, name: created.nombre || "" },
      details: {
        entity: "cargo_type",
        snapshot: { nombre: created.nombre || "" },
      },
    });
  }
  return created;
}

export async function updateCargoTypeById(id, updates) {
  if (!firebaseDb) throw new Error("Firestore no está configurado");
  const ref = doc(firebaseDb, "cargo_types", String(id));
  const current = await fetchCargoTypeById(id);
  if (!current) return null;

  const patch = { ...updates };
  if (typeof updates?.nombre !== "undefined") {
    patch.nombre = String(updates?.nombre || "").trim();
  }

  await updateDoc(ref, {
    ...patch,
    fecha_modificacion: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  const updated = await fetchCargoTypeById(id);
  if (updated) {
    queueInteraction({
      type: "cargo_type_updated",
      target: { id: updated.id, name: updated.nombre || "" },
      details: { entity: "cargo_type", updates: patch || {} },
    });
  }
  return updated;
}

export async function deleteCargoTypeById(id) {
  if (!firebaseDb) throw new Error("Firestore no está configurado");
  const current = await fetchCargoTypeById(id).catch(() => null);
  const ref = doc(firebaseDb, "cargo_types", String(id));
  await deleteDoc(ref);
  if (current) {
    queueInteraction({
      type: "cargo_type_deleted",
      target: { id: current.id, name: current.nombre || "" },
      details: { entity: "cargo_type" },
    });
  }
  return { ok: true };
}

export async function fetchAllResponsables() {
  const docs = await getAllDocsOrdered({
    collectionName: "responsables",
    orderField: "fecha_creacion",
  });
  return docs.map(({ docId, data }) => ({
    ...mapCommonAudit(data, docId),
    nombre: data.nombre || "",
    email: data.email || "",
    telefono: data.telefono || "",
  }));
}

export async function fetchResponsableById(id) {
  if (!firebaseDb) throw new Error("Firestore no está configurado");
  const ref = doc(firebaseDb, "responsables", String(id));
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data() || {};
  return {
    ...mapCommonAudit(data, snap.id),
    nombre: data.nombre || "",
    email: data.email || "",
    telefono: data.telefono || "",
  };
}

export async function createResponsable(payload) {
  if (!firebaseDb) throw new Error("Firestore no está configurado");
  const nombre = String(payload?.nombre || "").trim();
  if (!nombre) throw new Error("nombre es obligatorio");

  const email = String(payload?.email || "")
    .trim()
    .toLowerCase();
  const telefono = String(payload?.telefono || "").trim();

  const ref = doc(collection(firebaseDb, "responsables"));
  const id = ref.id;
  await setDoc(ref, {
    id,
    nombre,
    email,
    telefono,
    creado_por: String(payload?.creado_por || "Testing"),
    modificado_por: "",
    fecha_creacion: serverTimestamp(),
    fecha_modificacion: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  const created = await fetchResponsableById(id);
  if (created) {
    queueInteraction({
      type: "responsable_created",
      target: { id: created.id, name: created.nombre || "" },
      details: {
        entity: "responsable",
        snapshot: {
          nombre: created.nombre || "",
          email: created.email || "",
          telefono: created.telefono || "",
        },
      },
    });
  }
  return created;
}

export async function updateResponsableById(id, updates) {
  if (!firebaseDb) throw new Error("Firestore no está configurado");
  const ref = doc(firebaseDb, "responsables", String(id));
  const current = await fetchResponsableById(id);
  if (!current) return null;

  const patch = { ...updates };
  if (typeof updates?.email !== "undefined") {
    patch.email = String(updates?.email || "")
      .trim()
      .toLowerCase();
  }
  if (typeof updates?.telefono !== "undefined") {
    patch.telefono = String(updates?.telefono || "").trim();
  }
  if (typeof updates?.nombre !== "undefined") {
    patch.nombre = String(updates?.nombre || "").trim();
  }

  await updateDoc(ref, {
    ...patch,
    fecha_modificacion: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  const updated = await fetchResponsableById(id);
  if (updated) {
    queueInteraction({
      type: "responsable_updated",
      target: { id: updated.id, name: updated.nombre || "" },
      details: { entity: "responsable", updates: patch || {} },
    });
  }
  return updated;
}

export async function deleteResponsableById(id) {
  if (!firebaseDb) throw new Error("Firestore no está configurado");
  const current = await fetchResponsableById(id).catch(() => null);
  const ref = doc(firebaseDb, "responsables", String(id));
  await deleteDoc(ref);
  if (current) {
    queueInteraction({
      type: "responsable_deleted",
      target: { id: current.id, name: current.nombre || "" },
      details: { entity: "responsable" },
    });
  }
  return { ok: true };
}

export async function fetchAllCompanies() {
  const docs = await getAllDocsOrdered({
    collectionName: "companies",
    orderField: "fecha_creacion",
  });
  return docs.map(({ docId, data }) => ({
    ...mapCommonAudit(data, docId),
    nombre: data.nombre || "",
    telefono: data.telefono || "",
    email: data.email || "",
  }));
}

export async function fetchCompanyById(id) {
  if (!firebaseDb) throw new Error("Firestore no está configurado");
  const ref = doc(firebaseDb, "companies", String(id));
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data() || {};
  return {
    ...mapCommonAudit(data, snap.id),
    nombre: data.nombre || "",
    telefono: data.telefono || "",
    email: data.email || "",
  };
}

export async function createCompany(payload) {
  if (!firebaseDb) throw new Error("Firestore no está configurado");
  const nombre = String(payload?.nombre || "").trim();
  if (!nombre) throw new Error("nombre es obligatorio");

  const telefono = String(payload?.telefono || "").trim();
  const email = String(payload?.email || "").trim();

  const ref = doc(collection(firebaseDb, "companies"));
  const id = ref.id;
  await setDoc(ref, {
    id,
    nombre,
    telefono,
    email,
    creado_por: String(payload?.creado_por || "Testing"),
    modificado_por: "",
    fecha_creacion: serverTimestamp(),
    fecha_modificacion: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  const created = await fetchCompanyById(id);
  if (created) {
    queueInteraction({
      type: "company_created",
      target: { id: created.id, name: created.nombre || "" },
      details: {
        entity: "company",
        snapshot: {
          nombre: created.nombre || "",
          telefono: created.telefono || "",
          email: created.email || "",
        },
      },
    });
  }
  return created;
}

export async function updateCompanyById(id, updates) {
  if (!firebaseDb) throw new Error("Firestore no está configurado");
  const ref = doc(firebaseDb, "companies", String(id));
  const current = await fetchCompanyById(id);
  if (!current) return null;
  const patch = { ...updates };
  if (typeof updates?.nombre !== "undefined") {
    patch.nombre = String(updates?.nombre || "").trim();
  }
  if (typeof updates?.telefono !== "undefined") {
    patch.telefono = String(updates?.telefono || "").trim();
  }
  if (typeof updates?.email !== "undefined") {
    patch.email = String(updates?.email || "").trim();
  }
  await updateDoc(ref, {
    ...patch,
    fecha_modificacion: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  const updated = await fetchCompanyById(id);
  if (updated) {
    queueInteraction({
      type: "company_updated",
      target: { id: updated.id, name: updated.nombre || "" },
      details: { entity: "company", updates: patch || {} },
    });
  }
  return updated;
}

export async function deleteCompanyById(id) {
  if (!firebaseDb) throw new Error("Firestore no está configurado");
  const current = await fetchCompanyById(id).catch(() => null);
  const ref = doc(firebaseDb, "companies", String(id));
  await deleteDoc(ref);
  if (current) {
    queueInteraction({
      type: "company_deleted",
      target: { id: current.id, name: current.nombre || "" },
      details: { entity: "company" },
    });
  }
  return { ok: true };
}

export async function fetchAllShips() {
  const docs = await getAllDocsOrdered({
    collectionName: "ships",
    orderField: "fecha_creacion",
  });
  return docs.map(({ docId, data }) => {
    const rawEmpresa = data.empresa;
    const empresaObj =
      rawEmpresa && typeof rawEmpresa === "object" ? rawEmpresa : null;
    const empresaId =
      (empresaObj &&
        String(empresaObj._id || empresaObj.id || empresaObj.docId || "")) ||
      String(rawEmpresa || "");
    const empresaNombre =
      String(data.empresa_nombre || "") ||
      (empresaObj ? String(empresaObj.nombre || empresaObj.name || "") : "");

    const rawResponsable = data.responsable;
    const responsableObj =
      rawResponsable && typeof rawResponsable === "object"
        ? rawResponsable
        : null;
    const responsableId =
      (responsableObj &&
        String(
          responsableObj._id || responsableObj.id || responsableObj.docId || ""
        )) ||
      String(rawResponsable || "");
    const responsableNombre =
      String(data.responsable_nombre || "") ||
      (responsableObj
        ? String(responsableObj.nombre || responsableObj.name || "")
        : "");
    const responsableEmail =
      String(data.responsable_email || "") ||
      (responsableObj ? String(responsableObj.email || "") : "");

    const rawCargoType = data.cargo_type;
    const cargoTypeObj =
      rawCargoType && typeof rawCargoType === "object" ? rawCargoType : null;
    const cargo_type =
      (cargoTypeObj &&
        String(
          cargoTypeObj._id || cargoTypeObj.id || cargoTypeObj.docId || ""
        )) ||
      String(rawCargoType || "");
    const cargo_type_nombre =
      String(data.cargo_type_nombre || "") ||
      (cargoTypeObj
        ? String(cargoTypeObj.nombre || cargoTypeObj.name || "")
        : "");

    return {
      ...mapCommonAudit(data, docId),
      nombre_del_barco: data.nombre_del_barco || "",
      enlace: data.enlace || "",
      tipo: data.tipo || "",
      empresa: empresaId,
      empresa_nombre: empresaNombre,
      responsable: responsableId,
      responsable_nombre: responsableNombre,
      responsable_email: responsableEmail,
      cargo_type,
      cargo_type_nombre,
    };
  });
}

export async function fetchShipById(id) {
  if (!firebaseDb) throw new Error("Firestore no está configurado");
  const ref = doc(firebaseDb, "ships", String(id));
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data() || {};
  const rawEmpresa = data.empresa;
  const empresaObj =
    rawEmpresa && typeof rawEmpresa === "object" ? rawEmpresa : null;
  const empresaId =
    (empresaObj &&
      String(empresaObj._id || empresaObj.id || empresaObj.docId || "")) ||
    String(rawEmpresa || "");
  const empresaNombre =
    String(data.empresa_nombre || "") ||
    (empresaObj ? String(empresaObj.nombre || empresaObj.name || "") : "");

  const rawResponsable = data.responsable;
  const responsableObj =
    rawResponsable && typeof rawResponsable === "object"
      ? rawResponsable
      : null;
  const responsableId =
    (responsableObj &&
      String(
        responsableObj._id || responsableObj.id || responsableObj.docId || ""
      )) ||
    String(rawResponsable || "");
  const responsableNombre =
    String(data.responsable_nombre || "") ||
    (responsableObj
      ? String(responsableObj.nombre || responsableObj.name || "")
      : "");
  const responsableEmail =
    String(data.responsable_email || "") ||
    (responsableObj ? String(responsableObj.email || "") : "");

  const rawCargoType = data.cargo_type;
  const cargoTypeObj =
    rawCargoType && typeof rawCargoType === "object" ? rawCargoType : null;
  const cargo_type =
    (cargoTypeObj &&
      String(
        cargoTypeObj._id || cargoTypeObj.id || cargoTypeObj.docId || ""
      )) ||
    String(rawCargoType || "");
  const cargo_type_nombre =
    String(data.cargo_type_nombre || "") ||
    (cargoTypeObj
      ? String(cargoTypeObj.nombre || cargoTypeObj.name || "")
      : "");
  return {
    ...mapCommonAudit(data, snap.id),
    nombre_del_barco: data.nombre_del_barco || "",
    enlace: data.enlace || "",
    tipo: data.tipo || "",
    empresa: empresaId,
    empresa_nombre: empresaNombre,
    responsable: responsableId,
    responsable_nombre: responsableNombre,
    responsable_email: responsableEmail,
    cargo_type,
    cargo_type_nombre,
  };
}

export async function createShip(payload) {
  if (!firebaseDb) throw new Error("Firestore no está configurado");
  const nombre_del_barco = String(payload?.nombre_del_barco || "").trim();
  if (!nombre_del_barco) throw new Error("nombre_del_barco es obligatorio");

  const ref = doc(collection(firebaseDb, "ships"));
  const id = ref.id;

  const empresaInput = payload?.empresa;
  const empresaObj =
    empresaInput && typeof empresaInput === "object" ? empresaInput : null;
  const empresa = String(
    empresaObj?.id || empresaObj?._id || empresaObj?.docId || empresaInput || ""
  ).trim();
  const empresa_nombre = String(
    payload?.empresa_nombre || empresaObj?.nombre || empresaObj?.name || ""
  ).trim();

  const responsableInput = payload?.responsable;
  const responsableObj =
    responsableInput && typeof responsableInput === "object"
      ? responsableInput
      : null;
  const responsable = String(
    responsableObj?.id ||
      responsableObj?._id ||
      responsableObj?.docId ||
      responsableInput ||
      ""
  ).trim();
  const responsable_nombre = String(
    payload?.responsable_nombre ||
      responsableObj?.nombre ||
      responsableObj?.name ||
      ""
  ).trim();
  const responsable_email = String(
    payload?.responsable_email || responsableObj?.email || ""
  ).trim();

  const cargoTypeInput = payload?.cargo_type;
  const cargoTypeObj =
    cargoTypeInput && typeof cargoTypeInput === "object"
      ? cargoTypeInput
      : null;
  const cargo_type = String(
    cargoTypeObj?.id ||
      cargoTypeObj?._id ||
      cargoTypeObj?.docId ||
      cargoTypeInput ||
      ""
  ).trim();
  const cargo_type_nombre = String(
    payload?.cargo_type_nombre ||
      cargoTypeObj?.nombre ||
      cargoTypeObj?.name ||
      ""
  ).trim();

  const enlace = String(payload?.enlace || "").trim();
  const tipo = String(payload?.tipo || "").trim();
  const creado_por = String(payload?.creado_por || "Testing");
  const modificado_por = String(payload?.modificado_por || creado_por);

  await setDoc(ref, {
    id,
    nombre_del_barco,
    enlace,
    tipo,
    empresa,
    empresa_nombre,
    responsable,
    responsable_nombre,
    responsable_email,
    cargo_type,
    cargo_type_nombre,
    creado_por,
    modificado_por,
    fecha_creacion: serverTimestamp(),
    fecha_modificacion: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const created = await fetchShipById(id);
  if (created) {
    queueInteraction({
      type: "ship_created",
      target: { id: created.id, name: created.nombre_del_barco || "" },
      details: {
        entity: "ship",
        snapshot: {
          nombre_del_barco: created.nombre_del_barco || "",
          enlace: created.enlace || "",
          tipo: created.tipo || "",
          empresa: created.empresa || "",
          empresa_nombre: created.empresa_nombre || "",
          responsable: created.responsable || "",
          responsable_nombre: created.responsable_nombre || "",
          responsable_email: created.responsable_email || "",
          cargo_type: created.cargo_type || "",
          cargo_type_nombre: created.cargo_type_nombre || "",
        },
      },
    });
  }
  return created;
}

export async function updateShipById(id, updates) {
  if (!firebaseDb) throw new Error("Firestore no está configurado");
  const ref = doc(firebaseDb, "ships", String(id));
  const current = await fetchShipById(id);
  if (!current) return null;

  const patch = { ...updates };
  delete patch.telefono;
  delete patch.email;
  if (typeof updates?.modificado_por === "undefined") {
    const actorName = getActorFromLocalStorage()?.name || "";
    if (actorName) patch.modificado_por = actorName;
  } else {
    patch.modificado_por = String(updates?.modificado_por || "").trim();
  }
  if (typeof updates?.empresa !== "undefined") {
    const empresaInput = updates?.empresa;
    const empresaObj =
      empresaInput && typeof empresaInput === "object" ? empresaInput : null;
    patch.empresa = String(
      empresaObj?.id ||
        empresaObj?._id ||
        empresaObj?.docId ||
        empresaInput ||
        ""
    ).trim();
    patch.empresa_nombre = String(
      updates?.empresa_nombre || empresaObj?.nombre || empresaObj?.name || ""
    ).trim();
    if (!patch.empresa) patch.empresa_nombre = "";
  }

  if (typeof updates?.responsable !== "undefined") {
    const responsableInput = updates?.responsable;
    const responsableObj =
      responsableInput && typeof responsableInput === "object"
        ? responsableInput
        : null;
    patch.responsable = String(
      responsableObj?.id ||
        responsableObj?._id ||
        responsableObj?.docId ||
        responsableInput ||
        ""
    ).trim();
    patch.responsable_nombre = String(
      updates?.responsable_nombre ||
        responsableObj?.nombre ||
        responsableObj?.name ||
        ""
    ).trim();
    patch.responsable_email = String(
      updates?.responsable_email || responsableObj?.email || ""
    ).trim();
    if (!patch.responsable) {
      patch.responsable_nombre = "";
      patch.responsable_email = "";
    }
  }

  if (typeof updates?.cargo_type !== "undefined") {
    const cargoTypeInput = updates?.cargo_type;
    const cargoTypeObj =
      cargoTypeInput && typeof cargoTypeInput === "object"
        ? cargoTypeInput
        : null;
    patch.cargo_type = String(
      cargoTypeObj?.id ||
        cargoTypeObj?._id ||
        cargoTypeObj?.docId ||
        cargoTypeInput ||
        ""
    ).trim();
    patch.cargo_type_nombre = String(
      updates?.cargo_type_nombre ||
        cargoTypeObj?.nombre ||
        cargoTypeObj?.name ||
        ""
    ).trim();
    if (!patch.cargo_type) patch.cargo_type_nombre = "";
  }

  if (typeof updates?.tipo !== "undefined") {
    patch.tipo = String(updates?.tipo || "").trim();
  }

  if (typeof updates?.enlace !== "undefined") {
    patch.enlace = String(updates?.enlace || "").trim();
  }

  if (typeof updates?.nombre_del_barco !== "undefined") {
    patch.nombre_del_barco = String(updates?.nombre_del_barco || "").trim();
  }

  await updateDoc(ref, {
    ...patch,
    fecha_modificacion: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const updated = await fetchShipById(id);
  if (updated) {
    queueInteraction({
      type: "ship_updated",
      target: { id: updated.id, name: updated.nombre_del_barco || "" },
      details: { entity: "ship", updates: patch || {} },
    });
  }
  return updated;
}

export async function deleteShipById(id) {
  if (!firebaseDb) throw new Error("Firestore no está configurado");
  const current = await fetchShipById(id).catch(() => null);
  const ref = doc(firebaseDb, "ships", String(id));
  await deleteDoc(ref);
  if (current) {
    queueInteraction({
      type: "ship_deleted",
      target: { id: current.id, name: current.nombre_del_barco || "" },
      details: { entity: "ship" },
    });
  }
  return { ok: true };
}

export async function fetchAllMessages() {
  const docs = await getAllDocsOrdered({
    collectionName: "messages",
    orderField: "fecha_creacion",
  });
  return docs.map(({ docId, data }) => ({
    ...mapCommonAudit(data, docId),
    titulo: data.titulo || "",
    cuerpo: data.cuerpo || "",
    roles: Array.isArray(data.roles) ? data.roles : [],
  }));
}

export async function fetchMessageById(id) {
  if (!firebaseDb) throw new Error("Firestore no está configurado");
  const ref = doc(firebaseDb, "messages", String(id));
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data() || {};
  return {
    ...mapCommonAudit(data, snap.id),
    titulo: data.titulo || "",
    cuerpo: data.cuerpo || "",
    roles: Array.isArray(data.roles) ? data.roles : [],
  };
}

export async function createMessage(payload) {
  if (!firebaseDb) throw new Error("Firestore no está configurado");
  const titulo = String(payload?.titulo || "").trim();
  const cuerpo = String(payload?.cuerpo || "").trim();
  if (!titulo || !cuerpo) throw new Error("titulo y cuerpo son obligatorios");

  const roles = Array.isArray(payload?.roles)
    ? payload.roles.map((r) => String(r)).filter(Boolean)
    : [];

  const ref = doc(collection(firebaseDb, "messages"));
  const id = ref.id;

  await setDoc(ref, {
    id,
    titulo,
    cuerpo,
    roles,
    creado_por: String(payload?.creado_por || "Testing"),
    modificado_por: "",
    fecha_creacion: serverTimestamp(),
    fecha_modificacion: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const created = await fetchMessageById(id);
  if (created) {
    queueInteraction({
      type: "message_created",
      target: { id: created.id, name: created.titulo || "" },
      details: {
        entity: "message",
        snapshot: {
          titulo: created.titulo || "",
          roles: Array.isArray(created.roles) ? created.roles : [],
        },
      },
    });
  }
  return created;
}

export async function updateMessageById(id, updates) {
  if (!firebaseDb) throw new Error("Firestore no está configurado");
  const ref = doc(firebaseDb, "messages", String(id));
  const current = await fetchMessageById(id);
  if (!current) return null;

  const patch = {
    ...updates,
    ...(typeof updates?.roles !== "undefined"
      ? {
          roles: Array.isArray(updates.roles)
            ? updates.roles.map((r) => String(r)).filter(Boolean)
            : [],
        }
      : {}),
    fecha_modificacion: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await updateDoc(ref, patch);
  const updated = await fetchMessageById(id);
  if (updated) {
    queueInteraction({
      type: "message_updated",
      target: { id: updated.id, name: updated.titulo || "" },
      details: { entity: "message", updates: updates || {} },
    });
  }
  return updated;
}

export async function deleteMessageById(id) {
  if (!firebaseDb) throw new Error("Firestore no está configurado");
  const current = await fetchMessageById(id).catch(() => null);
  const ref = doc(firebaseDb, "messages", String(id));
  await deleteDoc(ref);
  if (current) {
    queueInteraction({
      type: "message_deleted",
      target: { id: current.id, name: current.titulo || "" },
      details: { entity: "message" },
    });
  }
  return { ok: true };
}
