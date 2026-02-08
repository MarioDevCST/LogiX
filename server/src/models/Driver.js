import mongoose from 'mongoose'

const DriverSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String },
  license: { type: String },
  active: { type: Boolean, default: true },
}, { timestamps: true })

export default mongoose.model('Driver', DriverSchema)