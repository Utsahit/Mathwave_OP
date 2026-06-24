router.add('admin/branches', {
  async render() {
    const user = store.get('user');
    if (!user || (user.role !== 'ADMIN' && user.role !== 'MANAGER')) { router.navigate('customer/menu'); return ''; }
    return `
    <div class="max-w-7xl mx-auto px-4 md:px-8 py-8">
      <h1 class="font-display text-3xl text-primary mb-2">Branch & Franchise Management</h1>
      <p class="text-secondary text-sm mb-6">Manage locations, staff, and transfers</p>
      <div class="flex flex-wrap gap-2 mb-6"><button class="branch-tab active bg-primary text-on-primary px-5 py-2 rounded-full text-sm font-medium" data-tab="branches">Branches</button><button class="branch-tab px-5 py-2 rounded-full text-sm font-medium border border-on-surface/20 text-secondary hover:bg-surface-container-high" data-tab="franchises">Franchises</button><button class="branch-tab px-5 py-2 rounded-full text-sm font-medium border border-on-surface/20 text-secondary hover:bg-surface-container-high" data-tab="transfers">Transfers</button></div>
      <div id="branch-content">${loadingSpinner()}</div>
    </div>`;
  },
  async mount() {
    const content = document.getElementById('branch-content');
    let activeTab = 'branches';
    async function loadTab(tab) {
      content.innerHTML = loadingSpinner();
      try {
        if (tab === 'branches') {
          const res = await api.get('/branches');
          const items = res.data || [];
          content.innerHTML = `<div class="bg-white rounded-2xl border border-on-surface/10 overflow-hidden"><table class="data-table w-full"><thead><tr><th>Name</th><th>Location</th><th>Phone</th><th>Status</th></tr></thead><tbody>${items.length === 0 ? '<tr><td colspan="4" class="text-center text-secondary py-8">No branches</td></tr>' : items.map(b => `<tr><td class="font-medium">${esc(b.name)}</td><td class="text-sm">${esc([b.city, b.state].filter(Boolean).join(', ') || '—')}</td><td class="text-sm">${esc(b.phone || '—')}</td><td><span class="badge ${b.isActive ? 'badge-success' : 'badge-danger'}">${b.isActive ? 'Active' : 'Inactive'}</span></td></tr>`).join('')}</tbody></table></div>`;
        } else if (tab === 'franchises') {
          const res = await api.get('/franchises');
          const items = res.data || [];
          content.innerHTML = `<div class="bg-white rounded-2xl border border-on-surface/10 overflow-hidden"><table class="data-table w-full"><thead><tr><th>Name</th><th>Owner</th><th>Branch</th><th>Status</th></tr></thead><tbody>${items.length === 0 ? '<tr><td colspan="4" class="text-center text-secondary py-8">No franchises</td></tr>' : items.map(f => `<tr><td class="font-medium">${esc(f.name || f.businessName || '—')}</td><td class="text-sm">${esc(f.ownerName || '—')}</td><td class="text-sm">${esc(f.branch?.name || '—')}</td><td><span class="badge ${f.status === 'ACTIVE' ? 'badge-success' : f.status === 'PENDING' ? 'badge-warning' : 'badge-neutral'}">${f.status || '—'}</span></td></tr>`).join('')}</tbody></table></div>`;
        } else if (tab === 'transfers') {
          const res = await api.get('/transfers');
          const items = res.data || [];
          content.innerHTML = items.length === 0 ? emptyState('🔄', 'No transfers', 'No inventory transfers recorded.') : `<div class="bg-white rounded-2xl border border-on-surface/10 overflow-hidden"><table class="data-table w-full"><thead><tr><th>From</th><th>To</th><th>Items</th><th>Status</th><th>Date</th></tr></thead><tbody>${items.map(t => `<tr><td class="text-sm">${esc(t.fromBranch?.name || '—')}</td><td class="text-sm">${esc(t.toBranch?.name || '—')}</td><td class="text-sm">${(t.items || []).length} items</td><td><span class="badge badge-${t.status === 'COMPLETED' ? 'success' : t.status === 'PENDING' ? 'warning' : 'info'}">${t.status || '—'}</span></td><td class="text-sm text-secondary">${formatDate(t.createdAt)}</td></tr>`).join('')}</tbody></table></div>`;
        }
      } catch { content.innerHTML = errorState(`Failed to load ${tab}.`); }
    }
    document.querySelectorAll('.branch-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        activeTab = btn.dataset.tab;
        document.querySelectorAll('.branch-tab').forEach(b => {
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
