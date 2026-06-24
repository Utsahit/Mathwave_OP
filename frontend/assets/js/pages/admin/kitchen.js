router.add('admin/kitchen', {
  async render() {
    const user = store.get('user');
    if (!user || (user.role !== 'ADMIN' && user.role !== 'MANAGER' && user.role !== 'STAFF')) { router.navigate('customer/menu'); return ''; }
    return `
    <div class="max-w-7xl mx-auto px-4 md:px-8 py-8">
      <h1 class="font-display text-3xl text-primary mb-2">Kitchen Display</h1>
      <p class="text-secondary text-sm mb-6">Live order tickets</p>
      <div id="kitchen-orders" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">${loadingSpinner()}</div>
    </div>`;
  },
  async mount() {
    const el = document.getElementById('kitchen-orders');
    async function load() {
      try {
        const res = await api.get('/kitchen/orders');
        let orders = res.data || [];
        if (!Array.isArray(orders) && orders.orders) orders = orders.orders;
        if (orders.length === 0) { el.innerHTML = emptyState('👨‍🍳', 'No active orders', 'All orders are completed!'); return; }
        el.innerHTML = orders.map(o => {
          const items = o.items || [];
          return `<div class="bg-white rounded-2xl border border-on-surface/10 p-5 card-hover border-l-4 border-l-${o.priority === 'HIGH' ? 'red' : o.priority === 'MEDIUM' ? 'amber' : 'green'}-500">
            <div class="flex justify-between items-start mb-3"><div><p class="font-bold text-primary">#${o.orderNumber || o.id?.slice(0, 8) || ''}</p><p class="text-xs text-secondary">${formatDateTime(o.createdAt)}</p></div>
            <div class="text-right"><span class="badge badge-${o.status === 'PREPARING' ? 'warning' : 'info'} text-xs">${o.status}</span></div></div>
            <div class="space-y-2 mb-4">${items.map(i => `<div class="flex justify-between text-sm py-1 border-b border-on-surface/5 last:border-0"><span>${esc(i.name || i.menuItemName || 'Item')} × ${i.quantity || 1}</span>${i.station ? `<span class="text-xs text-secondary">${esc(i.station)}</span>` : ''}</div>`).join('')}</div>
            <div class="flex gap-2"><button class="kitchen-start flex-1 text-sm bg-green-600 text-white py-2 rounded-lg hover:opacity-90 transition-500" data-id="${o.id}">${o.status === 'PENDING' ? 'Start' : 'Update'}</button><button class="kitchen-complete flex-1 text-sm bg-primary text-on-primary py-2 rounded-lg hover:opacity-90 transition-500" data-id="${o.id}">Complete</button></div>
          </div>`;
        }).join('');
        el.querySelectorAll('.kitchen-start').forEach(btn => {
          btn.addEventListener('click', async () => {
            try { await api.patch(`/orders/${btn.dataset.id}/status`, { status: 'PREPARING' }); toast.success('Order started'); load(); } catch { toast.error('Failed'); }
          });
        });
        el.querySelectorAll('.kitchen-complete').forEach(btn => {
          btn.addEventListener('click', async () => {
            try { await api.patch(`/orders/${btn.dataset.id}/status`, { status: 'READY' }); toast.success('Order completed'); load(); } catch { toast.error('Failed'); }
          });
        });
      } catch { el.innerHTML = errorState('Failed to load kitchen orders.'); }
    }
    await load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  },
  cleanup() { if (this._interval) clearInterval(this._interval); },
});
