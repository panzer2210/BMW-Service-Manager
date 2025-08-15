class BMWDashboard {
    constructor() {
        this.charts = {};
        this.notifications = [];
        this.init();
    }

    async init() {
        await this.loadDashboardStats();
        await this.createCharts();
        this.setupQuickActions();
        this.loadRecentActivity();
        this.setupNotifications();
        this.startRealTimeUpdates();
    }

    async loadDashboardStats() {
        try {
            const response = await fetch('/api/dashboard-stats');
            const stats = await response.json();
            
            // Update stat cards with animation
            this.animateStatUpdate('totalVehicles', stats.totalVehicles || 0);
            this.animateStatUpdate('totalCustomers', stats.totalCustomers || 0);
            this.animateStatUpdate('totalAppointments', stats.totalAppointments || 0);
            
        } catch (error) {
            console.error('Error loading dashboard stats:', error);
            this.showNotification('Error al cargar estadísticas', 'error');
        }
    }

    animateStatUpdate(elementId, finalValue) {
        const element = document.getElementById(elementId);
        if (!element) return;

        let currentValue = 0;
        const increment = Math.ceil(finalValue / 20);
        const timer = setInterval(() => {
            currentValue += increment;
            if (currentValue >= finalValue) {
                currentValue = finalValue;
                clearInterval(timer);
            }
            element.textContent = currentValue;
        }, 50);
    }

    async createCharts() {
        await this.createSalesChart();
        await this.createVehicleTypeChart();
    }

    async createSalesChart() {
        const canvas = document.getElementById('salesChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const gradient = ctx.createLinearGradient(0, 0, 0, 200);
        
        // Use theme-aware colors
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        gradient.addColorStop(0, isDark ? '#00D4FF' : '#1e3c72');
        gradient.addColorStop(1, isDark ? '#0066CC' : '#2a5298');

        // Get real sales data from completed appointments with vehicles
        const salesData = await this.getRealSalesData();

        this.drawBarChart(ctx, salesData, gradient, canvas.width, canvas.height);
    }

    async createVehicleTypeChart() {
        const canvas = document.getElementById('vehicleTypeChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        
        // Get real vehicle data from database
        const vehicleData = await this.getRealVehicleData();

        this.drawPieChart(ctx, vehicleData, canvas.width, canvas.height);
    }

    drawBarChart(ctx, data, gradient, width, height) {
        ctx.clearRect(0, 0, width, height);
        
        const padding = 40;
        const chartWidth = width - 2 * padding;
        const chartHeight = height - 2 * padding;
        const barWidth = chartWidth / data.length - 10;
        const maxValue = Math.max(...data.map(d => d.sales));

        data.forEach((item, index) => {
            const barHeight = (item.sales / maxValue) * chartHeight;
            const x = padding + index * (barWidth + 10);
            const y = height - padding - barHeight;

            // Draw bar
            ctx.fillStyle = gradient;
            ctx.fillRect(x, y, barWidth, barHeight);

            // Draw month label
            ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-primary');
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(item.month, x + barWidth / 2, height - 10);

            // Draw value
            ctx.fillText(item.sales, x + barWidth / 2, y - 5);
        });
    }

    drawPieChart(ctx, data, width, height) {
        ctx.clearRect(0, 0, width, height);
        
        const centerX = width / 2;
        const centerY = height / 2;
        const radius = Math.min(width, height) / 3;
        const total = data.reduce((sum, item) => sum + item.count, 0);

        let currentAngle = -Math.PI / 2; // Start at top

        data.forEach((item, index) => {
            const sliceAngle = (item.count / total) * 2 * Math.PI;
            
            // Draw slice
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
            ctx.closePath();
            ctx.fillStyle = item.color;
            ctx.fill();

            // Draw label
            const labelAngle = currentAngle + sliceAngle / 2;
            const labelX = centerX + Math.cos(labelAngle) * (radius + 20);
            const labelY = centerY + Math.sin(labelAngle) * (radius + 20);
            
            ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-primary');
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(`${item.type}: ${item.count}`, labelX, labelY);

            currentAngle += sliceAngle;
        });
    }

    setupQuickActions() {
        // Set up quick action handlers
        window.openQuickVehicleAdd = () => this.showQuickModal('vehicle');
        window.openQuickCustomerAdd = () => this.showQuickModal('customer');
        window.generateReport = () => this.generateReport();
        window.openCalculator = () => window.financeCalculator.openCalculator();
        window.viewNotifications = () => this.showNotificationsPanel();
    }

    showQuickModal(type) {
        // Create and show modal for quick actions
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'block';
        
        let content = '';
        switch(type) {
            case 'vehicle':
                content = this.getVehicleForm();
                break;
            case 'customer':
                content = this.getCustomerForm();
                break;
        }

        modal.innerHTML = `
            <div class="modal-content">
                <span class="close" onclick="this.parentElement.parentElement.remove()">&times;</span>
                ${content}
            </div>
        `;

        document.body.appendChild(modal);
        
        // Setup form submission
        this.setupQuickFormSubmission(modal, type);
        
        // Add phone validation for customer form
        if (type === 'customer') {
            const phoneInput = modal.querySelector('input[name="phone"]');
            if (phoneInput) {
                phoneInput.addEventListener('input', (e) => {
                    // Remove any non-numeric characters
                    e.target.value = e.target.value.replace(/[^0-9]/g, '');
                    // Limit to 8 characters
                    if (e.target.value.length > 8) {
                        e.target.value = e.target.value.slice(0, 8);
                    }
                });
                
                phoneInput.addEventListener('paste', (e) => {
                    // Handle paste events
                    e.preventDefault();
                    const pastedText = (e.clipboardData || window.clipboardData).getData('text');
                    const numericOnly = pastedText.replace(/[^0-9]/g, '').slice(0, 8);
                    e.target.value = numericOnly;
                });
            }
        }
        
        // Add click outside to close
        modal.onclick = (e) => {
            if (e.target === modal) modal.remove();
        };
    }

    setupQuickFormSubmission(modal, type) {
        const form = modal.querySelector('form');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                
                const formData = new FormData(form);
                const data = Object.fromEntries(formData);
                
                // Mostrar carga
                const submitBtn = form.querySelector('button[type="submit"]');
                const originalText = submitBtn.textContent;
                submitBtn.textContent = 'Guardando...';
                submitBtn.disabled = true;
                
                // Simular envío exitoso
                setTimeout(() => {
                    let activityDesc = '';
                    let activityIcon = '';
                    let activityTitle = '';
                    
                    switch(type) {
                        case 'sale':
                            activityIcon = '💰';
                            activityTitle = 'Venta completada';
                            activityDesc = `${data.vehicle} vendido a ${data.customer} - $${data.price}`;
                            console.log('Adding sale activity:', activityTitle, activityDesc);
                            break;
                        case 'vehicle':
                            activityIcon = '🚗';
                            activityTitle = 'Vehículo agregado';
                            activityDesc = `${data.model} ${data.year} - ${data.color}`;
                            console.log('Adding vehicle activity:', activityTitle, activityDesc);
                            break;
                        case 'customer':
                            activityIcon = '👥';
                            activityTitle = 'Cliente registrado';
                            activityDesc = `${data.first_name} ${data.last_name} - ${data.email}`;
                            // Save customer for future use
                            this.saveCustomer(`${data.first_name} ${data.last_name}`);
                            console.log('Adding customer activity:', activityTitle, activityDesc);
                            break;
                    }
                    
                    // Add to recent activity
                    this.addActivity(activityIcon, activityTitle, activityDesc);
                    
                    // Show success message
                    this.showNotification(`${activityTitle} exitosamente`, 'success');
                    
                    // Close modal
                    modal.remove();
                    
                    // Refresh stats (simulate increment)
                    this.simulateStatsIncrement(type);
                    
                }, 800);
            });
        }
    }

    getVehicleForm() {
        return `
            <h2>🚗 Agregar Vehículo Rápido</h2>
            <form id="quickVehicleForm">
                <div class="form-row">
                    <div class="form-group">
                        <label>Modelo BMW</label>
                        <select class="form-control" name="model" required>
                            <option value="">Seleccionar modelo</option>
                            <option value="BMW X1">BMW X1</option>
                            <option value="BMW X3">BMW X3</option>
                            <option value="BMW X5">BMW X5</option>
                            <option value="BMW 320i">BMW 320i</option>
                            <option value="BMW 330i">BMW 330i</option>
                            <option value="BMW M3">BMW M3</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Año</label>
                        <input type="number" class="form-control" name="year" min="2020" max="2025" value="2024" required>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>VIN</label>
                        <input type="text" class="form-control" name="vin" maxlength="17" required>
                    </div>
                    <div class="form-group">
                        <label>Color</label>
                        <select class="form-control" name="color" required>
                            <option value="Alpine White">Alpine White</option>
                            <option value="Jet Black">Jet Black</option>
                            <option value="Mineral Grey">Mineral Grey</option>
                            <option value="Melbourne Red">Melbourne Red</option>
                        </select>
                    </div>
                </div>
                <div class="form-group">
                    <label>Precio ($)</label>
                    <input type="number" class="form-control" name="price" required>
                </div>
                <button type="submit" class="btn btn-success">Agregar Vehículo</button>
            </form>
        `;
    }

    getCustomerForm() {
        return `
            <h2>👥 Nuevo Cliente Rápido</h2>
            <form id="quickCustomerForm">
                <div class="form-row">
                    <div class="form-group">
                        <label>Nombre</label>
                        <input type="text" class="form-control" name="first_name" required>
                    </div>
                    <div class="form-group">
                        <label>Apellido</label>
                        <input type="text" class="form-control" name="last_name" required>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Email</label>
                        <input type="email" class="form-control" name="email" required>
                    </div>
                    <div class="form-group">
                        <label>Teléfono</label>
                        <input type="tel" class="form-control" name="phone" maxlength="8" pattern="[0-9]{8}" 
                               placeholder="12345678" title="Debe contener exactamente 8 números" required>
                    </div>
                </div>
                <div class="form-group">
                    <label>Dirección</label>
                    <textarea class="form-control" name="address" rows="3"></textarea>
                </div>
                <button type="submit" class="btn btn-success">Agregar Cliente</button>
            </form>
        `;
    }


    loadRecentActivity() {
        console.log('Loading recent activity...');
        // Load activities from localStorage or use defaults
        let activities = JSON.parse(localStorage.getItem('bmw-recent-activities') || '[]');
        console.log('Loaded activities from localStorage:', activities.length);
        
        if (activities.length === 0) {
            console.log('No activities found, loading defaults');
            // Actividades por defecto si no hay guardadas
            activities = [
                { icon: '🚗', title: 'Nuevo vehículo agregado', desc: 'BMW X5 2024 - Blanco Alpino', time: 'Hace 2 horas', timestamp: Date.now() - 7200000 },
                { icon: '👥', title: 'Cliente registrado', desc: 'María García - maria@email.com', time: 'Hace 4 horas', timestamp: Date.now() - 14400000 },
                { icon: '💰', title: 'Venta completada', desc: 'BMW M3 2024 - $80,000', time: 'Ayer', timestamp: Date.now() - 86400000 }
            ];
            this.saveActivities(activities);
        }

        // Sort by timestamp (newest first)
        activities.sort((a, b) => b.timestamp - a.timestamp);
        
        // Show only last 10 activities
        activities = activities.slice(0, 10);

        const container = document.getElementById('recentActivity');
        console.log('Activity container found:', container ? 'Yes' : 'No');
        
        if (container) {
            const html = activities.map(activity => `
                <div class="activity-item">
                    <div class="activity-icon">${activity.icon}</div>
                    <div class="activity-content">
                        <strong>${activity.title}</strong>
                        <p>${activity.desc}</p>
                        <span class="activity-time">${this.formatTimeAgo(activity.timestamp)}</span>
                    </div>
                </div>
            `).join('');
            
            container.innerHTML = html;
            console.log('Updated activity container with', activities.length, 'activities');
        }
    }

    addActivity(icon, title, desc) {
        console.log('AddActivity called with:', { icon, title, desc });
        
        const activities = JSON.parse(localStorage.getItem('bmw-recent-activities') || '[]');
        const newActivity = {
            icon,
            title,
            desc,
            timestamp: Date.now(),
            time: 'Justo ahora'
        };
        
        console.log('New activity object:', newActivity);
        activities.unshift(newActivity);
        
        // Keep only last 20 activities
        if (activities.length > 20) {
            activities.splice(20);
        }
        
        console.log('Activities before saving:', activities);
        this.saveActivities(activities);
        console.log('Activities saved to localStorage');
        
        // Force reload recent activity
        setTimeout(() => {
            this.loadRecentActivity();
            console.log('Recent activity reloaded');
        }, 100);
    }

    saveActivities(activities) {
        localStorage.setItem('bmw-recent-activities', JSON.stringify(activities));
    }

    formatTimeAgo(timestamp) {
        const now = Date.now();
        const diff = now - timestamp;
        
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (seconds < 60) return 'Justo ahora';
        if (minutes < 60) return `Hace ${minutes} minuto${minutes > 1 ? 's' : ''}`;
        if (hours < 24) return `Hace ${hours} hora${hours > 1 ? 's' : ''}`;
        if (days < 7) return `Hace ${days} día${days > 1 ? 's' : ''}`;
        return 'Hace más de una semana';
    }


    saveCustomer(customerName) {
        const customers = JSON.parse(localStorage.getItem('bmw-customers') || '[]');
        if (!customers.includes(customerName)) {
            customers.push(customerName);
            localStorage.setItem('bmw-customers', JSON.stringify(customers));
        }
    }

    simulateStatsIncrement(type) {
        // Simulate increment in dashboard stats
        switch(type) {
            case 'vehicle':
                const totalVehiclesEl = document.getElementById('totalVehicles');
                const availableVehiclesEl = document.getElementById('availableVehicles');
                if (totalVehiclesEl) {
                    const current = parseInt(totalVehiclesEl.textContent) || 0;
                    this.animateStatUpdate('totalVehicles', current + 1);
                }
                if (availableVehiclesEl) {
                    const current = parseInt(availableVehiclesEl.textContent) || 0;
                    this.animateStatUpdate('availableVehicles', current + 1);
                }
                break;
            case 'customer':
                const customersEl = document.getElementById('totalCustomers');
                if (customersEl) {
                    const current = parseInt(customersEl.textContent) || 0;
                    this.animateStatUpdate('totalCustomers', current + 1);
                }
                break;
        }
    }

    setupNotifications() {
        // Add some sample notifications
        this.notifications = [
            { id: 1, title: 'Mantenimiento programado', message: 'BMW X5 requiere servicio en 3 días', type: 'warning' },
            { id: 2, title: 'Nuevo cliente', message: 'Juan Pérez ha sido registrado', type: 'info' },
            { id: 3, title: 'Venta completada', message: 'BMW 330i vendido por $45,000', type: 'success' }
        ];

        this.updateNotificationBadge();
    }

    updateNotificationBadge() {
        const badge = document.getElementById('notificationBadge');
        if (badge && this.notifications.length > 0) {
            badge.textContent = this.notifications.length;
            badge.style.display = 'flex';
        }
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `alert alert-${type}`;
        notification.textContent = message;
        notification.style.position = 'fixed';
        notification.style.top = '20px';
        notification.style.right = '20px';
        notification.style.zIndex = '10000';
        notification.style.minWidth = '300px';

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 5000);
    }

    generateReport() {
        this.showNotification('Generando reporte...', 'info');
        
        // Add to recent activity
        this.addActivity('📊', 'Reporte generado', `Reporte del sistema generado - ${new Date().toLocaleDateString()}`);
        
        // Simulate report generation
        setTimeout(() => {
            const reportWindow = window.open('', '_blank');
            reportWindow.document.write(`
                <html>
                    <head>
                        <title>BMW Service Manager - Reporte</title>
                        <style>
                            body { 
                                font-family: Arial, sans-serif; 
                                margin: 40px; 
                                background: linear-gradient(135deg, #1e3c72, #2a5298);
                                color: white;
                            }
                            .header { 
                                text-align: center; 
                                margin-bottom: 30px; 
                                background: rgba(255,255,255,0.1);
                                padding: 20px;
                                border-radius: 10px;
                            }
                            .stats-grid { 
                                display: grid; 
                                grid-template-columns: repeat(2, 1fr); 
                                gap: 20px; 
                                margin: 20px 0;
                            }
                            .stat-item { 
                                padding: 20px; 
                                background: rgba(255,255,255,0.1);
                                border-radius: 10px;
                                text-align: center;
                            }
                            .stat-number { 
                                font-size: 2rem; 
                                font-weight: bold; 
                                color: #00D4FF;
                            }
                        </style>
                    </head>
                    <body>
                        <div class="header">
                            <h1>🚗 BMW Service Manager - Reporte</h1>
                            <p>Fecha: ${new Date().toLocaleDateString()}</p>
                        </div>
                        <div class="stats-grid">
                            <div class="stat-item">
                                <div class="stat-number">${document.getElementById('totalVehicles')?.textContent || '0'}</div>
                                <div>Vehículos Totales</div>
                            </div>
                            <div class="stat-item">
                                <div class="stat-number">${document.getElementById('availableVehicles')?.textContent || '0'}</div>
                                <div>Vehículos Disponibles</div>
                            </div>
                            <div class="stat-item">
                                <div class="stat-number">${document.getElementById('totalCustomers')?.textContent || '0'}</div>
                                <div>Clientes Registrados</div>
                            </div>
                            <div class="stat-item">
                                <div class="stat-number">${document.getElementById('totalAppointments')?.textContent || '0'}</div>
                                <div>Citas Totales</div>
                            </div>
                        </div>
                        <div style="margin-top: 40px; text-align: center; opacity: 0.8;">
                            <p>Generado automáticamente por BMW Service Manager</p>
                            <button onclick="window.print()" style="
                                background: #00D4FF; 
                                color: white; 
                                border: none; 
                                padding: 10px 20px; 
                                border-radius: 5px; 
                                cursor: pointer;
                                margin-top: 20px;
                            ">🖨️ Imprimir Reporte</button>
                        </div>
                    </body>
                </html>
            `);
            reportWindow.document.close();
            this.showNotification('¡Reporte generado exitosamente!', 'success');
        }, 1000);
    }

    showNotificationsPanel() {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'block';
        
        modal.innerHTML = `
            <div class="modal-content">
                <span class="close" onclick="this.parentElement.parentElement.remove()">&times;</span>
                <h2>🔔 Centro de Notificaciones</h2>
                <div class="notifications-list">
                    <div class="notification-item">
                        <div class="notification-icon">⚠️</div>
                        <div class="notification-content">
                            <strong>Mantenimiento Programado</strong>
                            <p>BMW X5 - VIN: WBAXXX001 requiere servicio en 3 días</p>
                            <small>Hace 2 horas</small>
                        </div>
                    </div>
                    <div class="notification-item">
                        <div class="notification-icon">✅</div>
                        <div class="notification-content">
                            <strong>Venta Completada</strong>
                            <p>BMW 330i vendido por $45,000 a María García</p>
                            <small>Hace 4 horas</small>
                        </div>
                    </div>
                    <div class="notification-item">
                        <div class="notification-icon">👤</div>
                        <div class="notification-content">
                            <strong>Nuevo Cliente</strong>
                            <p>Juan Pérez registrado en el sistema</p>
                            <small>Ayer</small>
                        </div>
                    </div>
                </div>
                <div style="text-align: center; margin-top: 20px;">
                    <button class="btn" onclick="this.parentElement.parentElement.parentElement.remove()">
                        Cerrar Notificaciones
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Reset notification badge
        const badge = document.getElementById('notificationBadge');
        if (badge) {
            badge.style.display = 'none';
            badge.textContent = '0';
        }
    }

    async getRealSalesData() {
        try {
            // Get completed appointments with vehicles from the last 6 months
            const response = await fetch('/api/appointments');
            const appointments = await response.json();
            
            const salesByMonth = {};
            const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
            
            // Initialize last 6 months and next 6 months to capture all sales
            const now = new Date();
            for (let i = 6; i >= -6; i--) {
                const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
                const monthKey = months[date.getMonth()];
                salesByMonth[monthKey] = 0;
            }
            
            // Count completed appointments with vehicles (sales) or sales appointments
            appointments.forEach(appointment => {
                const isSale = (appointment.status === 'completed' && appointment.vehicle_id) || 
                              (appointment.service_type === 'Venta' && appointment.status === 'completed');
                
                if (isSale) {
                    const date = new Date(appointment.appointment_date);
                    const monthKey = months[date.getMonth()];
                    if (salesByMonth.hasOwnProperty(monthKey)) {
                        salesByMonth[monthKey]++;
                    }
                }
            });
            
            return Object.entries(salesByMonth).map(([month, sales]) => ({
                month,
                sales
            }));
        } catch (error) {
            console.error('Error getting sales data:', error);
            // Fallback to sample data
            return [
                { month: 'Ene', sales: 2 },
                { month: 'Feb', sales: 4 },
                { month: 'Mar', sales: 1 },
                { month: 'Abr', sales: 3 },
                { month: 'May', sales: 2 },
                { month: 'Jun', sales: 5 }
            ];
        }
    }

    async getRealVehicleData() {
        try {
            const response = await fetch('/api/vehicles');
            const vehicles = await response.json();
            
            const typeCount = {};
            const typeColors = {
                'SUV': '#1e3c72',
                'Sedán': '#2a5298', 
                'Eléctrico': '#00D4FF',
                'Deportivo': '#0066CC',
                'Convertible': '#4CAF50',
                'Coupé': '#FF9800',
                'Otros': '#9C27B0'
            };
            
            vehicles.forEach(vehicle => {
                let type = 'Otros';
                const model = vehicle.model.toLowerCase();
                
                if (model.includes('x') || model.includes('suv')) {
                    type = 'SUV';
                } else if (model.includes('i') && (model.includes('3') || model.includes('4') || model.includes('x'))) {
                    type = 'Eléctrico';
                } else if (model.includes('m') || model.includes('deportivo')) {
                    type = 'Deportivo';
                } else if (model.includes('convertible') || model.includes('cabrio')) {
                    type = 'Convertible';
                } else if (model.includes('coupé') || model.includes('coupe')) {
                    type = 'Coupé';
                } else {
                    type = 'Sedán';
                }
                
                typeCount[type] = (typeCount[type] || 0) + 1;
            });
            
            return Object.entries(typeCount).map(([type, count]) => ({
                type,
                count,
                color: typeColors[type] || typeColors['Otros']
            }));
        } catch (error) {
            console.error('Error getting vehicle data:', error);
            // Fallback to sample data
            return [
                { type: 'SUV', count: 3, color: '#1e3c72' },
                { type: 'Sedán', count: 2, color: '#2a5298' },
                { type: 'Eléctrico', count: 1, color: '#00D4FF' },
                { type: 'Deportivo', count: 1, color: '#0066CC' }
            ];
        }
    }

    startRealTimeUpdates() {
        // Check for new sales every 5 seconds
        setInterval(() => {
            this.checkForNewSales();
        }, 5000);
        
        // Update stats and charts every 30 seconds
        setInterval(async () => {
            await this.loadDashboardStats();
            await this.createCharts();
        }, 30000);

        // Update charts when theme changes
        window.addEventListener('themeChanged', () => {
            setTimeout(async () => {
                await this.createCharts();
            }, 100);
        });
    }

    async checkForNewSales() {
        const saleData = localStorage.getItem('bmw-sale-completed');
        if (saleData) {
            const sale = JSON.parse(saleData);
            const lastCheck = localStorage.getItem('bmw-last-sale-check') || '0';
            
            // If this is a new sale (timestamp is newer than last check)
            if (sale.timestamp > parseInt(lastCheck)) {
                console.log('New sale detected, updating dashboard');
                
                // Update dashboard immediately with a small delay to ensure server processed the sale
                setTimeout(async () => {
                    await this.loadDashboardStats();
                    await this.createCharts();
                    this.loadRecentActivity();
                    
                    // Force refresh the main dashboard stats too
                    if (window.loadDashboardStats) {
                        await window.loadDashboardStats();
                    }
                    if (window.loadMonthlyRevenueHistory) {
                        await window.loadMonthlyRevenueHistory();
                    }
                    
                    // Add sale activity
                    this.addSaleActivity(sale);
                    
                    // Show notification
                    this.showNotification('¡Nueva venta registrada! Dashboard actualizado.', 'success');
                }, 1500);
                
                // Update last check timestamp
                localStorage.setItem('bmw-last-sale-check', sale.timestamp.toString());
            }
        }
    }

    addSaleActivity(sale) {
        // Add sale to recent activity
        this.addActivity('💰', 'Venta completada', `Venta registrada - ID: ${sale.appointmentId}`);
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.bmwDashboard = new BMWDashboard();
});