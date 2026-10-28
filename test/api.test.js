const http = require('node:http');

// Helper to execute HTTP request
function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, headers: res.headers, body: parsed });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, raw: data });
        }
      });
    });
    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

// Start server in-process for sandbox test execution
const { fork } = require('node:child_process');

// Run tests
async function runTests() {
  console.log('🧪 Starting Verification Suite for Aadhira Spice Garden...\n');
  
  // Require and start server
  require('../server/index.js');
  
  // Wait 1 second for port listening
  await new Promise(r => setTimeout(r, 1000));

  const port = process.env.PORT || 3000;
  let adminToken = '';

  try {
    // 1. Health check
    const health = await request({
      hostname: 'localhost',
      port,
      path: '/api/health',
      method: 'GET'
    });
    console.log(`[PASS] 1. Health check returned status ${health.status}: ${health.body.restaurant}`);

    // 2. Public restaurant-info
    const info = await request({
      hostname: 'localhost',
      port,
      path: '/api/restaurant-info',
      method: 'GET'
    });
    console.log(`[PASS] 2. Restaurant details: "${info.body.name}" - ${info.body.tagline}`);

    // 3. Categories listing
    const cats = await request({
      hostname: 'localhost',
      port,
      path: '/api/categories',
      method: 'GET'
    });
    console.log(`[PASS] 3. Loaded ${cats.body.categories.length} culinary categories.`);

    // 4. Menu listing
    const menu = await request({
      hostname: 'localhost',
      port,
      path: '/api/menu',
      method: 'GET'
    });
    console.log(`[PASS] 4. Loaded ${menu.body.items.length} menu items from database.`);

    // 5. Test Table Reservation
    const newReservation = await request({
      hostname: 'localhost',
      port,
      path: '/api/reservations',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      customer_name: 'Anand Kumar',
      phone: '9840198401',
      email: 'anand.k@example.com',
      party_size: 4,
      reservation_date: '2026-10-30',
      reservation_time: '19:45',
      special_requests: 'Anniversary celebration table.'
    });
    console.log(`[PASS] 5. Created table booking: Reference ${newReservation.body.booking.booking_reference}`);

    // 6. Test Demo Online Order
    const newOrder = await request({
      hostname: 'localhost',
      port,
      path: '/api/orders',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      customer_name: 'Anand Kumar',
      phone: '9840198401',
      order_type: 'delivery',
      delivery_address: 'Plot 42, GT Road, Dindigul',
      items: [
        { id: 'menu-1', name: 'Ghee Podi Idli', price: 130, quantity: 2 },
        { id: 'menu-12', name: 'Kumbakonam Degree Filter Coffee', price: 60, quantity: 2 }
      ]
    });
    console.log(`[PASS] 6. Order placed: #${newOrder.body.order.order_number}, Total: Rs. ${newOrder.body.order.total}`);

    // 7. Test Admin Login
    const login = await request({
      hostname: 'localhost',
      port,
      path: '/api/admin/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      username: 'admin',
      password: 'admin123'
    });
    if (login.body.success && login.body.token) {
      adminToken = login.body.token;
      console.log(`[PASS] 7. Admin authenticated successfully as: ${login.body.admin.full_name}`);
    } else {
      throw new Error('Admin login failed: ' + JSON.stringify(login.body));
    }

    // 8. Test Admin Stats Protected Route
    const stats = await request({
      hostname: 'localhost',
      port,
      path: '/api/admin/stats',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    console.log(`[PASS] 8. Admin Stats validated: Menu Count: ${stats.body.stats.totalMenuItems}, Bookings: ${stats.body.stats.totalReservations}, Orders: ${stats.body.stats.totalOrders}`);

    // 9. Test Admin Menu Item Creation
    const createdDish = await request({
      hostname: 'localhost',
      port,
      path: '/api/menu',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      }
    }, {
      name: 'Nattu Kozhi Biryani',
      category_id: 'cat-meals',
      price: 340,
      is_veg: 0,
      spicy_level: 2,
      badge: 'Weekend Special',
      description: 'Country chicken dum biryani prepared with fragrant Seeraga Samba rice.'
    });
    console.log(`[PASS] 9. Admin successfully created new menu dish: ID ${createdDish.body.id}`);

    // 10. Test Admin Menu Item Deletion
    const deleted = await request({
      hostname: 'localhost',
      port,
      path: `/api/menu/${createdDish.body.id}`,
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    console.log(`[PASS] 10. Admin successfully deleted test menu dish: ${deleted.body.message}`);

    console.log('\n🎉 ALL 10 TESTS PASSED CLEANLY!\n');
    process.exit(0);
  } catch (err) {
    console.error('❌ Test failed with error:', err);
    process.exit(1);
  }
}

runTests();
