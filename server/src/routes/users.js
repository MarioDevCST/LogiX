import { Router } from 'express'
import bcrypt from 'bcryptjs'
import User from '../models/User.js'

const router = Router()

// GET /api/users -> lista de usuarios (sin password)
router.get('/', async (req, res) => {
  try {
    const users = await User.find().select('name email role active createdAt')
    res.json(users)
  } catch (err) {
    res.status(500).json({ error: 'Error obteniendo usuarios' })
  }
})

// GET /api/users/:id -> detalle de usuario
router.get('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('name email role active createdAt updatedAt')
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' })
    res.json(user)
  } catch (err) {
    res.status(500).json({ error: 'Error obteniendo usuario' })
  }
})

// PUT /api/users/:id -> actualizar usuario (sin cambiar password aquí)
router.put('/:id', async (req, res) => {
  try {
    const { name, email, role, active } = req.body
    const updated = await User.findByIdAndUpdate(
      req.params.id,
      { $set: { name, email, role, active } },
      { new: true, runValidators: true, fields: 'name email role active createdAt updatedAt' }
    )
    if (!updated) return res.status(404).json({ error: 'Usuario no encontrado' })
    res.json(updated)
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'Email ya registrado' })
    res.status(500).json({ error: 'Error actualizando usuario' })
  }
})

// POST /api/users -> crear usuario
router.post('/', async (req, res) => {
  try {
    const { name, email, password, role = 'dispatcher', active = true } = req.body
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'name, email y password son obligatorios' })
    }
    const exists = await User.findOne({ email })
    if (exists) return res.status(409).json({ error: 'Email ya registrado' })

    const hash = await bcrypt.hash(password, 10)
    const user = await User.create({ name, email, password: hash, role, active })

    // Devuelvo sin password
    const { password: _, ...safe } = user.toObject()
    res.status(201).json(safe)
  } catch (err) {
    res.status(500).json({ error: 'Error creando usuario' })
  }
})

export default router