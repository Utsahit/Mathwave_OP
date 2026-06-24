router.add('admin/inventory', {
  async render() {
    const user = store.get('user');
    if (!user || (user.role !== 'ADMIN' && user.role !== 'MANAGER')) { router.navigate('customer/menu'); return ''; }
    return `
    <div class="max-w-7xl mx-auto px-4 md:px-8 py-8">
      <h1 class="font-display text-3xl text-primary mb-2">Inventory Management</h1>
      <p class="text-secondary text-sm mb-6">Track ingredients, suppliers, and stock</p>
      <div class="flex flex-wrap gap-2 mb-6"><button class="inv-tab active bg-primary text-on-primary px-5 py-2 rounded-full text-sm font-medium" data-tab="ingredients">Ingredients</button><button class="inv-tab px-5 py-2 rounded-full text-sm font-medium border border-on-surface/20 text-secondary hover:bg-surface-container-high" data-tab="suppliers">Suppliers</button><button class="inv-tab px-5 py-2 rounded-full text-sm font-medium border border-on-surface/20 text-secondary hover:bg-surface-container-high" data-tab="purchase-orders">Purchase Orders</button><button class="inv-tab px-5 py-2 rounded-full text-sm font-medium border border-on-surface/20 text-secondary hover:bg-surface-container-high" data-tab="low-stock">Low Stock</button></div>
      <div id="inventory-content">${loadingSpinner()}</div>
    </div>`;
  },
  async mount() {
    const content = document.getElementById('inventory-content');
    let activeTab = 'ingredients';
    async function loadTab(tab) {
      content.innerHTML = loadingSpinner();
      try {
        if (tab === 'ingredients') {
          const res = await api.get('/inventory');
          const items = res.data || [];
          content.innerHTML = `<div class="bg-white rounded-2xl border border-on-surface/10 overflow-hidden"><table class="data-table w-full"><thead><tr><th>Name</th><th>Quantity</th><th>Unit</th><th>Min Stock</th><th>Status</th></tr></thead><tbody>${items.length === 0 ? '<tr><td colspan="5" class="text-center text-secondary py-8">No ingredients</td></tr>' : items.map(i => `<tr><td class="font-medium">${esc(i.name)}</td><td>${i.quantity || 0}</td><td>${esc(i.unit || '')}</td><td>${i.minStock || 0}</td><td><span class="badge ${(i.quantity || 0) <= (i.minStock || 0) ? 'badge-danger' : 'badge-success'}">${(i.quantity || 0) <= (i.minStock || 0) ? 'Low Stock' : 'In Stock'}</span></td></tr>`).join('')}</tbody></table></div>`;
        } else if (tab === 'suppliers') {
          const res = await api.get('/suppliers');
          const items = res.data || [];
          content.innerHTML = `<div class="bg-white rounded-2xl border border-on-surface/10 overflow-hidden"><table class="data-table w-full"><thead><tr><th>Name</th><th>Contact</th><th>Email</th><th>Phone</th></tr></thead><tbody>${items.length === 0 ? '<tr><td colspan="4" class="text-center text-secondary py-8">No suppliers</td></tr>' : items.map(s => `<tr><td class="font-medium">${esc(s.name)}</td><td>${esc(s.contactName || '—')}</td><td>${esc(s.email || '—')}</td><td>${esc(s.phone || '—')}</td></tr>`).join('')}</tbody></table></div>`;
        } else if (tab === 'purchase-orders') {
          const res = await api.get('/purchase-orders');
          const items = res.data || [];
          content.innerHTML = `<div class="bg-white rounded-2xl border border-on-surface/10 overflow-hidden"><table class="data-table w-full"><thead><tr><th>Order #</th><th>Supplier</th><th>Items</th><th>Status</th><th>Date</th></tr></thead><tbody>${items.length === 0 ? '<tr><td colspan="5" class="text-center text-secondary py-8">No purchase orders</td></tr>' : items.map(po => `<tr><td class="font-medium">#${po.id?.slice(0, 8)}</td><td class="text-sm">${esc(po.supplier?.name || '—')}</td><td class="text-sm">${(po.items || []).length} items</td><td><span class="badge badge-${po.status === 'DELIVERED' ? 'success' : po.status === 'PENDING' ? 'warning' : 'info'}">${po.status || 'PENDING'}</span></td><td class="text-sm text-secondary">${formatDate(po.createdAt)}</td></tr>`).join('')}</tbody></table></div>`;
        } else if (tab === 'low-stock') {
          const res = await api.get('/inventory/low-stock');
          const items = res.data || [];
          content.innerHTML = items.length === 0 ? emptyState('✅', 'All stocked up!', 'No low-stock alerts.') : `<div class="space-y-3">${items.map(i => `<div class="bg-white rounded-xl border border-red-200 p-4 flex justify-between items-center"><div><p class="font-medium text-primary">${esc(i.name)}</p><p class="text-sm text-red-600">Only ${i.quantity || 0} ${i.unit || 'units'} remaining (min: ${i.minStock || 0})</p></div><a href="#/admin/purchase-orders" class="text-sm bg-primary text-on-primary px-4 py-2 rounded-lg hover:opacity-90 transition-500">Reorder</a></div>`).join('')}</div>`;
        }
      } catch { content.innerHTML = errorState(`Failed to load ${tab}.`); }
    }
    document.querySelectorAll('.inv-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        activeTab = btn.dataset.tab;
        document.querySelectorAll('.inv-tab').forEach(b => {
          b.classList.toggle('active', b.dataset.tab === activeTab);
          b.classList.toggle('bg-primary', b.dataset.tab === activeTab);
          b.classList.toggle('text-on-primary', b.dataset.tab === activeTab);
        });
        loadTab(activeTab);
      });
    });
    await loadTab(activeTab);
  },
  cleanup() {},
});
