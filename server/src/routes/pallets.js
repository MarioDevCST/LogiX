import { Router } from 'express'
import Pallet from '../models/Pallet.js'
import Load from '../models/Load.js'

const router = Router()

// Lista de palets
router.get('/', async (req, res) => {
  try {
    const list = await Pallet.find().populate('carga', 'nombre')
    res.json(list)
  } catch (err) {
    res.status(500).json({ error: 'Error obteniendo palets' })
  }
})

// Detalle de palet
router.get('/:id', async (req, res) => {
  try {
    const item = await Pallet.findById(req.params.id).populate('carga', 'nombre')
    if (!item) return res.status(404).json({ error: 'Palet no encontrado' })
    res.json(item)
  } catch (err) {
    res.status(500).json({ error: 'Error obteniendo palet' })
  }
})

// Crear palet y asociarlo a la carga
router.post('/', async (req, res) => {
  try {
    const { numero_palet, tipo, carga, creado_por } = req.body
    if (!numero_palet) return res.status(400).json({ error: 'numero_palet es obligatorio' })
    if (!tipo) return res.status(400).json({ error: 'tipo es obligatorio' })
    if (!carga) return res.status(400).json({ error: 'carga es obligatoria' })

    const created = await Pallet.create({ numero_palet: String(numero_palet), tipo, carga, creado_por: creado_por || 'Testing' })
    // mantener la relación inversa en Load.palets
    await Load.findByIdAndUpdate(carga, { $push: { palets: created._id } })

    const populated = await Pallet.findById(created._id).populate('carga', 'nombre')
    res.status(201).json(populated)
  } catch (err) {
    res.status(500).json({ error: 'Error creando palet' })
  }
})

// Actualizar palet y sincronizar relación con carga
router.put('/:id', async (req, res) => {
  try {
    const { numero_palet, tipo, carga, modificado_por } = req.body
    if (!modificado_por) return res.status(400).json({ error: 'modificado_por es obligatorio' })

    const current = await Pallet.findById(req.params.id).select('carga')
    const updated = await Pallet.findByIdAndUpdate(
      req.params.id,
      { $set: { numero_palet: numero_palet && String(numero_palet), tipo, carga, modificado_por } },
      { new: true, runValidators: true }
    )
    if (!updated) return res.status(404).json({ error: 'Palet no encontrado' })

    // si cambia la carga, mover el palet entre las colecciones
    if (typeof carga !== 'undefined' && String(carga) !== String(current.carga)) {
      if (current.carga) await Load.findByIdAndUpdate(current.carga, { $pull: { palets: updated._id } })
      if (carga) await Load.findByIdAndUpdate(carga, { $push: { palets: updated._id } })
    }

    res.json(updated)
  } catch (err) {
    res.status(500).json({ error: 'Error actualizando palet' })
  }
})

// Eliminar palet y retirar asociación de la carga
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await Pallet.findByIdAndDelete(req.params.id)
    if (!deleted) return res.status(404).json({ error: 'Palet no encontrado' })

    if (deleted.carga) await Load.findByIdAndUpdate(deleted.carga, { $pull: { palets: deleted._id } })

    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Error eliminando palet' })
  }
})

export default router