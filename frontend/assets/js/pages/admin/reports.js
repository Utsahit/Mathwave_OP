router.add('admin/reports', {
  async render() {
    const user = store.get('user');
    if (!user || (user.role !== 'ADMIN' && user.role !== 'MANAGER')) { router.navigate('customer/menu'); return ''; }
    return `
    <div class="max-w-7xl mx-auto px-4 md:px-8 py-8">
      <h1 class="font-display text-3xl text-primary mb-2">Reports</h1>
      <p class="text-secondary text-sm mb-6">Export and schedule reports</p>
      <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <div class="bg-white rounded-2xl border border-on-surface/10 p-6 card-hover"><h3 class="font-medium text-primary mb-2">Sales Report</h3><p class="text-sm text-secondary mb-4">Daily, weekly, or monthly sales summary</p><button class="gen-report text-sm bg-primary text-on-primary px-4 py-2 rounded-lg hover:opacity-90 transition-500" data-type="sales">Download CSV</button></div>
        <div class="bg-white rounded-2xl border border-on-surface/10 p-6 card-hover"><h3 class="font-medium text-primary mb-2">Order Report</h3><p class="text-sm text-secondary mb-4">All orders within a date range</p><button class="gen-report text-sm bg-primary text-on-primary px-4 py-2 rounded-lg hover:opacity-90 transition-500" data-type="orders">Download CSV</button></div>
        <div class="bg-white rounded-2xl border border-on-surface/10 p-6 card-hover"><h3 class="font-medium text-primary mb-2">Inventory Report</h3><p class="text-sm text-secondary mb-4">Current stock levels and movements</p><button class="gen-report text-sm bg-primary text-on-primary px-4 py-2 rounded-lg hover:opacity-90 transition-500" data-type="inventory">Download CSV</button></div>
      </div>
      <div class="bg-white rounded-2xl border border-on-surface/10 p-6">
        <h2 class="font-display text-lg text-primary mb-4">Scheduled Reports</h2>
        <div id="scheduled-reports">${loadingSpinner()}</div>
      </div>
    </div>`;
  },
  async mount() {
    document.querySelectorAll('.gen-report').forEach(btn => {
      btn.addEventListener('click', async () => {
        const type = btn.dataset.type;
        try {
          const res = await api.get(`/admin/reports/${type}`);
          const url = res.data?.url || res.data?.downloadUrl || '';
          if (url) { window.open(url, '_blank'); toast.success('Report downloaded'); }
          else {
            const blob = new Blob([JSON.stringify(res.data || res, null, 2)], { type: 'text/csv' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `${type}-report.csv`;
            a.click();
            toast.success('Report downloaded');
          }
        } catch { toast.error('Failed to generate report.'); }
      });
    });
    const el = document.getElementById('scheduled-reports');
    try {
      const res = await api.get('/admin/reports');
      const reports = res.data || [];
      if (reports.length === 0) { el.innerHTML = emptyState('📊', 'No scheduled reports', 'Schedule reports for automatic delivery.'); return; }
      el.innerHTML = `<div class="space-y-3">${reports.map(r => `<div class="flex justify-between items-center py-3 border-b border-on-surface/5 last:border-0"><div><p class="text-sm font-medium">${esc(r.name || r.type || 'Report')}</p><p class="text-xs text-secondary">${r.schedule || 'One-time'} · ${formatDate(r.createdAt)}</p></div><a href="${r.downloadUrl || '#'}" class="text-sm text-primary font-medium hover:underline" ${r.downloadUrl ? 'download' : ''}>Download</a></div>`).join('')}</div>`;
    } catch { el.innerHTML = errorState('Failed to load reports.'); }
  },
  cleanup() {},
});
