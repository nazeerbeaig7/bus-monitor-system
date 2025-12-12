const express = require('express');
const router = express.Router();
const { ensureAuthenticated, ensureStudent } = require('../config/auth');
const Bus = require('../models/Bus');
const User = require('../models/User');
const Feedback = require('../models/Feedback');
const Complaint = require('../models/Complaint');

// Student Dashboard
router.get('/dashboard', ensureStudent, async (req, res) => {
  try {
    // Fetch active buses
    const buses = await Bus.find({ isActive: true });
    
    // Fetch today's day
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = days[new Date().getDay()];
    
    // Filter buses with schedules for today
    const busesWithScheduleToday = buses.filter(bus => {
      if (!bus.schedule || bus.schedule.length === 0) return false;
      return bus.schedule.some(schedule => schedule.days.includes(today));
    });
    
    res.render('student/dashboard', {
      title: 'Student Dashboard',
      user: req.session.user,
      buses: buses,
      busesCount: buses.length,
      busesWithScheduleToday: busesWithScheduleToday
    });
  } catch (err) {
    console.error('Error loading student dashboard:', err);
    res.render('student/dashboard', {
      title: 'Student Dashboard',
      user: req.session.user,
      error: 'Could not load dashboard data'
    });
  }
});

// List all available buses
router.get('/buses', ensureStudent, async (req, res) => {
  try {
    const buses = await Bus.find({ isActive: true });
    
    res.render('student/buses', {
      title: 'Available Buses',
      user: req.session.user,
      buses: buses
    });
  } catch (err) {
    console.error('Error loading buses:', err);
    req.flash('error_msg', 'Failed to load buses');
    res.redirect('/student/dashboard');
  }
});

// View Bus Schedule
router.get('/schedule', ensureStudent, async (req, res) => {
  try {
    // Fetch active buses with their schedules
    const buses = await Bus.find({ isActive: true });
    
    // Current day of the week
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = days[new Date().getDay()];
    
    // Get the selected bus ID from query parameters
    const selectedBusId = req.query.busId || '';

    // Find the selected bus if ID is provided
    let selectedBus = null;
    if (selectedBusId) {
      selectedBus = await Bus.findOne({ busId: selectedBusId, isActive: true });
    }

    // Get the selected day from query parameters or default to today
    const selectedDay = req.query.day || today;
    
    res.render('student/schedule', {
      title: 'Bus Schedule',
      user: req.session.user,
      buses: buses,
      today: today,
      selectedDay: selectedDay,
      selectedBus: selectedBus,
      selectedBusId: selectedBusId,
      query: req.query,
      messages: {
        error: req.flash('error'),
        success: req.flash('success')
      }
    });
  } catch (err) {
    console.error('Error loading schedule:', err);
    req.flash('error_msg', 'Failed to load bus schedule');
    res.redirect('/student/dashboard');
  }
});

// Track Bus Location
router.get('/track/:busId?', ensureStudent, async (req, res) => {
  try {
    let selectedBus = null;
    const buses = await Bus.find({ isActive: true });
    
    // If busId is provided, find that specific bus
    if (req.params.busId) {
      selectedBus = await Bus.findOne({ busId: req.params.busId, isActive: true });
      if (!selectedBus) {
        req.flash('error_msg', 'Bus not found or not active');
        return res.redirect('/student/buses');
      }
    }
    
    res.render('student/track', {
      title: 'Track Bus',
      user: req.session.user,
      buses: buses,
      selectedBus: selectedBus
    });
  } catch (err) {
    console.error('Error tracking bus:', err);
    req.flash('error_msg', 'Failed to load tracking data');
    res.redirect('/student/buses');
  }
});

// Submit feedback for a bus
router.post('/feedback/:busId', ensureStudent, async (req, res) => {
  try {
    const { rating, message } = req.body;
    const { busId } = req.params;
    
    // Validate input
    if (!rating || rating < 1 || rating > 5) {
      req.flash('error_msg', 'Please provide a valid rating between 1 and 5');
      return res.redirect(`/student/track/${busId}`);
    }
    
    // Find the bus
    const bus = await Bus.findOne({ busId });
    if (!bus) {
      req.flash('error_msg', 'Bus not found');
      return res.redirect('/student/buses');
    }
    
    // Add feedback to the bus
    bus.feedback.unshift({
      studentId: req.session.user.id,
      studentName: req.session.user.name,
      message: message || '',
      rating: parseInt(rating),
      timestamp: new Date(),
      isRead: false
    });
    
    await bus.save();
    
    req.flash('success_msg', 'Thank you for your feedback!');
    res.redirect(`/student/track/${busId}`);
  } catch (err) {
    console.error('Error submitting feedback:', err);
    req.flash('error_msg', 'Failed to submit feedback');
    res.redirect('/student/buses');
  }
});

