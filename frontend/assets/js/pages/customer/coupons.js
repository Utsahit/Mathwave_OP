router.add('customer/coupons', {
  async render() {
    const user = store.get('user');
    if (!user) { router.navigate('auth/login'); return ''; }
    return `<div class="max-w-4xl mx-auto px-4 md:px-8 py-8"><h1 class="font-display text-3xl text-primary mb-2">My Coupons</h1><p class="text-secondary text-sm mb-8">Available discounts and offers</p><div id="coupons-list">${loadingSpinner()}</div></div>`;
  },
  async mount() {
    const el = document.getElementById('coupons-list');
    try {
      const res = await api.get('/coupons');
      const coupons = res.data || [];
      if (coupons.length === 0) { el.innerHTML = emptyState('🏷️', 'No coupons available', 'Check back for new offers!'); return; }
      el.innerHTML = `<div class="grid grid-cols-1 md:grid-cols-2 gap-4">${coupons.map(c => `
        <div class="bg-white rounded-2xl border border-on-surface/10 p-5 card-hover">
          <div class="flex justify-between items-start mb-2"><h3 class="font-bold text-primary text-lg">${esc(c.code)}</h3><span class="badge ${c.isActive ? 'badge-success' : 'badge-neutral'}">${c.isActive ? 'Active' : 'Expired'}</span></div>
          <p class="text-sm text-secondary mb-1">${esc(c.description || '')}</p>
          <p class="text-sm font-medium text-primary">${c.discountType === 'PERCENTAGE' ? `${c.discountValue}% off` : formatCurrency(c.discountValue)} ${c.minOrder ? `· Min: ${formatCurrency(c.minOrder)}` : ''}</p>
          ${c.expiresAt ? `<p class="text-xs text-secondary mt-2">Expires: ${formatDate(c.expiresAt)}</p>` : ''}
        </div>
      `).join('')}</div>`;
    } catch { el.innerHTML = errorState('Failed to load coupons.'); }
  },
  cleanup() {},
});
