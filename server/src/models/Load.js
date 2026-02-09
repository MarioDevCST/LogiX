import mongoose from 'mongoose'
import auditPlugin from './auditPlugin.js'

const LoadSchema = new mongoose.Schema({
  nombre: { type: String },
  fecha_de_carga: { type: Date },
  hora_de_carga: { type: String },
  fecha_de_descarga: { type: Date },
  hora_de_descarga: { type: String },
  barco: { type: mongoose.Schema.Types.ObjectId, ref: 'Ship' },
  entrega: [{ type: String, enum: ['Provisión', 'Alimentación', 'Repuesto', 'Técnico'] }],
  chofer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  palets: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Pallet' }],
  carga: [{ type: String, enum: ['Seco', 'Refrigerado', 'Congelado', 'Técnico'] }],
  consignatario: { type: mongoose.Schema.Types.ObjectId, ref: 'Consignee' },
  cash: { type: Boolean, default: false },
  lancha: { type: Boolean, default: false },
  estado_viaje: { type: String, enum: ['Preparando', 'En Proceso', 'Cancelado', 'Entregado'], default: 'Preparando' },
}, { timestamps: true })

// Virtual: total_palets
LoadSchema.virtual('total_palets').get(function () {
  return Array.isArray(this.palets) ? this.palets.length : 0
})

// Virtual: estado_carga (true si campos principales presentes)
LoadSchema.virtual('estado_carga').get(function () {
  const requiredPresent = [
    this.fecha_de_carga,
    this.barco,
    Array.isArray(this.entrega) ? this.entrega.length > 0 : !!this.entrega,
    this.chofer,
    this.consignatario,
    this.estado_viaje,
  ].every(Boolean)
  const hasPalets = Array.isArray(this.palets) && this.palets.length > 0
  return requiredPresent && hasPalets
})

LoadSchema.plugin(auditPlugin)

export default mongoose.model('Load', LoadSchema)