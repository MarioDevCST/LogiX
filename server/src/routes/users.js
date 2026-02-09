import { Router } from 'express'
import bcrypt from 'bcryptjs'
import User from '../models/User.js'

const router = Router()

// GET /api/users -> lista de usuarios (sin password)
router.get('/', async (req, res) => {
  try {
    const users = await User.find()
    res.json(users)
  } catch (err) {
    res.status(500).json({ error: 'Error obteniendo usuarios' })
  }
})

// GET /api/users/:id -> detalle de usuario (sin password)
router.get('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' })
    res.json(user)
  } catch (err) {
    res.status(500).json({ error: 'Error obteniendo usuario' })
  }
})

// POST /api/users -> crear usuario (password requerido)
router.post('/', async (req, res) => {
  try {
    const { name, email, password, role = 'dispatcher', active = true } = req.body
    const emailNorm = String(email || '').trim().toLowerCase()

    if (!name || !emailNorm) {
      return res.status(400).json({ error: 'name y email son obligatorios' })
    }

    const exists = await User.findOne({ email: new RegExp(`^${emailNorm.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}$`, 'i') })
    if (exists) return res.status(409).json({ error: 'Email ya registrado' })

    const passwordStr = String(password || '').trim()
    if (!passwordStr) {
      return res.status(400).json({ error: 'password es obligatorio' })
    }

    const hash = await bcrypt.hash(passwordStr, 10)
    const user = await User.create({ name, email: emailNorm, password: hash, role, active })

    const { password: _, ...safe } = user.toObject()
    res.status(201).json(safe)
  } catch (err) {
    res.status(500).json({ error: 'Error creando usuario' })
  }
})

// PUT /api/users/:id -> actualizar usuario (hash si viene password)
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const data = { ...req.body }
    if (data.password) {
      data.password = await bcrypt.hash(String(data.password), 10)
    }
    const updated = await User.findByIdAndUpdate(id, data, { new: true })
    if (!updated) return res.status(404).json({ error: 'Usuario no encontrado' })
    const { password: _, ...safe } = updated.toObject()
    res.json(safe)
  } catch (err) {
    res.status(500).json({ error: 'Error actualizando usuario' })
  }
})

// DELETE /api/users/:id -> eliminar usuario
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params
    await User.findByIdAndDelete(id)
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Error eliminando usuario' })
  }
})

export default router