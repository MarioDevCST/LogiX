import mongoose from 'mongoose'

const OrderSchema = new mongoose.Schema({
  number: { type: String, required: true, index: true },
  customerName: { type: String, required: true },
  address: { type: String, required: true },
  status: { type: String, enum: ['pending', 'assigned', 'in_transit', 'delivered', 'cancelled'], default: 'pending', index: true },
  routeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Route' },
  scheduledDate: { type: Date },
}, { timestamps: true })

export default mongoose.model('Order', OrderSchema)