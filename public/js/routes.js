/**
 * Bus Monitoring System - Routes Management
 * Handles the frontend functionality for managing bus routes
 */

document.addEventListener('DOMContentLoaded', function() {
    // Initialize map and variables
    let map, routeLayer, markers = [];
    let currentStopMarker = null;
    let currentRoute = null;
    let isEditMode = false;
    
    // DOM Elements
    const routeForm = document.getElementById('routeForm');
    const routeModal = new bootstrap.Modal(document.getElementById('routeModal'));
    const stopModal = new bootstrap.Modal(document.getElementById('stopModal'));
    const deleteModal = new bootstrap.Modal(document.getElementById('deleteModal'));
    const saveRouteBtn = document.getElementById('saveRouteBtn');
    const searchInput = document.getElementById('searchRoutes');
    const routesTableBody = document.getElementById('routesTableBody');
    
    // Initialize the application
    initMap();
    loadRoutes();
    setupEventListeners();
    
    /**
     * Initialize the map
     */
    function initMap() {
        // Default to India view
        map = L.map('map').setView([20.5937, 78.9629], 5);
        
        // Add OpenStreetMap tiles
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
        }).addTo(map);
        
        // Add scale control
        L.control.scale().addTo(map);
        
        // Initialize route layer
        routeLayer = L.layerGroup().addTo(map);
    }
    
    /**
     * Set up event listeners
     */
    function setupEventListeners() {
        // Add Stop Button
        document.getElementById('addStopBtn').addEventListener('click', addStopFromButton);
        
        // Fit Bounds Button
        document.getElementById('fitBoundsBtn').addEventListener('click', fitMapToMarkers);
        
        // Route Form Submission
        routeForm.addEventListener('submit', handleRouteSubmit);
        
        // Stop Form Submission
        document.getElementById('stopForm').addEventListener('submit', handleStopSubmit);
        
        // Delete Confirmation
        document.getElementById('confirmDeleteBtn').addEventListener('click', deleteRoute);
        
        // Search Functionality
        searchInput.addEventListener('keyup', debounce(handleSearch, 300));
        document.getElementById('searchBtn').addEventListener('click', handleSearch);
        
        // Route Status Toggle
        document.getElementById('routeStatus').addEventListener('change', function() {
            document.getElementById('statusBadge').className = `badge bg-${this.checked ? 'success' : 'secondary'}`;
            document.getElementById('statusBadge').textContent = this.checked ? 'Active' : 'Inactive';
        });
        
        // Modal Hidden Events
        document.getElementById('routeModal').addEventListener('hidden.bs.modal', resetForm);
    }
    
    /**
     * Load routes from the API
     */
    async function loadRoutes() {
        try {
            showLoading(true);
            const response = await fetch('/api/routes');
            const data = await response.json();
            
            if (data.success) {
                renderRoutesTable(data.data);
            } else {
                showAlert('Error loading routes', 'danger');
            }
        } catch (error) {
            console.error('Error loading routes:', error);
            showAlert('Failed to load routes. Please try again.', 'danger');
        } finally {
            showLoading(false);
        }
    }
    
    /**
     * Render routes in the table
     */
    function renderRoutesTable(routes) {
        if (!routes || routes.length === 0) {
            routesTableBody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center py-4">
                        <i class="fas fa-route fa-2x text-muted mb-2"></i>
                        <p class="mb-0">No routes found. Add your first route to get started.</p>
                    </td>
                </tr>`;
            return;
        }
        
        routesTableBody.innerHTML = routes.map(route => `
            <tr data-route-id="${route._id}">
                <td>
                    <div class="d-flex align-items-center">
                        <div class="route-color" style="background-color: ${route.color || '#4e73df'}; width: 16px; height: 16px; border-radius: 4px; margin-right: 10px;"></div>
                        <div>
                            <h6 class="mb-0">${route.name}</h6>
                            <small class="text-muted">${route.description || 'No description'}</small>
                        </div>
                    </div>
                </td>
                <td>${route.stops ? route.stops.length : 0} stops</td>
                <td>${calculateTotalDuration(route.stops)} min</td>
                <td>
                    <span class="badge bg-${route.isActive ? 'success' : 'secondary'}">
                        ${route.isActive ? 'Active' : 'Inactive'}
                    </span>
                </td>
                <td>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-sm btn-outline-primary view-route" data-id="${route._id}" title="View">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-secondary edit-route" data-id="${route._id}" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger delete-route" data-id="${route._id}" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
        
        // Add event listeners to action buttons
        document.querySelectorAll('.view-route').forEach(btn => {
            btn.addEventListener('click', (e) => viewRoute(e.target.closest('button').dataset.id));
        });
        
        document.querySelectorAll('.edit-route').forEach(btn => {
            btn.addEventListener('click', (e) => editRoute(e.target.closest('button').dataset.id));
        });
        
        document.querySelectorAll('.delete-route').forEach(btn => {
            btn.addEventListener('click', (e) => confirmDelete(e.target.closest('button').dataset.id));
        });
    }
    
    /**
     * Handle route form submission
     */
    async function handleRouteSubmit(e) {
        e.preventDefault();
        
        if (markers.length < 2) {
            showAlert('Please add at least 2 stops to create a route', 'warning');
            return;
        }
        
        const formData = new FormData(routeForm);
        const routeData = {
            name: formData.get('name'),
            description: formData.get('description'),
            isActive: document.getElementById('routeStatus').checked,
            stops: markers.map((marker, index) => ({
                name: marker.name || `Stop ${index + 1}`,
                coordinates: [marker.getLatLng().lng, marker.getLatLng().lat],
                estimatedTime: marker.estimatedTime || index * 5, // Default 5 min between stops
                isActive: marker.isActive !== false // Default to true if not set
            }))
        };
        
        try {
            showLoading(true, 'Saving route...');
            
            const url = isEditMode ? `/api/routes/${currentRoute}` : '/api/routes';
            const method = isEditMode ? 'PUT' : 'POST';
            
            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(routeData)
            });
            
            const data = await response.json();
            
            if (response.ok && data.success) {
                showAlert(`Route ${isEditMode ? 'updated' : 'created'} successfully`, 'success');
                routeModal.hide();
                loadRoutes();
            } else {
                throw new Error(data.message || 'Failed to save route');
            }
        } catch (error) {
            console.error('Error saving route:', error);
            showAlert(error.message || 'Failed to save route. Please try again.', 'danger');
        } finally {
            showLoading(false);
        }
    }
    
    /**
     * Add a stop to the map
     */
    function addStop(lat, lng, name = '', estimatedTime = null, isActive = true) {
        const marker = L.marker([lat, lng], {
            draggable: true,
            icon: L.divIcon({
                html: `<div class="stop-marker">
                    <div class="stop-marker-inner">
                        <i class="fas fa-map-marker-alt"></i>
                        <span class="stop-number">${markers.length + 1}</span>
                    </div>
                </div>`,
                className: 'custom-marker',
                iconSize: [32, 32],
                iconAnchor: [16, 32],
                popupAnchor: [0, -32]
            })
        }).addTo(routeLayer);
        
        // Store additional data with the marker
        marker.name = name;
        marker.estimatedTime = estimatedTime;
        marker.isActive = isActive;
        
        // Add popup with stop details
        marker.bindPopup(`
            <div class="p-2">
                <h6>${name || `Stop ${markers.length + 1}`}</h6>
                <p class="mb-1">
                    <small class="text-muted">
                        ${lat.toFixed(6)}, ${lng.toFixed(6)}
                    </small>
                </p>
                <p class="mb-1">
                    <strong>ETA:</strong> ${estimatedTime || 'N/A'} min
                </p>
                <div class="d-flex justify-content-between mt-2">
                    <button class="btn btn-sm btn-outline-primary edit-stop" data-id="${marker._leaflet_id}">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn btn-sm btn-outline-danger remove-stop" data-id="${marker._leaflet_id}">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `);
        
        // Add to markers array
        markers.push(marker);
        
        // Update UI
        updateStopsList();
        updateRouteSummary();
        
        // Add event listeners
        marker.on('dragend', onMarkerDragEnd);
        
        // Add click event to the popup buttons
        marker.on('popupopen', function() {
            document.querySelector(`.edit-stop[data-id="${marker._leaflet_id}"]`)?.addEventListener('click', () => editStop(marker));
            document.querySelector(`.remove-stop[data-id="${marker._leaflet_id}"]`)?.addEventListener('click', () => removeStop(marker));
        });
        
        return marker;
    }
    
    /**
     * Add a stop from the button click
     */
    function addStopFromButton() {
        if (markers.length === 0) {
            // First stop - add at current map center
            const center = map.getCenter();
            addStop(center.lat, center.lng);
        } else {
            // Add near the last stop
            const lastStop = markers[markers.length - 1];
            const lastPos = lastStop.getLatLng();
            
            // Add slightly offset from the last stop
            addStop(
                lastPos.lat + (Math.random() * 0.01 - 0.005),
                lastPos.lng + (Math.random() * 0.01 - 0.005)
            );
        }
        
        // Update the map view
        fitMapToMarkers();
    }
    
    /**
     * Handle marker drag end event
     */
    function onMarkerDragEnd(e) {
        updateStopsList();
        updateRouteSummary();
    }
    
    /**
     * Update the stops list in the UI
     */
    function updateStopsList() {
        const stopsList = document.getElementById('stopsList');
        
        if (markers.length === 0) {
            stopsList.innerHTML = `
                <div class="text-center py-5 text-muted" id="noStopsMessage">
                    <i class="fas fa-map-marker-alt fa-3x mb-3"></i>
                    <p>No stops added yet.<br>Click "Add Stop" or click on the map to add stops.</p>
                </div>`;
            return;
        }
        
        // Remove the "no stops" message if it exists
        const noStopsMessage = document.getElementById('noStopsMessage');
        if (noStopsMessage) noStopsMessage.remove();
        
        // Sort markers by their current sequence (based on array order)
        stopsList.innerHTML = markers.map((marker, index) => {
            const pos = marker.getLatLng();
            return `
                <div class="list-group-item list-group-item-action" data-marker-id="${marker._leaflet_id}">
                    <div class="d-flex w-100 justify-content-between align-items-center">
                        <div class="d-flex align-items-center">
                            <div class="me-3 text-center" style="min-width: 24px;">
                                <span class="badge rounded-circle bg-primary">${index + 1}</span>
                            </div>
                            <div>
                                <h6 class="mb-0">${marker.name || `Stop ${index + 1}`}</h6>
                                <small class="text-muted">${pos.lat.toFixed(6)}, ${pos.lng.toFixed(6)}</small>
                            </div>
                        </div>
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-sm btn-outline-primary edit-stop" data-id="${marker._leaflet_id}">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-danger remove-stop" data-id="${marker._leaflet_id}">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>`;
        }).join('');
        
        // Add event listeners to the new buttons
        document.querySelectorAll('.edit-stop').forEach(btn => {
            btn.addEventListener('click', () => {
                const marker = markers.find(m => m._leaflet_id == btn.dataset.id);
                if (marker) editStop(marker);
            });
        });
        
        document.querySelectorAll('.remove-stop').forEach(btn => {
            btn.addEventListener('click', () => {
                const marker = markers.find(m => m._leaflet_id == btn.dataset.id);
                if (marker) removeStop(marker);
            });
        });
    }
    
    /**
     * Update the route summary information
     */
    function updateRouteSummary() {
        document.getElementById('totalStops').textContent = markers.length;
        
        // Calculate total duration (use the last stop's estimated time or calculate based on number of stops)
        let totalDuration = 0;
        if (markers.length > 0) {
            const lastStop = markers[markers.length - 1];
            totalDuration = lastStop.estimatedTime || (markers.length * 5); // Default 5 min per stop
        }
        
        document.getElementById('totalDuration').textContent = `${totalDuration} min`;
        
        // Update the route line
        updateRouteLine();
    }
    
    /**
     * Update the route line on the map
     */
    function updateRouteLine() {
        // Remove existing route line
        routeLayer.clearLayers();
        
        if (markers.length < 2) return;
        
        // Add markers back to the layer
        markers.forEach(marker => routeLayer.addLayer(marker));
        
        // Create a polyline connecting the stops
        const latlngs = markers.map(marker => marker.getLatLng());
        
        // Add the route line
        L.polyline(latlngs, {
            color: '#4e73df',
            weight: 4,
            opacity: 0.8,
            dashArray: '5, 5'
        }).addTo(routeLayer);
    }
    
    /**
     * Fit the map to show all markers
     */
    function fitMapToMarkers() {
        if (markers.length === 0) return;
        
        const group = new L.featureGroup(markers);
        map.fitBounds(group.getBounds().pad(0.1));
    }
    
    /**
     * Edit a stop
     */
    function editStop(marker) {
        currentStopMarker = marker;
        const pos = marker.getLatLng();
        
        // Fill the form with stop data
        document.getElementById('stopId').value = marker._leaflet_id;
        document.getElementById('stopName').value = marker.name || '';
        document.getElementById('stopLat').value = pos.lat.toFixed(6);
        document.getElementById('stopLng').value = pos.lng.toFixed(6);
        document.getElementById('stopEstimatedTime').value = marker.estimatedTime || '';
        document.getElementById('stopIsActive').checked = marker.isActive !== false;
        
        // Try to get address from coordinates
        if (navigator.geolocation) {
            fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.lat}&lon=${pos.lng}`)
                .then(response => response.json())
                .then(data => {
                    if (data.display_name) {
                        document.getElementById('stopAddress').value = data.display_name;
                    }
                })
                .catch(console.error);
        }
        
        // Show the modal
        stopModal.show();
    }
    
    /**
     * Handle stop form submission
     */
    function handleStopSubmit(e) {
        e.preventDefault();
        
        if (!currentStopMarker) return;
        
        // Update marker data
        currentStopMarker.name = document.getElementById('stopName').value;
        currentStopMarker.estimatedTime = parseInt(document.getElementById('stopEstimatedTime').value) || 0;
        currentStopMarker.isActive = document.getElementById('stopIsActive').checked;
        
        // Update the marker's popup
        const pos = currentStopMarker.getLatLng();
        currentStopMarker.setPopupContent(`
            <div class="p-2">
                <h6>${currentStopMarker.name || 'Stop'}</h6>
                <p class="mb-1">
                    <small class="text-muted">
                        ${pos.lat.toFixed(6)}, ${pos.lng.toFixed(6)}
                    </small>
                </p>
                <p class="mb-1">
                    <strong>ETA:</strong> ${currentStopMarker.estimatedTime || 'N/A'} min
                </p>
                <div class="d-flex justify-content-between mt-2">
                    <button class="btn btn-sm btn-outline-primary edit-stop" data-id="${currentStopMarker._leaflet_id}">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn btn-sm btn-outline-danger remove-stop" data-id="${currentStopMarker._leaflet_id}">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `);
        
        // Update the stops list and summary
        updateStopsList();
        updateRouteSummary();
        
        // Close the modal
        stopModal.hide();
    }
    
    /**
     * Remove a stop
     */
    function removeStop(marker) {
        if (confirm('Are you sure you want to remove this stop?')) {
            const index = markers.findIndex(m => m._leaflet_id === marker._leaflet_id);
            if (index > -1) {
                routeLayer.removeLayer(marker);
                markers.splice(index, 1);
                updateStopsList();
                updateRouteSummary();
            }
        }
    }
    
    /**
     * View a route
     */
    async function viewRoute(routeId) {
        try {
            showLoading(true, 'Loading route...');
            
            const response = await fetch(`/api/routes/${routeId}`);
            const data = await response.json();
            
            if (data.success) {
                // Open the modal in view mode
                openRouteModal(data.data, true);
            } else {
                throw new Error(data.message || 'Failed to load route');
            }
        } catch (error) {
            console.error('Error viewing route:', error);
            showAlert(error.message || 'Failed to load route. Please try again.', 'danger');
        } finally {
            showLoading(false);
        }
    }
    
    /**
     * Edit a route
     */
    async function editRoute(routeId) {
        try {
            showLoading(true, 'Loading route...');
            
            const response = await fetch(`/api/routes/${routeId}`);
            const data = await response.json();
            
            if (data.success) {
                // Open the modal in edit mode
                openRouteModal(data.data, false);
            } else {
                throw new Error(data.message || 'Failed to load route');
            }
        } catch (error) {
            console.error('Error editing route:', error);
            showAlert(error.message || 'Failed to load route. Please try again.', 'danger');
        } finally {
            showLoading(false);
        }
    }
    
    /**
     * Open the route modal with data
     */
    function openRouteModal(route, isViewMode = false) {
        // Set the modal title
        document.getElementById('modalTitle').textContent = 
            isViewMode ? `View Route: ${route.name}` : `Edit Route: ${route.name}`;
        
        // Set the form data
        document.getElementById('routeId').value = route._id;
        document.getElementById('routeName').value = route.name;
        document.getElementById('routeDescription').value = route.description || '';
        document.getElementById('routeStatus').checked = route.isActive !== false;
        
        // Update status badge
        document.getElementById('statusBadge').className = 
            `badge bg-${route.isActive !== false ? 'success' : 'secondary'}`;
        document.getElementById('statusBadge').textContent = 
            route.isActive !== false ? 'Active' : 'Inactive';
        
        // Clear existing markers
        routeLayer.clearLayers();
        markers = [];
        
        // Add stops to the map
        if (route.stops && route.stops.length > 0) {
            route.stops.forEach((stop, index) => {
                const marker = addStop(
                    stop.location.coordinates[1], // lat
                    stop.location.coordinates[0], // lng
                    stop.name,
                    stop.estimatedTime,
                    stop.isActive
                );
                
                // If this is the first or last stop, use a different icon
                if (index === 0) {
                    // First stop - use a green icon
                    marker.setIcon(L.divIcon({
                        html: `<div class="stop-marker first-stop">
                            <div class="stop-marker-inner">
                                <i class="fas fa-flag-checkered"></i>
                            </div>
                        </div>`,
                        className: 'custom-marker',
                        iconSize: [32, 32],
                        iconAnchor: [16, 32],
                        popupAnchor: [0, -32]
                    }));
                } else if (index === route.stops.length - 1) {
                    // Last stop - use a red icon
                    marker.setIcon(L.divIcon({
                        html: `<div class="stop-marker last-stop">
                            <div class="stop-marker-inner">
                                <i class="fas fa-flag"></i>
                            </div>
                        </div>`,
                        className: 'custom-marker',
                        iconSize: [32, 32],
                        iconAnchor: [16, 32],
                        popupAnchor: [0, -32]
                    }));
                }
                
                // If stop is inactive, add a class to style it differently
                if (stop.isActive === false) {
                    marker.getElement().classList.add('inactive-stop');
                }
            });
            
            // Fit the map to show all markers
            fitMapToMarkers();
        }
        
        // Set the current route ID for updates
        currentRoute = route._id;
        isEditMode = true;
        
        // Show/hide form elements based on view mode
        document.getElementById('routeName').readOnly = isViewMode;
        document.getElementById('routeDescription').readOnly = isViewMode;
        document.getElementById('routeStatus').disabled = isViewMode;
        document.getElementById('addStopBtn').style.display = isViewMode ? 'none' : 'block';
        document.getElementById('fitBoundsBtn').style.display = 'block';
        
        // Update the save button text
        saveRouteBtn.textContent = isViewMode ? 'Close' : 'Update Route';
        
        // If in view mode, change the save button to a close button
        if (isViewMode) {
            saveRouteBtn.classList.remove('btn-primary');
            saveRouteBtn.classList.add('btn-secondary');
            saveRouteBtn.type = 'button';
            saveRouteBtn.onclick = () => routeModal.hide();
        } else {
            saveRouteBtn.classList.remove('btn-secondary');
            saveRouteBtn.classList.add('btn-primary');
            saveRouteBtn.type = 'submit';
            saveRouteBtn.onclick = null;
        }
        
        // Show the modal
        routeModal.show();
    }
    
    /**
     * Confirm route deletion
     */
    function confirmDelete(routeId) {
        currentRoute = routeId;
        deleteModal.show();
    }
    
    /**
     * Delete a route
     */
    async function deleteRoute() {
        if (!currentRoute) return;
        
        try {
            showLoading(true, 'Deleting route...', 'deleteSpinner');
            
            const response = await fetch(`/api/routes/${currentRoute}`, {
                method: 'DELETE'
            });
            
            const data = await response.json();
            
            if (response.ok && data.success) {
                showAlert('Route deleted successfully', 'success');
                deleteModal.hide();
                loadRoutes();
            } else {
                throw new Error(data.message || 'Failed to delete route');
            }
        } catch (error) {
            console.error('Error deleting route:', error);
            showAlert(error.message || 'Failed to delete route. Please try again.', 'danger');
        } finally {
            showLoading(false, 'Delete Route', 'deleteSpinner');
            currentRoute = null;
        }
    }
    
    /**
     * Handle search
     */
    function handleSearch() {
        const searchTerm = searchInput.value.trim().toLowerCase();
        const rows = document.querySelectorAll('#routesTableBody tr');
        
        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(searchTerm) ? '' : 'none';
        });
    }
    
    /**
     * Reset the form
     */
    function resetForm() {
        routeForm.reset();
        routeLayer.clearLayers();
        markers = [];
        currentRoute = null;
        isEditMode = false;
        
        // Reset UI elements
        document.getElementById('totalStops').textContent = '0';
        document.getElementById('totalDuration').textContent = '0 min';
        document.getElementById('stopsList').innerHTML = `
            <div class="text-center py-5 text-muted" id="noStopsMessage">
                <i class="fas fa-map-marker-alt fa-3x mb-3"></i>
                <p>No stops added yet.<br>Click "Add Stop" or click on the map to add stops.</p>
            </div>`;
    }
    
    /**
     * Show loading state
     */
    function showLoading(isLoading, text = 'Loading...', spinnerId = 'saveSpinner') {
        const spinner = document.getElementById(spinnerId);
        if (spinner) {
            spinner.previousElementSibling.style.display = isLoading ? 'none' : 'inline-block';
            spinner.classList.toggle('d-none', !isLoading);
            spinner.nextElementSibling.textContent = text;
        }
        
        // Disable form elements when loading
        const formElements = routeForm.elements;
        for (let i = 0; i < formElements.length; i++) {
            formElements[i].disabled = isLoading;
        }
    }
    
    /**
     * Show an alert message
     */
    function showAlert(message, type = 'info') {
        // Remove any existing alerts
        const existingAlert = document.querySelector('.alert');
        if (existingAlert) existingAlert.remove();
        
        // Create and show the alert
        const alert = document.createElement('div');
        alert.className = `alert alert-${type} alert-dismissible fade show`;
        alert.role = 'alert';
        alert.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        `;
        
        // Add to the page
        document.querySelector('.container-fluid').prepend(alert);
        
        // Auto-dismiss after 5 seconds
        setTimeout(() => {
            const bsAlert = new bootstrap.Alert(alert);
            bsAlert.close();
        }, 5000);
    }
    
    /**
     * Calculate total duration of a route
     */
    function calculateTotalDuration(stops) {
        if (!stops || stops.length === 0) return 0;
        
        // Use the last stop's estimated time if available
        const lastStop = stops[stops.length - 1];
        if (lastStop.estimatedTime) {
            return lastStop.estimatedTime;
        }
        
        // Default to 5 minutes per stop
        return stops.length * 5;
    }
    
    /**
     * Debounce function to limit the rate of function calls
     */
    function debounce(func, wait) {
        let timeout;
        return function() {
            const context = this;
            const args = arguments;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), wait);
        };
    }
    
    // Add click handler to the map to add stops
    map.on('click', function(e) {
        // Only add stops if we're in edit mode and not viewing
        if (isEditMode && !document.getElementById('routeName').readOnly) {
            addStop(e.latlng.lat, e.latlng.lng);
        }
    });
    
    // Add click handler for the "Add Route" button
    document.querySelector('[data-bs-target="#routeModal"]').addEventListener('click', function() {
        // Reset the form and set up for a new route
        resetForm();
        
        // Set the modal title
        document.getElementById('modalTitle').textContent = 'Add New Route';
        
        // Enable form fields
        document.getElementById('routeName').readOnly = false;
        document.getElementById('routeDescription').readOnly = false;
        document.getElementById('routeStatus').disabled = false;
        document.getElementById('addStopBtn').style.display = 'block';
        document.getElementById('fitBoundsBtn').style.display = 'block';
        
        // Set up the save button
        saveRouteBtn.textContent = 'Save Route';
        saveRouteBtn.classList.remove('btn-secondary');
        saveRouteBtn.classList.add('btn-primary');
        saveRouteBtn.type = 'submit';
        saveRouteBtn.onclick = null;
        
        // Set the current route to null for a new route
        currentRoute = null;
        isEditMode = false;
    });
});
