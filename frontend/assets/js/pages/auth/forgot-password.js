router.add('auth/forgot-password', {
  async render() {
    return `
    <div class="min-h-screen flex items-center justify-center px-4 py-20">
      <div class="w-full max-w-md bg-white rounded-2xl shadow-sm border border-on-surface/10 p-8 md:p-10">
        <div class="text-center mb-8">
          <h1 class="font-display text-3xl text-primary mb-2">Forgot Password</h1>
          <p class="text-secondary text-sm">Enter your email and we'll send you a reset link</p>
        </div>
        <form id="forgot-form" class="space-y-5">
          <div>
            <label class="block text-sm font-medium text-primary mb-1.5">Email</label>
            <input type="email" id="forgot-email" required class="w-full px-4 py-3 border border-on-surface/20 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-500 text-sm bg-surface" placeholder="you@example.com">
          </div>
          <button type="submit" class="w-full bg-primary text-on-primary py-3.5 rounded-lg font-medium text-sm hover:opacity-90 transition-500 disabled:opacity-50" id="forgot-btn">Send Reset Link</button>
        </form>
        <p class="text-center text-sm text-secondary mt-6"><a href="#/auth/login" class="text-primary font-medium hover:underline">Back to sign in</a></p>
      </div>
    </div>`;
  },
  mount() {
    const form = document.getElementById('forgot-form');
    const btn = document.getElementById('forgot-btn');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      btn.disabled = true; btn.textContent = 'Sending...';
      try {
        await api.auth.forgotPassword(document.getElementById('forgot-email').value);
        toast.success('If that email is registered, you will receive a reset link.');
        router.navigate('auth/login');
      } catch (err) {
        toast.error(err.message || 'Something went wrong.');
      } finally {
        btn.disabled = false; btn.textContent = 'Send Reset Link';
      }
    });
  },
  cleanup() {},
});
