import mongoose from 'mongoose'

const VehicleSchema = new mongoose.Schema({
  plate: { type: String, required: true, unique: true },
  capacity: { type: Number },
  active: { type: Boolean, default: true },
}, { timestamps: true })

export default mongoose.model('Vehicle', VehicleSchema)