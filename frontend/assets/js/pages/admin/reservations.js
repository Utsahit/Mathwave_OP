router.add('admin/reservations', {
  async render() {
    const user = store.get('user');
    if (!user || (user.role !== 'ADMIN' && user.role !== 'MANAGER')) { router.navigate('customer/menu'); return ''; }
    return `<div class="max-w-7xl mx-auto px-4 md:px-8 py-8"><h1 class="font-display text-3xl text-primary mb-2">Reservations</h1><p class="text-secondary text-sm mb-6">Manage table bookings</p><div id="admin-reservations-list">${loadingSpinner()}</div></div>`;
  },
  async mount() {
    const el = document.getElementById('admin-reservations-list');
    async function load() {
      try {
        const res = await api.get('/reservations');
        const reservations = res.data || [];
        el.innerHTML = `<div class="bg-white rounded-2xl border border-on-surface/10 overflow-hidden"><table class="data-table w-full"><thead><tr><th>Name</th><th>Date</th><th>Time</th><th>Guests</th><th>Status</th><th>Phone</th><th class="text-right">Actions</th></tr></thead><tbody>${reservations.length === 0 ? '<tr><td colspan="7" class="text-center text-secondary py-8">No reservations</td></tr>' : reservations.map(r => `
          <tr><td class="font-medium">${esc(r.name || '—')}</td><td>${formatDate(r.date)}</td><td>${formatTime(r.time)}</td><td>${r.guests}</td><td><span class="badge badge-${r.status === 'CONFIRMED' ? 'success' : r.status === 'PENDING' ? 'warning' : r.status === 'CANCELLED' ? 'danger' : 'neutral'}">${r.status}</span></td><td class="text-sm">${esc(r.phone || '—')}</td>
          <td class="text-right"><select class="res-status text-xs border border-on-surface/20 rounded-lg px-2 py-1.5 bg-surface" data-id="${r.id}">${['PENDING','CONFIRMED','CANCELLED','COMPLETED'].map(s => `<option value="${s}" ${s === r.status ? 'selected' : ''}>${s}</option>`).join('')}</select></td></tr>
        `).join('')}</tbody></table></div>`;
        el.querySelectorAll('.res-status').forEach(sel => {
          sel.addEventListener('change', async () => {
            try { await api.patch(`/reservations/${sel.dataset.id}/status`, { status: sel.value }); toast.success('Updated'); } catch { toast.error('Failed'); }
          });
        });
      } catch { el.innerHTML = errorState('Failed to load reservations.'); }
    }
    await load();
  },
  cleanup() {},
});
