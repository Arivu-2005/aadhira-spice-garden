const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const url = require('node:url');
const crypto = require('node:crypto');
const { db, hashPassword, verifyPassword } = require('./db');

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'aadhira-spice-garden-secure-token-2026';
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

// MIME types for static assets
const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp'
};

// Simple secure token generator / validator (HMAC SHA256)
function generateToken(payload, expiresInSeconds = 86400) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const data = Buffer.from(JSON.stringify({ ...payload, exp })).toString('base64url');
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${data}`).digest('base64url');
  return `${header}.${data}.${signature}`;
}

function verifyToken(token) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, data, signature] = parts;
  const expectedSignature = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${data}`).digest('base64url');
  if (expectedSignature !== signature) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null; // Expired
    }
    return payload;
  } catch {
    return null;
  }
}

// Helpers
function sendJson(res, statusCode, data) {
  const json = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
  });
  res.end(json);
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 2e6) { // 2MB limit
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error('Invalid JSON format'));
      }
    });
    req.on('error', reject);
  });
}

function getAuthAdmin(req) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.*)$/i);
  if (!match) return null;
  return verifyToken(match[1]);
}

// Determine meal session from time
function calculateMealSession(timeStr) {
  if (!timeStr) return 'General';
  const [h, m] = timeStr.split(':').map(Number);
  const minutes = h * 60 + (m || 0);
  if (minutes >= 7 * 60 && minutes <= 11 * 60) return 'Breakfast (7:00 AM - 11:00 AM)';
  if (minutes >= 12 * 60 && minutes <= 15 * 60 + 30) return 'Lunch (12:00 PM - 3:30 PM)';
  if (minutes >= 18 * 60 + 30 && minutes <= 22 * 60 + 30) return 'Dinner (6:30 PM - 10:30 PM)';
  return 'All-Day Dining';
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const { pathname, query } = parsedUrl;
  const method = req.method;

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
    });
    res.end();
    return;
  }

  // ----------------------------------------------------------------
  // API ROUTES
  // ----------------------------------------------------------------

  // Health check
  if (pathname === '/api/health') {
    return sendJson(res, 200, {
      status: 'healthy',
      restaurant: 'Aadhira Spice Garden',
      serverTime: new Date().toISOString()
    });
  }

  // Restaurant profile information
  if (pathname === '/api/restaurant-info' && method === 'GET') {
    return sendJson(res, 200, {
      name: 'Aadhira Spice Garden',
      tagline: 'Authentic South Indian Food with a Modern Dining Experience.',
      cuisine: 'South Indian, Chettinad, vegetarian, and non-vegetarian.',
      address: '25 Main Road, Near Bus Stand, Dindigul, Tamil Nadu – 624001',
      phone: '+91 98765 43210',
      phoneDisplay: '+91 98765 43210 (Demonstration Number)',
      website: 'https://example.com',
      bookingUrl: 'https://example.com/booking',
      hours: {
        allDays: '7:00 AM – 10:30 PM',
        breakfast: '7:00 AM – 11:00 AM',
        lunch: '12:00 PM – 3:30 PM',
        dinner: '6:30 PM – 10:30 PM'
      }
    });
  }

  // GET /api/categories
  if (pathname === '/api/categories' && method === 'GET') {
    const cats = db.prepare('SELECT * FROM categories ORDER BY sort_order ASC, name ASC').all();
    return sendJson(res, 200, { success: true, categories: cats });
  }

  // POST /api/categories (Admin only)
  if (pathname === '/api/categories' && method === 'POST') {
    const admin = getAuthAdmin(req);
    if (!admin) return sendJson(res, 401, { success: false, message: 'Unauthorized. Admin credentials required.' });

    try {
      const data = await parseJsonBody(req);
      if (!data.name || !data.name.trim()) {
        return sendJson(res, 400, { success: false, message: 'Category name is required' });
      }
      const id = 'cat-' + Date.now();
      db.prepare('INSERT INTO categories (id, name, description, sort_order) VALUES (?, ?, ?, ?)').run(
        id,
        data.name.trim(),
        data.description ? data.description.trim() : '',
        Number(data.sort_order) || 0
      );
      return sendJson(res, 201, { success: true, message: 'Category created', id });
    } catch (err) {
      return sendJson(res, 500, { success: false, message: err.message });
    }
  }

  // GET /api/menu
  if (pathname === '/api/menu' && method === 'GET') {
    const { category, search, vegOnly, availableOnly } = query;
    let sql = `
      SELECT m.*, c.name as category_name
      FROM menu_items m
      JOIN categories c ON m.category_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (category && category !== 'all') {
      sql += ' AND (m.category_id = ? OR c.name = ?)';
      params.push(category, category);
    }
    if (search && search.trim()) {
      sql += ' AND (m.name LIKE ? OR m.description LIKE ?)';
      params.push(`%${search.trim()}%`, `%${search.trim()}%`);
    }
    if (vegOnly === 'true' || vegOnly === '1') {
      sql += ' AND m.is_veg = 1';
    }
    if (availableOnly === 'true') {
      sql += ' AND m.is_available = 1';
    }

    sql += ' ORDER BY c.sort_order ASC, m.price ASC';
    const items = db.prepare(sql).all(...params);
    return sendJson(res, 200, { success: true, count: items.length, items });
  }

  // POST /api/menu (Admin only)
  if (pathname === '/api/menu' && method === 'POST') {
    const admin = getAuthAdmin(req);
    if (!admin) return sendJson(res, 401, { success: false, message: 'Unauthorized. Admin access required.' });

    try {
      const data = await parseJsonBody(req);
      if (!data.name || !data.category_id || data.price === undefined) {
        return sendJson(res, 400, { success: false, message: 'Name, Category, and Price are required.' });
      }

      const id = 'menu-' + Date.now();
      db.prepare(`
        INSERT INTO menu_items (id, category_id, name, description, price, is_veg, spicy_level, image_url, badge, is_available)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        data.category_id,
        data.name.trim(),
        data.description ? data.description.trim() : '',
        Number(data.price),
        data.is_veg ? 1 : 0,
        Number(data.spicy_level) || 1,
        data.image_url ? data.image_url.trim() : 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=800&auto=format&fit=crop&q=80',
        data.badge ? data.badge.trim() : null,
        data.is_available !== undefined ? (data.is_available ? 1 : 0) : 1
      );

      return sendJson(res, 201, { success: true, message: 'Dish created successfully', id });
    } catch (err) {
      return sendJson(res, 500, { success: false, message: err.message });
    }
  }

  // PUT /api/menu/:id (Admin only)
  if (pathname.startsWith('/api/menu/') && method === 'PUT') {
    const admin = getAuthAdmin(req);
    if (!admin) return sendJson(res, 401, { success: false, message: 'Unauthorized.' });

    const id = pathname.replace('/api/menu/', '');
    try {
      const data = await parseJsonBody(req);
      db.prepare(`
        UPDATE menu_items
        SET category_id = COALESCE(?, category_id),
            name = COALESCE(?, name),
            description = COALESCE(?, description),
            price = COALESCE(?, price),
            is_veg = COALESCE(?, is_veg),
            spicy_level = COALESCE(?, spicy_level),
            image_url = COALESCE(?, image_url),
            badge = ?,
            is_available = COALESCE(?, is_available)
        WHERE id = ?
      `).run(
        data.category_id,
        data.name ? data.name.trim() : null,
        data.description !== undefined ? data.description.trim() : null,
        data.price !== undefined ? Number(data.price) : null,
        data.is_veg !== undefined ? (data.is_veg ? 1 : 0) : null,
        data.spicy_level !== undefined ? Number(data.spicy_level) : null,
        data.image_url !== undefined ? data.image_url.trim() : null,
        data.badge !== undefined ? (data.badge ? data.badge.trim() : null) : null,
        data.is_available !== undefined ? (data.is_available ? 1 : 0) : null,
        id
      );

      return sendJson(res, 200, { success: true, message: 'Menu item updated' });
    } catch (err) {
      return sendJson(res, 500, { success: false, message: err.message });
    }
  }

  // DELETE /api/menu/:id (Admin only)
  if (pathname.startsWith('/api/menu/') && method === 'DELETE') {
    const admin = getAuthAdmin(req);
    if (!admin) return sendJson(res, 401, { success: false, message: 'Unauthorized.' });

    const id = pathname.replace('/api/menu/', '');
    try {
      db.prepare('DELETE FROM menu_items WHERE id = ?').run(id);
      return sendJson(res, 200, { success: true, message: 'Item deleted successfully' });
    } catch (err) {
      return sendJson(res, 500, { success: false, message: err.message });
    }
  }

  // POST /api/reservations (Public)
  if (pathname === '/api/reservations' && method === 'POST') {
    try {
      const data = await parseJsonBody(req);
      const { customer_name, phone, email, reservation_date, reservation_time, party_size, special_requests } = data;

      if (!customer_name || !customer_name.trim()) {
        return sendJson(res, 400, { success: false, message: 'Customer name is required' });
      }
      if (!phone || !phone.trim() || phone.replace(/\D/g, '').length < 10) {
        return sendJson(res, 400, { success: false, message: 'Please provide a valid 10-digit contact phone number' });
      }
      if (!reservation_date) {
        return sendJson(res, 400, { success: false, message: 'Reservation date is required' });
      }
      if (!reservation_time) {
        return sendJson(res, 400, { success: false, message: 'Reservation time is required' });
      }
      const size = Number(party_size);
      if (!size || size < 1 || size > 50) {
        return sendJson(res, 400, { success: false, message: 'Party size must be between 1 and 50 guests' });
      }

      const mealSession = calculateMealSession(reservation_time);
      const refCode = 'ASG-' + Math.floor(10000 + Math.random() * 90000);
      const id = 'res-' + Date.now();

      db.prepare(`
        INSERT INTO reservations (
          id, booking_reference, customer_name, phone, email,
          reservation_date, reservation_time, party_size, meal_session, special_requests, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed')
      `).run(
        id,
        refCode,
        customer_name.trim(),
        phone.trim(),
        email ? email.trim() : '',
        reservation_date,
        reservation_time,
        size,
        mealSession,
        special_requests ? special_requests.trim() : ''
      );

      return sendJson(res, 201, {
        success: true,
        message: 'Table reservation successfully confirmed!',
        booking: {
          id,
          booking_reference: refCode,
          customer_name: customer_name.trim(),
          phone: phone.trim(),
          reservation_date,
          reservation_time,
          party_size: size,
          meal_session: mealSession
        }
      });
    } catch (err) {
      return sendJson(res, 500, { success: false, message: err.message });
    }
  }

  // GET /api/reservations (Admin only)
  if (pathname === '/api/reservations' && method === 'GET') {
    const admin = getAuthAdmin(req);
    if (!admin) return sendJson(res, 401, { success: false, message: 'Unauthorized.' });

    const list = db.prepare('SELECT * FROM reservations ORDER BY reservation_date DESC, reservation_time DESC').all();
    return sendJson(res, 200, { success: true, reservations: list });
  }

  // PUT /api/reservations/:id/status (Admin only)
  if (pathname.match(/^\/api\/reservations\/([^/]+)\/status$/) && method === 'PUT') {
    const admin = getAuthAdmin(req);
    if (!admin) return sendJson(res, 401, { success: false, message: 'Unauthorized.' });

    const match = pathname.match(/^\/api\/reservations\/([^/]+)\/status$/);
    const id = match[1];

    try {
      const data = await parseJsonBody(req);
      db.prepare('UPDATE reservations SET status = ? WHERE id = ?').run(data.status || 'confirmed', id);
      return sendJson(res, 200, { success: true, message: 'Reservation status updated' });
    } catch (err) {
      return sendJson(res, 500, { success: false, message: err.message });
    }
  }

  // POST /api/orders (Public - Demo online ordering)
  if (pathname === '/api/orders' && method === 'POST') {
    try {
      const data = await parseJsonBody(req);
      const { customer_name, phone, delivery_address, items, order_type, notes } = data;

      if (!customer_name || !customer_name.trim()) {
        return sendJson(res, 400, { success: false, message: 'Customer name is required' });
      }
      if (!phone || !phone.trim() || phone.replace(/\D/g, '').length < 10) {
        return sendJson(res, 400, { success: false, message: 'Valid phone number is required' });
      }
      if (!delivery_address || !delivery_address.trim()) {
        return sendJson(res, 400, { success: false, message: 'Delivery / pickup address is required' });
      }
      if (!Array.isArray(items) || items.length === 0) {
        return sendJson(res, 400, { success: false, message: 'Cart cannot be empty' });
      }

      let subtotal = 0;
      for (const item of items) {
        const p = Number(item.price) || 0;
        const q = Number(item.quantity) || 1;
        subtotal += p * q;
      }
      const tax = Math.round(subtotal * 0.05 * 100) / 100; // 5% GST
      const total = subtotal + tax;

      const orderNumber = 'ORD-' + Math.floor(1000 + Math.random() * 9000);
      const orderId = 'ord-' + Date.now();

      db.prepare(`
        INSERT INTO orders (id, order_number, customer_name, phone, delivery_address, order_type, subtotal, tax, total, status, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'received', ?)
      `).run(
        orderId,
        orderNumber,
        customer_name.trim(),
        phone.trim(),
        delivery_address.trim(),
        order_type || 'delivery',
        subtotal,
        tax,
        total,
        notes ? notes.trim() : ''
      );

      const insertItem = db.prepare(`
        INSERT INTO order_items (id, order_id, menu_item_id, name, price, quantity, total)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const p = Number(item.price) || 0;
        const q = Number(item.quantity) || 1;
        insertItem.run(`oi-${Date.now()}-${i}`, orderId, item.id || null, item.name, p, q, p * q);
      }

      return sendJson(res, 201, {
        success: true,
        message: 'Order placed successfully! (Demo order mode active)',
        order: {
          id: orderId,
          order_number: orderNumber,
          customer_name: customer_name.trim(),
          subtotal,
          tax,
          total,
          status: 'received',
          payment_method: 'Pay on Delivery / Counter (Demo)'
        }
      });
    } catch (err) {
      return sendJson(res, 500, { success: false, message: err.message });
    }
  }

  // GET /api/orders (Admin only)
  if (pathname === '/api/orders' && method === 'GET') {
    const admin = getAuthAdmin(req);
    if (!admin) return sendJson(res, 401, { success: false, message: 'Unauthorized.' });

    const orders = db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all();
    const items = db.prepare('SELECT * FROM order_items').all();

    const ordersWithItems = orders.map(ord => ({
      ...ord,
      items: items.filter(it => it.order_id === ord.id)
    }));

    return sendJson(res, 200, { success: true, orders: ordersWithItems });
  }

  // PUT /api/orders/:id/status (Admin only)
  if (pathname.match(/^\/api\/orders\/([^/]+)\/status$/) && method === 'PUT') {
    const admin = getAuthAdmin(req);
    if (!admin) return sendJson(res, 401, { success: false, message: 'Unauthorized.' });

    const match = pathname.match(/^\/api\/orders\/([^/]+)\/status$/);
    const id = match[1];

    try {
      const data = await parseJsonBody(req);
      db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(data.status || 'received', id);
      return sendJson(res, 200, { success: true, message: 'Order status updated' });
    } catch (err) {
      return sendJson(res, 500, { success: false, message: err.message });
    }
  }

  // POST /api/admin/login
  if (pathname === '/api/admin/login' && method === 'POST') {
    try {
      const data = await parseJsonBody(req);
      const { username, password } = data;

      if (!username || !password) {
        return sendJson(res, 400, { success: false, message: 'Username and password are required' });
      }

      const admin = db.prepare('SELECT * FROM administrators WHERE username = ?').get(username.trim());
      if (!admin) {
        return sendJson(res, 401, { success: false, message: 'Invalid credentials. Please verify your username.' });
      }

      const isValid = verifyPassword(password, admin.salt, admin.password_hash);
      if (!isValid) {
        return sendJson(res, 401, { success: false, message: 'Invalid credentials. Password did not match.' });
      }

      const token = generateToken({ id: admin.id, username: admin.username, role: admin.role, name: admin.full_name });

      return sendJson(res, 200, {
        success: true,
        message: 'Login successful',
        token,
        admin: {
          id: admin.id,
          username: admin.username,
          full_name: admin.full_name,
          role: admin.role
        }
      });
    } catch (err) {
      return sendJson(res, 500, { success: false, message: err.message });
    }
  }

  // GET /api/admin/stats (Admin only)
  if (pathname === '/api/admin/stats' && method === 'GET') {
    const admin = getAuthAdmin(req);
    if (!admin) return sendJson(res, 401, { success: false, message: 'Unauthorized.' });

    const totalMenu = db.prepare('SELECT count(*) as count FROM menu_items').get().count;
    const totalReservations = db.prepare('SELECT count(*) as count FROM reservations').get().count;
    const confirmedReservations = db.prepare("SELECT count(*) as count FROM reservations WHERE status = 'confirmed'").get().count;
    const totalOrders = db.prepare('SELECT count(*) as count FROM orders').get().count;
    const revenueRow = db.prepare('SELECT sum(total) as revenue FROM orders').get();
    const totalRevenue = revenueRow ? revenueRow.revenue || 0 : 0;

    return sendJson(res, 200, {
      success: true,
      stats: {
        totalMenuItems: totalMenu,
        totalReservations,
        confirmedReservations,
        totalOrders,
        totalRevenue: Math.round(totalRevenue * 100) / 100
      }
    });
  }

  // ----------------------------------------------------------------
  // STATIC ASSET SERVING
  // ----------------------------------------------------------------
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);

  // Security check: prevent directory traversal
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    return res.end('Access denied');
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Check if html file exists (e.g. /admin -> /admin.html)
      const htmlFallback = filePath + '.html';
      if (fs.existsSync(htmlFallback) && fs.statSync(htmlFallback).isFile()) {
        filePath = htmlFallback;
      } else {
        // Fallback to index.html for root or unknown static files
        if (pathname === '/admin' || pathname === '/admin/') {
          filePath = path.join(PUBLIC_DIR, 'admin.html');
        } else {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          return res.end('404 Not Found');
        }
      }
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        return res.end('Server error loading file');
      }
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    });
  });
});

server.listen(PORT, () => {
  console.log(`🍽️  Annapoorna / Aadhira Spice Garden Server running at http://localhost:${PORT}`);
  console.log(`📁 Admin dashboard accessible at http://localhost:${PORT}/admin.html`);
});
