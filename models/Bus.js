const mongoose = require('mongoose');

const BusSchema = new mongoose.Schema({
  busName: {
    type: String,
    required: true
  },
  busId: {
    type: String,
    required: true,
    unique: true
  },
  busNumber: {
    type: String,
    required: true
  },
  plateNumber: {
    type: String,
    required: true
  },
  driverName: {
    type: String,
    required: true
  },
  route: {
    type: String,
    required: true
  },
  capacity: {
    type: Number,
    required: true
  },
  pin: {
    type: String,
    required: true
  },
  currentLocation: {
    type: String,
    default: 'Not specified'
  },
  currentCoordinates: {
    lat: {
      type: Number,
      default: null
    },
    lon: {
      type: Number,
      default: null
    },
    lastUpdated: {
      type: Date,
      default: null
    }
  },
  boardingPoint: {
    name: {
      type: String,
      default: ''
    },
    lat: {
      type: Number,
      default: null
    },
    lon: {
      type: Number,
      default: null
    }
  },
  destinationPoint: {
    name: {
      type: String,
      default: ''
    },
    lat: {
      type: Number,
      default: null
    },
    lon: {
      type: Number,
      default: null
    }
  },
  notes: {
    type: String,
    default: ''
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastMaintenanceDate: {
    type: Date,
    default: null
  },
  nextMaintenanceDate: {
    type: Date,
    default: null
  },
  fuelStatus: {
    type: Number,
    default: 70,
    min: 0,
    max: 100
  },
  engineHealth: {
    type: Number,
    default: 85,
    min: 0,
    max: 100
  },
  maintenanceIssues: [{
    issue: String,
    date: Date,
    resolved: Boolean
  }],
  schedule: [{
    time: String,
    departure: String,
    arrival: String,
    days: [String]
  }],
  recentActivity: [{
    action: String,
    timestamp: {
      type: Date,
      default: Date.now
    },
    details: String
  }],
  feedback: [{
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    studentName: String,
    message: String,
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    isRead: {
      type: Boolean,
      default: false
    }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Bus = mongoose.model('Bus', BusSchema);

module.exports = Bus; 