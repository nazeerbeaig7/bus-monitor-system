const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { ensureAuthenticated, ensureManagement } = require('../config/auth');
const Bus = require('../models/Bus');
const User = require('../models/User');
const Feedback = require('../models/Feedback');
const Complaint = require('../models/Complaint');

// Management Dashboard
router.get('/dashboard', async (req, res) => {
  try {
    // Fetch buses to display on map and dashboard
    const buses = await Bus.find({});
    
    // Fetch student count
    const studentCount = await User.countDocuments({ role: 'student' });
    
    // Collect unique routes
    const routes = [...new Set(buses.map(bus => bus.route))].filter(Boolean);
    
    // Create empty reports array (can be populated with real reports later)
    const reports = [];
    
    // Collect and process all feedback
    let allFeedback = [];
    let studentComplaints = [];
    
    // Process each bus to extract feedback
    for (const bus of buses) {
      if (bus.feedback && bus.feedback.length > 0) {
        // Add bus info to each feedback item for context
        const busInfo = {
          busId: bus.busId,
          busName: bus.busName,
          driverName: bus.driverName,
          _id: bus._id
        };
        
        // Process each feedback item
        bus.feedback.forEach(item => {
          const feedbackWithBus = {
            ...item.toObject(),
            bus: busInfo
          };
          
          // Separate into complaints (rating ≤ 3) and positive feedback
          if (item.rating <= 3) {
            studentComplaints.push(feedbackWithBus);
          } else {
            allFeedback.push(feedbackWithBus);
          }
        });
      }
    }
    
    // Sort feedback by timestamp (newest first)
    allFeedback.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    studentComplaints.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    // Render dashboard with data
    res.render('management/dashboard', { 
      title: 'Management Dashboard',
      buses,
      feedback: allFeedback,
      complaints: studentComplaints,
      studentCount,
      routes,
      reports,
      user: req.user
    });
  } catch (err) {
    console.error('Error loading dashboard:', err);
    res.render('management/dashboard', { 
      title: 'Management Dashboard',
      error: 'Could not load dashboard data',
      user: req.user
    });
  }
});

// Manage Buses
router.get('/buses', ensureManagement, async (req, res) => {
  try {
    const buses = await Bus.find({}).sort({ createdAt: -1 });
    
    res.render('management/buses', {
      title: 'Manage Buses',
      user: req.session.user,
      buses
    });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Failed to fetch buses');
    res.redirect('/management/dashboard');
  }
});

// Add New Bus Form
router.get('/buses/add', ensureManagement, (req, res) => {
  res.render('management/add-bus', {
    title: 'Add New Bus',
    user: req.session.user
  });
});

// Add New Bus
router.post('/buses/add', ensureManagement, async (req, res) => {
  try {
    const { 
      busName, busId, busNumber, plateNumber, driverName, 
      route, capacity, pin, confirmPin, currentLocation, 
      notes, isActive 
    } = req.body;
    
    // Validate input
    if (!busName || !busId || !busNumber || !plateNumber || !driverName || !route || !capacity || !pin) {
      req.flash('error_msg', 'Please fill in all required fields');
      return res.redirect('/management/buses/add');
    }
    
    // Check if PIN and confirm PIN match
    if (pin !== confirmPin) {
      req.flash('error_msg', 'PINs do not match');
      return res.redirect('/management/buses/add');
    }
    
    // Check if bus ID already exists
    const existingBus = await Bus.findOne({ busId });
    if (existingBus) {
      req.flash('error_msg', 'Bus ID already exists. Please choose a different ID');
      return res.redirect('/management/buses/add');
    }
    
    // Hash the PIN
    const salt = await bcrypt.genSalt(10);
    const hashedPin = await bcrypt.hash(pin, salt);
    
    // Create new bus
    const newBus = new Bus({
      busName,
      busId,
      busNumber,
      plateNumber,
      driverName,
      route,
      capacity: parseInt(capacity),
      pin: hashedPin,
      currentLocation: currentLocation || 'Not specified',
      notes: notes || '',
      isActive: isActive === 'on',
      // Add default schedule for weekdays
      schedule: [
        {
          time: '7:45 AM',
          departure: 'Bus Depot',
          arrival: 'Campus',
          days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
        },
        {
          time: '8:15 AM',
          departure: 'Campus',
          arrival: 'City Center',
          days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
        },
        {
          time: '1:00 PM',
          departure: 'City Center',
          arrival: 'Campus',
          days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
        },
        {
          time: '4:30 PM',
          departure: 'Campus',
          arrival: 'Bus Depot',
          days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
        }
      ],
      // Add initial activity
      recentActivity: [
        {
          action: 'Bus Added',
          details: 'Bus was added to the system',
          timestamp: new Date()
        }
      ]
    });
    
    await newBus.save();
    req.flash('success_msg', 'Bus added successfully');
    res.redirect('/management/buses');
  } catch (err) {
    console.error('Error adding bus:', err);
    req.flash('error_msg', 'An error occurred while adding the bus');
    res.redirect('/management/buses/add');
  }
});

