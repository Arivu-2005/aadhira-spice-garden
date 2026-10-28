// State
let allCategories = [];
let allMenuItems = [];
let activeCategory = 'all';
let searchQuery = '';
let vegOnly = false;
let cart = JSON.parse(localStorage.getItem('asg_cart') || '[]');

// DOM Elements
const categoryTabsContainer = document.getElementById('categoryTabsContainer');
const menuItemsGrid = document.getElementById('menuItemsGrid');
const menuSearchInput = document.getElementById('menuSearchInput');
const vegFilterCheckbox = document.getElementById('vegFilterCheckbox');
const cartCount = document.getElementById('cartCount');
const cartDrawer = document.getElementById('cartDrawer');
const cartBackdrop = document.getElementById('cartBackdrop');
const openCartBtn = document.getElementById('openCartBtn');
const closeCartBtn = document.getElementById('closeCartBtn');
const cartItemsContainer = document.getElementById('cartItemsContainer');
const cartSubtotal = document.getElementById('cartSubtotal');
const cartTax = document.getElementById('cartTax');
const cartGrandTotal = document.getElementById('cartGrandTotal');
const checkoutBtn = document.getElementById('checkoutBtn');
const checkoutModal = document.getElementById('checkoutModal');
const closeCheckoutBtn = document.getElementById('closeCheckoutBtn');
const orderForm = document.getElementById('orderForm');
const modalTotalPayable = document.getElementById('modalTotalPayable');
const orderStatusBox = document.getElementById('orderStatusBox');
const placeOrderBtn = document.getElementById('placeOrderBtn');
const reservationForm = document.getElementById('reservationForm');
const bookingStatusBox = document.getElementById('bookingStatusBox');
const submitBookingBtn = document.getElementById('submitBookingBtn');
const mobileMenuToggle = document.getElementById('mobileMenuToggle');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  // Set default reservation date to today or tomorrow
  const resDateInput = document.getElementById('resDate');
  if (resDateInput) {
    const today = new Date().toISOString().split('T')[0];
    resDateInput.min = today;
    resDateInput.value = today;
  }

  fetchCategories();
  fetchMenu();
  updateCartUI();

  // Mobile menu toggle
  if (mobileMenuToggle) {
    mobileMenuToggle.addEventListener('click', () => {
      document.body.classList.toggle('mobile-menu-active');
    });
  }

  // Smooth scroll links and mobile menu collapse
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      document.body.classList.remove('mobile-menu-active');
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });

  // Search input handler
  if (menuSearchInput) {
    menuSearchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.toLowerCase().trim();
      renderMenu();
    });
  }

  // Veg filter checkbox handler
  if (vegFilterCheckbox) {
    vegFilterCheckbox.addEventListener('change', (e) => {
      vegOnly = e.target.checked;
      renderMenu();
    });
  }

  // Cart open/close handlers
  if (openCartBtn) openCartBtn.addEventListener('click', openCart);
  if (closeCartBtn) closeCartBtn.addEventListener('click', closeCart);
  if (cartBackdrop) cartBackdrop.addEventListener('click', closeCart);

  // Checkout modal handlers
  if (checkoutBtn) {
    checkoutBtn.addEventListener('click', () => {
      if (cart.length === 0) return;
      closeCart();
      checkoutModal.classList.add('active');
      const total = calculateTotal();
      modalTotalPayable.innerHTML = `&#8377;${total.grandTotal.toFixed(2)}`;
    });
  }
  if (closeCheckoutBtn) {
    closeCheckoutBtn.addEventListener('click', () => {
      checkoutModal.classList.remove('active');
    });
  }

  // Reservation form handler
  if (reservationForm) {
    reservationForm.addEventListener('submit', handleReservationSubmit);
  }

  // Order form handler
  if (orderForm) {
    orderForm.addEventListener('submit', handleOrderSubmit);
  }
});

// Fetch Categories
async function fetchCategories() {
  try {
    const res = await fetch('/api/categories');
    const data = await res.json();
    if (data.success && Array.isArray(data.categories)) {
      allCategories = data.categories;
      renderCategoryTabs();
    }
  } catch (err) {
    console.error('Failed to load categories', err);
  }
}

