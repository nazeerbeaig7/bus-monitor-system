const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Bus = require('../models/Bus');
require('dotenv').config();

const seedBus = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('MongoDB Connected for seeding...');
    
    // Clear existing buses
    await Bus.deleteMany({});
    
    // Create test bus
    const salt = await bcrypt.genSalt(10);
    const hashedPin = await bcrypt.hash('1234', salt);
    
    const bus = new Bus({
      busId: 'BUS101',
      pin: hashedPin,
      driverName: 'John Driver',
      route: 'Campus ↔ City Center',
      capacity: 40,
      isActive: true,
      currentLocation: 'College Campus'
    });
    
    await bus.save();
    
    console.log('Sample bus data seeded successfully');
    console.log('Bus ID: BUS101');
    console.log('PIN: 1234');
    
    process.exit();
    
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

seedBus(); 