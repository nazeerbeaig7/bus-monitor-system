const mongoose = require('mongoose');

const FeedbackSchema = new mongoose.Schema({
  busId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bus',
    default: null
  },
  busName: {
    type: String,
    default: 'General Feedback'
  },
  busNumber: {
    type: String,
    default: 'N/A'
  },
  driverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bus',
    default: null
  },
  driverName: {
    type: String,
    default: 'N/A'
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
  isAnonymous: {
    type: Boolean,
    default: false
  },
  sentToDriver: {
    type: Boolean,
    default: true
  },
  sentToAdmin: {
    type: Boolean,
    default: true
  },
  readByDriver: {
    type: Boolean,
    default: false
  },
  readByAdmin: {
    type: Boolean,
    default: false
  },
  driverResponse: {
    type: String,
    default: null
  },
  adminResponse: {
    type: String,
    default: null
  },
  status: {
    type: String,
    enum: ['pending', 'responding', 'resolved'],
    default: 'pending'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update timestamps on save
FeedbackSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Feedback', FeedbackSchema); 