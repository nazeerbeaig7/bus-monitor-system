const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
const methodOverride = require('method-override');
const expressLayouts = require('express-ejs-layouts');
const session = require('express-session');
const flash = require('connect-flash');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const connectDB = require('./config/db');
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;

// Connect to MongoDB
connectDB();

// Initialize GPS Tracker
const GPSTracker = require('./services/gpstracker');
const gpsTracker = new GPSTracker(io);

// Make io and gpsTracker available in routes
app.set('io', io);
app.set('gpsTracker', gpsTracker);

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));
app.use(cookieParser());

// Express Session
app.use(session({
  secret: 'bus_management_secret',
  resave: true,
  saveUninitialized: true,
  cookie: { maxAge: 60 * 60 * 1000 } // 1 hour
}));

// Connect Flash
app.use(flash());

// Global Variables
app.use((req, res, next) => {
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  res.locals.user = req.session.user || null;
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

// EJS Layout Setup
app.use(expressLayouts);
app.set('layout', 'layout');
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Routes
const indexRoutes = require('./routes/index');
const authRoutes = require('./routes/auth');
const studentRoutes = require('./routes/student');
const driverRoutes = require('./routes/driver');
const managementRoutes = require('./routes/management');

app.use('/', indexRoutes);
app.use('/auth', authRoutes);
app.use('/student', studentRoutes);
app.use('/driver', driverRoutes);
app.use('/management', managementRoutes);

// Start server with WebSocket support
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT} with WebSocket support`);
});