import { Router } from 'express'
import Location from '../models/Location.js'

const router = Router()

// Lista de localizaciones
router.get('/', async (req, res) => {
  try {
    const list = await Location.find().select('nombre ciudad puerto coordenadas fecha_creacion fecha_modificacion creado_por modificado_por')
    res.json(list)
  } catch (err) {
    res.status(500).json({ error: 'Error obteniendo localizaciones' })
  }
})

// Detalle de localización
router.get('/:id', async (req, res) => {
  try {
    const item = await Location.findById(req.params.id)
    if (!item) return res.status(404).json({ error: 'Localización no encontrada' })
    res.json(item)
  } catch (err) {
    res.status(500).json({ error: 'Error obteniendo localización' })
  }
})

// Crear localización
router.post('/', async (req, res) => {
  try {
    const { nombre, ciudad, puerto, coordenadas, creado_por } = req.body
    if (!nombre) return res.status(400).json({ error: 'nombre es obligatorio' })
    const created = await Location.create({ nombre, ciudad, puerto, coordenadas, creado_por: creado_por || 'Testing' })
    res.status(201).json(created)
  } catch (err) {
    res.status(500).json({ error: 'Error creando localización' })
  }
})

// Actualizar localización
router.put('/:id', async (req, res) => {
  try {
    const { nombre, ciudad, puerto, coordenadas, modificado_por } = req.body
    if (!modificado_por) return res.status(400).json({ error: 'modificado_por es obligatorio' })
    const updated = await Location.findByIdAndUpdate(
      req.params.id,
      { $set: { nombre, ciudad, puerto, coordenadas, modificado_por } },
      { new: true, runValidators: true }
    )
    if (!updated) return res.status(404).json({ error: 'Localización no encontrada' })
    res.json(updated)
  } catch (err) {
    res.status(500).json({ error: 'Error actualizando localización' })
  }
})

// Eliminar localización
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await Location.findByIdAndDelete(req.params.id)
    if (!deleted) return res.status(404).json({ error: 'Localización no encontrada' })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Error eliminando localización' })
  }
})

export default router