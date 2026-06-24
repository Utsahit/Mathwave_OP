router.add('admin/orders', {
  async render() {
    const user = store.get('user');
    if (!user || (user.role !== 'ADMIN' && user.role !== 'MANAGER')) { router.navigate('customer/menu'); return ''; }
    return `
    <div class="max-w-7xl mx-auto px-4 md:px-8 py-8">
      <h1 class="font-display text-3xl text-primary mb-2">Order Management</h1>
      <p class="text-secondary text-sm mb-6">View, filter, and manage orders</p>
      <div class="flex flex-wrap gap-2 mb-6" id="order-filters"><button class="filter-btn active bg-primary text-on-primary px-4 py-2 rounded-full text-sm font-medium" data-status="all">All</button>${['PENDING','CONFIRMED','PREPARING','READY','OUT_FOR_DELIVERY','DELIVERED','CANCELLED'].map(s => `<button class="filter-btn px-4 py-2 rounded-full text-sm font-medium border border-on-surface/20 text-secondary hover:bg-surface-container-high" data-status="${s}">${s.replace(/_/g, ' ')}</button>`).join('')}</div>
      <div id="orders-admin-list">${loadingSpinner()}</div>
    </div>`;
  },
  async mount() {
    const el = document.getElementById('orders-admin-list');
    let activeFilter = 'all';
    async function load() {
      try {
        const res = await api.get('/orders');
        let orders = res.data || [];
        if (activeFilter !== 'all') orders = orders.filter(o => o.status === activeFilter);
        el.innerHTML = `<div class="bg-white rounded-2xl border border-on-surface/10 overflow-hidden"><table class="data-table w-full"><thead><tr><th>Order #</th><th>Customer</th><th>Items</th><th>Total</th><th>Status</th><th>Date</th><th class="text-right">Actions</th></tr></thead><tbody>${orders.length === 0 ? '<tr><td colspan="7" class="text-center text-secondary py-8">No orders found</td></tr>' : orders.map(o => {
          const items = o.items || [];
          return `<tr><td class="font-medium">#${o.orderNumber || o.id.slice(0, 8)}</td><td class="text-sm">${esc(o.user?.name || o.customerName || '—')}</td><td class="text-sm">${items.slice(0, 2).map(i => esc(i.name || i.menuItemName || 'Item')).join(', ')}${items.length > 2 ? ` +${items.length - 2}` : ''}</td><td class="font-medium">${formatCurrency(o.totalAmount || o.total || 0)}</td><td><span class="badge badge-${o.status === 'DELIVERED' ? 'success' : o.status === 'CANCELLED' ? 'danger' : o.status === 'PREPARING' || o.status === 'READY' ? 'warning' : 'info'}">${o.status}</span></td><td class="text-sm text-secondary">${formatDate(o.createdAt)}</td><td class="text-right"><select class="order-status text-xs border border-on-surface/20 rounded-lg px-2 py-1.5 bg-surface" data-id="${o.id}">${['PENDING','CONFIRMED','PREPARING','READY','OUT_FOR_DELIVERY','DELIVERED','CANCELLED'].map(s => `<option value="${s}" ${s === o.status ? 'selected' : ''}>${s.replace(/_/g, ' ')}</option>`).join('')}</select></td></tr>`;
        }).join('')}</tbody></table></div>`;
        el.querySelectorAll('.order-status').select?.forEach?.(); // no-op placeholder
        el.querySelectorAll('.order-status').forEach(sel => {
          sel.addEventListener('change', async () => {
            try { await api.patch(`/orders/${sel.dataset.id}/status`, { status: sel.value }); toast.success('Status updated'); } catch { toast.error('Failed to update'); }
          });
        });
      } catch { el.innerHTML = errorState('Failed to load orders.'); }
    }
    document.querySelectorAll('#order-filters .filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        activeFilter = btn.dataset.status;
        document.querySelectorAll('#order-filters .filter-btn').forEach(b => {
          b.classList.toggle('active', b.dataset.status === activeFilter);
          b.classList.toggle('bg-primary', b.dataset.status === activeFilter);
          b.classList.toggle('text-on-primary', b.dataset.status === activeFilter);
        });
        load();
      });
    });
    await load();
  },
  cleanup() {},
});
