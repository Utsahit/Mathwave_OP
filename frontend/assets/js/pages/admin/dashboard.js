router.add('admin/dashboard', {
  async render() {
    const user = store.get('user');
    if (!user || (user.role !== 'ADMIN' && user.role !== 'MANAGER')) { toast.error('Access denied.'); router.navigate('customer/menu'); return ''; }
    return `
    <div class="max-w-7xl mx-auto px-4 md:px-8 py-8">
      <h1 class="font-display text-3xl text-primary mb-2">Admin Dashboard</h1>
      <p class="text-secondary text-sm mb-8">Business overview and key metrics</p>
      <div id="admin-stats" class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"></div>
      <div class="bg-white rounded-2xl border border-on-surface/10 p-6 mb-6">
        <h2 class="font-display text-lg text-primary mb-4">Quick Access</h2>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">${[
          ['🍽️', 'Menu', 'admin/menu-management'],
          ['📋', 'Orders', 'admin/orders'],
          ['📅', 'Reservations', 'admin/reservations'],
          ['👨‍🍳', 'Kitchen', 'admin/kitchen'],
          ['📦', 'Inventory', 'admin/inventory'],
          ['👥', 'CRM', 'admin/crm'],
          ['📢', 'Marketing', 'admin/marketing'],
          ['🏪', 'Branches', 'admin/branches'],
          ['📊', 'Reports', 'admin/reports'],
          ['📝', 'Audit Logs', 'admin/audit-logs'],
          ['⚡', 'Jobs', 'admin/jobs'],
        ].map(([icon, label, href]) => `<a href="#/${href}" class="flex flex-col items-center gap-2 p-4 rounded-xl bg-surface-container-high hover:bg-primary/10 transition-500 text-center"><span class="text-2xl">${icon}</span><span class="text-xs font-medium text-primary">${label}</span></a>`).join('')}</div>
      </div>
      <div id="admin-charts" class="grid md:grid-cols-2 gap-6 mb-6">
        <div class="bg-white rounded-2xl border border-on-surface/10 p-6"><h2 class="font-display text-lg text-primary mb-4">Revenue (Today)</h2><p id="admin-revenue" class="text-3xl font-bold text-primary">—</p></div>
        <div class="bg-white rounded-2xl border border-on-surface/10 p-6"><h2 class="font-display text-lg text-primary mb-4">Active Orders</h2><p id="admin-active-orders" class="text-3xl font-bold text-primary">—</p></div>
      </div>
    </div>`;
  },
  async mount() {
    try {
      const [revRes, orderRes, resRes, invRes, menuRes, custRes] = await Promise.allSettled([
        api.get('/analytics/revenue?period=today'),
        api.get('/orders?limit=5'),
        api.get('/reservations?limit=5'),
        api.get('/inventory/low-stock'),
        api.get('/menu/public'),
        api.get('/analytics/customers'),
      ]);
      const revenue = revRes.status === 'fulfilled' ? (revRes.value.data?.totalRevenue || revRes.value.data?.amount || 0) : 0;
      const orders = orderRes.status === 'fulfilled' ? (orderRes.value.data || []) : [];
      const reservations = resRes.status === 'fulfilled' ? (resRes.value.data || []) : [];
      const lowStock = invRes.status === 'fulfilled' ? (invRes.value.data || []) : [];
      const menuItems = menuRes.status === 'fulfilled' ? (menuRes.value.data || []) : [];
      const customers = custRes.status === 'fulfilled' ? (custRes.value.data?.total || 0) : 0;
      document.getElementById('admin-stats').innerHTML = `
        <div class="bg-white rounded-xl border border-on-surface/10 p-4 text-center"><p class="text-2xl font-bold text-primary">${formatCurrency(revenue)}</p><p class="text-xs text-secondary mt-1">Today's Revenue</p></div>
        <div class="bg-white rounded-xl border border-on-surface/10 p-4 text-center"><p class="text-2xl font-bold text-primary">${orders.filter(o => o.status !== 'DELIVERED' && o.status !== 'CANCELLED').length}</p><p class="text-xs text-secondary mt-1">Active Orders</p></div>
        <div class="bg-white rounded-xl border border-on-surface/10 p-4 text-center"><p class="text-2xl font-bold text-primary">${menuItems.length}</p><p class="text-xs text-secondary mt-1">Menu Items</p></div>
        <div class="bg-white rounded-xl border border-on-surface/10 p-4 text-center"><p class="text-2xl font-bold text-primary">${lowStock.length}</p><p class="text-xs text-secondary mt-1">Low Stock Alerts</p></div>
      `;
      document.getElementById('admin-revenue').textContent = formatCurrency(revenue);
      const active = orders.filter(o => o.status !== 'DELIVERED' && o.status !== 'CANCELLED').length;
      document.getElementById('admin-active-orders').textContent = active;
    } catch {}
  },
  cleanup() {},
});
