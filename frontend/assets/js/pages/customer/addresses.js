router.add('customer/addresses', {
  async render() {
    const user = store.get('user');
    if (!user) { router.navigate('auth/login'); return ''; }
    return `
    <div class="max-w-4xl mx-auto px-4 md:px-8 py-8">
      <div class="flex justify-between items-center mb-8"><div><h1 class="font-display text-3xl text-primary">My Addresses</h1><p class="text-secondary text-sm mt-1">Manage your delivery addresses</p></div><button id="new-addr-btn" class="bg-primary text-on-primary px-5 py-2.5 rounded-lg font-medium text-sm hover:opacity-90 transition-500">+ Add Address</button></div>
      <div id="addresses-list">${loadingSpinner()}</div>
      <div id="address-modal" class="fixed inset-0 z-50 bg-black/40 flex items-center justify-center hidden p-4">
        <div class="bg-white rounded-2xl p-6 md:p-8 max-w-lg w-full" onclick="event.stopPropagation()">
          <div class="flex justify-between items-center mb-6"><h2 class="font-display text-xl text-primary" id="address-modal-title">Add Address</h2><button onclick="document.getElementById('address-modal').classList.add('hidden')" class="text-secondary text-xl">✕</button></div>
          <form id="address-form" class="space-y-3">
            <input type="hidden" id="addr-id">
            <div><label class="block text-sm font-medium mb-1">Label</label><input type="text" id="addr-label" placeholder="Home, Office, etc." class="w-full px-4 py-3 border border-on-surface/20 rounded-lg text-sm bg-surface"></div>
            <div><label class="block text-sm font-medium mb-1">Street</label><input type="text" id="addr-street" required class="w-full px-4 py-3 border border-on-surface/20 rounded-lg text-sm bg-surface"></div>
            <div class="grid grid-cols-2 gap-3">
              <div><label class="block text-sm font-medium mb-1">City</label><input type="text" id="addr-city" required class="w-full px-4 py-3 border border-on-surface/20 rounded-lg text-sm bg-surface"></div>
              <div><label class="block text-sm font-medium mb-1">State</label><input type="text" id="addr-state" class="w-full px-4 py-3 border border-on-surface/20 rounded-lg text-sm bg-surface"></div>
            </div>
            <div><label class="block text-sm font-medium mb-1">ZIP Code</label><input type="text" id="addr-zip" class="w-full px-4 py-3 border border-on-surface/20 rounded-lg text-sm bg-surface"></div>
            <label class="flex items-center gap-2 text-sm"><input type="checkbox" id="addr-default" class="accent-primary"> Set as default</label>
            <button type="submit" class="w-full bg-primary text-on-primary py-3 rounded-lg font-medium text-sm hover:opacity-90 transition-500" id="addr-submit">Save Address</button>
          </form>
        </div>
      </div>
    </div>`;
  },
  async mount() {
    const el = document.getElementById('addresses-list');
    async function load() {
      try {
        const res = await api.get('/addresses');
        const addrs = res.data || [];
        if (addrs.length === 0) { el.innerHTML = emptyState('📍', 'No addresses saved', 'Add an address for delivery.'); return; }
        el.innerHTML = `<div class="grid grid-cols-1 md:grid-cols-2 gap-4">${addrs.map(a => `
          <div class="bg-white rounded-2xl border border-on-surface/10 p-5 ${a.isDefault ? 'ring-2 ring-primary/20' : ''}">
            <div class="flex justify-between items-start mb-2"><h3 class="font-medium text-primary">${esc(a.label || 'Address')} ${a.isDefault ? '<span class="text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-full">Default</span>' : ''}</h3><div class="flex gap-2"><button class="edit-addr text-secondary hover:text-primary transition-500 text-sm" data-id="${a.id}">✏️</button><button class="del-addr text-red-500 hover:text-red-700 transition-500 text-sm" data-id="${a.id}">🗑️</button></div></div>
            <p class="text-sm text-secondary">${esc([a.street, a.city, a.state, a.zip].filter(Boolean).join(', '))}</p>
          </div>
        `).join('')}</div>`;
        el.querySelectorAll('.edit-addr').forEach(btn => {
          btn.addEventListener('click', async () => {
            try { const r = await api.get(`/addresses/${btn.dataset.id}`); const a = r.data || {}; openModal(a); } catch {}
          });
        });
        el.querySelectorAll('.del-addr').forEach(btn => {
          btn.addEventListener('click', async () => {
            if (!confirm('Delete this address?')) return;
            try { await api.delete(`/addresses/${btn.dataset.id}`); toast.success('Address deleted'); load(); }
            catch { toast.error('Failed to delete'); }
          });
        });
      } catch { el.innerHTML = errorState('Failed to load addresses.'); }
    }
    function openModal(addr) {
      const modal = document.getElementById('address-modal');
      document.getElementById('address-modal-title').textContent = addr.id ? 'Edit Address' : 'Add Address';
      document.getElementById('addr-id').value = addr.id || '';
      document.getElementById('addr-label').value = addr.label || '';
      document.getElementById('addr-street').value = addr.street || '';
      document.getElementById('addr-city').value = addr.city || '';
      document.getElementById('addr-state').value = addr.state || '';
      document.getElementById('addr-zip').value = addr.zip || '';
      document.getElementById('addr-default').checked = addr.isDefault || false;
      modal.classList.remove('hidden');
    }
    document.getElementById('new-addr-btn').addEventListener('click', () => openModal({}));
    document.getElementById('address-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('addr-submit');
      btn.disabled = true; btn.textContent = 'Saving...';
      const id = document.getElementById('addr-id').value;
      const data = {
        label: document.getElementById('addr-label').value,
        street: document.getElementById('addr-street').value,
        city: document.getElementById('addr-city').value,
        state: document.getElementById('addr-state').value,
        zip: document.getElementById('addr-zip').value,
        isDefault: document.getElementById('addr-default').checked,
      };
      try {
        if (id) await api.put(`/addresses/${id}`, data);
        else await api.post('/addresses', data);
        toast.success(id ? 'Address updated' : 'Address added');
        document.getElementById('address-modal').classList.add('hidden');
        load();
      } catch (err) { toast.error(err.message || 'Failed to save address.'); }
      finally { btn.disabled = false; btn.textContent = 'Save Address'; }
    });
    await load();
  },
  cleanup() {},
});
