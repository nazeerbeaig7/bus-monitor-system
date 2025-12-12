// Authentication middleware

module.exports = {
  // Check if user is authenticated
  ensureAuthenticated: (req, res, next) => {
    if (req.session.user) {
      return next();
    }
    req.flash('error_msg', 'Please log in to view this resource');
    res.redirect('/');
  },
  
  // Check if user is a student
  ensureStudent: (req, res, next) => {
    if (req.session.user && req.session.user.role === 'student') {
      return next();
    }
    req.flash('error_msg', 'Access denied. Student access only');
    res.redirect('/');
  },
  
  // Check if user is a driver
  ensureDriver: (req, res, next) => {
    if (req.session.user && req.session.user.role === 'driver') {
      return next();
    }
    req.flash('error_msg', 'Access denied. Driver access only');
    res.redirect('/');
  },
  
  // Check if user is management
  ensureManagement: (req, res, next) => {
    if (req.session.user && req.session.user.role === 'management') {
      return next();
    }
    req.flash('error_msg', 'Access denied. Management access only');
    res.redirect('/');
  }
}; 