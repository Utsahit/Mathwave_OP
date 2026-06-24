router.add('customer/dashboard', {
  async render() {
    const user = store.get('user');
    if (!user) { router.navigate('auth/login'); return ''; }
    return `
    <div class="max-w-7xl mx-auto px-4 md:px-8 py-8">
      <h1 class="font-display text-3xl text-primary mb-2">Welcome, ${esc(user.name || user.email)}</h1>
      <p class="text-secondary text-sm mb-8">Your account overview</p>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10" id="dash-stats"></div>
      <div class="grid md:grid-cols-2 gap-8 mb-10">
        <div class="bg-white rounded-2xl border border-on-surface/10 p-6">
          <h2 class="font-display text-lg text-primary mb-4">Recent Orders</h2>
          <div id="dash-recent-orders">${loadingSpinner()}</div>
        </div>
        <div class="bg-white rounded-2xl border border-on-surface/10 p-6">
          <h2 class="font-display text-lg text-primary mb-4">Upcoming Reservations</h2>
          <div id="dash-upcoming-reservations">${loadingSpinner()}</div>
        </div>
      </div>
      <div class="bg-white rounded-2xl border border-on-surface/10 p-6">
        <h2 class="font-display text-lg text-primary mb-4">Quick Actions</h2>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <a href="#/customer/menu" class="flex flex-col items-center gap-2 p-4 rounded-xl bg-surface-container-high hover:bg-primary/10 transition-500 text-center">
            <span class="text-2xl">🍽️</span><span class="text-sm font-medium">Browse Menu</span>
          </a>
          <a href="#/customer/reservations" class="flex flex-col items-center gap-2 p-4 rounded-xl bg-surface-container-high hover:bg-primary/10 transition-500 text-center">
            <span class="text-2xl">📅</span><span class="text-sm font-medium">Book a Table</span>
          </a>
          <a href="#/customer/orders" class="flex flex-col items-center gap-2 p-4 rounded-xl bg-surface-container-high hover:bg-primary/10 transition-500 text-center">
            <span class="text-2xl">📋</span><span class="text-sm font-medium">My Orders</span>
          </a>
          <a href="#/customer/loyalty" class="flex flex-col items-center gap-2 p-4 rounded-xl bg-surface-container-high hover:bg-primary/10 transition-500 text-center">
            <span class="text-2xl">⭐</span><span class="text-sm font-medium">Loyalty</span>
          </a>
        </div>
      </div>
    </div>`;
  },
  async mount() {
    const user = store.get('user');
    if (!user) return;
    try {
      const [ordersRes, reservationsRes, loyaltyRes] = await Promise.allSettled([
        api.get('/orders?limit=3'),
        api.get('/reservations?limit=3'),
        api.get('/loyalty/points'),
      ]);
      const recentOrders = ordersRes.status === 'fulfilled' ? (ordersRes.value.data || []) : [];
      const reservations = reservationsRes.status === 'fulfilled' ? (reservationsRes.value.data || []) : [];
      const loyalty = loyaltyRes.status === 'fulfilled' ? (loyaltyRes.value.data || {}) : {};
      document.getElementById('dash-stats').innerHTML = `
        <div class="bg-white rounded-xl border border-on-surface/10 p-4 text-center">
          <p class="text-2xl font-bold text-primary">${recentOrders.length}</p>
          <p class="text-xs text-secondary mt-1">Orders</p>
        </div>
        <div class="bg-white rounded-xl border border-on-surface/10 p-4 text-center">
          <p class="text-2xl font-bold text-primary">${reservations.length}</p>
          <p class="text-xs text-secondary mt-1">Reservations</p>
        </div>
        <div class="bg-white rounded-xl border border-on-surface/10 p-4 text-center">
          <p class="text-2xl font-bold text-primary">${loyalty.points || 0}</p>
          <p class="text-xs text-secondary mt-1">Loyalty Points</p>
        </div>
        <div class="bg-white rounded-xl border border-on-surface/10 p-4 text-center">
          <p class="text-2xl font-bold text-primary">${loyalty.tier || 'Bronze'}</p>
          <p class="text-xs text-secondary mt-1">Membership Tier</p>
        </div>
      `;
      const ordersEl = document.getElementById('dash-recent-orders');
      if (recentOrders.length === 0) {
        ordersEl.innerHTML = emptyState('📋', 'No orders yet', 'Start by browsing our menu!');
      } else {
        ordersEl.innerHTML = recentOrders.map(o => `
          <a href="#/customer/order-detail?id=${o.id}" class="flex justify-between items-center py-3 border-b border-on-surface/5 last:border-0 hover:bg-surface-container-high px-3 -mx-3 rounded-lg transition-500">
            <div><p class="text-sm font-medium">#${o.orderNumber || o.id.slice(0,8)}</p><p class="text-xs text-secondary">${formatDateTime(o.createdAt)}</p></div>
            <span class="badge badge-${o.status === 'DELIVERED' ? 'success' : o.status === 'PENDING' ? 'warning' : 'info'}">${o.status}</span>
          </a>
        `).join('');
      }
      const resEl = document.getElementById('dash-upcoming-reservations');
      if (reservations.length === 0) {
        resEl.innerHTML = emptyState('📅', 'No reservations', 'Book a table to get started!');
      } else {
        resEl.innerHTML = reservations.map(r => `
          <div class="flex justify-between items-center py-3 border-b border-on-surface/5 last:border-0">
            <div><p class="text-sm font-medium">${formatDate(r.date)} at ${formatTime(r.time)}</p><p class="text-xs text-secondary">${r.guests} guests${r.tableNumber ? ' · Table ' + r.tableNumber : ''}</p></div>
            <span class="badge badge-${r.status === 'CONFIRMED' ? 'success' : r.status === 'PENDING' ? 'warning' : 'neutral'}">${r.status}</span>
          </div>
        `).join('');
      }
    } catch { /* stats will show zeros */ }
  },
  cleanup() {},
});
