// State
let token = localStorage.getItem('asg_admin_token') || null;
let currentAdmin = JSON.parse(localStorage.getItem('asg_admin_user') || 'null');
let categoriesCache = [];
let menuCache = [];
let reservationsCache = [];
let ordersCache = [];

// DOM Elements
const loginView = document.getElementById('loginView');
const dashboardView = document.getElementById('dashboardView');
const adminLoginForm = document.getElementById('adminLoginForm');
const loginErrorMsg = document.getElementById('loginErrorMsg');
const logoutBtn = document.getElementById('logoutBtn');
const adminUserDisplayName = document.getElementById('adminUserDisplayName');
const adminAvatarInitial = document.getElementById('adminAvatarInitial');
const currentTabTitle = document.getElementById('currentTabTitle');

// Stats Elements
const statRevenue = document.getElementById('statRevenue');
const statReservations = document.getElementById('statReservations');
const statOrders = document.getElementById('statOrders');
const statMenuCount = document.getElementById('statMenuCount');

// Modals
const menuModalOverlay = document.getElementById('menuModalOverlay');
const menuItemForm = document.getElementById('menuItemForm');
const menuModalTitle = document.getElementById('menuModalTitle');
const editMenuId = document.getElementById('editMenuId');

document.addEventListener('DOMContentLoaded', () => {
  if (token) {
    showDashboard();
  } else {
    showLogin();
  }

  // Setup sidebar navigation tabs
  document.querySelectorAll('.sidebar-menu .nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const tabId = item.getAttribute('data-tab');
      switchTab(tabId);
    });
  });

  // Login handler
  if (adminLoginForm) {
    adminLoginForm.addEventListener('submit', handleLogin);
  }

  // Logout handler
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }

  // Menu Form handler
  if (menuItemForm) {
    menuItemForm.addEventListener('submit', handleSaveMenuItem);
  }
});

function showLogin() {
  loginView.style.display = 'flex';
  dashboardView.style.display = 'none';
}

function showDashboard() {
  loginView.style.display = 'none';
  dashboardView.style.display = 'flex';

  if (currentAdmin) {
    adminUserDisplayName.textContent = currentAdmin.full_name || currentAdmin.username;
    adminAvatarInitial.textContent = (currentAdmin.full_name || currentAdmin.username).charAt(0).toUpperCase();
  }

  loadAllDashboardData();
}

const API_BASE = window.location.origin.startsWith('http') ? window.location.origin : 'http://localhost:3000';

async function handleLogin(e) {
  e.preventDefault();
  loginErrorMsg.style.display = 'none';
  const username = document.getElementById('adminUsername').value;
  const password = document.getElementById('adminPassword').value;

  try {
    const res = await fetch(`${API_BASE}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();

    if (data.success && data.token) {
      token = data.token;
      currentAdmin = data.admin;
      localStorage.setItem('asg_admin_token', token);
      localStorage.setItem('asg_admin_user', JSON.stringify(currentAdmin));
      showDashboard();
    } else {
      loginErrorMsg.textContent = data.message || 'Login failed. Check credentials.';
      loginErrorMsg.style.display = 'block';
    }
  } catch (err) {
    if (window.location.protocol === 'file:') {
      loginErrorMsg.innerHTML = 'You opened the file directly (file://). Please open it via <a href="http://localhost:3000/admin.html" style="color:#b91c1c; font-weight:bold; text-decoration:underline;">http://localhost:3000/admin.html</a> in your browser!';
    } else {
      loginErrorMsg.textContent = 'Server connection error: ' + err.message + '. Make sure start-server.bat is running.';
    }
    loginErrorMsg.style.display = 'block';
  }
}

function handleLogout() {
  token = null;
  currentAdmin = null;
  localStorage.removeItem('asg_admin_token');
  localStorage.removeItem('asg_admin_user');
  showLogin();
}

function switchTab(tabId) {
  document.querySelectorAll('.sidebar-menu .nav-item').forEach(link => {
    link.classList.toggle('active', link.getAttribute('data-tab') === tabId);
  });

  document.querySelectorAll('.admin-tab-pane').forEach(pane => {
    pane.classList.toggle('active', pane.id === tabId);
  });

  const tabTitles = {
    'tab-overview': 'Dashboard Overview',
    'tab-reservations': 'Table Reservations Management',
    'tab-orders': 'Customer Online Orders',
    'tab-menu': 'Dishes & Menu Catalog'
  };
  currentTabTitle.textContent = tabTitles[tabId] || 'Admin Portal';
}

async function loadAllDashboardData() {
  await Promise.all([
    fetchStats(),
    fetchCategories(),
    fetchMenu(),
    fetchReservations(),
    fetchOrders()
  ]);
}

// Fetch Stats
async function fetchStats() {
  try {
    const res = await fetch(`${API_BASE}/api/admin/stats`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.status === 401) return handleLogout();
    const data = await res.json();
    if (data.success) {
      statRevenue.innerHTML = `&#8377;${data.stats.totalRevenue.toLocaleString()}`;
      statReservations.textContent = data.stats.totalReservations;
      statOrders.textContent = data.stats.totalOrders;
      statMenuCount.textContent = data.stats.totalMenuItems;
    }
  } catch (err) {
    console.error('Failed to load stats', err);
  }
}

