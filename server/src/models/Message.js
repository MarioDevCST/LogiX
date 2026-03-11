import mongoose from 'mongoose'
import auditPlugin from './auditPlugin.js'

const MessageSchema = new mongoose.Schema({
  titulo: { type: String, required: true, index: true },
  cuerpo: { type: String, required: true },
  roles: [{ type: String, enum: ['admin', 'dispatcher', 'driver', 'warehouse', 'consignee', 'logistic'], index: true }],
}, { timestamps: true })

MessageSchema.plugin(auditPlugin)

export default mongoose.model('Message', MessageSchema)