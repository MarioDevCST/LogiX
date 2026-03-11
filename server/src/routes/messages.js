import { Router } from 'express'
import Message from '../models/Message.js'

const router = Router()

// GET /api/messages -> lista de mensajes (opcional filtro por role)
router.get('/', async (req, res) => {
  try {
    const { role } = req.query
    const query = role ? { roles: role } : {}
    const messages = await Message.find(query).sort({ createdAt: -1 })
    res.json(messages)
  } catch (err) {
    res.status(500).json({ error: 'Error obteniendo mensajes' })
  }
})

// GET /api/messages/:id -> detalle
router.get('/:id', async (req, res) => {
  try {
    const msg = await Message.findById(req.params.id)
    if (!msg) return res.status(404).json({ error: 'Mensaje no encontrado' })
    res.json(msg)
  } catch (err) {
    res.status(500).json({ error: 'Error obteniendo mensaje' })
  }
})

// POST /api/messages -> crear
router.post('/', async (req, res) => {
  try {
    const { titulo, cuerpo, roles = [], creado_por } = req.body
    if (!titulo || !cuerpo) {
      return res.status(400).json({ error: 'titulo y cuerpo son obligatorios' })
    }
    const msg = await Message.create({ titulo, cuerpo, roles, creado_por })
    res.status(201).json(msg)
  } catch (err) {
    res.status(500).json({ error: 'Error creando mensaje' })
  }
})

// PUT /api/messages/:id -> actualizar
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { titulo, cuerpo, roles = [], modificado_por } = req.body
    const updated = await Message.findByIdAndUpdate(id, { $set: { titulo, cuerpo, roles, modificado_por } }, { new: true })
    if (!updated) return res.status(404).json({ error: 'Mensaje no encontrado' })
    res.json(updated)
  } catch (err) {
    res.status(500).json({ error: 'Error actualizando mensaje' })
  }
})

// DELETE /api/messages/:id -> eliminar
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params
    await Message.findByIdAndDelete(id)
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Error eliminando mensaje' })
  }
})

export default router