// Student Profile
router.get('/profile', ensureStudent, async (req, res) => {
  try {
    const user = await User.findById(req.session.user.id);
    if (!user) {
      req.flash('error_msg', 'User not found');
      return res.redirect('/student/dashboard');
    }
    
    res.render('student/profile', {
      title: 'My Profile',
      user: user
    });
  } catch (err) {
    console.error('Error loading profile:', err);
    req.flash('error_msg', 'Failed to load profile');
    res.redirect('/student/dashboard');
  }
});

// API endpoint to get bus location
router.get('/api/bus-location/:busId', ensureStudent, async (req, res) => {
  try {
    const bus = await Bus.findOne({ busId: req.params.busId });
    if (!bus) {
      return res.status(404).json({ success: false, message: 'Bus not found' });
    }
    
    res.json({
      success: true,
      busId: bus.busId,
      busName: bus.busName,
      currentLocation: bus.currentLocation,
      coordinates: bus.currentCoordinates,
      boardingPoint: bus.boardingPoint,
      destinationPoint: bus.destinationPoint,
      lastUpdated: bus.currentCoordinates.lastUpdated
    });
  } catch (err) {
    console.error('Error fetching bus location:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Send feedback to driver and admin
router.post('/send-feedback', ensureStudent, async (req, res) => {
  try {
    const { busId, subject, message, isAnonymous } = req.body;
    
    // Create new feedback document with minimal required fields
    const feedback = new Feedback({
      subject,
      message,
      studentId: req.session.user._id,
      studentName: isAnonymous ? 'Anonymous Student' : req.session.user.name,
      isAnonymous: !!isAnonymous,
      busId: null, // Set default values to avoid validation errors
      busName: 'General Feedback',
      busNumber: 'N/A',
      driverId: null, // Set to null by default - will update if bus exists
      driverName: 'N/A'
    });
    
    // If bus is specified, add bus name and driver info
    if (busId) {
      const bus = await Bus.findById(busId);
      if (bus) {
        feedback.busId = bus._id;
        feedback.busName = bus.name || bus.busName;
        feedback.busNumber = bus.busNumber;
        feedback.driverId = bus.driverId || bus._id; // Use bus ID as driver ID if not specified
        feedback.driverName = bus.driverName;
      }
    }
    
    await feedback.save();
    
    return res.json({
      success: true,
      message: 'Your feedback has been submitted successfully!'
    });
  } catch (error) {
    console.error('Error sending feedback:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while submitting your feedback. Please try again.'
    });
  }
});

// Send complaint to admin
router.post('/send-complaint', ensureStudent, async (req, res) => {
  try {
    const { busId, type, subject, message, severity, isAnonymous } = req.body;
    
    // Create new complaint document with minimal required fields
    const complaint = new Complaint({
      type,
      subject,
      message,
      severity: parseInt(severity) || 3,
      studentId: req.session.user._id,
      studentName: isAnonymous ? 'Anonymous Student' : req.session.user.name,
      isAnonymous: !!isAnonymous,
      status: 'open',
      busId: null,  // Will update if bus exists
      busName: null,
      busNumber: null,
      driverId: null,
      driverName: null
    });
    
    // If bus is specified, add bus name and driver info
    if (busId) {
      const bus = await Bus.findById(busId);
      if (bus) {
        complaint.busId = bus._id;
        complaint.busName = bus.name || bus.busName;
        complaint.busNumber = bus.busNumber;
        complaint.driverId = bus.driverId || bus._id; // Use bus ID as driver ID if not specified
        complaint.driverName = bus.driverName;
      }
    }
    
    await complaint.save();
    
    return res.json({
      success: true,
      message: 'Your complaint has been submitted successfully!'
    });
  } catch (error) {
    console.error('Error sending complaint:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while submitting your complaint. Please try again.'
    });
  }
});

// API endpoint to get all bus locations for map
router.get('/api/all-bus-locations', ensureStudent, async (req, res) => {
  try {
    const buses = await Bus.find({ isActive: true });
    const busLocations = buses.map(bus => ({
      _id: bus._id,
      busId: bus.busId,
      busName: bus.busName || bus.name,
      busNumber: bus.busNumber,
      route: bus.route,
      isActive: bus.isActive,
      currentLocation: bus.currentLocation,
      coordinates: bus.currentCoordinates,
      lastUpdated: bus.currentCoordinates?.lastUpdated || new Date()
    }));
    
    res.json({
      success: true,
      buses: busLocations
    });
  } catch (err) {
    console.error('Error fetching bus locations:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router; 