import { Router } from 'express'
import Pallet from '../models/Pallet.js'

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

// Crear palet
router.post('/', async (req, res) => {
  try {
    const { numero_palet, tipo, carga, creado_por } = req.body
    if (!numero_palet) return res.status(400).json({ error: 'numero_palet es obligatorio' })
    if (!tipo) return res.status(400).json({ error: 'tipo es obligatorio' })
    if (!carga) return res.status(400).json({ error: 'carga es obligatoria' })
    const created = await Pallet.create({ numero_palet: String(numero_palet), tipo, carga, creado_por: creado_por || 'Testing' })
    res.status(201).json(created)
  } catch (err) {
    res.status(500).json({ error: 'Error creando palet' })
  }
})

// Actualizar palet
router.put('/:id', async (req, res) => {
  try {
    const { numero_palet, tipo, carga, modificado_por } = req.body
    if (!modificado_por) return res.status(400).json({ error: 'modificado_por es obligatorio' })
    const updated = await Pallet.findByIdAndUpdate(
      req.params.id,
      { $set: { numero_palet: numero_palet && String(numero_palet), tipo, carga, modificado_por } },
      { new: true, runValidators: true }
    )
    if (!updated) return res.status(404).json({ error: 'Palet no encontrado' })
    res.json(updated)
  } catch (err) {
    res.status(500).json({ error: 'Error actualizando palet' })
  }
})

// Eliminar palet
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await Pallet.findByIdAndDelete(req.params.id)
    if (!deleted) return res.status(404).json({ error: 'Palet no encontrado' })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Error eliminando palet' })
  }
})

export default router