router.add('customer/favorites', {
  async render() {
    const user = store.get('user');
    if (!user) { router.navigate('auth/login'); return ''; }
    return `<div class="max-w-5xl mx-auto px-4 md:px-8 py-8"><h1 class="font-display text-3xl text-primary mb-2">My Favorites</h1><p class="text-secondary text-sm mb-8">Your saved menu items</p><div id="favorites-list">${loadingSpinner()}</div></div>`;
  },
  async mount() {
    const el = document.getElementById('favorites-list');
    try {
      const res = await api.get('/favorites');
      const favs = res.data || [];
      if (favs.length === 0) { el.innerHTML = emptyState('❤️', 'No favorites yet', 'Save items you love from our menu!'); return; }
      el.innerHTML = `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">${favs.map(f => `
        <div class="bg-white rounded-2xl border border-on-surface/10 p-5 card-hover">
          <div class="flex justify-between items-start mb-2"><h3 class="font-medium text-primary">${esc(f.menuItemName || f.name || 'Item')}</h3><button class="remove-fav text-red-400 hover:text-red-600 transition-500 text-lg" data-id="${f.id}">❤️</button></div>
          <p class="text-sm text-secondary mb-3">${formatCurrency(f.price || 0)}</p>
          <button class="add-cart-fav text-sm bg-primary text-on-primary px-4 py-2 rounded-lg hover:opacity-90 transition-500" data-id="${f.menuItemId}" data-name="${esc(f.menuItemName || 'Item')}" data-price="${f.price || 0}">Add to Cart</button>
        </div>
      `).join('')}</div>`;
      el.querySelectorAll('.remove-fav').forEach(btn => {
        btn.addEventListener('click', async () => {
          try { await api.delete(`/favorites/${btn.dataset.id}`); toast.success('Removed from favorites'); btn.closest('.card-hover').remove(); }
          catch { toast.error('Failed to remove'); }
        });
      });
      el.querySelectorAll('.add-cart-fav').forEach(btn => {
        btn.addEventListener('click', () => {
          const cart = store.get('cart') || [];
          const existing = cart.find(c => c.id === btn.dataset.id);
          if (existing) existing.quantity = (existing.quantity || 1) + 1;
          else cart.push({ id: btn.dataset.id, name: btn.dataset.name, price: parseFloat(btn.dataset.price), quantity: 1 });
          store.set('cart', cart);
          toast.success(`${btn.dataset.name} added to cart`);
        });
      });
    } catch { el.innerHTML = errorState('Failed to load favorites.'); }
  },
  cleanup() {},
});
