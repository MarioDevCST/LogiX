import { Router } from 'express'
import bcrypt from 'bcryptjs'
import User from '../models/User.js'

const router = Router()

// POST /api/auth/login -> login con email y contraseña
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña son obligatorios' })
    }

    const user = await User.findOne({ email }).select('+password')
    if (!user) return res.status(401).json({ error: 'Credenciales inválidas' })

    const ok = await bcrypt.compare(password, user.password)
    if (!ok) return res.status(401).json({ error: 'Credenciales inválidas' })

    const { password: _, ...safe } = user.toObject()
    return res.json({ user: safe })
  } catch (err) {
    console.error('Error en login:', err)
    res.status(500).json({ error: 'Error en login' })
  }
})

export default router