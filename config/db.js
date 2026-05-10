const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // Default to local MongoDB if no URI is provided
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/bus-monitoring-system';
    
    const conn = await mongoose.connect(mongoURI);

    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    // Don't exit, just continue without DB for demo purposes
    console.log('Continuing without database connection...');
  }
};

module.exports = connectDB;