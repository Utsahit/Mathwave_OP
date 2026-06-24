router.add('customer/reservations', {
  async render() {
    const user = store.get('user');
    if (!user) { router.navigate('auth/login'); return ''; }
    return `
    <div class="max-w-5xl mx-auto px-4 md:px-8 py-8">
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div><h1 class="font-display text-3xl text-primary">Reservations</h1><p class="text-secondary text-sm mt-1">Manage your table bookings</p></div>
        <button id="new-reservation-btn" class="bg-primary text-on-primary px-6 py-2.5 rounded-lg font-medium text-sm hover:opacity-90 transition-500">+ New Reservation</button>
      </div>
      <div id="reservations-list">${loadingSpinner()}</div>
      <!-- New reservation modal -->
      <div id="reservation-modal" class="fixed inset-0 z-50 bg-black/40 flex items-center justify-center hidden p-4" onclick="if(event.target===this)this.classList.add('hidden')">
        <div class="bg-white rounded-2xl p-6 md:p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto" onclick="event.stopPropagation()">
          <div class="flex justify-between items-center mb-6"><h2 class="font-display text-xl text-primary">Book a Table</h2><button onclick="document.getElementById('reservation-modal').classList.add('hidden')" class="text-secondary text-xl">✕</button></div>
          <form id="reservation-form" class="space-y-4">
            <div><label class="block text-sm font-medium mb-1">Date</label><input type="date" id="res-date" required class="w-full px-4 py-3 border border-on-surface/20 rounded-lg text-sm bg-surface"></div>
            <div><label class="block text-sm font-medium mb-1">Time</label><select id="res-time" required class="w-full px-4 py-3 border border-on-surface/20 rounded-lg text-sm bg-surface">${['12:00','12:30','13:00','13:30','14:00','14:30','18:00','18:30','19:00','19:30','20:00','20:30','21:00'].map(t => `<option value="${t}">${t}</option>`).join('')}</select></div>
            <div><label class="block text-sm font-medium mb-1">Guests</label><select id="res-guests" required class="w-full px-4 py-3 border border-on-surface/20 rounded-lg text-sm bg-surface">${[1,2,3,4,5,6,7,8].map(n => `<option value="${n}" ${n===2?'selected':''}>${n} ${n===1?'Guest':'Guests'}</option>`).join('')}</select></div>
            <div><label class="block text-sm font-medium mb-1">Name</label><input type="text" id="res-name" value="${esc(user.name || '')}" class="w-full px-4 py-3 border border-on-surface/20 rounded-lg text-sm bg-surface"></div>
            <div><label class="block text-sm font-medium mb-1">Phone</label><input type="tel" id="res-phone" value="${esc(user.phone || '')}" class="w-full px-4 py-3 border border-on-surface/20 rounded-lg text-sm bg-surface"></div>
            <div><label class="block text-sm font-medium mb-1">Notes</label><textarea id="res-notes" rows="2" class="w-full px-4 py-3 border border-on-surface/20 rounded-lg text-sm bg-surface" placeholder="Special requests..."></textarea></div>
            <button type="submit" class="w-full bg-primary text-on-primary py-3.5 rounded-lg font-medium text-sm hover:opacity-90 transition-500" id="res-submit">Confirm Booking</button>
          </form>
        </div>
      </div>
    </div>`;
  },
  async mount() {
    const el = document.getElementById('reservations-list');
    async function loadReservations() {
      try {
        const res = await api.get('/reservations');
        const reservations = res.data || [];
        if (reservations.length === 0) { el.innerHTML = emptyState('📅', 'No reservations yet', 'Book a table to get started!'); return; }
        el.innerHTML = `<div class="space-y-4">${reservations.map(r => `
          <div class="bg-white rounded-2xl border border-on-surface/10 p-5">
            <div class="flex justify-between items-start mb-3">
              <div><p class="font-medium text-primary">${formatDate(r.date)} at ${formatTime(r.time)}</p><p class="text-xs text-secondary">${r.guests} guests${r.tableNumber ? ' · Table ' + r.tableNumber : ''}</p></div>
              <span class="badge badge-${r.status === 'CONFIRMED' ? 'success' : r.status === 'PENDING' ? 'warning' : r.status === 'CANCELLED' ? 'danger' : 'neutral'}">${r.status}</span>
            </div>
            <div class="flex gap-2 mt-3">
              ${r.status !== 'CANCELLED' ? `<button class="cancel-res text-xs text-red-600 hover:text-red-800 border border-red-200 px-3 py-1.5 rounded-lg transition-500" data-id="${r.id}">Cancel</button>` : ''}
              ${r.whatsappLink ? `<a href="${esc(r.whatsappLink)}" target="_blank" class="text-xs text-green-700 border border-green-200 px-3 py-1.5 rounded-lg hover:bg-green-50 transition-500">💬 WhatsApp</a>` : ''}
            </div>
          </div>
        `).join('')}</div>`;
        el.querySelectorAll('.cancel-res').forEach(btn => {
          btn.addEventListener('click', async () => {
            if (!confirm('Cancel this reservation?')) return;
            try {
              await api.post(`/reservations/${btn.dataset.id}/cancel`);
              toast.success('Reservation cancelled');
              loadReservations();
            } catch { toast.error('Failed to cancel'); }
          });
        });
      } catch { el.innerHTML = errorState('Failed to load reservations.'); }
    }
    document.getElementById('new-reservation-btn').addEventListener('click', () => {
      document.getElementById('reservation-modal').classList.remove('hidden');
      const today = new Date().toISOString().split('T')[0];
      document.getElementById('res-date').min = today;
    });
    document.getElementById('reservation-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('res-submit');
      btn.disabled = true; btn.textContent = 'Booking...';
      try {
        await api.post('/reservations', {
          date: document.getElementById('res-date').value,
          time: document.getElementById('res-time').value,
          guests: parseInt(document.getElementById('res-guests').value),
          name: document.getElementById('res-name').value,
          phone: document.getElementById('res-phone').value,
          notes: document.getElementById('res-notes').value,
        });
        toast.success('Table booked!');
        document.getElementById('reservation-modal').classList.add('hidden');
        loadReservations();
      } catch (err) { toast.error(err.message || 'Booking failed.'); }
      finally { btn.disabled = false; btn.textContent = 'Confirm Booking'; }
    });
    await loadReservations();
  },
  cleanup() {},
});