// Fetch Categories
async function fetchCategories() {
  try {
    const res = await fetch(`${API_BASE}/api/categories`);
    const data = await res.json();
    if (data.success) {
      categoriesCache = data.categories;
      populateCategoryDropdown();
    }
  } catch (err) {
    console.error('Failed to load categories', err);
  }
}

function populateCategoryDropdown() {
  const select = document.getElementById('dishCategory');
  if (!select) return;
  select.innerHTML = categoriesCache.map(cat => `
    <option value="${cat.id}">${cat.name}</option>
  `).join('');
}

// Fetch Menu Items
async function fetchMenu() {
  try {
    const res = await fetch(`${API_BASE}/api/menu`);
    const data = await res.json();
    if (data.success) {
      menuCache = data.items;
      renderMenuTable();
    }
  } catch (err) {
    console.error('Failed to fetch menu', err);
  }
}

function renderMenuTable() {
  const tbody = document.getElementById('menuTableBody');
  if (!tbody) return;

  if (menuCache.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 20px;">No menu items created.</td></tr>';
    return;
  }

  tbody.innerHTML = menuCache.map(item => `
    <tr>
      <td>
        <img src="${item.image_url}" alt="" style="width: 48px; height: 48px; border-radius: 8px; object-fit: cover;">
      </td>
      <td>
        <strong>${item.name}</strong><br>
        <span style="font-size: 0.78rem; color: var(--admin-muted);">${(item.description || '').substring(0, 60)}...</span>
      </td>
      <td>${item.category_name}</td>
      <td><strong>&#8377;${item.price}</strong></td>
      <td>
        ${item.is_veg === 1 ? '<span class="badge badge-green">Pure Veg</span>' : '<span class="badge badge-red">Non-Veg</span>'}
      </td>
      <td>${item.badge ? `<span class="badge badge-yellow">${item.badge}</span>` : '-'}</td>
      <td>
        ${item.is_available === 1 
          ? '<span class="badge badge-green">In Stock</span>' 
          : '<span class="badge badge-red">Sold Out</span>'}
      </td>
      <td>
        <div style="display: flex; gap: 6px;">
          <button class="btn-sm btn-sm-edit" onclick="openEditMenuModal('${item.id}')">
            <i class="fa-solid fa-pen"></i> Edit
          </button>
          <button class="btn-sm btn-sm-danger" onclick="deleteMenuItem('${item.id}')">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

// Fetch Reservations
async function fetchReservations() {
  try {
    const res = await fetch(`${API_BASE}/api/reservations`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.status === 401) return handleLogout();
    const data = await res.json();
    if (data.success) {
      reservationsCache = data.reservations;
      renderReservationsTable();
      renderOverviewRecentReservations();
    }
  } catch (err) {
    console.error('Failed to load reservations', err);
  }
}

function renderReservationsTable() {
  const tbody = document.getElementById('reservationsTableBody');
  if (!tbody) return;

  if (reservationsCache.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 20px;">No reservations recorded.</td></tr>';
    return;
  }

  tbody.innerHTML = reservationsCache.map(r => {
    let statusBadge = '<span class="badge badge-green">Confirmed</span>';
    if (r.status === 'cancelled') statusBadge = '<span class="badge badge-red">Cancelled</span>';
    if (r.status === 'completed') statusBadge = '<span class="badge badge-blue">Completed</span>';

    return `
      <tr>
        <td><strong>${r.booking_reference}</strong></td>
        <td>${r.customer_name}</td>
        <td>${r.phone}</td>
        <td>${r.reservation_date} <br><small style="color: var(--admin-muted);">${r.reservation_time}</small></td>
        <td><strong>${r.party_size}</strong></td>
        <td>${r.meal_session || '-'}</td>
        <td style="max-width: 200px;">${r.special_requests || '<em>None</em>'}</td>
        <td>${statusBadge}</td>
        <td>
          <select onchange="updateReservationStatus('${r.id}', this.value)" style="padding: 4px 8px; border-radius: 4px; border: 1px solid var(--admin-border); font-size: 0.8rem;">
            <option value="confirmed" ${r.status === 'confirmed' ? 'selected' : ''}>Confirm</option>
            <option value="completed" ${r.status === 'completed' ? 'selected' : ''}>Complete</option>
            <option value="cancelled" ${r.status === 'cancelled' ? 'selected' : ''}>Cancel</option>
          </select>
        </td>
      </tr>
    `;
  }).join('');
}

function renderOverviewRecentReservations() {
  const tbody = document.getElementById('overviewRecentReservationsBody');
  if (!tbody) return;
  const recent = reservationsCache.slice(0, 5);

  if (recent.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No reservations yet</td></tr>';
    return;
  }

  tbody.innerHTML = recent.map(r => `
    <tr>
      <td><strong>${r.booking_reference}</strong></td>
      <td>${r.customer_name}</td>
      <td>${r.reservation_date} ${r.reservation_time}</td>
      <td>${r.party_size}</td>
      <td><span class="badge badge-green">${r.status}</span></td>
    </tr>
  `).join('');
}

async function updateReservationStatus(id, newStatus) {
  try {
    const res = await fetch(`${API_BASE}/api/reservations/${id}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ status: newStatus })
    });
    const data = await res.json();
    if (data.success) {
      fetchReservations();
      fetchStats();
    }
  } catch (err) {
    alert('Failed to update reservation status');
  }
}

