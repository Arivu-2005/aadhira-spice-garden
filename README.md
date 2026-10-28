# Aadhira Spice Garden (Annapoorna Spice Garden)

> **Authentic South Indian Food with a Modern Dining Experience.**

A full-stack, responsive restaurant web application featuring authentic South Indian and Chettinad heritage cuisine. Built with a rich customer-facing UI, real-time table booking engine, cart and demo online ordering workflow, and a secure administration panel backed by SQLite.

---

## 🌟 Key Features

### 1. Customer-Facing Website
- **Modern Southern Heritage Aesthetic**: Forest green (`#153e28`), elegant warm gold (`#d4a359`), and crisp cream backgrounds with generous spacing and rounded card layouts.
- **Hero Showcase**: Highlighting South Indian and Chettinad dishes with instant action CTAs for Table Reservations and Menu browsing.
- **Interactive Menu with Real-Time Filtering**:
  - Live search bar (by dish name or ingredients).
  - Dietary filter toggle (**Pure Vegetarian Green Dot** vs **Non-Vegetarian Red Dot**).
  - Category selector tabs (Tiffin & Breakfast, Artisan Dosas, Chettinad Heritage Specialties, Traditional South Indian Meals, Beverages & Desserts).
  - Spiciness indicators (0 to 3 chili ratings) and special chef badges.
- **Story & Culinary Philosophy Section**: Showcasing Chettinad stone-ground masalas, native cow ghee, and generational culinary ethics.
- **Patron Testimonials**: Clearly identified as fictional sample reviews for demonstration purposes.
- **Location, Map & Hours**:
  - Address: *25 Main Road, Near Bus Stand, Dindigul, Tamil Nadu – 624001*
  - Operating Hours: Monday–Sunday, 7:00 AM – 10:30 PM (Breakfast, Lunch, Dinner breakdowns).
  - Demonstration phone number: `+91 98765 43210`.
  - Interactive OpenStreetMap integration.

### 2. Table Booking & Reservation Engine
- Functional reservation form collecting guest name, 10-digit mobile number, date, time slot, party size (1 to 10+ guests), and special dining requests.
- Automatic meal session calculation (*Breakfast: 7:00 AM–11:00 AM*, *Lunch: 12:00 PM–3:30 PM*, *Dinner: 6:30 PM–10:30 PM*).
- Instant unique booking reference generation (e.g. `ASG-83674`) and persistent storage in the database.

### 3. Demo Online Ordering & Slide-out Cart
- Full-featured shopping cart drawer with real-time subtotal, 5% GST tax calculation, and grand total.
- Quantity adjustment controls (`+` / `-`) and persistent cart state in browser `localStorage`.
- Modal checkout collecting delivery/takeaway choices, customer contact, and delivery address.
- Persisted to the database orders collection for restaurant operations management.

### 4. Authenticated Administration Panel (`/admin.html`)
- **Secure Authentication**: Salted scrypt password hashing and HMAC-SHA256 bearer tokens.
- **Operations Dashboard**: Real-time business metrics (Total Revenue, Total Bookings, Orders count, Active Menu items).
- **Reservations Management**: View all table reservations, filter by session, and toggle status (`Confirmed`, `Completed`, `Cancelled`).
- **Order Tracking**: Real-time overview of online customer orders with items list, delivery address, and status progression (`Received` &rarr; `Preparing` &rarr; `Dispatched` &rarr; `Delivered`).
- **Complete Menu Catalog CRUD**:
  - Add new dishes with name, category, price, veg/non-veg indicator, spice rating, image URL, and badges.
  - Live editing and price adjustments.
  - Stock availability toggles (*In Stock* vs *Sold Out*).
  - Permanent dish deletion.

---

## 🛠️ Technology Stack

- **Frontend**: Semantic HTML5, CSS3 Custom Properties (Design tokens), Modern Vanilla JavaScript (ES6+), Font Awesome 6.5, Google Fonts (*Playfair Display* & *Plus Jakarta Sans*).
- **Backend**: Node.js HTTP REST API server with routing, static file streaming, and CORS support.
- **Database**: SQLite (Node.js native `node:sqlite` DatabaseSync) with foreign keys and WAL mode.
- **Security**: Node.js native `node:crypto` (`scryptSync` with cryptographic salts) for password hashing and HMAC-SHA256 authentication tokens. Zero unvetted external dependencies.

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18.0.0 or higher; tested on v24)

### Starting the Server
Run the application from the project root:

```bash
node server/index.js
```
or
```bash
npm start
```

The server will start at:
- **Public Customer Website**: [http://localhost:3000](http://localhost:3000)
- **Admin Management Portal**: [http://localhost:3000/admin.html](http://localhost:3000/admin.html)

### Default Admin Credentials
- **Username**: `admin`
- **Password**: `admin123`

---

## 🧪 Running the Test Suite

A test suite verifying all 10 core integration requirements (API health, menu queries, reservation creation, demo ordering, admin authentication, admin stats, and menu CRUD):

```bash
npm test
```

---

## 📁 Project Structure

```
Aadhira Spice Garden/
├── data/
│   └── restaurant.db            # SQLite database file
├── public/
│   ├── css/
│   │   ├── style.css            # Customer website stylesheet (Forest green, gold, cream)
│   │   └── admin.css            # Administrative dashboard stylesheet
│   ├── js/
│   │   ├── main.js              # Menu filtering, cart state, booking & checkout handling
│   │   └── admin.js             # Admin authentication, stats, table updates, menu CRUD
│   ├── index.html               # Customer-facing landing page & booking portal
│   └── admin.html               # Protected restaurant staff management dashboard
├── server/
│   ├── db.js                    # Database schema, initialization, and seed records
│   └── index.js                 # HTTP REST API server and static asset server
├── test/
│   └── api.test.js              # Comprehensive API & operations test suite
├── package.json
└── README.md
```
