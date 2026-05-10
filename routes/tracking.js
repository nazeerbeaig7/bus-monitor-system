const express = require('express');
const router = express.Router();
const { ensureAuthenticated, ensureDriver } = require('../config/auth');
const Bus = require('../models/Bus');

// Tracking dashboard
router.get('/tracking', ensureDriver, async (req, res) => {
  try {
    // Get bus data including tracking information
    const bus = await Bus.findById(req.session.user.id);
    
    if (!bus) {
      req.flash('error_msg', 'Bus not found');
      return res.redirect('/driver/dashboard');
    }
    
    // Render the tracking interface
    res.render('driver/tracking', {
      title: 'Live Bus Tracking',
      user: req.session.user,
      bus: bus,
      layout: 'layout'
    });
  } catch (err) {
    console.error('Error loading tracking page:', err);
    req.flash('error_msg', 'Error loading tracking interface');
    res.redirect('/driver/dashboard');
  }
});

// API Endpoint: Get current bus location
router.get('/api/bus/:id/location', ensureAuthenticated, async (req, res) => {
  try {
    const bus = await Bus.findById(req.params.id, 'tracking busName busNumber');
    
    if (!bus) {
      return res.status(404).json({ success: false, error: 'Bus not found' });
    }
    
    res.json({
      success: true,
      bus: {
        id: bus._id,
        name: bus.busName,
        number: bus.busNumber,
        isOnline: bus.tracking.isActive,
        lastUpdate: bus.tracking.lastUpdate,
        location: bus.tracking.coordinates
      }
    });
  } catch (err) {
    console.error('Error fetching bus location:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// API Endpoint: Get all active buses
router.get('/api/buses/active', ensureAuthenticated, async (req, res) => {
  try {
    const buses = await Bus.find(
      { 'tracking.isActive': true },
      'busName busNumber plateNumber driverName route tracking'
    );
    
    res.json({
      success: true,
      count: buses.length,
      buses: buses.map(bus => ({
        id: bus._id,
        name: bus.busName,
        number: bus.busNumber,
        plateNumber: bus.plateNumber,
        driverName: bus.driverName,
        route: bus.route,
        isOnline: bus.tracking.isActive,
        lastUpdate: bus.tracking.lastUpdate,
        location: bus.tracking.coordinates
      }))
    });
  } catch (err) {
    console.error('Error fetching active buses:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

module.exports = router;
