import { Router } from 'express'
import Load from '../models/Load.js'
import Ship from '../models/Ship.js'

const router = Router()

// Lista de cargas (populate de barco)
router.get('/', async (req, res) => {
  try {
    const list = await Load.find()
      .populate('barco', 'nombre_del_barco')
      .populate('chofer', 'name')
      .populate('consignatario', 'name')
      .populate('palets', 'numero_palet')
    res.json(list)
  } catch (err) {
    res.status(500).json({ error: 'Error obteniendo cargas' })
  }
})

// Detalle de carga
router.get('/:id', async (req, res) => {
  try {
    const item = await Load.findById(req.params.id)
      .populate('barco', 'nombre_del_barco')
      .populate('chofer', 'name')
      .populate('consignatario', 'name')
      .populate('palets')
    if (!item) return res.status(404).json({ error: 'Carga no encontrada' })
    res.json(item)
  } catch (err) {
    res.status(500).json({ error: 'Error obteniendo carga' })
  }
})

function isoDateOnly(value) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

// Crear carga (soporta múltiples valores en entrega y carga, calcula nombre y lancha)
router.post('/', async (req, res) => {
  try {
    const {
      fecha_de_carga,
      hora_de_carga,
      fecha_de_descarga,
      hora_de_descarga,
      barco,
      entrega,
      chofer,
      palets,
      carga,
      consignatario,
      cash,
      estado_viaje,
      creado_por,
      lancha,
    } = req.body

    const entregaArr = Array.isArray(entrega) ? entrega : entrega ? [entrega] : []
    const cargaArr = Array.isArray(carga) ? carga : carga ? [carga] : []

    let nombre = ''
    if (barco && fecha_de_carga) {
      const ship = await Ship.findById(barco).select('nombre_del_barco')
      if (ship) nombre = `${ship.nombre_del_barco} - ${isoDateOnly(fecha_de_carga)}`
    }

    const payload = {
      nombre,
      fecha_de_carga,
      hora_de_carga,
      fecha_de_descarga,
      hora_de_descarga,
      barco,
      entrega: entregaArr,
      chofer,
      palets,
      carga: cargaArr,
      consignatario,
      cash,
      estado_viaje,
      lancha: !!lancha,
      creado_por: creado_por || 'Testing',
    }

    const created = await Load.create(payload)
    const populated = await created.populate([
      { path: 'barco' },
      { path: 'chofer', select: 'name email role' },
      { path: 'consignatario', select: 'name email role' },
      { path: 'palets' },
    ])
    res.status(201).json(populated)
  } catch (err) {
    res.status(500).json({ error: 'Error creando carga' })
  }
})

// Actualizar carga (recalcula nombre si cambian barco o fecha)
router.put('/:id', async (req, res) => {
  try {
    const {
      fecha_de_carga,
      hora_de_carga,
      fecha_de_descarga,
      hora_de_descarga,
      barco,
      entrega,
      chofer,
      palets,
      carga,
      consignatario,
      cash,
      estado_viaje,
      modificado_por,
      lancha,
    } = req.body

    if (!modificado_por) return res.status(400).json({ error: 'modificado_por es obligatorio' })

    const current = await Load.findById(req.params.id)
    if (!current) return res.status(404).json({ error: 'Carga no encontrada' })

    const entregaArr = Array.isArray(entrega) ? entrega : entrega ? [entrega] : current.entrega
    const cargaArr = Array.isArray(carga) ? carga : carga ? [carga] : current.carga

    const nextBarco = typeof barco !== 'undefined' ? barco : current.barco
    const nextFecha = typeof fecha_de_carga !== 'undefined' ? fecha_de_carga : current.fecha_de_carga

    let nombre = current.nombre
    if (nextBarco && nextFecha) {
      const ship = await Ship.findById(nextBarco).select('nombre_del_barco')
      if (ship) nombre = `${ship.nombre_del_barco} - ${isoDateOnly(nextFecha)}`
    }

    const updated = await Load.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          nombre,
          fecha_de_carga,
          hora_de_carga,
          fecha_de_descarga,
          hora_de_descarga,
          barco,
          entrega: entregaArr,
          chofer,
          palets,
          carga: cargaArr,
          consignatario,
          cash,
          estado_viaje,
          lancha: typeof lancha !== 'undefined' ? !!lancha : current.lancha,
          modificado_por,
        },
      },
      { new: true, runValidators: true }
    )

    const populated = await updated.populate([
      { path: 'barco' },
      { path: 'chofer', select: 'name email role' },
      { path: 'consignatario', select: 'name email role' },
      { path: 'palets' },
    ])

    res.json(populated)
  } catch (err) {
    res.status(500).json({ error: 'Error actualizando carga' })
  }
})

// Eliminar carga
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await Load.findByIdAndDelete(req.params.id)
    if (!deleted) return res.status(404).json({ error: 'Carga no encontrada' })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Error eliminando carga' })
  }
})

export default router