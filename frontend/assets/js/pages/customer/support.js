router.add('customer/support', {
  async render() {
    const user = store.get('user');
    if (!user) { router.navigate('auth/login'); return ''; }
    return `
    <div class="max-w-4xl mx-auto px-4 md:px-8 py-8">
      <div class="flex justify-between items-center mb-8"><div><h1 class="font-display text-3xl text-primary">Support</h1><p class="text-secondary text-sm mt-1">Get help with your orders and account</p></div><button id="new-ticket-btn" class="bg-primary text-on-primary px-5 py-2.5 rounded-lg font-medium text-sm hover:opacity-90 transition-500">+ New Ticket</button></div>
      <div id="tickets-list">${loadingSpinner()}</div>
      <div id="ticket-modal" class="fixed inset-0 z-50 bg-black/40 flex items-center justify-center hidden p-4">
        <div class="bg-white rounded-2xl p-6 md:p-8 max-w-lg w-full" onclick="event.stopPropagation()">
          <div class="flex justify-between items-center mb-6"><h2 class="font-display text-xl text-primary">New Support Ticket</h2><button onclick="document.getElementById('ticket-modal').classList.add('hidden')" class="text-secondary text-xl">✕</button></div>
          <form id="ticket-form" class="space-y-4">
            <div><label class="block text-sm font-medium mb-1">Subject</label><input type="text" id="ticket-subject" required class="w-full px-4 py-3 border border-on-surface/20 rounded-lg text-sm bg-surface" placeholder="Brief description"></div>
            <div><label class="block text-sm font-medium mb-1">Category</label><select id="ticket-category" class="w-full px-4 py-3 border border-on-surface/20 rounded-lg text-sm bg-surface"><option>Order Issue</option><option>Account</option><option>Payment</option><option>Reservation</option><option>Other</option></select></div>
            <div><label class="block text-sm font-medium mb-1">Message</label><textarea id="ticket-message" rows="4" required class="w-full px-4 py-3 border border-on-surface/20 rounded-lg text-sm bg-surface" placeholder="Describe your issue..."></textarea></div>
            <button type="submit" class="w-full bg-primary text-on-primary py-3.5 rounded-lg font-medium text-sm hover:opacity-90 transition-500" id="ticket-submit">Submit Ticket</button>
          </form>
        </div>
      </div>
    </div>`;
  },
  async mount() {
    const el = document.getElementById('tickets-list');
    async function load() {
      try {
        const res = await api.get('/support/tickets');
        const tickets = res.data || [];
        if (tickets.length === 0) { el.innerHTML = emptyState('💬', 'No support tickets', 'We\'re here to help! Create a ticket above.'); return; }
        el.innerHTML = `<div class="space-y-3">${tickets.map(t => `
          <a href="#/customer/ticket-detail?id=${t.id}" class="block bg-white rounded-2xl border border-on-surface/10 p-5 card-hover">
            <div class="flex justify-between items-start mb-2"><h3 class="font-medium text-primary">${esc(t.subject)}</h3><span class="badge badge-${t.status === 'RESOLVED' ? 'success' : t.status === 'OPEN' ? 'warning' : 'info'}">${t.status}</span></div>
            <p class="text-sm text-secondary line-clamp-2">${esc(t.message || '')}</p>
            <p class="text-xs text-secondary mt-2">${formatDateTime(t.createdAt)}</p>
          </a>
        `).join('')}</div>`;
      } catch { el.innerHTML = errorState('Failed to load tickets.'); }
    }
    document.getElementById('new-ticket-btn').addEventListener('click', () => {
      document.getElementById('ticket-modal').classList.remove('hidden');
    });
    document.getElementById('ticket-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('ticket-submit');
      btn.disabled = true; btn.textContent = 'Submitting...';
      try {
        await api.post('/support/tickets', {
          subject: document.getElementById('ticket-subject').value,
          category: document.getElementById('ticket-category').value,
          message: document.getElementById('ticket-message').value,
        });
        toast.success('Ticket created!');
        document.getElementById('ticket-modal').classList.add('hidden');
        load();
      } catch (err) { toast.error(err.message || 'Failed to create ticket.'); }
      finally { btn.disabled = false; btn.textContent = 'Submit Ticket'; }
    });
    await load();
  },
  cleanup() {},
});
router.add('customer/ticket-detail', {
  async render(params) {
    return `<div class="max-w-3xl mx-auto px-4 md:px-8 py-8"><div id="ticket-detail-content">${loadingSpinner()}</div></div>`;
  },
  async mount(params) {
    const el = document.getElementById('ticket-detail-content');
    try {
      const res = await api.get(`/support/tickets/${params.id}`);
      const t = res.data || {};
      el.innerHTML = `
        <a href="#/customer/support" class="text-sm text-secondary hover:text-primary transition-500">← Back to Tickets</a>
        <div class="bg-white rounded-2xl border border-on-surface/10 p-6 mt-4">
          <div class="flex justify-between items-start mb-4"><h1 class="font-display text-2xl text-primary">${esc(t.subject)}</h1><span class="badge badge-${t.status === 'RESOLVED' ? 'success' : t.status === 'OPEN' ? 'warning' : 'info'} text-sm">${t.status}</span></div>
          <p class="text-sm text-secondary mb-4">${esc(t.message || '')}</p>
          <p class="text-xs text-secondary">Created: ${formatDateTime(t.createdAt)}</p>
        </div>`;
    } catch { el.innerHTML = errorState('Failed to load ticket.'); }
  },
  cleanup() {},
});
