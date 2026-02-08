import { Router } from 'express'
import Company from '../models/Company.js'

const router = Router()

// Lista de empresas
router.get('/', async (req, res) => {
  try {
    const list = await Company.find().select('nombre fecha_creacion fecha_modificacion creado_por modificado_por createdAt')
    res.json(list)
  } catch (err) {
    res.status(500).json({ error: 'Error obteniendo empresas' })
  }
})

// Detalle de empresa
router.get('/:id', async (req, res) => {
  try {
    const item = await Company.findById(req.params.id)
    if (!item) return res.status(404).json({ error: 'Empresa no encontrada' })
    res.json(item)
  } catch (err) {
    res.status(500).json({ error: 'Error obteniendo empresa' })
  }
})

// Crear empresa
router.post('/', async (req, res) => {
  try {
    const { nombre, creado_por } = req.body
    if (!nombre) return res.status(400).json({ error: 'nombre es obligatorio' })
    const created = await Company.create({ nombre, creado_por: creado_por || 'Testing' })
    res.status(201).json(created)
  } catch (err) {
    res.status(500).json({ error: 'Error creando empresa' })
  }
})

// Actualizar empresa
router.put('/:id', async (req, res) => {
  try {
    const { nombre, modificado_por } = req.body
    if (!modificado_por) return res.status(400).json({ error: 'modificado_por es obligatorio' })
    const updated = await Company.findByIdAndUpdate(
      req.params.id,
      { $set: { nombre, modificado_por } },
      { new: true, runValidators: true }
    )
    if (!updated) return res.status(404).json({ error: 'Empresa no encontrada' })
    res.json(updated)
  } catch (err) {
    res.status(500).json({ error: 'Error actualizando empresa' })
  }
})

// Eliminar empresa
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await Company.findByIdAndDelete(req.params.id)
    if (!deleted) return res.status(404).json({ error: 'Empresa no encontrada' })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Error eliminando empresa' })
  }
})

export default router