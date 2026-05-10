const { check, body } = require('express-validator');
const Route = require('../../models/Route');

// Validation rules for creating/updating a route
exports.routeValidationRules = () => {
    return [
        check('name', 'Route name is required').not().isEmpty().trim(),
        check('name').custom(async (value, { req }) => {
            // Check if route name already exists (case insensitive)
            const route = await Route.findOne({ 
                name: new RegExp(`^${value}$`, 'i'),
                _id: { $ne: req.params.id } // Exclude current route when updating
            });
            
            if (route) {
                throw new Error('Route with this name already exists');
            }
            return true;
        }),
        check('description', 'Description can be at most 500 characters long')
            .optional()
            .isLength({ max: 500 }),
        check('stops', 'At least one stop is required').isArray({ min: 2 }),
        check('stops.*.name', 'Stop name is required').not().isEmpty().trim(),
        check('stops.*.coordinates', 'Coordinates are required')
            .optional()
            .isArray({ min: 2, max: 2 })
            .withMessage('Coordinates must be an array of [longitude, latitude]'),
        check('stops.*.coordinates.*', 'Invalid coordinate value')
            .optional()
            .isFloat({
                min: -180,
                max: 180
            }),
        check('stops.*.estimatedTime', 'Estimated time must be a positive number')
            .optional()
            .isInt({ min: 0 })
    ];
};

// Validation rules for updating route status
exports.routeStatusValidationRules = () => {
    return [
        check('isActive', 'isActive must be a boolean')
            .isBoolean()
    ];
};

// Validation rules for getting routes in radius
exports.radiusValidationRules = () => {
    return [
        check('zipcode', 'Zipcode is required').not().isEmpty(),
        check('distance', 'Distance is required and must be a number')
            .isNumeric()
            .toInt()
    ];
};
