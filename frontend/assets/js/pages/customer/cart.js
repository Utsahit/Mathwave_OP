router.add('customer/cart', {
  async render() {
    const cart = store.get('cart') || [];
    if (cart.length === 0) {
      return `<div class="max-w-3xl mx-auto px-4 py-20">${emptyState('🛒', 'Your cart is empty', 'Browse our menu to add items.')}<div class="text-center mt-4"><a href="#/customer/menu" class="inline-block bg-primary text-on-primary px-8 py-3 rounded-lg font-medium text-sm hover:opacity-90 transition-500">Browse Menu</a></div></div>`;
    }
    const total = cart.reduce((s, i) => s + i.price * (i.quantity || 1), 0);
    return `
    <div class="max-w-4xl mx-auto px-4 md:px-8 py-8">
      <div class="flex items-center justify-between mb-8">
        <h1 class="font-display text-3xl text-primary">Your Cart</h1>
        <button id="clear-cart" class="text-sm text-red-500 hover:text-red-700 transition-500">Clear All</button>
      </div>
      <div id="cart-items" class="space-y-4 mb-8">${cart.map((item, i) => `
        <div class="bg-white rounded-2xl border border-on-surface/10 p-4 md:p-6 flex items-center justify-between gap-4 cart-item" data-index="${i}">
          <div class="flex-1 min-w-0"><h3 class="font-medium text-primary">${esc(item.name)}</h3><p class="text-sm text-secondary">${formatCurrency(item.price)} each</p></div>
          <div class="flex items-center gap-3">
            <button class="qty-minus w-8 h-8 rounded-full border border-on-surface/20 flex items-center justify-center text-secondary hover:bg-surface-container-high transition-500">−</button>
            <span class="qty-display w-8 text-center font-medium">${item.quantity}</span>
            <button class="qty-plus w-8 h-8 rounded-full border border-on-surface/20 flex items-center justify-center text-secondary hover:bg-surface-container-high transition-500">+</button>
          </div>
          <div class="text-right min-w-[80px]"><p class="font-medium text-primary">${formatCurrency(item.price * item.quantity)}</p><button class="remove-item text-xs text-red-500 hover:text-red-700 mt-1 transition-500">Remove</button></div>
        </div>
      `).join('')}</div>
      <div class="bg-white rounded-2xl border border-on-surface/10 p-6">
        <div class="flex justify-between items-center text-lg mb-2"><span class="font-medium">Subtotal</span><span class="font-bold text-primary">${formatCurrency(total)}</span></div>
        <p class="text-xs text-secondary mb-6">Taxes and delivery calculated at checkout</p>
        <a href="#/customer/checkout" class="block w-full bg-primary text-on-primary text-center py-3.5 rounded-lg font-medium hover:opacity-90 transition-500">Proceed to Checkout</a>
      </div>
    </div>`;
  },
  mount() {
    function update() {
      const cart = store.get('cart') || [];
      if (cart.length === 0) { router.navigate('customer/cart'); return; }
      cart.forEach((item, i) => {
        const el = document.querySelector(`.cart-item[data-index="${i}"]`);
        if (!el) return;
        el.querySelector('.qty-display').textContent = item.quantity;
        el.querySelector('p:last-child').textContent = formatCurrency(item.price * item.quantity);
      });
      const total = cart.reduce((s, i) => s + i.price * (i.quantity || 1), 0);
      const subtotalEl = document.querySelector('.text-lg .font-bold');
      if (subtotalEl) subtotalEl.textContent = formatCurrency(total);
      store.set('cart', cart);
    }
    document.querySelectorAll('.qty-plus').forEach(btn => {
      btn.addEventListener('click', () => {
        const cart = store.get('cart') || [];
        const idx = parseInt(btn.closest('.cart-item').dataset.index);
        cart[idx].quantity = (cart[idx].quantity || 1) + 1;
        store.set('cart', cart);
        update();
      });
    });
    document.querySelectorAll('.qty-minus').forEach(btn => {
      btn.addEventListener('click', () => {
        const cart = store.get('cart') || [];
        const idx = parseInt(btn.closest('.cart-item').dataset.index);
        if (cart[idx].quantity > 1) {
          cart[idx].quantity--;
          store.set('cart', cart);
          update();
        }
      });
    });
    document.querySelectorAll('.remove-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const cart = store.get('cart') || [];
        const idx = parseInt(btn.closest('.cart-item').dataset.index);
        cart.splice(idx, 1);
        store.set('cart', cart);
        toast.info('Item removed from cart');
        router.navigate('customer/cart');
      });
    });
    document.getElementById('clear-cart')?.addEventListener('click', () => {
      store.set('cart', []);
      toast.info('Cart cleared');
      router.navigate('customer/cart');
    });
  },
  cleanup() {},
});
