import mongoose from 'mongoose'

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, index: true },
  password: { type: String, required: true, select: false },
  role: { type: String, enum: ['admin', 'dispatcher', 'driver','warehouse', 'consignee', 'logistic'], default: 'dispatcher' },
  active: { type: Boolean, default: true },
}, { timestamps: true })

export default mongoose.model('User', UserSchema)