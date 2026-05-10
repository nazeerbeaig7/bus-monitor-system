const mongoose = require('mongoose');

const RouteSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Route name is required'],
        unique: true,
        trim: true,
        maxlength: [100, 'Route name cannot be more than 100 characters']
    },
    description: {
        type: String,
        trim: true,
        maxlength: [500, 'Description cannot be more than 500 characters']
    },
    stops: [{
        name: {
            type: String,
            required: [true, 'Stop name is required'],
            trim: true
        },
        location: {
            type: {
                type: String,
                enum: ['Point'],
                default: 'Point',
                required: true
            },
            coordinates: {
                type: [Number], // [longitude, latitude]
                required: true,
                validate: {
                    validator: function(v) {
                        return v.length === 2 && 
                               v[0] >= -180 && v[0] <= 180 && 
                               v[1] >= -90 && v[1] <= 90;
                    },
                    message: props => `${props.value} is not a valid coordinate set`
                }
            }
        },
        sequence: {
            type: Number,
            required: true,
            min: 1
        },
        estimatedTime: {
            type: Number, // in minutes from start
            required: true,
            min: 0
        },
        isActive: {
            type: Boolean,
            default: true
        }
    }],
    isActive: {
        type: Boolean,
        default: true
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Create geospatial index for location-based queries
RouteSchema.index({ 'stops.location': '2dsphere' });

// Virtual for total distance (can be calculated using map service)
RouteSchema.virtual('totalDistance').get(function() {
    // This would be calculated based on the actual route
    return 0; // Placeholder
});

// Virtual for estimated duration
RouteSchema.virtual('estimatedDuration').get(function() {
    if (!this.stops || this.stops.length === 0) return 0;
    return this.stops[this.stops.length - 1].estimatedTime;
});

// Pre-save hook to validate stops sequence
RouteSchema.pre('save', function(next) {
    if (this.isModified('stops')) {
        // Sort stops by sequence
        this.stops.sort((a, b) => a.sequence - b.sequence);
        
        // Validate sequence numbers are consecutive and start from 1
        const sequences = this.stops.map(s => s.sequence);
        const uniqueSequences = [...new Set(sequences)];
        
        if (uniqueSequences.length !== this.stops.length) {
            return next(new Error('Stop sequence numbers must be unique'));
        }
        
        const minSeq = Math.min(...sequences);
        const maxSeq = Math.max(...sequences);
        
        if (minSeq !== 1 || maxSeq !== this.stops.length) {
            return next(new Error('Stop sequence must start at 1 and be consecutive'));
        }
        
        // Validate estimatedTime is increasing
        for (let i = 1; i < this.stops.length; i++) {
            if (this.stops[i].estimatedTime <= this.stops[i - 1].estimatedTime) {
                return next(new Error('Estimated time must be increasing for each stop'));
            }
        }
    }
    next();
});

// Static method to find routes near a location
RouteSchema.statics.findNearby = function(coordinates, maxDistance = 5000) {
    return this.find({
        'stops.location': {
            $near: {
                $geometry: {
                    type: 'Point',
                    coordinates: [coordinates.longitude, coordinates.latitude]
                },
                $maxDistance: maxDistance // in meters
            }
        },
        isActive: true
    });
};

// Instance method to get route as GeoJSON
RouteSchema.methods.toGeoJSON = function() {
    return {
        type: 'Feature',
        properties: {
            id: this._id,
            name: this.name,
            description: this.description,
            totalStops: this.stops.length,
            estimatedDuration: this.estimatedDuration
        },
        geometry: {
            type: 'LineString',
            coordinates: this.stops.map(stop => [
                stop.location.coordinates[0],
                stop.location.coordinates[1]
            ])
        }
    };
};

module.exports = mongoose.model('Route', RouteSchema);
