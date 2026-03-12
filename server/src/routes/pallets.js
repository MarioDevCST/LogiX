import { Router } from "express";
import Pallet from "../models/Pallet.js";
import Load from "../models/Load.js";

const router = Router();

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

// Lista de palets
router.get("/", async (req, res) => {
  try {
    const list = await Pallet.find().populate("carga", "nombre");
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: "Error obteniendo palets" });
  }
});

router.post("/fuse", async (req, res) => {
  try {
    const {
      mode,
      targetPalletId,
      sourcePalletIds,
      sourcePalletNumbers,
      modificado_por,
    } = req.body || {};

    if (!modificado_por)
      return res.status(400).json({ error: "modificado_por es obligatorio" });

    if (!targetPalletId)
      return res.status(400).json({ error: "targetPalletId es obligatorio" });

    const target = await Pallet.findById(targetPalletId);
    if (!target)
      return res.status(404).json({ error: "Palet destino no encontrado" });
    if (!target.carga)
      return res.status(400).json({ error: "El palet destino no tiene carga" });

    let sources = [];

    if (mode === "ids") {
      const ids = Array.isArray(sourcePalletIds) ? sourcePalletIds : [];
      const unique = Array.from(
        new Set(ids.map((v) => String(v || "").trim()).filter(Boolean))
      ).filter((v) => String(v) !== String(target._id));
      if (unique.length === 0)
        return res
          .status(400)
          .json({ error: "Debe indicar palets origen" });

      sources = await Pallet.find({ _id: { $in: unique } });
      if (sources.length !== unique.length) {
        const found = new Set(sources.map((p) => String(p._id)));
        const missing = unique.filter((v) => !found.has(String(v)));
        return res
          .status(404)
          .json({ error: "Hay palets origen que no existen", missing });
      }
    } else if (mode === "numbers") {
      const nums = Array.isArray(sourcePalletNumbers) ? sourcePalletNumbers : [];
      const normalized = Array.from(
        new Set(nums.map((v) => String(v || "").trim()).filter(Boolean))
      ).filter((n) => n !== String(target.numero_palet));
      if (normalized.length === 0)
        return res
          .status(400)
          .json({ error: "Debe indicar números de palet a fusionar" });

      sources = await Pallet.find({
        carga: target.carga,
        numero_palet: { $in: normalized },
      });

      const foundNums = new Set(sources.map((p) => String(p.numero_palet)));
      const missing = normalized.filter((n) => !foundNums.has(String(n)));
      if (missing.length > 0) {
        return res
          .status(404)
          .json({ error: "No se encontraron algunos números de palet", missing });
      }
    } else {
      return res.status(400).json({ error: "mode inválido" });
    }

    const targetCarga = String(target.carga);
    const invalid = sources.find((p) => String(p.carga) !== targetCarga);
    if (invalid) {
      return res
        .status(400)
        .json({ error: "Todos los palets deben pertenecer a la misma carga" });
    }

    const targetTipo = String(target.tipo || "");
    const differentTipo = sources.filter((p) => String(p.tipo || "") !== targetTipo);
    if (differentTipo.length > 0) {
      return res.status(400).json({
        error: "Solo se pueden fusionar palets del mismo tipo",
        targetTipo,
        differentTipo: differentTipo.map((p) => ({
          id: String(p._id),
          numero_palet: p.numero_palet,
          tipo: p.tipo,
        })),
      });
    }

    const sourceIds = sources.map((p) => p._id);
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
          ].map((v) => String(v).trim()).filter(Boolean)
        )
      )
    );
    const numeroMerged = mergedNumeroParts.join("+");

    const updatedTarget = await Pallet.findByIdAndUpdate(
      target._id,
      {
        $set: {
          productos: productosMerged,
          numero_palet: numeroMerged || target.numero_palet,
          modificado_por,
        },
      },
      { new: true, runValidators: true }
    ).populate("carga", "nombre");

    const loadDoc = await Load.findById(target.carga).select("palets");
    if (!loadDoc) return res.status(404).json({ error: "Carga no encontrada" });

    const idsToRemove = new Set(sourceIds.map((v) => String(v)));
    const current = Array.isArray(loadDoc.palets) ? loadDoc.palets : [];
    const next = current.filter((pid) => !idsToRemove.has(String(pid)));
    if (!next.some((pid) => String(pid) === String(target._id))) {
      next.push(target._id);
    }

    await Load.findByIdAndUpdate(target.carga, { $set: { palets: next } });

    await Pallet.deleteMany({ _id: { $in: sourceIds } });

    res.json({
      ok: true,
      target: updatedTarget,
      deletedIds: sourceIds.map((v) => String(v)),
    });
  } catch (err) {
    if (err?.name === "CastError") {
      return res.status(400).json({ error: "Identificador inválido" });
    }
    console.error("Error fusionando palets:", err);
    res.status(500).json({ error: "Error fusionando palets", detail: err?.message });
  }
});

// Detalle de palet
router.get("/:id", async (req, res) => {
  try {
    const item = await Pallet.findById(req.params.id).populate(
      "carga",
      "nombre"
    );
    if (!item) return res.status(404).json({ error: "Palet no encontrado" });
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: "Error obteniendo palet" });
  }
});

// Crear palet y asociarlo a la carga
router.post("/", async (req, res) => {
  try {
    const { numero_palet, tipo, base, carga, creado_por } = req.body;
    if (!numero_palet)
      return res.status(400).json({ error: "numero_palet es obligatorio" });
    if (!tipo) return res.status(400).json({ error: "tipo es obligatorio" });
    if (!carga) return res.status(400).json({ error: "carga es obligatoria" });

    const created = await Pallet.create({
      numero_palet: String(numero_palet),
      tipo,
      base: base || undefined,
      carga,
      creado_por: creado_por || "Testing",
    });
    // mantener la relación inversa en Load.palets
    await Load.findByIdAndUpdate(carga, { $push: { palets: created._id } });

    const populated = await Pallet.findById(created._id).populate(
      "carga",
      "nombre"
    );
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ error: "Error creando palet" });
  }
});

// Actualizar palet y sincronizar relación con carga
router.put("/:id", async (req, res) => {
  try {
    const { numero_palet, tipo, base, carga, modificado_por } = req.body;
    if (!modificado_por)
      return res.status(400).json({ error: "modificado_por es obligatorio" });

    const current = await Pallet.findById(req.params.id).select("carga");
    const updated = await Pallet.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          numero_palet: numero_palet && String(numero_palet),
          tipo,
          ...(typeof base !== "undefined" && base !== "" ? { base } : {}),
          carga,
          modificado_por,
        },
      },
      { new: true, runValidators: true }
    );
    if (!updated) return res.status(404).json({ error: "Palet no encontrado" });

    // si cambia la carga, mover el palet entre las colecciones
    if (
      typeof carga !== "undefined" &&
      String(carga) !== String(current.carga)
    ) {
      if (current.carga)
        await Load.findByIdAndUpdate(current.carga, {
          $pull: { palets: updated._id },
        });
      if (carga)
        await Load.findByIdAndUpdate(carga, { $push: { palets: updated._id } });
    }

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Error actualizando palet" });
  }
});

// Eliminar palet y retirar asociación de la carga
router.delete("/:id", async (req, res) => {
  try {
    const deleted = await Pallet.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Palet no encontrado" });

    if (deleted.carga)
      await Load.findByIdAndUpdate(deleted.carga, {
        $pull: { palets: deleted._id },
      });

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Error eliminando palet" });
  }
});

export default router;
