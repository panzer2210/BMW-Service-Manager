const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const path = require('path');
const { body, validationResult } = require('express-validator');
const flash = require('connect-flash');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
    secret: 'bmw-service-secret-key-2024',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false,
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: 'lax',
        httpOnly: true
    },
    name: 'bmw-session-id'
}));

app.use(flash());

app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    res.locals.messages = req.flash();
    next();
});

const db = new sqlite3.Database('./bmw_service.db', (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to SQLite database');
        initializeDatabase();
    }
});

function initializeDatabase() {
    db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT DEFAULT 'user',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS vehicles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            model TEXT NOT NULL,
            year INTEGER NOT NULL,
            vin TEXT UNIQUE NOT NULL,
            color TEXT NOT NULL,
            price DECIMAL(10,2) NOT NULL,
            status TEXT DEFAULT 'available',
            mileage INTEGER DEFAULT 0,
            fuel_type TEXT DEFAULT 'gasoline',
            transmission TEXT DEFAULT 'automatic',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS customers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            first_name TEXT NOT NULL,
            last_name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            phone TEXT NOT NULL,
            address TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS service_appointments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_id INTEGER NOT NULL,
            vehicle_id INTEGER,
            service_type TEXT NOT NULL,
            appointment_date DATETIME NOT NULL,
            status TEXT DEFAULT 'scheduled',
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (customer_id) REFERENCES customers (id),
            FOREIGN KEY (vehicle_id) REFERENCES vehicles (id)
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS monthly_revenue (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            year INTEGER NOT NULL,
            month INTEGER NOT NULL,
            revenue DECIMAL(10,2) DEFAULT 0,
            vehicle_count INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(year, month)
        )`);

        db.get("SELECT COUNT(*) as count FROM users", (err, row) => {
            if (err) {
                console.error('Error checking users:', err);
                return;
            }
            if (row.count === 0) {
                const defaultPasswords = {
                    admin: bcrypt.hashSync('admin123', 10),
                    adrian: bcrypt.hashSync('papaelgallo2025', 10)
                };
                
                const defaultUsers = [
                    ['adrian', 'adrian@bmwservice.com', defaultPasswords.adrian, 'admin']
                ];
                
                defaultUsers.forEach(userData => {
                    db.run(
                        "INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)",
                        userData,
                        function(err) {
                            if (err) {
                                console.error('Error creating user:', err);
                            } else {
                                console.log(`User created: ${userData[0]}`);
                            }
                        }
                    );
                });
            }
        });

        insertSampleData();
    });
}

function insertSampleData() {
    db.get("SELECT COUNT(*) as count FROM vehicles", (err, row) => {
        if (err || row.count > 0) return;

        const sampleVehicles = [
            ['BMW X5 (SUV)', 2024, 'WBAXXX001', 'Alpine White', 75000, 'available', 0, 'gasoline', 'automatic'],
            ['BMW 330i (Sedán)', 2024, 'WBAXXX002', 'Jet Black', 45000, 'available', 0, 'gasoline', 'automatic'],
            ['BMW iX3 (SUV Eléctrico)', 2024, 'WBAXXX003', 'Mineral Grey', 60000, 'available', 0, 'electric', 'automatic'],
            ['BMW M3 (Deportivo)', 2024, 'WBAXXX004', 'Melbourne Red', 80000, 'available', 0, 'gasoline', 'manual'],
            ['BMW X7 (SUV)', 2024, 'WBAXXX005', 'Carbon Black', 95000, 'available', 0, 'gasoline', 'automatic']
        ];

        sampleVehicles.forEach(vehicle => {
            db.run(
                "INSERT INTO vehicles (model, year, vin, color, price, status, mileage, fuel_type, transmission) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                vehicle
            );
        });
    });
}

function requireAuth(req, res, next) {
    console.log('Session check:', {
        sessionExists: !!req.session,
        userExists: !!req.session?.user,
        sessionID: req.sessionID,
        url: req.url
    });
    
    if (!req.session || !req.session.user) {
        console.log('No valid session, redirecting to login');
        return res.redirect('/login');
    }
    next();
}

app.use('/login', (req, res, next) => {
    if (req.session.user && req.method === 'GET') {
        return res.redirect('/dashboard');
    }
    next();
});

function requireAdmin(req, res, next) {
    if (!req.session.user || req.session.user.role !== 'admin') {
        req.flash('error', 'Access denied. Admin privileges required.');
        return res.redirect('/dashboard');
    }
    next();
}

app.get('/', requireAuth, (req, res) => {
    res.redirect('/dashboard');
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

app.post('/login', [
    body('username').notEmpty().withMessage('Username is required'),
    body('password').notEmpty().withMessage('Password is required')
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        req.flash('error', errors.array()[0].msg);
        return res.redirect('/login');
    }

    const { username, password } = req.body;
    
    db.get(
        "SELECT * FROM users WHERE username = ? OR email = ?",
        [username, username],
        (err, user) => {
            if (err) {
                req.flash('error', 'Database error');
                return res.redirect('/login');
            }
            
            if (!user || !bcrypt.compareSync(password, user.password)) {
                req.flash('error', 'Invalid credentials');
                return res.redirect('/login');
            }
            
            req.session.user = {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role
            };
            
            res.redirect('/dashboard');
        }
    );
});


app.get('/dashboard', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'dashboard.html'));
});

app.get('/vehicles', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'vehicles.html'));
});

app.get('/customers', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'customers.html'));
});

app.get('/appointments', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'appointments.html'));
});

app.get('/api/vehicles', requireAuth, (req, res) => {
    db.all("SELECT * FROM vehicles ORDER BY created_at DESC", (err, rows) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(rows);
    });
});

app.post('/api/vehicles', requireAuth, [
    body('model').notEmpty().withMessage('Model is required'),
    body('year').isInt({ min: 1990, max: 2030 }).withMessage('Valid year required'),
    body('vin').isLength({ min: 17, max: 17 }).withMessage('VIN must be 17 characters'),
    body('color').notEmpty().withMessage('Color is required'),
    body('price').isFloat({ min: 0 }).withMessage('Valid price required')
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { model, year, vin, color, price, mileage, fuel_type, transmission } = req.body;
    
    db.run(
        "INSERT INTO vehicles (model, year, vin, color, price, mileage, fuel_type, transmission) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [model, year, vin, color, price, mileage || 0, fuel_type || 'gasoline', transmission || 'automatic'],
        function(err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(400).json({ error: 'VIN already exists' });
                }
                return res.status(500).json({ error: 'Database error' });
            }
            res.json({ id: this.lastID, message: 'Vehicle added successfully' });
        }
    );
});

app.put('/api/vehicles/:id', requireAuth, (req, res) => {
    const { id } = req.params;
    const { model, year, vin, color, price, status, mileage, fuel_type, transmission } = req.body;
    
    db.run(
        "UPDATE vehicles SET model = ?, year = ?, vin = ?, color = ?, price = ?, status = ?, mileage = ?, fuel_type = ?, transmission = ? WHERE id = ?",
        [model, year, vin, color, price, status, mileage, fuel_type, transmission, id],
        function(err) {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Vehicle not found' });
            }
            res.json({ message: 'Vehicle updated successfully' });
        }
    );
});

app.delete('/api/vehicles/:id', requireAuth, (req, res) => {
    const { id } = req.params;
    
    db.run("DELETE FROM vehicles WHERE id = ?", [id], function(err) {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Vehicle not found' });
        }
        res.json({ message: 'Vehicle deleted successfully' });
    });
});

app.get('/api/customers', requireAuth, (req, res) => {
    db.all("SELECT * FROM customers ORDER BY created_at DESC", (err, rows) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(rows);
    });
});

app.post('/api/customers', requireAuth, [
    body('first_name').notEmpty().withMessage('First name is required'),
    body('last_name').notEmpty().withMessage('Last name is required'),
    body('email').isEmail().withMessage('Valid email required'),
    body('phone').isLength({ min: 8, max: 8 }).withMessage('Phone must be exactly 8 digits').matches(/^[0-9]{8}$/).withMessage('Phone must contain only numbers')
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { first_name, last_name, email, phone, address } = req.body;
    
    db.run(
        "INSERT INTO customers (first_name, last_name, email, phone, address) VALUES (?, ?, ?, ?, ?)",
        [first_name, last_name, email, phone, address || ''],
        function(err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(400).json({ error: 'Email already exists' });
                }
                return res.status(500).json({ error: 'Database error' });
            }
            res.json({ id: this.lastID, message: 'Customer added successfully' });
        }
    );
});

app.put('/api/customers/:id', requireAuth, [
    body('first_name').notEmpty().withMessage('First name is required'),
    body('last_name').notEmpty().withMessage('Last name is required'),
    body('email').isEmail().withMessage('Valid email required'),
    body('phone').isLength({ min: 8, max: 8 }).withMessage('Phone must be exactly 8 digits').matches(/^[0-9]{8}$/).withMessage('Phone must contain only numbers')
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { id } = req.params;
    const { first_name, last_name, email, phone, address } = req.body;
    
    db.run(
        "UPDATE customers SET first_name = ?, last_name = ?, email = ?, phone = ?, address = ? WHERE id = ?",
        [first_name, last_name, email, phone, address || '', id],
        function(err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(400).json({ error: 'Email already exists' });
                }
                return res.status(500).json({ error: 'Database error' });
            }
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Customer not found' });
            }
            res.json({ message: 'Customer updated successfully' });
        }
    );
});

app.get('/api/appointments', requireAuth, (req, res) => {
    const query = `
        SELECT a.*, c.first_name, c.last_name, c.email, c.phone,
               v.model, v.vin
        FROM service_appointments a
        JOIN customers c ON a.customer_id = c.id
        LEFT JOIN vehicles v ON a.vehicle_id = v.id
        ORDER BY a.appointment_date DESC
    `;
    
    db.all(query, (err, rows) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(rows);
    });
});

app.post('/api/appointments', requireAuth, [
    body('customer_id').isInt().withMessage('Customer ID is required'),
    body('service_type').notEmpty().withMessage('Service type is required'),
    body('appointment_date').isISO8601().withMessage('Valid appointment date required')
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { customer_id, vehicle_id, service_type, appointment_date, notes, status } = req.body;
    
    db.run(
        "INSERT INTO service_appointments (customer_id, vehicle_id, service_type, appointment_date, notes, status) VALUES (?, ?, ?, ?, ?, ?)",
        [customer_id, vehicle_id || null, service_type, appointment_date, notes || '', status || 'scheduled'],
        function(err) {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            res.json({ id: this.lastID, message: 'Appointment scheduled successfully' });
        }
    );
});

app.put('/api/appointments/:id', requireAuth, (req, res) => {
    const { id } = req.params;
    const { customer_id, vehicle_id, service_type, appointment_date, notes, status } = req.body;
    
    // First, get the old appointment to check if status is changing to completed
    db.get("SELECT * FROM service_appointments WHERE id = ?", [id], (err, oldAppointment) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        
        if (!oldAppointment) {
            return res.status(404).json({ error: 'Appointment not found' });
        }
        
        db.run(
            "UPDATE service_appointments SET customer_id = ?, vehicle_id = ?, service_type = ?, appointment_date = ?, notes = ?, status = ? WHERE id = ?",
            [customer_id, vehicle_id || null, service_type, appointment_date, notes || '', status || 'scheduled', id],
            function(err) {
                if (err) {
                    return res.status(500).json({ error: 'Database error' });
                }
                if (this.changes === 0) {
                    return res.status(404).json({ error: 'Appointment not found' });
                }
                
                // If status changed to completed and there's a vehicle, or if it's a sales appointment
                if (status === 'completed' && vehicle_id && 
                    (oldAppointment.status !== 'completed' || service_type === 'Venta')) {
                    
                    console.log(`Marking vehicle ${vehicle_id} as sold for appointment ${id}`);
                    console.log(`Status change: ${oldAppointment.status} -> ${status}`);
                    console.log(`Service type: ${service_type}`);
                    
                    // Get vehicle price and update monthly revenue
                    db.get("SELECT price FROM vehicles WHERE id = ?", [vehicle_id], (err, vehicle) => {
                        if (!err && vehicle) {
                            const appointmentDate = new Date(appointment_date);
                            const year = appointmentDate.getFullYear();
                            const month = appointmentDate.getMonth() + 1; // JavaScript months are 0-based
                            
                            console.log(`Adding sale revenue: $${vehicle.price} for ${year}-${month}`);
                            
                            // Check if this sale has already been recorded to avoid duplicates
                            db.get(`SELECT COUNT(*) as count FROM monthly_revenue WHERE year = ? AND month = ?`, 
                                [year, month], (err, existing) => {
                                if (!err) {
                                    if (existing.count === 0) {
                                        // First sale of the month
                                        db.run(`INSERT INTO monthly_revenue (year, month, revenue, vehicle_count) 
                                               VALUES (?, ?, ?, 1)`,
                                            [year, month, vehicle.price], function(err) {
                                            if (err) {
                                                console.error('Error inserting monthly revenue:', err);
                                            } else {
                                                console.log(`First sale of ${year}-${month}: $${vehicle.price}`);
                                            }
                                        });
                                    } else {
                                        // Add to existing month
                                        db.run(`UPDATE monthly_revenue 
                                               SET revenue = revenue + ?, vehicle_count = vehicle_count + 1 
                                               WHERE year = ? AND month = ?`,
                                            [vehicle.price, year, month], function(err) {
                                            if (err) {
                                                console.error('Error updating monthly revenue:', err);
                                            } else {
                                                console.log(`Added $${vehicle.price} to ${year}-${month} revenue`);
                                            }
                                        });
                                    }
                                }
                            });
                        }
                    });
                    
                    // Mark vehicle as sold
                    db.run("UPDATE vehicles SET status = 'sold' WHERE id = ?", [vehicle_id], function(err) {
                        if (err) {
                            console.error('Error updating vehicle status:', err);
                        } else {
                            console.log(`Vehicle ${vehicle_id} marked as sold successfully`);
                        }
                    });
                }
                
                res.json({ 
                    message: 'Appointment updated successfully',
                    statusChanged: oldAppointment.status !== status,
                    newStatus: status,
                    vehicleId: vehicle_id,
                    serviceType: service_type,
                    id: id
                });
            }
        );
    });
});

app.get('/api/dashboard-stats', requireAuth, (req, res) => {
    const queries = {
        totalVehicles: "SELECT COUNT(*) as count FROM vehicles",
        availableVehicles: "SELECT COUNT(*) as count FROM vehicles WHERE status = 'available'",
        soldVehicles: "SELECT COUNT(*) as count FROM vehicles WHERE status = 'sold'",
        totalCustomers: "SELECT COUNT(*) as count FROM customers",
        totalAppointments: "SELECT COUNT(*) as count FROM service_appointments",
        upcomingAppointments: "SELECT COUNT(*) as count FROM service_appointments WHERE appointment_date > datetime('now') AND status = 'scheduled'",
        totalSales: `SELECT COUNT(*) as count FROM service_appointments 
                    WHERE (status = 'completed' AND vehicle_id IS NOT NULL) 
                    OR (service_type = 'Venta' AND status = 'completed')`,
        monthlyRevenue: `SELECT COALESCE(revenue, 0) as revenue 
                        FROM monthly_revenue 
                        WHERE year = strftime('%Y', 'now') 
                        AND month = strftime('%m', 'now')`
    };

    const stats = {};
    let completed = 0;
    const total = Object.keys(queries).length;

    Object.entries(queries).forEach(([key, query]) => {
        db.get(query, (err, row) => {
            if (!err && row) {
                stats[key] = key === 'monthlyRevenue' ? (row.revenue || 0) : (row.count || 0);
            } else {
                stats[key] = 0;
            }
            completed++;
            if (completed === total) {
                res.json(stats);
            }
        });
    });
});

// Force recalculate monthly revenue from all sales
app.post('/api/recalculate-revenue', requireAuth, (req, res) => {
    console.log('Recalculating monthly revenue from all sales...');
    
    // Clear existing revenue data
    db.run('DELETE FROM monthly_revenue', (err) => {
        if (err) {
            console.error('Error clearing revenue data:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        
        // Recalculate from all completed sales
        const query = `
            INSERT INTO monthly_revenue (year, month, revenue, vehicle_count)
            SELECT strftime('%Y', sa.appointment_date) as year,
                   strftime('%m', sa.appointment_date) as month,
                   SUM(v.price) as revenue,
                   COUNT(*) as vehicle_count
            FROM service_appointments sa 
            JOIN vehicles v ON sa.vehicle_id = v.id 
            WHERE ((sa.status = 'completed' AND sa.vehicle_id IS NOT NULL) 
            OR (sa.service_type = 'Venta' AND sa.status = 'completed'))
            GROUP BY strftime('%Y', sa.appointment_date), strftime('%m', sa.appointment_date)
        `;
        
        db.run(query, (err) => {
            if (err) {
                console.error('Error recalculating revenue:', err);
                return res.status(500).json({ error: 'Database error' });
            }
            
            console.log('Monthly revenue recalculated successfully');
            res.json({ message: 'Revenue recalculated successfully' });
        });
    });
});

// Get monthly revenue history
app.get('/api/monthly-revenue', requireAuth, (req, res) => {
    const query = `
        SELECT year, month, revenue, vehicle_count 
        FROM monthly_revenue 
        ORDER BY year DESC, month DESC 
        LIMIT 12
    `;
    
    db.all(query, (err, rows) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(rows);
    });
});

// Get recent sales for activity feed
app.get('/api/recent-sales', requireAuth, (req, res) => {
    const query = `
        SELECT sa.*, c.first_name, c.last_name, v.model, v.year, v.price, v.color
        FROM service_appointments sa
        JOIN customers c ON sa.customer_id = c.id
        LEFT JOIN vehicles v ON sa.vehicle_id = v.id
        WHERE ((sa.status = 'completed' AND sa.vehicle_id IS NOT NULL) 
        OR (sa.service_type = 'Venta' AND sa.status = 'completed'))
        ORDER BY sa.appointment_date DESC
        LIMIT 10
    `;
    
    db.all(query, (err, rows) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(rows);
    });
});

// Delete customer
app.delete('/api/customers/:id', requireAuth, (req, res) => {
    const { id } = req.params;
    
    db.run("DELETE FROM customers WHERE id = ?", [id], function(err) {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Customer not found' });
        }
        res.json({ message: 'Customer deleted successfully' });
    });
});

// Delete appointment
app.delete('/api/appointments/:id', requireAuth, (req, res) => {
    const { id } = req.params;
    
    db.run("DELETE FROM service_appointments WHERE id = ?", [id], function(err) {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Appointment not found' });
        }
        res.json({ message: 'Appointment deleted successfully' });
    });
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

process.on('SIGINT', () => {
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err.message);
        } else {
            console.log('Database connection closed');
        }
        process.exit(0);
    });
});

app.listen(PORT, () => {
    console.log(`BMW Service Manager running on http://localhost:${PORT}`);
});