router.get('/buses/view/:id', ensureManagement, async (req, res) => {
  try {
    const bus = await Bus.findById(req.params.id);
    if (!bus) {
      req.flash('error_msg', 'Bus not found');
      return res.redirect('/management/buses');
    }
    
    res.render('management/view-bus', {
      user: req.session.user,
      page_title: 'View Bus Details',
      bus
    });
  } catch (err) {
    console.error('Error viewing bus:', err);
    req.flash('error_msg', 'An error occurred while retrieving bus details');
    res.redirect('/management/buses');
  }
});

router.get('/buses/edit/:id', ensureManagement, async (req, res) => {
  try {
    const bus = await Bus.findById(req.params.id);
    if (!bus) {
      req.flash('error_msg', 'Bus not found');
      return res.redirect('/management/buses');
    }
    
    res.render('management/edit-bus', {
      user: req.session.user,
      page_title: 'Edit Bus',
      bus
    });
  } catch (err) {
    console.error('Error retrieving bus for edit:', err);
    req.flash('error_msg', 'An error occurred while retrieving bus details');
    res.redirect('/management/buses');
  }
});

router.post('/buses/update/:id', ensureManagement, async (req, res) => {
  try {
    const { 
      busName, busNumber, plateNumber, driverName, 
      route, capacity, currentLocation, 
      notes, isActive, currentPin, newPin, confirmNewPin,
      lastMaintenanceDate, nextMaintenanceDate, fuelStatus, engineHealth
    } = req.body;
    
    // Find the bus
    const bus = await Bus.findById(req.params.id);
    if (!bus) {
      req.flash('error_msg', 'Bus not found');
      return res.redirect('/management/buses');
    }
    
    // Update bus data
    bus.busName = busName;
    bus.busNumber = busNumber;
    bus.plateNumber = plateNumber;
    bus.driverName = driverName;
    bus.route = route;
    bus.capacity = parseInt(capacity);
    bus.currentLocation = currentLocation || 'Not specified';
    bus.notes = notes || '';
    bus.isActive = isActive === 'on';
    
    // Update maintenance information
    if (lastMaintenanceDate) bus.lastMaintenanceDate = new Date(lastMaintenanceDate);
    if (nextMaintenanceDate) bus.nextMaintenanceDate = new Date(nextMaintenanceDate);
    if (fuelStatus) bus.fuelStatus = parseInt(fuelStatus);
    if (engineHealth) bus.engineHealth = parseInt(engineHealth);
    
    // If PIN change is requested
    if (currentPin && newPin && confirmNewPin) {
      // Verify current PIN
      const isMatch = await bcrypt.compare(currentPin, bus.pin);
      if (!isMatch) {
        req.flash('error_msg', 'Current PIN is incorrect');
        return res.redirect(`/management/buses/edit/${req.params.id}`);
      }
      
      // Check if new PIN and confirm PIN match
      if (newPin !== confirmNewPin) {
        req.flash('error_msg', 'New PINs do not match');
        return res.redirect(`/management/buses/edit/${req.params.id}`);
      }
      
      // Hash and save new PIN
      const salt = await bcrypt.genSalt(10);
      bus.pin = await bcrypt.hash(newPin, salt);
    }
    
    // Add recent activity for the edit
    bus.recentActivity.unshift({
      action: 'Bus Updated',
      details: 'Bus information was updated by management',
      timestamp: new Date()
    });
    
    // Keep only the 5 most recent activities
    if (bus.recentActivity.length > 5) {
      bus.recentActivity = bus.recentActivity.slice(0, 5);
    }
    
    await bus.save();
    req.flash('success_msg', 'Bus updated successfully');
    res.redirect('/management/buses');
  } catch (err) {
    console.error('Error updating bus:', err);
    req.flash('error_msg', 'An error occurred while updating the bus');
    res.redirect(`/management/buses/edit/${req.params.id}`);
  }
});

router.post('/buses/delete/:id', ensureManagement, async (req, res) => {
  try {
    await Bus.findByIdAndDelete(req.params.id);
    req.flash('success_msg', 'Bus deleted successfully');
    res.redirect('/management/buses');
  } catch (err) {
    console.error('Error deleting bus:', err);
    req.flash('error_msg', 'An error occurred while deleting the bus');
    res.redirect('/management/buses');
  }
});

