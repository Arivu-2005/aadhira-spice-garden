const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const crypto = require('node:crypto');
const fs = require('node:fs');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'restaurant.db');
const db = new DatabaseSync(dbPath);

// Enable foreign keys and WAL mode for reliability & performance
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA journal_mode = WAL;');

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}

function verifyPassword(password, salt, originalHash) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(originalHash, 'hex'));
}

function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      sort_order INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS menu_items (
      id TEXT PRIMARY KEY,
      category_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL,
      is_veg INTEGER DEFAULT 1,
      spicy_level INTEGER DEFAULT 1,
      image_url TEXT,
      badge TEXT,
      is_available INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS administrators (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      full_name TEXT NOT NULL,
      salt TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'admin',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS reservations (
      id TEXT PRIMARY KEY,
      booking_reference TEXT NOT NULL UNIQUE,
      customer_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT,
      reservation_date TEXT NOT NULL,
      reservation_time TEXT NOT NULL,
      party_size INTEGER NOT NULL,
      meal_session TEXT,
      special_requests TEXT,
      status TEXT DEFAULT 'confirmed',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      order_number TEXT NOT NULL UNIQUE,
      customer_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      delivery_address TEXT NOT NULL,
      order_type TEXT DEFAULT 'takeaway',
      subtotal REAL NOT NULL,
      tax REAL NOT NULL,
      total REAL NOT NULL,
      status TEXT DEFAULT 'received',
      payment_method TEXT DEFAULT 'Demo Pay on Delivery',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      menu_item_id TEXT,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      quantity INTEGER NOT NULL,
      total REAL NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    );
  `);

  // Seed default admin if none exists
  const adminCheck = db.prepare('SELECT count(*) as count FROM administrators').get();
  if (!adminCheck || adminCheck.count === 0) {
    const adminPass = hashPassword('admin123');
    db.prepare(`
      INSERT INTO administrators (id, username, full_name, salt, password_hash, role)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('admin-1', 'admin', 'Restaurant General Manager', adminPass.salt, adminPass.hash, 'superadmin');
    console.log('Seeded default administrator: admin / admin123');
  }

  // Seed categories
  const catCheck = db.prepare('SELECT count(*) as count FROM categories').get();
  if (!catCheck || catCheck.count === 0) {
    const categories = [
      { id: 'cat-breakfast', name: 'Tiffin & Breakfast', description: 'Fresh, steaming traditional morning delights served with fresh chutneys and sambar', sort_order: 1 },
      { id: 'cat-dosa', name: 'Artisan Dosas & Uthappams', description: 'Crisp golden fermented crepes served with trio of chutneys and aromatic piping hot sambar', sort_order: 2 },
      { id: 'cat-chettinad', name: 'Chettinad Heritage Specialties', description: 'Signature spice-infused culinary treasures from the Chettinad region', sort_order: 3 },
      { id: 'cat-meals', name: 'Traditional South Indian Meals', description: 'Banana-leaf inspired feast with kootu, poriyal, rasam, vatha kuzhambu and payasam', sort_order: 4 },
      { id: 'cat-beverages', name: 'Beverages & Desserts', description: 'Freshly brewed Kumbakonam degree filter coffee and traditional desserts', sort_order: 5 }
    ];

    const insertCat = db.prepare('INSERT INTO categories (id, name, description, sort_order) VALUES (?, ?, ?, ?)');
    for (const cat of categories) {
      insertCat.run(cat.id, cat.name, cat.description, cat.sort_order);
    }

    // Seed Menu Items
    const menuItems = [
      {
        id: 'menu-1',
        category_id: 'cat-breakfast',
        name: 'Ghee Podi Idli (Mini Idli 14 Pcs)',
        description: 'Tender button idlis tossed generously in aromatic pure cow ghee and freshly pounded Gunpowder (Milagai Podi).',
        price: 130,
        is_veg: 1,
        spicy_level: 2,
        image_url: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=800&auto=format&fit=crop&q=80',
        badge: 'Chef Special'
      },
      {
        id: 'menu-2',
        category_id: 'cat-breakfast',
        name: 'Crispy Medu Vada (2 Pcs)',
        description: 'Golden, crispy lentil fritters spiced with whole black pepper, fresh curry leaves, ginger, and green chillies.',
        price: 85,
        is_veg: 1,
        spicy_level: 1,
        image_url: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=800&auto=format&fit=crop&q=80',
        badge: 'Bestseller'
      },
      {
        id: 'menu-3',
        category_id: 'cat-breakfast',
        name: 'Ven Pongal with Ghee & Cashews',
        description: 'Classic rice and moong lentil melange tempered with whole cumin, cracked pepper, fragrant curry leaves, and roasted cashews.',
        price: 120,
        is_veg: 1,
        spicy_level: 1,
        image_url: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=800&auto=format&fit=crop&q=80',
        badge: 'Traditional'
      },
      {
        id: 'menu-4',
        category_id: 'cat-dosa',
        name: 'Signature Kari Dosa (Madurai Special)',
        description: 'Triple-layered thick artisan dosa topped with fluffy egg omelette and slow-simmered spiced tender minced mutton.',
        price: 290,
        is_veg: 0,
        spicy_level: 3,
        image_url: 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?w=800&auto=format&fit=crop&q=80',
        badge: 'House Signature'
      },
      {
        id: 'menu-5',
        category_id: 'cat-dosa',
        name: 'Ghee Roast Masala Dosa',
        description: 'Ultra-crispy golden crepe smeared with pure aromatic ghee, filled with spiced potato masala and shallot relish.',
        price: 165,
        is_veg: 1,
        spicy_level: 1,
        image_url: 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?w=800&auto=format&fit=crop&q=80',
        badge: 'Most Loved'
      },
      {
        id: 'menu-6',
        category_id: 'cat-dosa',
        name: 'Chettinad Mushroom Chukka Dosa',
        description: 'Thin crispy paper roast filled with dry-roasted button mushrooms tossed in stone-ground Chettinad pepper spices.',
        price: 195,
        is_veg: 1,
        spicy_level: 2,
        image_url: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=800&auto=format&fit=crop&q=80',
        badge: 'Spicy'
      },
      {
        id: 'menu-7',
        category_id: 'cat-chettinad',
        name: 'Chettinad Kozhi Varuval (Chicken Pepper Fry)',
        description: 'Country-style chicken sautéed with kalpasi (black stone flower), dry red chillies, shallots, and freshly cracked Tellicherry black pepper.',
        price: 280,
        is_veg: 0,
        spicy_level: 3,
        image_url: 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=800&auto=format&fit=crop&q=80',
        badge: 'Authentic Chettinad'
      },
      {
        id: 'menu-8',
        category_id: 'cat-chettinad',
        name: 'Ennai Kathirikai Kuzhambu',
        description: 'Baby brinjals stuffed with roasted coriander, sesame seeds, and simmered gently in rich tangy shallot tamarind gravy.',
        price: 210,
        is_veg: 1,
        spicy_level: 2,
        image_url: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=800&auto=format&fit=crop&q=80',
        badge: 'Vegetarian Delicacy'
      },
      {
        id: 'menu-9',
        category_id: 'cat-chettinad',
        name: 'Mutton Chukka Varuval (Dindigul Style)',
        description: 'Tender baby goat cuts roasted dry in iron kadai with small onions, curry leaves, and rich house-made spice masala.',
        price: 360,
        is_veg: 0,
        spicy_level: 3,
        image_url: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800&auto=format&fit=crop&q=80',
        badge: 'Chef Special'
      },
      {
        id: 'menu-10',
        category_id: 'cat-meals',
        name: 'Annapoorna Royal Saiva Sapadu (Full Meals)',
        description: 'Unlimited traditional vegetarian banquet on banana leaf with Ponni rice, Sambar, Rasam, Vatha Kuzhambu, Kootu, Poriyal, Appalam, Curd & Payasam.',
        price: 220,
        is_veg: 1,
        spicy_level: 1,
        image_url: 'https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?w=800&auto=format&fit=crop&q=80',
        badge: 'Lunch Feast'
      },
      {
        id: 'menu-11',
        category_id: 'cat-meals',
        name: 'Dindigul Thalapakatti Style Seeraga Samba Biryani',
        description: 'Fragrant short-grain Seeraga Samba rice cooked in copper handi with farm-raised chicken, curd, mint, and secret whole spices.',
        price: 310,
        is_veg: 0,
        spicy_level: 2,
        image_url: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800&auto=format&fit=crop&q=80',
        badge: 'Dindigul Heritage'
      },
      {
        id: 'menu-12',
        category_id: 'cat-beverages',
        name: 'Kumbakonam Degree Filter Coffee',
        description: 'Freshly decocted chicory-blended dark roast coffee whipped with frothy thick cow milk and served in traditional brass davarah-tumbler.',
        price: 60,
        is_veg: 1,
        spicy_level: 0,
        image_url: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=800&auto=format&fit=crop&q=80',
        badge: 'Iconic'
      },
      {
        id: 'menu-13',
        category_id: 'cat-beverages',
        name: 'Elaneer Payasam (Tender Coconut Kheer)',
        description: 'Delicate chilled dessert made with sweet tender coconut pulp, coconut water, cardamom essence, and rich condensed milk.',
        price: 135,
        is_veg: 1,
        spicy_level: 0,
        image_url: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=800&auto=format&fit=crop&q=80',
        badge: 'Refreshing'
      }
    ];

    const insertMenu = db.prepare(`
      INSERT INTO menu_items (id, category_id, name, description, price, is_veg, spicy_level, image_url, badge, is_available)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);

    for (const item of menuItems) {
      insertMenu.run(item.id, item.category_id, item.name, item.description, item.price, item.is_veg, item.spicy_level, item.image_url, item.badge);
    }
    console.log('Seeded menu items successfully.');
  }

  // Seed initial sample reservations
  const resCheck = db.prepare('SELECT count(*) as count FROM reservations').get();
  if (!resCheck || resCheck.count === 0) {
    const sampleReservations = [
      {
        id: 'res-101',
        booking_reference: 'ASG-78210',
        customer_name: 'Sundararajan V.',
        phone: '+91 94432 10987',
        email: 'sundar.v@example.com',
        reservation_date: '2026-10-28',
        reservation_time: '19:30',
        party_size: 4,
        meal_session: 'Dinner',
        special_requests: 'Prefers quiet corner table for family anniversary celebration.',
        status: 'confirmed'
      },
      {
        id: 'res-102',
        booking_reference: 'ASG-91043',
        customer_name: 'Meenakshi Ramanathan',
        phone: '+91 98841 55210',
        email: 'meenakshi.r@example.com',
        reservation_date: '2026-10-29',
        reservation_time: '13:00',
        party_size: 6,
        meal_session: 'Lunch',
        special_requests: 'Requires 2 high chairs for toddlers and banana-leaf meals.',
        status: 'confirmed'
      }
    ];

    const insertRes = db.prepare(`
      INSERT INTO reservations (id, booking_reference, customer_name, phone, email, reservation_date, reservation_time, party_size, meal_session, special_requests, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const r of sampleReservations) {
      insertRes.run(r.id, r.booking_reference, r.customer_name, r.phone, r.email, r.reservation_date, r.reservation_time, r.party_size, r.meal_session, r.special_requests, r.status);
    }
    console.log('Seeded sample reservations.');
  }

  // Seed sample orders
  const ordCheck = db.prepare('SELECT count(*) as count FROM orders').get();
  if (!ordCheck || ordCheck.count === 0) {
    const oId = 'ord-501';
    db.prepare(`
      INSERT INTO orders (id, order_number, customer_name, phone, delivery_address, order_type, subtotal, tax, total, status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      oId,
      'ORD-8812',
      'Karthik Narayanan',
      '+91 97900 12345',
      'Flat 3B, Temple View Apartments, Main Road, Dindigul',
      'delivery',
      475.0,
      23.75,
      498.75,
      'preparing',
      'Please pack extra coconut chutney and gun powder separately.'
    );

    const insertOrdItem = db.prepare(`
      INSERT INTO order_items (id, order_id, menu_item_id, name, price, quantity, total)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    insertOrdItem.run('oi-1', oId, 'menu-1', 'Ghee Podi Idli (Mini Idli 14 Pcs)', 130, 1, 130);
    insertOrdItem.run('oi-2', oId, 'menu-4', 'Signature Kari Dosa (Madurai Special)', 290, 1, 290);
    insertOrdItem.run('oi-3', oId, 'menu-12', 'Kumbakonam Degree Filter Coffee', 55, 1, 55);
    console.log('Seeded sample order.');
  }
}

initDb();

module.exports = {
  db,
  hashPassword,
  verifyPassword
};
