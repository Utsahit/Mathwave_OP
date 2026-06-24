router.add('customer/checkout', {
  async render() {
    const user = store.get('user');
    if (!user) { router.navigate('auth/login'); return ''; }
    const cart = store.get('cart') || [];
    if (cart.length === 0) { router.navigate('customer/cart'); return ''; }
    const subtotal = cart.reduce((s, i) => s + i.price * (i.quantity || 1), 0);
    return `
    <div class="max-w-4xl mx-auto px-4 md:px-8 py-8">
      <h1 class="font-display text-3xl text-primary mb-8">Checkout</h1>
      <div class="grid md:grid-cols-3 gap-8">
        <div class="md:col-span-2 space-y-6">
          <div class="bg-white rounded-2xl border border-on-surface/10 p-6">
            <h2 class="font-display text-lg text-primary mb-4">Delivery Address</h2>
            <div id="checkout-addresses">${loadingSpinner()}</div>
          </div>
          <div class="bg-white rounded-2xl border border-on-surface/10 p-6">
            <h2 class="font-display text-lg text-primary mb-4">Apply Coupon</h2>
            <div class="flex gap-3"><input type="text" id="coupon-input" placeholder="Enter coupon code" class="flex-1 px-4 py-2.5 border border-on-surface/20 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-surface"><button id="apply-coupon" class="bg-primary text-on-primary px-5 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition-500">Apply</button></div>
            <div id="coupon-result" class="mt-3"></div>
          </div>
          <div class="bg-white rounded-2xl border border-on-surface/10 p-6">
            <h2 class="font-display text-lg text-primary mb-4">Apply Gift Card</h2>
            <div class="flex gap-3"><input type="text" id="giftcard-input" placeholder="Gift card code" class="flex-1 px-4 py-2.5 border border-on-surface/20 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-surface"><button id="apply-giftcard" class="bg-primary text-on-primary px-5 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition-500">Apply</button></div>
            <div id="giftcard-result" class="mt-3"></div>
          </div>
          <div class="bg-white rounded-2xl border border-on-surface/10 p-6">
            <h2 class="font-display text-lg text-primary mb-4">Notes</h2>
            <textarea id="order-notes" rows="2" class="w-full px-4 py-3 border border-on-surface/20 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-surface" placeholder="Any special instructions?"></textarea>
          </div>
        </div>
        <div class="md:col-span-1">
          <div class="bg-white rounded-2xl border border-on-surface/10 p-6 sticky top-24">
            <h2 class="font-display text-lg text-primary mb-4">Order Summary</h2>
            <div id="checkout-items" class="space-y-3 mb-4">${cart.map(i => `<div class="flex justify-between text-sm"><span>${esc(i.name)} × ${i.quantity}</span><span>${formatCurrency(i.price * i.quantity)}</span></div>`).join('')}</div>
            <div class="border-t border-on-surface/10 pt-4 space-y-2">
              <div class="flex justify-between text-sm"><span>Subtotal</span><span id="checkout-subtotal">${formatCurrency(subtotal)}</span></div>
              <div class="flex justify-between text-sm"><span>Discount</span><span id="checkout-discount">− ${formatCurrency(0)}</span></div>
              <div class="flex justify-between text-sm"><span>Gift Card</span><span id="checkout-giftcard">− ${formatCurrency(0)}</span></div>
              <div class="flex justify-between text-sm"><span>Loyalty Used</span><span id="checkout-loyalty">− ${formatCurrency(0)}</span></div>
              <div class="flex justify-between font-bold text-primary text-lg border-t border-on-surface/10 pt-3 mt-3"><span>Total</span><span id="checkout-total">${formatCurrency(subtotal)}</span></div>
            </div>
            <button id="place-order" class="w-full bg-primary text-on-primary py-3.5 rounded-lg font-medium text-sm hover:opacity-90 transition-500 mt-6">Place Order</button>
            <div id="loyalty-section" class="mt-4"></div>
          </div>
        </div>
      </div>
    </div>`;
  },
  async mount() {
    let appliedCoupon = null;
    let appliedGiftCard = null;
    let loyaltyDiscount = 0;
    const cart = store.get('cart') || [];
    if (cart.length === 0) return;
    const subtotal = cart.reduce((s, i) => s + i.price * (i.quantity || 1), 0);
    function updateTotal() {
      const discount = appliedCoupon ? (appliedCoupon.discount || 0) : 0;
      const giftVal = appliedGiftCard ? (appliedGiftCard.balance || 0) : 0;
      const total = Math.max(0, subtotal - discount - giftVal - loyaltyDiscount);
      document.getElementById('checkout-discount').textContent = `− ${formatCurrency(discount)}`;
      document.getElementById('checkout-giftcard').textContent = `− ${formatCurrency(giftVal)}`;
      document.getElementById('checkout-loyalty').textContent = `− ${formatCurrency(loyaltyDiscount)}`;
      document.getElementById('checkout-total').textContent = formatCurrency(total);
    }
    try {
      const addrRes = await api.get('/addresses');
      const addresses = addrRes.data || [];
      const addrEl = document.getElementById('checkout-addresses');
      if (addresses.length === 0) {
        addrEl.innerHTML = `<p class="text-sm text-secondary">No saved addresses. <a href="#/customer/addresses" class="text-primary font-medium hover:underline">Add one</a></p>`;
      } else {
        addrEl.innerHTML = addresses.map((a, i) => `<label class="flex items-center gap-3 py-2 cursor-pointer"><input type="radio" name="address" value="${a.id}" ${i === 0 ? 'checked' : ''} class="accent-primary"><div><p class="text-sm font-medium">${esc(a.label || 'Address')}</p><p class="text-xs text-secondary">${esc([a.street, a.city, a.state, a.zip].filter(Boolean).join(', '))}</p></div></label>`).join('');
      }
    } catch { /* no addresses */ }

    const user = store.get('user');
    if (user) {
      try {
        const loyRes = await api.get('/loyalty/points');
        const loy = loyRes.data || {};
        if (loy.points > 0) {
          document.getElementById('loyalty-section').innerHTML = `
            <div class="bg-surface-container-high rounded-lg p-4"><div class="flex justify-between items-center"><span class="text-sm font-medium">Use Loyalty Points</span><span class="text-sm text-secondary">${loy.points} pts available</span></div>
            <div class="flex gap-2 mt-3"><input type="number" id="loyalty-points" max="${loy.points}" placeholder="Points" class="w-24 px-3 py-2 border border-on-surface/20 rounded-lg text-sm bg-white"><button id="apply-loyalty" class="bg-primary text-on-primary px-4 py-2 rounded-lg text-sm">Apply</button></div></div>`;
          document.getElementById('apply-loyalty').addEventListener('click', () => {
            const pts = parseInt(document.getElementById('loyalty-points').value) || 0;
            if (pts > 0) { loyaltyDiscount = pts; updateTotal(); toast.success(`${pts} points applied`); }
          });
        }
      } catch {}
    }

    document.getElementById('apply-coupon').addEventListener('click', async () => {
      const code = document.getElementById('coupon-input').value.trim();
      if (!code) return;
      try {
        const res = await api.post('/coupons/validate', { code, orderTotal: subtotal });
        appliedCoupon = res.data;
        document.getElementById('coupon-result').innerHTML = `<p class="text-green-700 text-sm">✅ Coupon applied! Discount: ${formatCurrency(appliedCoupon.discount || 0)}</p>`;
        updateTotal();
        toast.success('Coupon applied');
      } catch (err) { document.getElementById('coupon-result').innerHTML = `<p class="text-red-600 text-sm">❌ ${err.message || 'Invalid coupon'}</p>`; }
    });
    document.getElementById('apply-giftcard').addEventListener('click', async () => {
      const code = document.getElementById('giftcard-input').value.trim();
      if (!code) return;
      try {
        const res = await api.post('/giftcards/redeem', { code, amount: subtotal });
        appliedGiftCard = res.data;
        document.getElementById('giftcard-result').innerHTML = `<p class="text-green-700 text-sm">✅ Gift card applied!</p>`;
        updateTotal();
        toast.success('Gift card applied');
      } catch (err) { document.getElementById('giftcard-result').innerHTML = `<p class="text-red-600 text-sm">❌ ${err.message || 'Invalid gift card'}</p>`; }
    });

    document.getElementById('place-order').addEventListener('click', async () => {
      const btn = document.getElementById('place-order');
      btn.disabled = true; btn.textContent = 'Placing order...';
      const addrRadio = document.querySelector('input[name="address"]:checked');
      try {
        const orderData = {
          items: cart.map(i => ({ menuItemId: i.id, quantity: i.quantity })),
          notes: document.getElementById('order-notes')?.value || '',
          couponCode: appliedCoupon ? document.getElementById('coupon-input').value.trim() : undefined,
          giftCardCode: appliedGiftCard ? document.getElementById('giftcard-input').value.trim() : undefined,
          loyaltyPointsUsed: loyaltyDiscount || undefined,
          addressId: addrRadio ? addrRadio.value : undefined,
        };
        const res = await api.post('/orders', orderData);
        store.set('cart', []);
        toast.success('Order placed! Redirecting to payment...');
        if (res.data && res.data.id) {
          router.navigate(`customer/payment?id=${res.data.id}`);
        }
      } catch (err) {
        toast.error(err.message || 'Failed to place order.');
        btn.disabled = false; btn.textContent = 'Place Order';
      }
    });
  },
  cleanup() {},
});
