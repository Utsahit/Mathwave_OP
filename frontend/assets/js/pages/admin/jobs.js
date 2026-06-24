router.add('admin/jobs', {
  async render() {
    const user = store.get('user');
    if (!user || (user.role !== 'ADMIN' && user.role !== 'MANAGER')) { router.navigate('customer/menu'); return ''; }
    return `
    <div class="max-w-7xl mx-auto px-4 md:px-8 py-8">
      <h1 class="font-display text-3xl text-primary mb-2">Job Queue</h1>
      <p class="text-secondary text-sm mb-6">Monitor and manage background jobs</p>
      <div class="grid md:grid-cols-2 gap-6 mb-6">
        <div class="bg-white rounded-2xl border border-on-surface/10 p-6"><h2 class="font-display text-lg text-primary mb-4">Failed Jobs</h2><div id="failed-jobs">${loadingSpinner()}</div></div>
        <div class="bg-white rounded-2xl border border-on-surface/10 p-6"><h2 class="font-display text-lg text-primary mb-4">Pending Jobs</h2><div id="pending-jobs">${loadingSpinner()}</div></div>
      </div>
    </div>`;
  },
  async mount() {
    async function loadSection(elId, status) {
      const el = document.getElementById(elId);
      try {
        const res = await api.get(`/admin/jobs?status=${status}`);
        const jobs = res.data || [];
        if (jobs.length === 0) { el.innerHTML = `<p class="text-sm text-secondary">No ${status} jobs.</p>`; return; }
        el.innerHTML = `<div class="space-y-2">${jobs.map(j => `
          <div class="flex justify-between items-center py-2 border-b border-on-surface/5 last:border-0">
            <div><p class="text-sm font-medium">${esc(j.name || j.type || 'Job')}</p><p class="text-xs text-secondary">${formatDateTime(j.createdAt)}${j.attempts ? ` · Attempt ${j.attempts}` : ''}</p></div>
            ${status === 'failed' ? `<button class="retry-job text-xs bg-primary text-on-primary px-3 py-1.5 rounded-lg hover:opacity-90 transition-500" data-id="${j.id}">Retry</button>` : `<span class="badge badge-info">${j.status || 'PENDING'}</span>`}
          </div>
        `).join('')}</div>`;
        el.querySelectorAll('.retry-job').forEach(btn => {
          btn.addEventListener('click', async () => {
            try { await api.post(`/admin/jobs/${btn.dataset.id}/retry`); toast.success('Job retried'); btn.closest('.border-b')?.remove(); } catch { toast.error('Failed to retry'); }
          });
        });
      } catch { el.innerHTML = errorState(`Failed to load ${status} jobs.`); }
    }
    await Promise.all([loadSection('failed-jobs', 'failed'), loadSection('pending-jobs', 'pending')]);
  },
  cleanup() {},
});
