router.add('admin/menu-management', {
  async render() {
    const user = store.get('user');
    if (!user || (user.role !== 'ADMIN' && user.role !== 'MANAGER')) { router.navigate('customer/menu'); return ''; }
    return `
    <div class="max-w-7xl mx-auto px-4 md:px-8 py-8">
      <div class="flex justify-between items-center mb-8"><div><h1 class="font-display text-3xl text-primary">Menu Management</h1><p class="text-secondary text-sm mt-1">Add, edit, and manage menu items</p></div><button id="new-menu-item" class="bg-primary text-on-primary px-5 py-2.5 rounded-lg font-medium text-sm hover:opacity-90 transition-500">+ New Item</button></div>
      <div id="menu-items-list">${loadingSpinner()}</div>
    </div>
    <div id="menu-modal" class="fixed inset-0 z-50 bg-black/40 flex items-center justify-center hidden p-4">
      <div class="bg-white rounded-2xl p-6 md:p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto" onclick="event.stopPropagation()">
        <div class="flex justify-between items-center mb-6"><h2 class="font-display text-xl text-primary" id="menu-modal-title">Add Menu Item</h2><button onclick="document.getElementById('menu-modal').classList.add('hidden')" class="text-secondary text-xl">✕</button></div>
        <form id="menu-form" class="space-y-4">
          <input type="hidden" id="menu-item-id">
          <div><label class="block text-sm font-medium mb-1">Name</label><input type="text" id="menu-name" required class="w-full px-4 py-3 border border-on-surface/20 rounded-lg text-sm bg-surface"></div>
          <div><label class="block text-sm font-medium mb-1">Description</label><textarea id="menu-desc" rows="2" class="w-full px-4 py-3 border border-on-surface/20 rounded-lg text-sm bg-surface"></textarea></div>
          <div><label class="block text-sm font-medium mb-1">Price (₹)</label><input type="number" id="menu-price" required min="0" step="0.01" class="w-full px-4 py-3 border border-on-surface/20 rounded-lg text-sm bg-surface"></div>
          <div><label class="block text-sm font-medium mb-1">Category</label><input type="text" id="menu-category" class="w-full px-4 py-3 border border-on-surface/20 rounded-lg text-sm bg-surface" placeholder="e.g., Starters, Main Course, Desserts"></div>
          <div><label class="block text-sm font-medium mb-1">Image URL</label><input type="text" id="menu-image" class="w-full px-4 py-3 border border-on-surface/20 rounded-lg text-sm bg-surface"></div>
          <label class="flex items-center gap-2 text-sm"><input type="checkbox" id="menu-available" checked class="accent-primary"> Available for ordering</label>
          <button type="submit" class="w-full bg-primary text-on-primary py-3.5 rounded-lg font-medium text-sm hover:opacity-90 transition-500" id="menu-submit">Save</button>
        </form>
      </div>
    </div>`;
  },
  async mount() {
    const el = document.getElementById('menu-items-list');
    async function load() {
      try {
        const res = await api.get('/menu/public');
        const items = res.data || [];
        el.innerHTML = `<div class="bg-white rounded-2xl border border-on-surface/10 overflow-hidden"><table class="data-table w-full"><thead><tr><th>Name</th><th>Category</th><th>Price</th><th>Status</th><th class="text-right">Actions</th></tr></thead><tbody>${items.map(item => `
          <tr><td class="font-medium">${esc(item.name)}</td><td><span class="badge badge-gold">${esc(item.category || 'General')}</span></td><td>${formatCurrency(item.price)}</td><td><span class="badge ${item.isAvailable ? 'badge-success' : 'badge-danger'}">${item.isAvailable ? 'Available' : 'Unavailable'}</span></td>
          <td class="text-right"><button class="edit-menu text-secondary hover:text-primary transition-500 text-sm mr-2" data-id="${item.id}">✏️</button><button class="del-menu text-red-500 hover:text-red-700 transition-500 text-sm" data-id="${item.id}">🗑️</button></td></tr>
        `).join('')}</tbody></table></div>`;
        el.querySelectorAll('.edit-menu').forEach(btn => {
          btn.addEventListener('click', async () => {
            try { const r = await api.get(`/menu/${btn.dataset.id}`); const m = r.data || {}; openModal(m); } catch {}
          });
        });
        el.querySelectorAll('.del-menu').forEach(btn => {
          btn.addEventListener('click', async () => {
            if (!confirm('Delete this item?')) return;
            try { await api.delete(`/menu/${btn.dataset.id}`); toast.success('Deleted'); load(); } catch { toast.error('Failed to delete'); }
          });
        });
      } catch { el.innerHTML = errorState('Failed to load menu.'); }
    }
    function openModal(item) {
      const modal = document.getElementById('menu-modal');
      document.getElementById('menu-modal-title').textContent = item.id ? 'Edit Menu Item' : 'Add Menu Item';
      document.getElementById('menu-item-id').value = item.id || '';
      document.getElementById('menu-name').value = item.name || '';
      document.getElementById('menu-desc').value = item.description || '';
      document.getElementById('menu-price').value = item.price || '';
      document.getElementById('menu-category').value = item.category || '';
      document.getElementById('menu-image').value = item.image || '';
      document.getElementById('menu-available').checked = item.isAvailable !== false;
      modal.classList.remove('hidden');
    }
    document.getElementById('new-menu-item').addEventListener('click', () => openModal({}));
    document.getElementById('menu-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('menu-submit');
      btn.disabled = true; btn.textContent = 'Saving...';
      const id = document.getElementById('menu-item-id').value;
      const data = {
        name: document.getElementById('menu-name').value,
        description: document.getElementById('menu-desc').value,
        price: parseFloat(document.getElementById('menu-price').value),
        category: document.getElementById('menu-category').value,
        image: document.getElementById('menu-image').value,
        isAvailable: document.getElementById('menu-available').checked,
      };
      try {
        if (id) await api.put(`/menu/${id}`, data);
        else await api.post('/menu', data);
        toast.success(id ? 'Updated' : 'Created');
        document.getElementById('menu-modal').classList.add('hidden');
        load();
      } catch (err) { toast.error(err.message || 'Failed to save.'); }
      finally { btn.disabled = false; btn.textContent = 'Save'; }
    });
    await load();
  },
  cleanup() {},
});
