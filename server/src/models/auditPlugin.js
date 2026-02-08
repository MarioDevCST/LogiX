import mongoose from 'mongoose'

// Plugin de auditoría: añade campos comunes y actualiza fechas automáticamente
export default function auditPlugin(schema) {
  schema.add({
    fecha_creacion: { type: Date, default: Date.now },
    fecha_modificacion: { type: Date, default: Date.now },
    creado_por: { type: String, default: 'Testing' },
    modificado_por: { type: String },
  })

  // asegurar virtuals visibles en JSON/objects
  schema.set('toJSON', { virtuals: true })
  schema.set('toObject', { virtuals: true })

  // actualizar fecha_modificacion en operaciones de guardado
  schema.pre('save', function (next) {
    this.fecha_modificacion = new Date()
    if (!this.fecha_creacion) this.fecha_creacion = new Date()
    next()
  })

  // actualizar fecha_modificacion en updates
  schema.pre('findOneAndUpdate', function (next) {
    const update = this.getUpdate() || {}
    if (!update.$set) update.$set = {}
    update.$set.fecha_modificacion = new Date()
    this.setUpdate(update)
    next()
  })
}