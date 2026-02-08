import { Router } from 'express'
import Ship from '../models/Ship.js'

const router = Router()

// Lista de barcos (populate empresa y responsable)
router.get('/', async (req, res) => {
  try {
    const ships = await Ship.find()
      .populate('empresa')
      .populate('responsable', 'name email role')
    res.json(ships)
  } catch (err) {
    res.status(500).json({ error: 'Error obteniendo barcos' })
  }
})

// Detalle de barco
router.get('/:id', async (req, res) => {
  try {
    const item = await Ship.findById(req.params.id)
      .populate('empresa', 'nombre')
      .populate('responsable', 'name email')
    if (!item) return res.status(404).json({ error: 'Barco no encontrado' })
    res.json(item)
  } catch (err) {
    res.status(500).json({ error: 'Error obteniendo barco' })
  }
})

// Crear barco
router.post('/', async (req, res) => {
  try {
    const { nombre_del_barco, empresa, responsable, tipo, creado_por } = req.body
    if (!nombre_del_barco) return res.status(400).json({ error: 'nombre_del_barco es obligatorio' })
    const created = await Ship.create({ nombre_del_barco, empresa, responsable, tipo, creado_por: creado_por || 'Testing' })
    res.status(201).json(created)
  } catch (err) {
    res.status(500).json({ error: 'Error creando barco' })
  }
})

// Actualizar barco
router.put('/:id', async (req, res) => {
  try {
    const { nombre_del_barco, empresa, responsable, tipo, modificado_por } = req.body
    if (!modificado_por) return res.status(400).json({ error: 'modificado_por es obligatorio' })
    const updated = await Ship.findByIdAndUpdate(
      req.params.id,
      { $set: { nombre_del_barco, empresa, responsable, tipo, modificado_por } },
      { new: true, runValidators: true }
    )
    if (!updated) return res.status(404).json({ error: 'Barco no encontrado' })
    res.json(updated)
  } catch (err) {
    res.status(500).json({ error: 'Error actualizando barco' })
  }
})

// Eliminar barco
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await Ship.findByIdAndDelete(req.params.id)
    if (!deleted) return res.status(404).json({ error: 'Barco no encontrado' })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Error eliminando barco' })
  }
})

export default router