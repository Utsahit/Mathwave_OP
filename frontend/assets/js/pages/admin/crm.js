router.add('admin/crm', {
  async render() {
    const user = store.get('user');
    if (!user || (user.role !== 'ADMIN' && user.role !== 'MANAGER')) { router.navigate('customer/menu'); return ''; }
    return `
    <div class="max-w-7xl mx-auto px-4 md:px-8 py-8">
      <h1 class="font-display text-3xl text-primary mb-2">Customer Relationship Management</h1>
      <p class="text-secondary text-sm mb-6">Manage customers, segments, and loyalty</p>
      <div class="flex flex-wrap gap-2 mb-6"><button class="crm-tab active bg-primary text-on-primary px-5 py-2 rounded-full text-sm font-medium" data-tab="customers">Customers</button><button class="crm-tab px-5 py-2 rounded-full text-sm font-medium border border-on-surface/20 text-secondary hover:bg-surface-container-high" data-tab="segments">Segments</button></div>
      <div id="crm-content">${loadingSpinner()}</div>
    </div>`;
  },
  async mount() {
    const content = document.getElementById('crm-content');
    let activeTab = 'customers';
    async function loadTab(tab) {
      content.innerHTML = loadingSpinner();
      try {
        if (tab === 'customers') {
          const res = await api.get('/analytics/customers');
          const items = res.data?.customers || res.data || [];
          content.innerHTML = `<div class="bg-white rounded-2xl border border-on-surface/10 overflow-hidden"><table class="data-table w-full"><thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Orders</th><th>Joined</th></tr></thead><tbody>${items.length === 0 ? '<tr><td colspan="5" class="text-center text-secondary py-8">No customers found</td></tr>' : items.map(c => `<tr><td class="font-medium">${esc(c.name || '—')}</td><td class="text-sm">${esc(c.email || '—')}</td><td class="text-sm">${esc(c.phone || '—')}</td><td>${c._count?.orders || c.orderCount || 0}</td><td class="text-sm text-secondary">${formatDate(c.createdAt)}</td></tr>`).join('')}</tbody></table></div>`;
        } else if (tab === 'segments') {
          const res = await api.get('/segments');
          const items = res.data || [];
          content.innerHTML = items.length === 0 ? emptyState('📊', 'No segments', 'Create segments in Marketing.') : `<div class="grid grid-cols-1 md:grid-cols-3 gap-4">${items.map(s => `<div class="bg-white rounded-2xl border border-on-surface/10 p-5 card-hover"><h3 class="font-medium text-primary">${esc(s.name)}</h3><p class="text-sm text-secondary mt-1">${s.customerCount || 0} customers</p><p class="text-xs text-secondary mt-2">${esc(s.description || '')}</p></div>`).join('')}</div>`;
        }
      } catch { content.innerHTML = errorState(`Failed to load ${tab}.`); }
    }
    document.querySelectorAll('.crm-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        activeTab = btn.dataset.tab;
        document.querySelectorAll('.crm-tab').forEach(b => {
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
