router.add('admin/audit-logs', {
  async render() {
    const user = store.get('user');
    if (!user || (user.role !== 'ADMIN' && user.role !== 'MANAGER')) { router.navigate('customer/menu'); return ''; }
    return `
    <div class="max-w-7xl mx-auto px-4 md:px-8 py-8">
      <h1 class="font-display text-3xl text-primary mb-2">Audit Logs</h1>
      <p class="text-secondary text-sm mb-6">Track all system activity</p>
      <div class="flex gap-3 mb-6"><input type="text" id="audit-search" placeholder="Search actions, users..." class="flex-1 px-4 py-2.5 border border-on-surface/20 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none max-w-md"><button id="audit-refresh" class="bg-primary text-on-primary px-5 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition-500">Refresh</button></div>
      <div id="audit-logs-content">${loadingSpinner()}</div>
    </div>`;
  },
  async mount() {
    const content = document.getElementById('audit-logs-content');
    async function load(query) {
      content.innerHTML = loadingSpinner();
      try {
        const path = query ? `/admin/audit?search=${encodeURIComponent(query)}` : '/admin/audit';
        const res = await api.get(path);
        const logs = res.data || [];
        content.innerHTML = `<div class="bg-white rounded-2xl border border-on-surface/10 overflow-hidden"><table class="data-table w-full"><thead><tr><th>Action</th><th>User</th><th>Entity</th><th>Details</th><th>Date</th></tr></thead><tbody>${logs.length === 0 ? '<tr><td colspan="5" class="text-center text-secondary py-8">No audit logs found</td></tr>' : logs.map(l => `<tr><td><span class="badge badge-info">${esc(l.action)}</span></td><td class="text-sm">${esc(l.user?.name || l.userId || 'System')}</td><td class="text-sm">${esc(l.entityType || '—')} #${(l.entityId || '').slice(0, 8)}</td><td class="text-sm text-secondary max-w-xs truncate">${esc(l.metadata ? JSON.stringify(l.metadata).slice(0, 80) : (l.description || '—'))}</td><td class="text-sm text-secondary">${formatDateTime(l.createdAt)}</td></tr>`).join('')}</tbody></table></div>`;
      } catch { content.innerHTML = errorState('Failed to load audit logs.'); }
    }
    document.getElementById('audit-refresh').addEventListener('click', () => load(document.getElementById('audit-search').value));
    let timer;
    document.getElementById('audit-search').addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => load(document.getElementById('audit-search').value), 400);
    });
    await load();
  },
  cleanup() {},
});
