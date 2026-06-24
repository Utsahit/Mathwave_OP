router.add('customer/recommendations', {
  async render() {
    return `<div class="max-w-5xl mx-auto px-4 md:px-8 py-8"><h1 class="font-display text-3xl text-primary mb-2">Recommended For You</h1><p class="text-secondary text-sm mb-8">Personalized suggestions based on your taste</p><div id="recommendations-list">${loadingSpinner()}</div></div>`;
  },
  async mount() {
    const el = document.getElementById('recommendations-list');
    try {
      const res = await api.get('/recommendations');
      let items = res.data || [];
      if (!Array.isArray(items)) items = items.items || [];
      if (items.length === 0) { el.innerHTML = emptyState('🤖', 'No recommendations yet', 'Order some items to get personalized suggestions!'); return; }
      el.innerHTML = `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">${items.map(item => `
        <div class="bg-white rounded-2xl border border-on-surface/10 p-5 card-hover">
          <div class="flex justify-between items-start mb-2"><h3 class="font-medium text-primary">${esc(item.name || item.menuItemName || 'Item')}</h3><span class="text-primary font-bold">${formatCurrency(item.price || 0)}</span></div>
          <p class="text-sm text-secondary mb-3">${esc(item.description || item.category || '')}</p>
          <button class="add-cart-rec text-sm bg-primary text-on-primary px-4 py-2 rounded-lg hover:opacity-90 transition-500" data-id="${item.id || item.menuItemId}" data-name="${esc(item.name || 'Item')}" data-price="${item.price || 0}">Add to Cart</button>
        </div>
      `).join('')}</div>`;
      el.querySelectorAll('.add-cart-rec').forEach(btn => {
        btn.addEventListener('click', () => {
          const cart = store.get('cart') || [];
          const existing = cart.find(c => c.id === btn.dataset.id);
          if (existing) existing.quantity = (existing.quantity || 1) + 1;
          else cart.push({ id: btn.dataset.id, name: btn.dataset.name, price: parseFloat(btn.dataset.price), quantity: 1 });
          store.set('cart', cart);
          toast.success('Added to cart');
        });
      });
    } catch { el.innerHTML = errorState('Failed to load recommendations.'); }
  },
  cleanup() {},
});