// Render Category Tabs
function renderCategoryTabs() {
  if (!categoryTabsContainer) return;
  let html = `<button class="cat-tab ${activeCategory === 'all' ? 'active' : ''}" data-category="all">All Dishes</button>`;
  for (const cat of allCategories) {
    html += `<button class="cat-tab ${activeCategory === cat.id ? 'active' : ''}" data-category="${cat.id}">${cat.name}</button>`;
  }
  categoryTabsContainer.innerHTML = html;

  categoryTabsContainer.querySelectorAll('.cat-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      categoryTabsContainer.querySelectorAll('.cat-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeCategory = btn.getAttribute('data-category');
      renderMenu();
    });
  });
}

// Fetch Menu Items
async function fetchMenu() {
  try {
    const res = await fetch('/api/menu');
    const data = await res.json();
    if (data.success && Array.isArray(data.items)) {
      allMenuItems = data.items;
      renderMenu();
    }
  } catch (err) {
    console.error('Failed to fetch menu', err);
    menuItemsGrid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #b71c1c;">
        <i class="fa-solid fa-triangle-exclamation fa-2x"></i>
        <p style="margin-top: 10px;">Failed to load menu items. Please refresh or try again.</p>
      </div>
    `;
  }
}

// Render Menu Items with Filters
function renderMenu() {
  if (!menuItemsGrid) return;

  const filtered = allMenuItems.filter(item => {
    // Category match
    const matchesCategory = (activeCategory === 'all') || (item.category_id === activeCategory);
    
    // Veg match
    const matchesVeg = !vegOnly || item.is_veg === 1;

    // Search query match
    const matchesSearch = !searchQuery ||
      item.name.toLowerCase().includes(searchQuery) ||
      (item.description && item.description.toLowerCase().includes(searchQuery));

    return matchesCategory && matchesVeg && matchesSearch;
  });

  if (filtered.length === 0) {
    menuItemsGrid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: var(--text-light);">
        <i class="fa-solid fa-utensils fa-3x" style="opacity: 0.3; margin-bottom: 14px;"></i>
        <h4 style="font-size: 1.2rem; color: var(--text-muted); margin-bottom: 8px;">No matching dishes found</h4>
        <p>Try selecting another category or clearing your search term.</p>
      </div>
    `;
    return;
  }

  menuItemsGrid.innerHTML = filtered.map(item => {
    const dietIcon = item.is_veg === 1 
      ? `<span class="diet-indicator" title="Vegetarian"><span class="veg-symbol"><span class="veg-dot"></span></span></span>`
      : `<span class="diet-indicator" title="Non-Vegetarian"><span class="nonveg-symbol"><span class="nonveg-triangle"></span></span></span>`;

    const badgeHtml = item.badge 
      ? `<span class="menu-card-badge">${item.badge}</span>` 
      : '';

    let spiceHtml = '';
    if (item.spicy_level > 0) {
      const peppers = Array(item.spicy_level).fill('<i class="fa-solid fa-pepper-hot spice-chili"></i>').join('');
      spiceHtml = `<div class="spice-rating" title="Spiciness level: ${item.spicy_level}">${peppers}</div>`;
    }

    return `
      <article class="menu-card" data-id="${item.id}">
        <div class="menu-card-img-wrapper">
          <img src="${item.image_url || 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=800&auto=format&fit=crop&q=80'}" 
               alt="${item.name}" 
               class="menu-card-img" 
               loading="lazy">
          ${badgeHtml}
          ${dietIcon}
        </div>
        <div class="menu-card-content">
          <div class="menu-card-header">
            <h3 class="menu-card-title">${item.name}</h3>
            <span class="menu-card-price">&#8377;${item.price}</span>
          </div>
          <p class="menu-card-desc">${item.description || ''}</p>
          <div class="menu-card-footer">
            ${spiceHtml || '<span></span>'}
            <button class="add-cart-btn" onclick="addToCart('${item.id}')">
              <i class="fa-solid fa-plus"></i> Add to Order
            </button>
          </div>
        </div>
      </article>
    `;
  }).join('');
}

