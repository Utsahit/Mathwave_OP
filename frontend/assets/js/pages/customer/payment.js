router.add('customer/payment', {
  async render(params) {
    return `
    <div class="max-w-2xl mx-auto px-4 py-16">
      <div class="bg-white rounded-2xl border border-on-surface/10 p-8 text-center">
        <h1 class="font-display text-3xl text-primary mb-4">Complete Payment</h1>
        <p class="text-secondary text-sm mb-8">Processing payment for order #${esc(params.id || '')}</p>
        <div id="payment-status">${loadingSpinner()}</div>
        <div id="payment-actions" class="hidden space-y-4 mt-8">
          <button id="pay-now" class="w-full bg-primary text-on-primary py-3.5 rounded-lg font-medium hover:opacity-90 transition-500">Pay Now</button>
          <a href="#/customer/orders" class="block text-sm text-secondary hover:text-primary transition-500">Back to Orders</a>
        </div>
      </div>
    </div>`;
  },
  async mount(params) {
    const orderId = params.id;
    if (!orderId) { toast.error('No order specified.'); router.navigate('customer/menu'); return; }
    try {
      const orderRes = await api.get(`/orders/${orderId}`);
      const order = orderRes.data || {};
      const statusEl = document.getElementById('payment-status');
      let total = order.totalAmount || order.total || 0;
      if (order.items) total = order.items.reduce((s, i) => s + (i.price || 0) * (i.quantity || 1), 0);
      if (order.status === 'PAID' || order.status === 'COMPLETED' || order.status === 'DELIVERED') {
        statusEl.innerHTML = `<div class="text-green-600 text-5xl mb-4">✅</div><h2 class="text-xl font-medium text-primary mb-2">Payment Complete</h2><p class="text-secondary text-sm">Your order has been paid successfully.</p><a href="#/customer/orders" class="inline-block mt-6 bg-primary text-on-primary px-8 py-3 rounded-lg font-medium text-sm hover:opacity-90 transition-500">View Orders</a>`;
        return;
      }
      document.getElementById('payment-actions').classList.remove('hidden');
      statusEl.innerHTML = `<div class="text-amber-600 text-5xl mb-4">💳</div><h2 class="text-xl font-medium text-primary mb-2">Amount Due: ${formatCurrency(total)}</h2><p class="text-secondary text-sm">Order #${orderId.slice(0, 8)}</p>`;
      document.getElementById('pay-now').addEventListener('click', async () => {
        const btn = document.getElementById('pay-now');
        btn.disabled = true; btn.textContent = 'Processing...';
        try {
          const payRes = await api.post(`/payments/create-order`, { orderId, amount: total });
          const payment = payRes.data || {};
          if (payment.razorpayOrderId && typeof Razorpay !== 'undefined') {
            const rzp = new Razorpay({
              key: payment.razorpayKey || '',
              amount: payment.amount || total * 100,
              currency: 'INR',
              name: 'Elixir & Oak',
              order_id: payment.razorpayOrderId,
              handler: async function (response) {
                try {
                  await api.post(`/payments/verify`, {
                    razorpayOrderId: response.razorpay_order_id,
                    razorpayPaymentId: response.razorpay_payment_id,
                    razorpaySignature: response.razorpay_signature,
                    orderId,
                  });
                  toast.success('Payment successful!');
                  router.navigate(`customer/payment-success?id=${orderId}`);
                } catch { toast.error('Payment verification failed.'); router.navigate(`customer/payment-failure?id=${orderId}`); }
              },
              modal: { ondismiss: function () { btn.disabled = false; btn.textContent = 'Pay Now'; } },
            });
            rzp.open();
          } else {
            await api.post(`/payments/verify`, { orderId, method: 'COD' });
            toast.success('Order confirmed!');
            router.navigate(`customer/payment-success?id=${orderId}`);
          }
        } catch (err) {
          toast.error(err.message || 'Payment failed.');
          btn.disabled = false; btn.textContent = 'Pay Now';
        }
      });
    } catch (err) {
      document.getElementById('payment-status').innerHTML = errorState('Could not load order details.');
    }
  },
  cleanup() {},
});
router.add('customer/payment-success', {
  async render(params) {
    return `
    <div class="max-w-2xl mx-auto px-4 py-20 text-center">
      <div class="bg-white rounded-2xl border border-on-surface/10 p-8">
        <div class="text-green-600 text-6xl mb-4">✅</div>
        <h1 class="font-display text-3xl text-primary mb-2">Payment Successful!</h1>
        <p class="text-secondary text-sm mb-2">Your order has been confirmed.</p>
        <p class="text-xs text-secondary mb-8">Order ID: ${esc(params.id || '')}</p>
        <a href="#/customer/orders" class="inline-block bg-primary text-on-primary px-8 py-3 rounded-lg font-medium text-sm hover:opacity-90 transition-500">View Orders</a>
        <a href="#/customer/menu" class="inline-block ml-4 text-sm text-secondary hover:text-primary transition-500">Continue Shopping</a>
      </div>
    </div>`;
  },
  cleanup() {},
});
router.add('customer/payment-failure', {
  async render(params) {
    return `
    <div class="max-w-2xl mx-auto px-4 py-20 text-center">
      <div class="bg-white rounded-2xl border border-on-surface/10 p-8">
        <div class="text-red-600 text-6xl mb-4">❌</div>
        <h1 class="font-display text-3xl text-primary mb-2">Payment Failed</h1>
        <p class="text-secondary text-sm mb-2">Something went wrong with your payment.</p>
        <p class="text-xs text-secondary mb-8">Order ID: ${esc(params.id || '')}</p>
        <a href="#/customer/payment?id=${esc(params.id || '')}" class="inline-block bg-primary text-on-primary px-8 py-3 rounded-lg font-medium text-sm hover:opacity-90 transition-500">Retry Payment</a>
        <a href="#/customer/orders" class="inline-block ml-4 text-sm text-secondary hover:text-primary transition-500">View Orders</a>
      </div>
    </div>`;
  },
  cleanup() {},
});