// API route to get all buses (for AJAX/fetch calls)
router.get('/api/buses', ensureManagement, async (req, res) => {
  try {
    const buses = await Bus.find().sort({ createdAt: -1 });
    res.json(buses);
  } catch (err) {
    console.error('Error fetching buses:', err);
    res.status(500).json({ error: 'Failed to fetch buses' });
  }
});

// Manage Students
router.get('/students', ensureManagement, async (req, res) => {
  try {
    const students = await User.find({ role: 'student' }).sort({ createdAt: -1 });
    
    res.render('management/students', {
      title: 'Manage Students',
      user: req.session.user,
      students
    });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Failed to fetch students');
    res.redirect('/management/dashboard');
  }
});

// Reports
router.get('/reports', ensureManagement, (req, res) => {
  res.render('management/reports', {
    title: 'Reports',
    user: req.session.user
  });
});

// Add route for marking complaint as resolved
router.post('/complaints/resolve/:busId/:feedbackId', async (req, res) => {
  try {
    const { busId, feedbackId } = req.params;
    
    // Find the bus
    const bus = await Bus.findById(busId);
    if (!bus) {
      return res.status(404).json({ success: false, message: 'Bus not found' });
    }
    
    // Find the feedback in the array
    const feedbackIndex = bus.feedback.findIndex(
      item => item._id.toString() === feedbackId
    );
    
    if (feedbackIndex === -1) {
      return res.status(404).json({ success: false, message: 'Feedback not found' });
    }
    
    // Mark as resolved by adding a resolved flag
    bus.feedback[feedbackIndex].resolved = true;
    bus.feedback[feedbackIndex].resolvedAt = new Date();
    bus.feedback[feedbackIndex].resolvedBy = req.user.name;
    
    // Save the bus
    await bus.save();
    
    // If this is an AJAX request
    if (req.xhr) {
      return res.json({ success: true, message: 'Complaint marked as resolved' });
    }
    
    // For regular form submissions, redirect back to the dashboard with success message
    req.flash('success', 'Complaint marked as resolved.');
    res.redirect('/management/dashboard');
    
  } catch (err) {
    console.error('Error resolving complaint:', err);
    
    // If this is an AJAX request
    if (req.xhr) {
      return res.status(500).json({ success: false, message: 'Error resolving complaint' });
    }
    
    // For regular form submissions
    req.flash('error', 'Error resolving complaint.');
    res.redirect('/management/dashboard');
  }
});

// View all feedback and complaints
router.get('/feedback', ensureManagement, async (req, res) => {
  try {
    // Fetch all feedback and complaints
    const feedback = await Feedback.find({}).sort({ createdAt: -1 });
    const complaints = await Complaint.find({}).sort({ createdAt: -1 });
    
    res.render('management/feedback', {
      title: 'Student Feedback & Complaints',
      user: req.session.user,
      feedback,
      complaints
    });
  } catch (err) {
    console.error('Error fetching feedback and complaints:', err);
    req.flash('error_msg', 'Failed to load feedback and complaints');
    res.redirect('/management/dashboard');
  }
});

// Mark feedback as read
router.post('/feedback/mark-read/:id', ensureManagement, async (req, res) => {
  try {
    const feedback = await Feedback.findById(req.params.id);
    
    if (!feedback) {
      req.flash('error_msg', 'Feedback not found');
      return res.redirect('/management/feedback');
    }
    
    feedback.readByAdmin = true;
    await feedback.save();
    
    req.flash('success_msg', 'Feedback marked as read');
    res.redirect('/management/feedback');
  } catch (err) {
    console.error('Error marking feedback as read:', err);
    req.flash('error_msg', 'Failed to update feedback');
    res.redirect('/management/feedback');
  }
});

// Update complaint status
router.post('/complaints/update-status/:id', ensureManagement, async (req, res) => {
  try {
    const { status, adminResponse } = req.body;
    const complaint = await Complaint.findById(req.params.id);
    
    if (!complaint) {
      req.flash('error_msg', 'Complaint not found');
      return res.redirect('/management/feedback');
    }
    
    complaint.status = status;
    complaint.adminResponse = adminResponse;
    complaint.readByAdmin = true;
    await complaint.save();
    
    req.flash('success_msg', 'Complaint updated successfully');
    res.redirect('/management/feedback');
  } catch (err) {
    console.error('Error updating complaint:', err);
    req.flash('error_msg', 'Failed to update complaint');
    res.redirect('/management/feedback');
  }
});

module.exports = router; 