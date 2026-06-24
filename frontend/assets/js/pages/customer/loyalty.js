router.add('customer/loyalty', {
  async render() {
    const user = store.get('user');
    if (!user) { router.navigate('auth/login'); return ''; }
    return `<div class="max-w-4xl mx-auto px-4 md:px-8 py-8"><h1 class="font-display text-3xl text-primary mb-2">Loyalty & Rewards</h1><p class="text-secondary text-sm mb-8">Your points and membership benefits</p><div id="loyalty-content">${loadingSpinner()}</div></div>`;
  },
  async mount() {
    const el = document.getElementById('loyalty-content');
    try {
      const [ptsRes, histRes, refRes] = await Promise.allSettled([
        api.get('/loyalty/points'),
        api.get('/loyalty/history'),
        api.get('/referrals'),
      ]);
      const pts = ptsRes.status === 'fulfilled' ? (ptsRes.value.data || {}) : {};
      const history = histRes.status === 'fulfilled' ? (histRes.value.data || []) : [];
      const referrals = refRes.status === 'fulfilled' ? (refRes.value.data || []) : [];
      const tiers = [
        { name: 'Bronze', min: 0, color: 'bg-amber-600' },
        { name: 'Silver', min: 500, color: 'bg-gray-400' },
        { name: 'Gold', min: 1500, color: 'bg-yellow-500' },
        { name: 'Platinum', min: 5000, color: 'bg-purple-600' },
      ];
      const currentTier = tiers.filter(t => (pts.points || 0) >= t.min).pop() || tiers[0];
      const nextTier = tiers[tiers.indexOf(currentTier) + 1];
      el.innerHTML = `
        <div class="grid md:grid-cols-3 gap-6 mb-8">
          <div class="bg-white rounded-2xl border border-on-surface/10 p-6 text-center">
            <p class="text-4xl font-bold text-primary mb-1">${pts.points || 0}</p>
            <p class="text-sm text-secondary">Points Balance</p>
          </div>
          <div class="bg-white rounded-2xl border border-on-surface/10 p-6 text-center">
            <span class="inline-block px-4 py-1 rounded-full text-sm font-medium text-white ${currentTier.color} mb-2">${currentTier.name}</span>
            <p class="text-sm text-secondary">Current Tier</p>
            ${nextTier ? `<p class="text-xs text-secondary mt-2">${nextTier.min - (pts.points || 0)} pts to ${nextTier.name}</p>` : '<p class="text-xs text-amber-600 mt-2">Highest tier reached! 🎉</p>'}
          </div>
          <div class="bg-white rounded-2xl border border-on-surface/10 p-6 text-center">
            <p class="text-4xl font-bold text-primary mb-1">${referrals.length || 0}</p>
            <p class="text-sm text-secondary">Referrals</p>
          </div>
        </div>
        <div class="grid md:grid-cols-2 gap-6 mb-8">
          <div class="bg-white rounded-2xl border border-on-surface/10 p-6">
            <h2 class="font-display text-lg text-primary mb-4">Points History</h2>
            ${history.length === 0 ? emptyState('⭐', 'No history yet', 'Earn points with every order!') : `<div class="space-y-2">${history.slice(0, 10).map(h => `<div class="flex justify-between items-center py-2 border-b border-on-surface/5 last:border-0"><span class="text-sm">${esc(h.description || 'Activity')}</span><span class="text-sm font-medium ${h.points > 0 ? 'text-green-600' : 'text-red-600'}">${h.points > 0 ? '+' : ''}${h.points}</span></div>`).join('')}</div>`}
          </div>
          <div class="bg-white rounded-2xl border border-on-surface/10 p-6">
            <h2 class="font-display text-lg text-primary mb-4">Referral Program</h2>
            <p class="text-sm text-secondary mb-4">Share your referral link and earn points when friends join!</p>
            <div class="flex gap-2"><input type="text" id="referral-link" readonly class="flex-1 px-4 py-2.5 border border-on-surface/20 rounded-lg text-sm bg-surface text-secondary" value="${pts.referralLink || ''}"><button id="copy-ref" class="bg-primary text-on-primary px-4 py-2.5 rounded-lg text-sm hover:opacity-90">Copy</button></div>
            <p class="text-xs text-secondary mt-2">${pts.referralPoints || 0} points earned from referrals</p>
          </div>
        </div>
        <div class="bg-white rounded-2xl border border-on-surface/10 p-6">
          <h2 class="font-display text-lg text-primary mb-4">Available Rewards</h2>
          <div id="rewards-list">${loadingSpinner()}</div>
        </div>`;
      document.getElementById('copy-ref')?.addEventListener('click', () => {
        const inp = document.getElementById('referral-link');
        if (inp.value) { navigator.clipboard.writeText(inp.value).then(() => toast.success('Link copied!')).catch(() => {}); }
      });
      try {
        const rewRes = await api.get('/loyalty/rewards');
        const rewards = rewRes.data || [];
        const rewEl = document.getElementById('rewards-list');
        if (rewards.length === 0) rewEl.innerHTML = emptyState('🎁', 'No rewards available', 'Check back soon!');
        else rewEl.innerHTML = `<div class="grid grid-cols-1 md:grid-cols-3 gap-4">${rewards.map(r => `
          <div class="border border-on-surface/10 rounded-xl p-4 text-center card-hover"><p class="text-2xl mb-2">${r.icon || '🎁'}</p><p class="font-medium text-sm">${esc(r.name)}</p><p class="text-xs text-secondary mb-3">${r.pointsRequired} points</p><button class="redeem-btn text-sm bg-primary text-on-primary px-4 py-2 rounded-lg hover:opacity-90 transition-500 disabled:opacity-50" data-id="${r.id}" ${(pts.points || 0) < r.pointsRequired ? 'disabled' : ''}>${(pts.points || 0) >= r.pointsRequired ? 'Redeem' : 'Not enough points'}</button></div>
        `).join('')}</div>`;
        rewEl.querySelectorAll('.redeem-btn:not([disabled])').forEach(btn => {
          btn.addEventListener('click', async () => {
            try { await api.post('/loyalty/redeem', { rewardId: btn.dataset.id }); toast.success('Reward redeemed!'); router.navigate('customer/loyalty'); }
            catch (err) { toast.error(err.message || 'Redemption failed.'); }
          });
        });
      } catch {}
    } catch { el.innerHTML = errorState('Failed to load loyalty data.'); }
  },
  cleanup() {},
});
