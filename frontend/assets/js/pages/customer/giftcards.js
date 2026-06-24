router.add('customer/giftcards', {
  async render() {
    const user = store.get('user');
    if (!user) { router.navigate('auth/login'); return ''; }
    return `<div class="max-w-4xl mx-auto px-4 md:px-8 py-8"><h1 class="font-display text-3xl text-primary mb-2">Gift Cards</h1><p class="text-secondary text-sm mb-8">Manage your gift card balance</p><div id="giftcards-content">${loadingSpinner()}</div></div>`;
  },
  async mount() {
    const el = document.getElementById('giftcards-content');
    try {
      const res = await api.get('/giftcards');
      const cards = res.data || [];
      if (cards.length === 0) {
        el.innerHTML = `${emptyState('🎴', 'No gift cards', 'Redeem a gift card code below.')}
        <div class="max-w-md mx-auto mt-6"><div class="bg-white rounded-2xl border border-on-surface/10 p-6"><h2 class="font-display text-lg text-primary mb-4">Redeem Gift Card</h2><div class="flex gap-3"><input type="text" id="gc-redeem-input" placeholder="Enter gift card code" class="flex-1 px-4 py-3 border border-on-surface/20 rounded-lg text-sm bg-surface"><button id="gc-redeem-btn" class="bg-primary text-on-primary px-5 py-3 rounded-lg text-sm font-medium hover:opacity-90 transition-500">Redeem</button></div><div id="gc-result" class="mt-3"></div></div></div>`;
        document.getElementById('gc-redeem-btn').addEventListener('click', async () => {
          const code = document.getElementById('gc-redeem-input').value.trim();
          if (!code) return;
          try { const r = await api.post('/giftcards/redeem', { code }); document.getElementById('gc-result').innerHTML = `<p class="text-green-700 text-sm">✅ Balance: ${formatCurrency(r.data?.balance || 0)}</p>`; toast.success('Gift card redeemed!'); } catch (err) { document.getElementById('gc-result').innerHTML = `<p class="text-red-600 text-sm">❌ ${err.message || 'Invalid code'}</p>`; }
        });
        return;
      }
      el.innerHTML = `<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">${cards.map(c => `
        <div class="bg-white rounded-2xl border border-on-surface/10 p-5 card-hover">
          <div class="flex justify-between items-start mb-3"><h3 class="font-medium text-primary">Gift Card</h3><span class="badge ${c.status === 'ACTIVE' ? 'badge-success' : 'badge-neutral'}">${c.status}</span></div>
          <p class="text-2xl font-bold text-primary mb-1">${formatCurrency(c.balance || 0)}</p>
          <p class="text-xs text-secondary">Code: ${c.code}</p>
          ${c.expiresAt ? `<p class="text-xs text-secondary mt-2">Expires: ${formatDate(c.expiresAt)}</p>` : ''}
        </div>
      `).join('')}</div>
      <div class="bg-white rounded-2xl border border-on-surface/10 p-6"><h2 class="font-display text-lg text-primary mb-4">Purchase a Gift Card</h2>
        <div class="flex gap-3"><input type="number" id="gc-purchase-amount" placeholder="Amount" min="100" class="w-40 px-4 py-3 border border-on-surface/20 rounded-lg text-sm bg-surface"><button id="gc-purchase-btn" class="bg-primary text-on-primary px-6 py-3 rounded-lg text-sm font-medium hover:opacity-90 transition-500">Buy Gift Card</button></div>
        <div id="gc-purchase-result" class="mt-3"></div>
      </div>`;
      document.getElementById('gc-purchase-btn').addEventListener('click', async () => {
        const amount = parseInt(document.getElementById('gc-purchase-amount').value);
        if (!amount || amount < 100) { toast.error('Minimum amount is ₹100'); return; }
        try { const r = await api.post('/giftcards', { amount }); toast.success(`Gift card purchased! Code: ${r.data?.code || ''}`); router.navigate('customer/giftcards'); } catch (err) { toast.error(err.message || 'Purchase failed.'); }
      });
    } catch { el.innerHTML = errorState('Failed to load gift cards.'); }
  },
  cleanup() {},
});