// Cart Management
function openCart() {
  cartDrawer.classList.add('open');
  cartBackdrop.classList.add('open');
}

function closeCart() {
  cartDrawer.classList.remove('open');
  cartBackdrop.classList.remove('open');
}

function addToCart(itemId) {
  const item = allMenuItems.find(i => i.id === itemId);
  if (!item) return;

  const existing = cart.find(c => c.id === itemId);
  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({
      id: item.id,
      name: item.name,
      price: item.price,
      is_veg: item.is_veg,
      quantity: 1
    });
  }

  saveCart();
  updateCartUI();
  openCart();
}

function updateCartQuantity(itemId, delta) {
  const itemIndex = cart.findIndex(c => c.id === itemId);
  if (itemIndex > -1) {
    cart[itemIndex].quantity += delta;
    if (cart[itemIndex].quantity <= 0) {
      cart.splice(itemIndex, 1);
    }
  }
  saveCart();
  updateCartUI();
}

function saveCart() {
  localStorage.setItem('asg_cart', JSON.stringify(cart));
}

function calculateTotal() {
  let subtotal = 0;
  let count = 0;
  for (const item of cart) {
    subtotal += item.price * item.quantity;
    count += item.quantity;
  }
  const tax = Math.round(subtotal * 0.05 * 100) / 100;
  const grandTotal = subtotal + tax;
  return { subtotal, tax, grandTotal, count };
}

function updateCartUI() {
  const { subtotal, tax, grandTotal, count } = calculateTotal();

  if (cartCount) cartCount.textContent = count;
  if (cartSubtotal) cartSubtotal.innerHTML = `&#8377;${subtotal.toFixed(2)}`;
  if (cartTax) cartTax.innerHTML = `&#8377;${tax.toFixed(2)}`;
  if (cartGrandTotal) cartGrandTotal.innerHTML = `&#8377;${grandTotal.toFixed(2)}`;
  if (checkoutBtn) checkoutBtn.disabled = cart.length === 0;

  if (!cartItemsContainer) return;

  if (cart.length === 0) {
    cartItemsContainer.innerHTML = `
      <div class="cart-empty-state">
        <span>🍲</span>
        <h4>Your cart is empty</h4>
        <p>Explore our menu and add authentic South Indian delicacies!</p>
      </div>
    `;
    return;
  }

  cartItemsContainer.innerHTML = cart.map(item => `
    <div class="cart-item">
      <div class="cart-item-info">
        <h4>${item.name}</h4>
        <p>&#8377;${item.price} &times; ${item.quantity} = &#8377;${(item.price * item.quantity).toFixed(2)}</p>
      </div>
      <div class="cart-qty-controls">
        <button class="qty-btn" onclick="updateCartQuantity('${item.id}', -1)" aria-label="Decrease quantity">-</button>
        <span style="font-weight: 600; min-width: 16px; text-align: center;">${item.quantity}</span>
        <button class="qty-btn" onclick="updateCartQuantity('${item.id}', 1)" aria-label="Increase quantity">+</button>
      </div>
    </div>
  `).join('');
}