// Fetch Orders
async function fetchOrders() {
  try {
    const res = await fetch(`${API_BASE}/api/orders`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.status === 401) return handleLogout();
    const data = await res.json();
    if (data.success) {
      ordersCache = data.orders;
      renderOrdersTable();
      renderOverviewRecentOrders();
    }
  } catch (err) {
    console.error('Failed to load orders', err);
  }
}

function renderOrdersTable() {
  const tbody = document.getElementById('ordersTableBody');
  if (!tbody) return;

  if (ordersCache.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 20px;">No online orders received yet.</td></tr>';
    return;
  }

  tbody.innerHTML = ordersCache.map(o => {
    let statusClass = 'badge-yellow';
    if (o.status === 'delivered' || o.status === 'completed') statusClass = 'badge-green';
    if (o.status === 'cancelled') statusClass = 'badge-red';

    const itemsSummary = o.items ? o.items.map(it => `${it.quantity}x ${it.name}`).join('<br>') : 'N/A';

    return `
      <tr>
        <td><strong>${o.order_number}</strong></td>
        <td>${o.customer_name}</td>
        <td>${o.phone}</td>
        <td style="font-size: 0.8rem;">${itemsSummary}</td>
        <td style="font-size: 0.8rem; max-width: 180px;">
          <strong>${o.order_type.toUpperCase()}</strong><br>
          ${o.delivery_address}
        </td>
        <td><strong>&#8377;${o.total.toFixed(2)}</strong></td>
        <td><span class="badge ${statusClass}">${o.status.toUpperCase()}</span></td>
        <td>
          <select onchange="updateOrderStatus('${o.id}', this.value)" style="padding: 4px 8px; border-radius: 4px; border: 1px solid var(--admin-border); font-size: 0.8rem;">
            <option value="received" ${o.status === 'received' ? 'selected' : ''}>Received</option>
            <option value="preparing" ${o.status === 'preparing' ? 'selected' : ''}>Preparing</option>
            <option value="dispatched" ${o.status === 'dispatched' ? 'selected' : ''}>Dispatched</option>
            <option value="delivered" ${o.status === 'delivered' ? 'selected' : ''}>Delivered</option>
            <option value="cancelled" ${o.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
          </select>
        </td>
      </tr>
    `;
  }).join('');
}

