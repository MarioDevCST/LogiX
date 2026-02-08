import mongoose from 'mongoose'
import auditPlugin from './auditPlugin.js'

const ShipSchema = new mongoose.Schema({
  nombre_del_barco: { type: String, required: true, index: true },
  empresa: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
  responsable: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  tipo: { type: String, enum: ['Mercante', 'Ferry', 'Crucero'] },
}, { timestamps: true })

ShipSchema.plugin(auditPlugin)

export default mongoose.model('Ship', ShipSchema)