// Handle Reservation Form Submission
async function handleReservationSubmit(e) {
  e.preventDefault();
  bookingStatusBox.className = 'booking-status-box';
  bookingStatusBox.style.display = 'none';

  const formData = new FormData(reservationForm);
  const data = {
    customer_name: formData.get('customer_name'),
    phone: formData.get('phone'),
    email: formData.get('email'),
    party_size: formData.get('party_size'),
    reservation_date: formData.get('reservation_date'),
    reservation_time: formData.get('reservation_time'),
    special_requests: formData.get('special_requests')
  };

  // Client-side validation
  if (!data.customer_name || !data.customer_name.trim()) {
    showBookingStatus('Please enter your full name.', 'error');
    return;
  }
  const cleanPhone = data.phone.replace(/\D/g, '');
  if (cleanPhone.length < 10) {
    showBookingStatus('Please enter a valid 10-digit mobile phone number.', 'error');
    return;
  }
  if (!data.reservation_date) {
    showBookingStatus('Please choose your reservation date.', 'error');
    return;
  }

  submitBookingBtn.disabled = true;
  submitBookingBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing Table Booking...';

  try {
    const res = await fetch('/api/reservations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    const result = await res.json();
    if (result.success) {
      showBookingStatus(`
        <strong><i class="fa-solid fa-circle-check"></i> Reservation Confirmed!</strong><br>
        Booking Reference: <strong>${result.booking.booking_reference}</strong><br>
        Guest: ${result.booking.customer_name} (${result.booking.party_size} Guests)<br>
        Date & Time: ${result.booking.reservation_date} at ${result.booking.reservation_time} (${result.booking.meal_session})<br>
        A confirmation SMS simulation has been registered. We look forward to welcoming you!
      `, 'success');
      reservationForm.reset();
      const resDateInput = document.getElementById('resDate');
      if (resDateInput) resDateInput.value = new Date().toISOString().split('T')[0];
    } else {
      showBookingStatus(result.message || 'Failed to submit booking. Please try again.', 'error');
    }
  } catch (err) {
    showBookingStatus('Network error while booking. Please try again.', 'error');
  } finally {
    submitBookingBtn.disabled = false;
    submitBookingBtn.innerHTML = '<i class="fa-solid fa-circle-check"></i> Confirm Table Reservation';
  }
}

function showBookingStatus(msg, type) {
  bookingStatusBox.className = `booking-status-box ${type}`;
  bookingStatusBox.innerHTML = msg;
  bookingStatusBox.style.display = 'block';
  bookingStatusBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Handle Order Checkout Submission
async function handleOrderSubmit(e) {
  e.preventDefault();
  orderStatusBox.className = 'booking-status-box';
  orderStatusBox.style.display = 'none';

  const customerName = document.getElementById('orderCustomerName').value;
  const phone = document.getElementById('orderPhone').value;
  const orderType = document.getElementById('orderType').value;
  const address = document.getElementById('orderAddress').value;
  const notes = document.getElementById('orderNotes').value;

  if (cart.length === 0) {
    showOrderStatus('Your cart is empty. Please add menu items first.', 'error');
    return;
  }
  if (!customerName.trim() || !phone.trim() || !address.trim()) {
    showOrderStatus('Please fill in your name, contact phone, and address.', 'error');
    return;
  }

  placeOrderBtn.disabled = true;
  placeOrderBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Placing Order...';

  try {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_name: customerName,
        phone,
        order_type: orderType,
        delivery_address: address,
        notes,
        items: cart
      })
    });

    const result = await res.json();
    if (result.success) {
      showOrderStatus(`
        <strong><i class="fa-solid fa-circle-check"></i> Order Placed Successfully!</strong><br>
        Order Number: <strong>${result.order.order_number}</strong><br>
        Total Amount: &#8377;${result.order.total.toFixed(2)}<br>
        Status: <strong>Received & Sent to Kitchen</strong><br>
        Estimated Preparation Time: 25-35 minutes.
      `, 'success');
      // Clear cart
      cart = [];
      saveCart();
      updateCartUI();
      orderForm.reset();
      setTimeout(() => {
        checkoutModal.classList.remove('active');
        orderStatusBox.style.display = 'none';
      }, 4500);
    } else {
      showOrderStatus(result.message || 'Failed to place order', 'error');
    }
  } catch (err) {
    showOrderStatus('Network error while placing order.', 'error');
  } finally {
    placeOrderBtn.disabled = false;
    placeOrderBtn.innerHTML = 'Place Demo Order Now';
  }
}

function showOrderStatus(msg, type) {
  orderStatusBox.className = `booking-status-box ${type}`;
  orderStatusBox.innerHTML = msg;
  orderStatusBox.style.display = 'block';
}

// Expose globals for onclick attributes
window.addToCart = addToCart;
window.updateCartQuantity = updateCartQuantity;
