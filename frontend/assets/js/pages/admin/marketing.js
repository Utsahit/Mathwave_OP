router.add('admin/marketing', {
  async render() {
    const user = store.get('user');
    if (!user || (user.role !== 'ADMIN' && user.role !== 'MANAGER')) { router.navigate('customer/menu'); return ''; }
    return `
    <div class="max-w-7xl mx-auto px-4 md:px-8 py-8">
      <h1 class="font-display text-3xl text-primary mb-2">Marketing</h1>
      <p class="text-secondary text-sm mb-6">Campaigns, automation, and analytics</p>
      <div class="bg-white rounded-2xl border border-on-surface/10 p-6 mb-6">
        <h2 class="font-display text-lg text-primary mb-4">Campaigns</h2>
        <div id="campaigns-list">${loadingSpinner()}</div>
      </div>
    </div>`;
  },
  async mount() {
    const el = document.getElementById('campaigns-list');
    try {
      const res = await api.get('/campaigns');
      const campaigns = res.data || [];
      if (campaigns.length === 0) { el.innerHTML = emptyState('📢', 'No campaigns', 'Create your first marketing campaign.'); return; }
      el.innerHTML = `<div class="space-y-3">${campaigns.map(c => `
        <div class="flex items-center justify-between py-3 border-b border-on-surface/5 last:border-0">
          <div><p class="font-medium text-sm text-primary">${esc(c.name)}</p><p class="text-xs text-secondary">${esc(c.type || c.channel || '')} · ${c.recipientCount || 0} recipients</p></div>
          <span class="badge badge-${c.status === 'ACTIVE' ? 'success' : c.status === 'DRAFT' ? 'neutral' : 'info'}">${c.status || 'DRAFT'}</span>
        </div>
      `).join('')}</div>`;
    } catch { el.innerHTML = errorState('Failed to load campaigns.'); }
  },
  cleanup() {},
});
