import { Router } from 'express'
import Consignee from '../models/Consignee.js'

const router = Router()

// Lista de consignatarios
router.get('/', async (req, res) => {
  try {
    const list = await Consignee.find()
    res.json(list)
  } catch (err) {
    res.status(500).json({ error: 'Error obteniendo consignatarios' })
  }
})

// Detalle de consignatario
router.get('/:id', async (req, res) => {
  try {
    const item = await Consignee.findById(req.params.id)
    if (!item) return res.status(404).json({ error: 'Consignatario no encontrado' })
    res.json(item)
  } catch (err) {
    res.status(500).json({ error: 'Error obteniendo consignatario' })
  }
})

// Crear consignatario
router.post('/', async (req, res) => {
  try {
    const { nombre, creado_por } = req.body
    if (!nombre) return res.status(400).json({ error: 'nombre es obligatorio' })
    const created = await Consignee.create({ nombre, creado_por: creado_por || 'Testing' })
    res.status(201).json(created)
  } catch (err) {
    res.status(500).json({ error: 'Error creando consignatario' })
  }
})

// Actualizar consignatario
router.put('/:id', async (req, res) => {
  try {
    const { nombre, modificado_por } = req.body
    if (!modificado_por) return res.status(400).json({ error: 'modificado_por es obligatorio' })
    const updated = await Consignee.findByIdAndUpdate(
      req.params.id,
      { $set: { nombre, modificado_por } },
      { new: true, runValidators: true }
    )
    if (!updated) return res.status(404).json({ error: 'Consignatario no encontrado' })
    res.json(updated)
  } catch (err) {
    res.status(500).json({ error: 'Error actualizando consignatario' })
  }
})

// Eliminar consignatario
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await Consignee.findByIdAndDelete(req.params.id)
    if (!deleted) return res.status(404).json({ error: 'Consignatario no encontrado' })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Error eliminando consignatario' })
  }
})

export default router