router.add('customer/menu', {
  async render() {
    return `
    <div class="max-w-7xl mx-auto px-4 md:px-8 py-8">
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div><h1 class="font-display text-3xl text-primary">Our Menu</h1><p class="text-secondary text-sm mt-1">Discover our curated selection</p></div>
        <div class="flex gap-3"><input type="text" id="menu-search" placeholder="Search menu..." class="px-4 py-2.5 border border-on-surface/20 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none w-full md:w-64"></div>
      </div>
      <div id="menu-categories" class="flex flex-wrap gap-2 mb-8"></div>
      <div id="menu-items">${loadingSpinner()}</div>
    </div>`;
  },
  async mount() {
    const catsEl = document.getElementById('menu-categories');
    const itemsEl = document.getElementById('menu-items');
    let allItems = [];
    let activeCat = 'all';
    async function loadMenu() {
      try {
        const data = await api.get('/menu/public');
        allItems = data.data || [];
        renderCategories();
        renderItems();
      } catch {
        itemsEl.innerHTML = errorState('Could not load menu. Please try again.');
      }
    }
    function renderCategories() {
      const cats = ['all', ...new Set(allItems.map(i => i.category).filter(Boolean))];
      catsEl.innerHTML = cats.map(c => `<button class="filter-btn px-5 py-2 rounded-full text-sm font-medium border border-on-surface/20 ${c === activeCat ? 'active bg-primary text-on-primary' : 'text-secondary hover:bg-surface-container-high'}" data-cat="${c}">${c === 'all' ? 'All' : c}</button>`).join('');
      catsEl.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          activeCat = btn.dataset.cat;
          catsEl.querySelectorAll('.filter-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.cat === activeCat);
            b.classList.toggle('bg-primary', b.dataset.cat === activeCat);
            b.classList.toggle('text-on-primary', b.dataset.cat === activeCat);
          });
          renderItems();
        });
      });
    }
    function renderItems() {
      const query = (document.getElementById('menu-search').value || '').toLowerCase();
      let filtered = allItems;
      if (activeCat !== 'all') filtered = filtered.filter(i => i.category === activeCat);
      if (query) filtered = filtered.filter(i => (i.name || '').toLowerCase().includes(query) || (i.description || '').toLowerCase().includes(query));
      if (filtered.length === 0) {
        itemsEl.innerHTML = emptyState('🍽️', 'No items found', 'Try adjusting your search or filter.');
        return;
      }
      itemsEl.innerHTML = `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">${filtered.map(item => `
        <div class="bg-white rounded-2xl border border-on-surface/10 overflow-hidden card-hover">
          <div class="p-6">
            <div class="flex justify-between items-start mb-2">
              <h3 class="font-display text-lg text-primary">${esc(item.name)}</h3>
              <span class="text-primary font-bold text-lg">${formatCurrency(item.price)}</span>
            </div>
            <p class="text-sm text-secondary mb-4 line-clamp-2">${esc(item.description || '')}</p>
            <div class="flex items-center justify-between">
              <span class="text-xs text-secondary bg-surface-container-high px-2.5 py-1 rounded-full">${esc(item.category || 'General')}</span>
              <button class="add-cart-btn text-sm bg-primary text-on-primary px-4 py-2 rounded-lg hover:opacity-90 transition-500" data-id="${item.id}" data-name="${esc(item.name)}" data-price="${item.price}">Add to Cart</button>
            </div>
          </div>
        </div>
      `).join('')}</div>`;
      itemsEl.querySelectorAll('.add-cart-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const cart = store.get('cart') || [];
          const existing = cart.find(c => c.id === btn.dataset.id);
          if (existing) {
            existing.quantity = (existing.quantity || 1) + 1;
          } else {
            cart.push({ id: btn.dataset.id, name: btn.dataset.name, price: parseFloat(btn.dataset.price), quantity: 1 });
          }
          store.set('cart', cart);
          toast.success(`${btn.dataset.name} added to cart`);
        });
      });
    }
    document.getElementById('menu-search').addEventListener('input', renderItems);
    await loadMenu();
  },
  cleanup() {},
});
