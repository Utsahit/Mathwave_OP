router.add('customer/orders', {
  async render() {
    const user = store.get('user');
    if (!user) { router.navigate('auth/login'); return ''; }
    return `
    <div class="max-w-5xl mx-auto px-4 md:px-8 py-8">
      <h1 class="font-display text-3xl text-primary mb-2">My Orders</h1>
      <p class="text-secondary text-sm mb-8">Track your order history</p>
      <div id="orders-list">${loadingSpinner()}</div>
    </div>`;
  },
  async mount() {
    const el = document.getElementById('orders-list');
    try {
      const res = await api.get('/orders');
      const orders = res.data || [];
      if (orders.length === 0) { el.innerHTML = emptyState('📋', 'No orders yet', 'Place your first order from our menu!'); return; }
      el.innerHTML = `<div class="space-y-4">${orders.map(o => {
        const items = o.items || [];
        return `<a href="#/customer/order-detail?id=${o.id}" class="block bg-white rounded-2xl border border-on-surface/10 p-5 card-hover">
          <div class="flex justify-between items-start mb-3">
            <div><p class="font-medium text-primary">Order #${o.orderNumber || o.id.slice(0,8)}</p><p class="text-xs text-secondary">${formatDateTime(o.createdAt)}</p></div>
            <span class="badge badge-${o.status === 'DELIVERED' || o.status === 'COMPLETED' ? 'success' : o.status === 'CANCELLED' ? 'danger' : o.status === 'PREPARING' || o.status === 'COOKING' ? 'warning' : 'info'}">${o.status}</span>
          </div>
          <div class="text-sm text-secondary">${items.slice(0, 3).map(i => esc(i.name || i.menuItemName || 'Item')).join(', ')}${items.length > 3 ? ` +${items.length - 3} more` : ''}</div>
          <div class="flex justify-between items-center mt-3 pt-3 border-t border-on-surface/5">
            <span class="text-sm text-secondary">${items.reduce((s, i) => s + (i.quantity || 1), 0)} items</span>
            <span class="font-bold text-primary">${formatCurrency(o.totalAmount || o.total || 0)}</span>
          </div>
        </a>`;
      }).join('')}</div>`;
    } catch { el.innerHTML = errorState('Failed to load orders.'); }
  },
  cleanup() {},
});
router.add('customer/order-detail', {
  async render(params) {
    return `<div class="max-w-4xl mx-auto px-4 md:px-8 py-8"><div id="order-detail-content">${loadingSpinner()}</div></div>`;
  },
  async mount(params) {
    const el = document.getElementById('order-detail-content');
    try {
      const res = await api.get(`/orders/${params.id}`);
      const o = res.data || {};
      const items = o.items || [];
      el.innerHTML = `
        <div class="flex items-center gap-4 mb-6">
          <a href="#/customer/orders" class="text-secondary hover:text-primary transition-500">← Back</a>
          <h1 class="font-display text-2xl text-primary">Order #${o.orderNumber || o.id.slice(0, 8)}</h1>
          <span class="badge badge-${o.status === 'DELIVERED' || o.status === 'COMPLETED' ? 'success' : o.status === 'CANCELLED' ? 'danger' : o.status === 'PREPARING' || o.status === 'COOKING' ? 'warning' : 'info'} text-sm">${o.status}</span>
        </div>
        <div class="grid md:grid-cols-3 gap-6">
          <div class="md:col-span-2 space-y-4">
            <div class="bg-white rounded-2xl border border-on-surface/10 p-6">
              <h2 class="font-display text-lg text-primary mb-4">Items</h2>
              <div class="space-y-3">${items.map(i => `<div class="flex justify-between items-center py-2 border-b border-on-surface/5 last:border-0"><div><p class="text-sm font-medium">${esc(i.name || i.menuItemName || 'Item')}</p><p class="text-xs text-secondary">× ${i.quantity || 1}</p></div><span class="font-medium">${formatCurrency((i.price || 0) * (i.quantity || 1))}</span></div>`).join('')}</div>
            </div>
            ${o.status === 'PREPARING' || o.status === 'COOKING' || o.status === 'READY' ? `
            <div class="bg-white rounded-2xl border border-on-surface/10 p-6">
              <h2 class="font-display text-lg text-primary mb-4">Kitchen Status</h2>
              <div class="flex items-center gap-3"><span class="w-3 h-3 rounded-full bg-green-500 animate-pulse"></span><span class="text-sm">Your order is being prepared</span></div>
            </div>` : ''}
          </div>
          <div class="space-y-4">
            <div class="bg-white rounded-2xl border border-on-surface/10 p-6">
              <h2 class="font-display text-lg text-primary mb-4">Order Details</h2>
              <div class="space-y-2 text-sm">
                <div class="flex justify-between"><span class="text-secondary">Date</span><span>${formatDateTime(o.createdAt)}</span></div>
                <div class="flex justify-between"><span class="text-secondary">Payment</span><span>${o.paymentStatus || 'PENDING'}</span></div>
                <hr class="border-on-surface/5 my-2">
                <div class="flex justify-between font-bold"><span>Total</span><span>${formatCurrency(o.totalAmount || o.total || 0)}</span></div>
              </div>
            </div>
            ${o.address ? `<div class="bg-white rounded-2xl border border-on-surface/10 p-6"><h2 class="font-display text-lg text-primary mb-2">Delivery Address</h2><p class="text-sm text-secondary">${esc([o.address.street, o.address.city, o.address.state, o.address.zip].filter(Boolean).join(', '))}</p></div>` : ''}
          </div>
        </div>`;
    } catch { el.innerHTML = errorState('Failed to load order details.'); }
  },
  cleanup() {},
});
