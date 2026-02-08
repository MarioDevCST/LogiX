import mongoose from 'mongoose'
import auditPlugin from './auditPlugin.js'

const CompanySchema = new mongoose.Schema({
  nombre: { type: String, required: true, index: true },
}, { timestamps: true })

CompanySchema.plugin(auditPlugin)

export default mongoose.model('Company', CompanySchema)