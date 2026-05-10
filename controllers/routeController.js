const Route = require('../models/Route');
const { validationResult } = require('express-validator');
const geocoder = require('../utils/geocoder');

/**
 * @desc    Get all routes
 * @route   GET /management/routes
 * @access  Private/Management
 */
exports.getRoutes = async (req, res, next) => {
    try {
        const routes = await Route.find({})
            .sort({ name: 1 })
            .populate('createdBy', 'name email')
            .populate('updatedBy', 'name email');
            
        res.status(200).json({
            success: true,
            count: routes.length,
            data: routes
        });
    } catch (err) {
        next(err);
    }
};

/**
 * @desc    Get single route
 * @route   GET /management/routes/:id
 * @access  Private/Management
 */
exports.getRoute = async (req, res, next) => {
    try {
        const route = await Route.findById(req.params.id)
            .populate('createdBy', 'name email')
            .populate('updatedBy', 'name email');
            
        if (!route) {
            return res.status(404).json({
                success: false,
                error: 'Route not found'
            });
        }
        
        res.status(200).json({
            success: true,
            data: route
        });
    } catch (err) {
        next(err);
    }
};

/**
 * @desc    Create new route
 * @route   POST /management/routes
 * @access  Private/Management
 */
exports.createRoute = async (req, res, next) => {
    try {
        // Input validation
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }
        
        const { name, description, stops } = req.body;
        
        // Process stops with geocoding if needed
        const processedStops = await Promise.all(stops.map(async (stop, index) => {
            // If coordinates not provided, geocode the address
            if (!stop.coordinates && stop.address) {
                const loc = await geocoder.geocode(stop.address);
                stop.coordinates = [loc[0].longitude, loc[0].latitude];
            }
            
            return {
                name: stop.name,
                location: {
                    type: 'Point',
                    coordinates: stop.coordinates || [0, 0]
                },
                sequence: index + 1,
                estimatedTime: stop.estimatedTime || (index * 5) // Default 5 min between stops
            };
        }));
        
        // Create route
        const route = await Route.create({
            name,
            description,
            stops: processedStops,
            createdBy: req.user.id
        });
        
        res.status(201).json({
            success: true,
            data: route
        });
    } catch (err) {
        next(err);
    }
};

/**
 * @desc    Update route
 * @route   PUT /management/routes/:id
 * @access  Private/Management
 */
exports.updateRoute = async (req, res, next) => {
    try {
        // Input validation
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }
        
        const { name, description, stops } = req.body;
        
        // Process stops with geocoding if needed
        const processedStops = await Promise.all(stops.map(async (stop, index) => {
            // If coordinates not provided, geocode the address
            if (!stop.coordinates && stop.address) {
                const loc = await geocoder.geocode(stop.address);
                stop.coordinates = [loc[0].longitude, loc[0].latitude];
            }
            
            return {
                name: stop.name,
                location: {
                    type: 'Point',
                    coordinates: stop.coordinates || [0, 0]
                },
                sequence: index + 1,
                estimatedTime: stop.estimatedTime || (index * 5), // Default 5 min between stops
                isActive: stop.isActive !== undefined ? stop.isActive : true
            };
        }));
        
        // Find and update route
        let route = await Route.findById(req.params.id);
        
        if (!route) {
            return res.status(404).json({
                success: false,
                error: 'Route not found'
            });
        }
        
        // Check permission
        if (route.createdBy.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'Not authorized to update this route'
            });
        }
        
        // Update fields
        route.name = name;
        route.description = description;
        route.stops = processedStops;
        route.updatedBy = req.user.id;
        
        await route.save();
        
        res.status(200).json({
            success: true,
            data: route
        });
    } catch (err) {
        next(err);
    }
};

/**
 * @desc    Delete route
 * @route   DELETE /management/routes/:id
 * @access  Private/Admin
 */
exports.deleteRoute = async (req, res, next) => {
    try {
        const route = await Route.findById(req.params.id);
        
        if (!route) {
            return res.status(404).json({
                success: false,
                error: 'Route not found'
            });
        }
        
        // Check if route is in use (you'll need to implement this check based on your data model)
        // const isInUse = await checkIfRouteInUse(route._id);
        // if (isInUse) {
        //     return res.status(400).json({
        //         success: false,
        //         error: 'Cannot delete route that is in use'
        //     });
        // }
        
        // Soft delete (set isActive to false)
        route.isActive = false;
        route.updatedBy = req.user.id;
        await route.save();
        
        // Or hard delete:
        // await route.remove();
        
        res.status(200).json({
            success: true,
            data: {}
        });
    } catch (err) {
        next(err);
    }
};

/**
 * @desc    Get routes within a radius
 * @route   GET /management/routes/radius/:zipcode/:distance
 * @access  Private/Management
 */
exports.getRoutesInRadius = async (req, res, next) => {
    try {
        const { zipcode, distance } = req.params;
        
        // Get lat/lng from geocoder
        const loc = await geocoder.geocode(zipcode);
        const lat = loc[0].latitude;
        const lng = loc[0].longitude;
        
        // Calc radius using radians
        // Divide distance by radius of Earth (3,963 mi / 6,378 km)
        const radius = distance / 3963;
        
        const routes = await Route.find({
            'stops.location': {
                $geoWithin: { $centerSphere: [[lng, lat], radius] }
            },
            isActive: true
        });
        
        res.status(200).json({
            success: true,
            count: routes.length,
            data: routes
        });
    } catch (err) {
        next(err);
    }
};

/**
 * @desc    Get route GeoJSON
 * @route   GET /management/routes/geojson/:id
 * @access  Public
 */
exports.getRouteGeoJSON = async (req, res, next) => {
    try {
        const route = await Route.findById(req.params.id);
        
        if (!route) {
            return res.status(404).json({
                success: false,
                error: 'Route not found'
            });
        }
        
        res.status(200).json({
            success: true,
            data: route.toGeoJSON()
        });
    } catch (err) {
        next(err);
    }
};
