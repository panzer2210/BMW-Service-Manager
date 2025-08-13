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
        maxAge: 24 * 60 * 60 * 1000
    }
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
            ['BMW X5', 2024, 'WBAXXX001', 'Alpine White', 75000, 'available', 0, 'gasoline', 'automatic'],
            ['BMW 330i', 2024, 'WBAXXX002', 'Jet Black', 45000, 'available', 0, 'gasoline', 'automatic'],
            ['BMW iX3', 2024, 'WBAXXX003', 'Mineral Grey', 60000, 'available', 0, 'electric', 'automatic'],
            ['BMW M3', 2024, 'WBAXXX004', 'Melbourne Red', 80000, 'available', 0, 'gasoline', 'manual'],
            ['BMW X7', 2024, 'WBAXXX005', 'Carbon Black', 95000, 'available', 0, 'gasoline', 'automatic']
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
    if (!req.session.user) {
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
    body('phone').notEmpty().withMessage('Phone is required')
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

    const { customer_id, vehicle_id, service_type, appointment_date, notes } = req.body;
    
    db.run(
        "INSERT INTO service_appointments (customer_id, vehicle_id, service_type, appointment_date, notes) VALUES (?, ?, ?, ?, ?)",
        [customer_id, vehicle_id || null, service_type, appointment_date, notes || ''],
        function(err) {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            res.json({ id: this.lastID, message: 'Appointment scheduled successfully' });
        }
    );
});

app.get('/api/dashboard-stats', requireAuth, (req, res) => {
    const queries = {
        totalVehicles: "SELECT COUNT(*) as count FROM vehicles",
        availableVehicles: "SELECT COUNT(*) as count FROM vehicles WHERE status = 'available'",
        totalCustomers: "SELECT COUNT(*) as count FROM customers",
        totalAppointments: "SELECT COUNT(*) as count FROM service_appointments",
        upcomingAppointments: "SELECT COUNT(*) as count FROM service_appointments WHERE appointment_date > datetime('now') AND status = 'scheduled'"
    };

    const stats = {};
    let completed = 0;
    const total = Object.keys(queries).length;

    Object.entries(queries).forEach(([key, query]) => {
        db.get(query, (err, row) => {
            if (!err) {
                stats[key] = row.count;
            }
            completed++;
            if (completed === total) {
                res.json(stats);
            }
        });
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