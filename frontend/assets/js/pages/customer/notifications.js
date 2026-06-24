router.add('customer/notifications', {
  async render() {
    const user = store.get('user');
    if (!user) { router.navigate('auth/login'); return ''; }
    return `
    <div class="max-w-4xl mx-auto px-4 md:px-8 py-8">
      <div class="flex justify-between items-center mb-8"><div><h1 class="font-display text-3xl text-primary">Notifications</h1><p class="text-secondary text-sm mt-1">Stay updated with your orders and offers</p></div><button id="mark-all-read" class="text-sm text-secondary hover:text-primary transition-500">Mark all as read</button></div>
      <div id="notifications-list">${loadingSpinner()}</div>
    </div>`;
  },
  async mount() {
    const el = document.getElementById('notifications-list');
    async function load() {
      try {
        const res = await api.get('/notifications');
        const notifs = res.data || [];
        if (notifs.length === 0) { el.innerHTML = emptyState('🔔', 'No notifications', 'You\'re all caught up!'); return; }
        el.innerHTML = `<div class="space-y-2">${notifs.map(n => `
          <div class="bg-white rounded-xl border border-on-surface/10 p-4 flex items-start gap-4 ${n.isRead ? '' : 'border-l-4 border-l-primary'}">
            <div class="flex-1"><p class="text-sm font-medium">${esc(n.title || n.message || 'Notification')}</p><p class="text-xs text-secondary mt-1">${formatDateTime(n.createdAt)}</p></div>
            ${!n.isRead ? `<button class="mark-read text-xs text-primary hover:underline" data-id="${n.id}">Mark read</button>` : ''}
          </div>
        `).join('')}</div>`;
        el.querySelectorAll('.mark-read').forEach(btn => {
          btn.addEventListener('click', async () => {
            try { await api.patch(`/notifications/${btn.dataset.id}/read`); btn.closest('.border-l-4').classList.remove('border-l-4', 'border-l-primary'); btn.remove(); } catch {}
          });
        });
      } catch { el.innerHTML = errorState('Failed to load notifications.'); }
    }
    document.getElementById('mark-all-read').addEventListener('click', async () => {
      try { await api.post('/notifications/read-all'); toast.success('All marked as read'); load(); } catch {}
    });
    await load();
  },
  cleanup() {},
});
