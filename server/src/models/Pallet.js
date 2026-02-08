import mongoose from 'mongoose'
import auditPlugin from './auditPlugin.js'
import Load from './Load.js'

const PalletSchema = new mongoose.Schema({
  numero_palet: { type: String, required: true, index: true },
  nombre: { type: String, index: true, default: '' },
  tipo: { type: String, enum: ['Seco', 'Refrigerado', 'Congelado', 'Técnico'], required: true },
  carga: { type: mongoose.Schema.Types.ObjectId, ref: 'Load', required: true },
  productos: { type: String, default: '' },
}, { timestamps: true })

// Compose nombre from numero_palet and carga label
PalletSchema.pre('save', async function(next) {
  try {
    const load = await Load.findById(this.carga).select('nombre barco')
    const cargaLabel = load?.nombre || (load?.barco ? String(load.barco) : '')
    this.nombre = `${this.numero_palet} - ${cargaLabel || 'Sin carga'}`
    next()
  } catch (err) {
    next(err)
  }
})

PalletSchema.pre('findOneAndUpdate', async function(next) {
  try {
    const update = this.getUpdate() || {}
    const numero = update.$set?.numero_palet ?? update.numero_palet
    const carga = update.$set?.carga ?? update.carga
    if (numero || carga) {
      const current = await this.model.findOne(this.getQuery()).select('numero_palet carga')
      const numeroFinal = String(numero ?? current.numero_palet)
      const cargaFinal = carga ?? current.carga
      const load = await Load.findById(cargaFinal).select('nombre barco')
      const cargaLabel = load?.nombre || (load?.barco ? String(load.barco) : '')
      update.$set = { ...(update.$set || {}), nombre: `${numeroFinal} - ${cargaLabel || 'Sin carga'}` }
      this.setUpdate(update)
    }
    next()
  } catch (err) {
    next(err)
  }
})

PalletSchema.plugin(auditPlugin)

export default mongoose.model('Pallet', PalletSchema)