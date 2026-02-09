import mongoose from 'mongoose'
import auditPlugin from './auditPlugin.js'

const ConsigneeSchema = new mongoose.Schema({
  nombre: { type: String, required: true, index: true },
}, { timestamps: true })

ConsigneeSchema.plugin(auditPlugin)

export default mongoose.model('Consignee', ConsigneeSchema)