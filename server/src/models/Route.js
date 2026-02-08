import mongoose from 'mongoose'

const StopSchema = new mongoose.Schema({
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
  position: { type: Number, required: true },
  eta: { type: Date },
})

const RouteSchema = new mongoose.Schema({
  name: { type: String, required: true },
  vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle' },
  driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'Driver' },
  status: { type: String, enum: ['planned', 'in_progress', 'completed'], default: 'planned', index: true },
  stops: [StopSchema],
}, { timestamps: true })

export default mongoose.model('Route', RouteSchema)