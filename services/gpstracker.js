const Bus = require('../models/Bus');
const { v4: uuidv4 } = require('uuid');

class GPSTracker {
  constructor(io) {
    this.io = io;
    this.activeConnections = new Map(); // Maps deviceId to socketId
    this.setupSocketHandlers();
  }

  setupSocketHandlers() {
    if (!this.io) return;

    this.io.on('connection', (socket) => {
      console.log('New client connected:', socket.id);

      // Handle device registration
      socket.on('register-device', async (data, callback) => {
        try {
          const { busId, deviceId, deviceInfo } = data;
          
          // Verify bus exists and update its tracking info
          const bus = await Bus.findById(busId);
          if (!bus) {
            return callback({ success: false, error: 'Bus not found' });
          }

          // Update bus tracking info
          bus.tracking.isActive = true;
          bus.tracking.deviceInfo = {
            deviceId,
            deviceModel: deviceInfo?.model || 'Unknown',
            appVersion: deviceInfo?.appVersion || '1.0.0',
            lastSeen: new Date()
          };
          
          await bus.save();
          
          // Store the connection
          this.activeConnections.set(deviceId, {
            socketId: socket.id,
            busId: bus._id,
            lastSeen: Date.now()
          });

          // Notify all clients about this bus going online
          this.io.emit('bus-status-changed', {
            busId: bus._id,
            isOnline: true,
            lastUpdate: bus.tracking.lastUpdate
          });

          callback({ success: true, message: 'Device registered successfully' });
        } catch (error) {
          console.error('Error registering device:', error);
          callback({ success: false, error: 'Internal server error' });
        }
      });

      // Handle location updates
      socket.on('location-update', async (data, callback) => {
        try {
          const { busId, deviceId, location } = data;
          
          // Verify bus exists
          const bus = await Bus.findById(busId);
          if (!bus) {
            return callback({ success: false, error: 'Bus not found' });
          }

          // Update tracking info
          bus.tracking.isActive = true;
          bus.tracking.lastUpdate = new Date();
          bus.tracking.coordinates = {
            lat: location.latitude,
            lon: location.longitude,
            accuracy: location.accuracy,
            speed: location.speed || 0,
            heading: location.heading || 0,
            altitude: location.altitude || 0
          };
          
          // Update legacy fields for backward compatibility
          bus.currentCoordinates = {
            lat: location.latitude,
            lon: location.longitude,
            lastUpdated: new Date()
          };
          
          // Add to activity log
          bus.recentActivity.unshift({
            action: 'Location Update',
            details: `Location updated to (${location.latitude}, ${location.longitude})`,
            timestamp: new Date()
          });
          
          await bus.save();
          
          // Broadcast update to all connected clients
          this.io.emit('location-updated', {
            busId: bus._id,
            location: bus.tracking.coordinates,
            lastUpdate: bus.tracking.lastUpdate
          });

          callback({ success: true });
        } catch (error) {
          console.error('Error updating location:', error);
          callback({ success: false, error: 'Failed to update location' });
        }
      });

      // Handle disconnection
      socket.on('disconnect', async () => {
        console.log('Client disconnected:', socket.id);
        
        // Find and clean up the connection
        for (const [deviceId, conn] of this.activeConnections.entries()) {
          if (conn.socketId === socket.id) {
            this.activeConnections.delete(deviceId);
            
            // Update bus status
            try {
              const bus = await Bus.findById(conn.busId);
              if (bus) {
                bus.tracking.isActive = false;
                bus.tracking.deviceInfo.lastSeen = new Date();
                await bus.save();
                
                // Notify clients
                this.io.emit('bus-status-changed', {
                  busId: bus._id,
                  isOnline: false,
                  lastUpdate: bus.tracking.lastUpdate
                });
              }
            } catch (error) {
              console.error('Error handling device disconnect:', error);
            }
            break;
          }
        }
      });
    });
  }

  // Get real-time location of a bus
  async getBusLocation(busId) {
    try {
      const bus = await Bus.findById(busId, 'tracking');
      if (!bus) return null;
      
      return {
        isOnline: bus.tracking.isActive,
        lastUpdate: bus.tracking.lastUpdate,
        location: bus.tracking.coordinates
      };
    } catch (error) {
      console.error('Error getting bus location:', error);
      return null;
    }
  }

  // Get all active buses with their locations
  async getAllActiveBuses() {
    try {
      const buses = await Bus.find(
        { 'tracking.isActive': true },
        'busName busNumber plateNumber driverName route tracking'
      );
      
      return buses.map(bus => ({
        busId: bus._id,
        busName: bus.busName,
        busNumber: bus.busNumber,
        plateNumber: bus.plateNumber,
        driverName: bus.driverName,
        route: bus.route,
        isOnline: bus.tracking.isActive,
        lastUpdate: bus.tracking.lastUpdate,
        location: bus.tracking.coordinates
      }));
    } catch (error) {
      console.error('Error getting active buses:', error);
      return [];
    }
  }
}

module.exports = GPSTracker;