function renderOverviewRecentOrders() {
  const tbody = document.getElementById('overviewRecentOrdersBody');
  if (!tbody) return;
  const recent = ordersCache.slice(0, 5);

  if (recent.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">No orders yet</td></tr>';
    return;
  }

  tbody.innerHTML = recent.map(o => `
    <tr>
      <td><strong>${o.order_number}</strong></td>
      <td>${o.customer_name}</td>
      <td><strong>&#8377;${o.total.toFixed(2)}</strong></td>
      <td><span class="badge badge-yellow">${o.status}</span></td>
    </tr>
  `).join('');
}

async function updateOrderStatus(id, newStatus) {
  try {
    const res = await fetch(`${API_BASE}/api/orders/${id}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ status: newStatus })
    });
    const data = await res.json();
    if (data.success) {
      fetchOrders();
      fetchStats();
    }
  } catch (err) {
    alert('Failed to update order status');
  }
}

// Menu Item Modal & CRUD Handlers
function openAddMenuModal() {
  editMenuId.value = '';
  menuModalTitle.textContent = 'Add New Dish';
  menuItemForm.reset();
  document.getElementById('dishAvailable').checked = true;
  menuModalOverlay.classList.add('active');
}

function openEditMenuModal(id) {
  const item = menuCache.find(i => i.id === id);
  if (!item) return;

  editMenuId.value = item.id;
  menuModalTitle.textContent = 'Edit Dish: ' + item.name;
  document.getElementById('dishName').value = item.name;
  document.getElementById('dishCategory').value = item.category_id;
  document.getElementById('dishPrice').value = item.price;
  document.getElementById('dishDiet').value = item.is_veg;
  document.getElementById('dishSpice').value = item.spicy_level;
  document.getElementById('dishBadge').value = item.badge || '';
  document.getElementById('dishImage').value = item.image_url || '';
  document.getElementById('dishDesc').value = item.description || '';
  document.getElementById('dishAvailable').checked = item.is_available === 1;

  menuModalOverlay.classList.add('active');
}

function closeMenuModal() {
  menuModalOverlay.classList.remove('active');
}

async function handleSaveMenuItem(e) {
  e.preventDefault();
  const id = editMenuId.value;
  const payload = {
    name: document.getElementById('dishName').value,
    category_id: document.getElementById('dishCategory').value,
    price: Number(document.getElementById('dishPrice').value),
    is_veg: Number(document.getElementById('dishDiet').value),
    spicy_level: Number(document.getElementById('dishSpice').value),
    badge: document.getElementById('dishBadge').value,
    image_url: document.getElementById('dishImage').value,
    description: document.getElementById('dishDesc').value,
    is_available: document.getElementById('dishAvailable').checked ? 1 : 0
  };

  const isEdit = Boolean(id);
  const endpoint = isEdit ? `${API_BASE}/api/menu/${id}` : `${API_BASE}/api/menu`;
  const method = isEdit ? 'PUT' : 'POST';

  try {
    const res = await fetch(endpoint, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (data.success) {
      closeMenuModal();
      await fetchMenu();
      await fetchStats();
    } else {
      alert(data.message || 'Operation failed');
    }
  } catch (err) {
    alert('Network error while saving menu item');
  }
}

async function deleteMenuItem(id) {
  if (!confirm('Are you sure you want to permanently delete this menu dish?')) return;

  try {
    const res = await fetch(`${API_BASE}/api/menu/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    const data = await res.json();
    if (data.success) {
      await fetchMenu();
      await fetchStats();
    } else {
      alert(data.message || 'Failed to delete dish');
    }
  } catch (err) {
    alert('Network error while deleting dish');
  }
}

// Expose globals for inline HTML event triggers
window.switchTab = switchTab;
window.fetchReservations = fetchReservations;
window.fetchOrders = fetchOrders;
window.updateReservationStatus = updateReservationStatus;
window.updateOrderStatus = updateOrderStatus;
window.openAddMenuModal = openAddMenuModal;
window.openEditMenuModal = openEditMenuModal;
window.closeMenuModal = closeMenuModal;
window.deleteMenuItem = deleteMenuItem;
