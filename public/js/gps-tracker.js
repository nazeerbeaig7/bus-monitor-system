class GPSTracker {
  constructor(options = {}) {
    this.busId = options.busId;
    this.deviceId = localStorage.getItem('deviceId') || this.generateDeviceId();
    this.socket = null;
    this.watchId = null;
    this.updateInterval = options.updateInterval || 10000; // 10 seconds
    this.highAccuracy = options.highAccuracy !== false; // true by default
    this.maximumAge = options.maximumAge || 30000; // 30 seconds
    this.timeout = options.timeout || 10000; // 10 seconds
    this.isTracking = false;
    this.lastPosition = null;
    this.socketConnected = false;
    this.watchCallbacks = [];
    this.errorCallbacks = [];
    this.statusCallbacks = [];
    this.autoReconnect = true;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 5000; // 5 seconds

    // Generate a unique device ID if not exists
    if (!localStorage.getItem('deviceId')) {
      localStorage.setItem('deviceId', this.deviceId);
    }

    // Initialize WebSocket connection
    this.initSocket();
  }

  generateDeviceId() {
    return 'dev-' + Math.random().toString(36).substr(2, 9);
  }

  initSocket() {
    // Use the current host for WebSocket connection
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    this.socket = new WebSocket(`${protocol}//${host}`);

    this.socket.onopen = () => {
      console.log('WebSocket connected');
      this.socketConnected = true;
      this.reconnectAttempts = 0;
      this.notifyStatusChange('connected');
      
      // Register device with the server
      this.registerDevice();
      
      // If tracking was active before reconnect, restart it
      if (this.isTracking) {
        this.startTracking();
      }
    };

    this.socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleSocketMessage(data);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    this.socket.onclose = () => {
      console.log('WebSocket disconnected');
      this.socketConnected = false;
      this.notifyStatusChange('disconnected');
      
      // Attempt to reconnect
      if (this.autoReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        const delay = this.reconnectDelay * this.reconnectAttempts;
        console.log(`Attempting to reconnect in ${delay}ms...`);
        
        setTimeout(() => {
          console.log(`Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
          this.initSocket();
        }, delay);
      }
    };

    this.socket.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.notifyError(error);
    };
  }

  registerDevice() {
    if (!this.socketConnected) return;
    
    const deviceInfo = {
      model: window.navigator.userAgent,
      appVersion: '1.0.0',
      os: window.navigator.platform
    };

    this.socket.send(JSON.stringify({
      type: 'register-device',
      busId: this.busId,
      deviceId: this.deviceId,
      deviceInfo: deviceInfo
    }));
  }

  startTracking() {
    if (this.watchId !== null) {
      console.warn('GPS tracking is already active');
      return;
    }

    if (!navigator.geolocation) {
      this.notifyError(new Error('Geolocation is not supported by your browser'));
      return;
    }

    const options = {
      enableHighAccuracy: this.highAccuracy,
      maximumAge: this.maximumAge,
      timeout: this.timeout
    };

    // Get position immediately
    navigator.geolocation.getCurrentPosition(
      (position) => this.handlePositionUpdate(position),
      (error) => this.handlePositionError(error),
      options
    );

    // Then watch for changes
    this.watchId = navigator.geolocation.watchPosition(
      (position) => this.handlePositionUpdate(position),
      (error) => this.handlePositionError(error),
      options
    );

    this.isTracking = true;
    this.notifyStatusChange('tracking_started');
    console.log('GPS tracking started');
  }

  stopTracking() {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
      this.isTracking = false;
      this.notifyStatusChange('tracking_stopped');
      console.log('GPS tracking stopped');
    }
  }

  handlePositionUpdate(position) {
    this.lastPosition = position;
    this.notifyPositionUpdate(position);
    this.sendLocationUpdate(position);
  }

  handlePositionError(error) {
    console.error('Geolocation error:', error);
    this.notifyError(error);
  }

  sendLocationUpdate(position) {
    if (!this.socketConnected) {
      console.warn('Cannot send location update: WebSocket not connected');
      return;
    }

    const locationData = {
      type: 'location-update',
      busId: this.busId,
      deviceId: this.deviceId,
      location: {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        altitude: position.coords.altitude,
        altitudeAccuracy: position.coords.altitudeAccuracy,
        heading: position.coords.heading,
        speed: position.coords.speed,
        timestamp: position.timestamp
      }
    };

    this.socket.send(JSON.stringify(locationData));
  }

  handleSocketMessage(data) {
    // Handle incoming WebSocket messages from the server
    switch (data.type) {
      case 'location-update-ack':
        // Acknowledge receipt of location update
        break;
      case 'server-message':
        console.log('Server message:', data.message);
        break;
      default:
        console.log('Unknown message type:', data.type);
    }
  }

  // Event handling
  onPositionUpdate(callback) {
    if (typeof callback === 'function') {
      this.watchCallbacks.push(callback);
    }
    return this;
  }

  onError(callback) {
    if (typeof callback === 'function') {
      this.errorCallbacks.push(callback);
    }
    return this;
  }

  onStatusChange(callback) {
    if (typeof callback === 'function') {
      this.statusCallbacks.push(callback);
    }
    return this;
  }

  notifyPositionUpdate(position) {
    this.watchCallbacks.forEach(callback => {
      try {
        callback(position);
      } catch (error) {
        console.error('Error in position update callback:', error);
      }
    });
  }

  notifyError(error) {
    this.errorCallbacks.forEach(callback => {
      try {
        callback(error);
      } catch (err) {
        console.error('Error in error callback:', err);
      }
    });
  }

  notifyStatusChange(status) {
    this.statusCallbacks.forEach(callback => {
      try {
        callback(status);
      } catch (error) {
        console.error('Error in status change callback:', error);
      }
    });
  }

  // Cleanup
  destroy() {
    this.stopTracking();
    
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    
    this.watchCallbacks = [];
    this.errorCallbacks = [];
    this.statusCallbacks = [];
    
    console.log('GPS tracker destroyed');
  }
}

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GPSTracker;
} else if (typeof define === 'function' && define.amd) {
  define([], function() { return GPSTracker; });
} else {
  window.GPSTracker = GPSTracker;
}
