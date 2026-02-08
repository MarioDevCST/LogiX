import mongoose from 'mongoose'
import auditPlugin from './auditPlugin.js'

const LocationSchema = new mongoose.Schema({
  nombre: { type: String, required: true, index: true },
  ciudad: { type: String },
  puerto: { type: String },
  coordenadas: { type: String },
}, { timestamps: true })

LocationSchema.plugin(auditPlugin)

export default mongoose.model('Location', LocationSchema)