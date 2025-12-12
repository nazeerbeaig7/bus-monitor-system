const mongoose = require('mongoose');

const ComplaintSchema = new mongoose.Schema({
  busId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bus',
    default: null
  },
  busName: {
    type: String,
    default: null
  },
  busNumber: {
    type: String,
    default: null
  },
  driverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bus',
    default: null
  },
  driverName: {
    type: String,
    default: null
  },
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  studentName: {
    type: String,
    required: true
  },
  subject: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['schedule', 'behavior', 'cleanliness', 'safety', 'technical', 'other'],
    required: true
  },
  severity: {
    type: Number,
    min: 1,
    max: 5,
    default: 3
  },
  isAnonymous: {
    type: Boolean,
    default: false
  },
  readByAdmin: {
    type: Boolean,
    default: false
  },
  adminResponse: {
    type: String,
    default: null
  },
  adminActionTaken: {
    type: String,
    default: null
  },
  status: {
    type: String,
    enum: ['open', 'investigating', 'action_taken', 'resolved', 'closed'],
    default: 'open'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  resolvedAt: {
    type: Date,
    default: null
  }
});

// Update timestamps on save
ComplaintSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // If status changed to resolved/closed, set resolvedAt
  if (this.isModified('status') && 
      (this.status === 'resolved' || this.status === 'closed') && 
      !this.resolvedAt) {
    this.resolvedAt = Date.now();
  }
  
  next();
});

module.exports = mongoose.model('Complaint', ComplaintSchema); 