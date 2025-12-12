const express = require('express');
const router = express.Router();
const { ensureAuthenticated, ensureDriver } = require('../config/auth');
const Bus = require('../models/Bus');
const Feedback = require('../models/Feedback');

// Driver Dashboard
router.get('/dashboard', ensureDriver, async (req, res) => {
  try {
    // Fetch full bus data for the dashboard
    const bus = await Bus.findById(req.session.user.id);
    
    res.render('driver/dashboard', {
      title: 'Driver Dashboard',
      user: req.session.user,
      bus: bus
    });
  } catch (err) {
    console.error('Error fetching bus data:', err);
    res.render('driver/dashboard', {
      title: 'Driver Dashboard',
      user: req.session.user,
      error_msg: 'Failed to load bus data'
    });
  }
});

// Update Bus Location
router.get('/update-location', ensureDriver, async (req, res) => {
  try {
    // Get full bus data including location info
    const bus = await Bus.findById(req.session.user.id);
    
    // Add bus data to user object so we can access it in the template
    const userData = { ...req.session.user, bus };
    
    res.render('driver/update-location', {
      title: 'Update Location',
      user: userData
    });
  } catch (err) {
    console.error('Error fetching bus data for location update:', err);
    res.render('driver/update-location', {
      title: 'Update Location',
      user: req.session.user,
      error_msg: 'Failed to load location data'
    });
  }
});

// Handle location update form submission
router.post('/update-location', ensureDriver, async (req, res) => {
  try {
    const { 
      currentLat, currentLon,
      boardingLat, boardingLon, boardingPointName,
      destinationLat, destinationLon, destinationPointName
    } = req.body;
    
    // Find the bus
    const bus = await Bus.findById(req.session.user.id);
    if (!bus) {
      req.flash('error_msg', 'Bus not found');
      return res.redirect('/driver/dashboard');
    }
    
    // Update current coordinates if provided
    if (currentLat && currentLon) {
      bus.currentCoordinates = {
        lat: parseFloat(currentLat),
        lon: parseFloat(currentLon),
        lastUpdated: new Date()
      };
      
      // Also update the text-based location
      bus.currentLocation = 'Updated via map';
      
      // Add activity record
      bus.recentActivity.unshift({
        action: 'Location Updated',
        details: `Current location updated to coordinates (${currentLat}, ${currentLon})`,
        timestamp: new Date()
      });
    }
    
    // Update boarding point if provided
    if (boardingLat && boardingLon) {
      bus.boardingPoint = {
        name: boardingPointName || 'Boarding Point',
        lat: parseFloat(boardingLat),
        lon: parseFloat(boardingLon)
      };
    }
    
    // Update destination point if provided
    if (destinationLat && destinationLon) {
      bus.destinationPoint = {
        name: destinationPointName || 'Destination',
        lat: parseFloat(destinationLat),
        lon: parseFloat(destinationLon)
      };
    }
    
    // Keep only the 5 most recent activities
    if (bus.recentActivity.length > 5) {
      bus.recentActivity = bus.recentActivity.slice(0, 5);
    }
    
    await bus.save();
    req.flash('success_msg', 'Location data updated successfully');
    res.redirect('/driver/update-location');
  } catch (err) {
    console.error('Error updating location:', err);
    req.flash('error_msg', 'An error occurred while updating location data');
    res.redirect('/driver/update-location');
  }
});

// View Passenger List
router.get('/passengers', ensureDriver, (req, res) => {
  res.render('driver/passengers', {
    title: 'Passenger List',
    user: req.session.user
  });
});

// Driver Profile
router.get('/profile', ensureDriver, (req, res) => {
  res.render('driver/profile', {
    title: 'My Profile',
    user: req.session.user
  });
});

// View all feedback
router.get('/feedback', ensureDriver, async (req, res) => {
  try {
    // Get the driver's bus ID from session
    const driverId = req.session.user.id;
    
    // Find all feedback for this driver
    const feedback = await Feedback.find({ driverId }).sort({ createdAt: -1 });
    
    res.render('driver/feedback', {
      title: 'Student Feedback',
      user: req.session.user,
      feedback
    });
  } catch (err) {
    console.error('Error fetching feedback:', err);
    req.flash('error_msg', 'Failed to load feedback');
    res.redirect('/driver/dashboard');
  }
});

// Mark feedback as read
router.post('/feedback/mark-read/:id', ensureDriver, async (req, res) => {
  try {
    const feedbackId = req.params.id;
    const driverId = req.session.user.id;
    
    // Find the feedback and verify it belongs to this driver
    const feedback = await Feedback.findOne({ _id: feedbackId, driverId });
    
    if (!feedback) {
      req.flash('error_msg', 'Feedback not found or not authorized');
      return res.redirect('/driver/feedback');
    }
    
    // Mark as read
    feedback.readByDriver = true;
    await feedback.save();
    
    req.flash('success_msg', 'Feedback marked as read');
    res.redirect('/driver/feedback');
  } catch (err) {
    console.error('Error marking feedback as read:', err);
    req.flash('error_msg', 'Failed to update feedback status');
    res.redirect('/driver/feedback');
  }
});

// Respond to feedback
router.post('/feedback/respond/:id', ensureDriver, async (req, res) => {
  try {
    const { response } = req.body;
    const feedbackId = req.params.id;
    const driverId = req.session.user.id;
    
    // Find the feedback and verify it belongs to this driver
    const feedback = await Feedback.findOne({ _id: feedbackId, driverId });
    
    if (!feedback) {
      req.flash('error_msg', 'Feedback not found or not authorized');
      return res.redirect('/driver/feedback');
    }
    
    // Add driver response
    feedback.driverResponse = response;
    feedback.status = 'responding';
    await feedback.save();
    
    req.flash('success_msg', 'Response sent successfully');
    res.redirect('/driver/feedback');
  } catch (err) {
    console.error('Error responding to feedback:', err);
    req.flash('error_msg', 'Failed to send response');
    res.redirect('/driver/feedback');
  }
});

module.exports = router; 