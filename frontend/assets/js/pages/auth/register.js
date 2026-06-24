router.add('auth/register', {
  async render() {
    return `
    <div class="min-h-screen flex items-center justify-center px-4 py-20">
      <div class="w-full max-w-md bg-white rounded-2xl shadow-sm border border-on-surface/10 p-8 md:p-10">
        <div class="text-center mb-8">
          <h1 class="font-display text-3xl text-primary mb-2">Create Account</h1>
          <p class="text-secondary text-sm">Join Elixir & Oak today</p>
        </div>
        <form id="register-form" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-primary mb-1.5">Full Name</label>
            <input type="text" id="reg-name" required class="w-full px-4 py-3 border border-on-surface/20 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-500 text-sm bg-surface" placeholder="John Doe">
          </div>
          <div>
            <label class="block text-sm font-medium text-primary mb-1.5">Email</label>
            <input type="email" id="reg-email" required class="w-full px-4 py-3 border border-on-surface/20 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-500 text-sm bg-surface" placeholder="you@example.com">
          </div>
          <div>
            <label class="block text-sm font-medium text-primary mb-1.5">Phone</label>
            <input type="tel" id="reg-phone" class="w-full px-4 py-3 border border-on-surface/20 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-500 text-sm bg-surface" placeholder="+91 98765 43210">
          </div>
          <div>
            <label class="block text-sm font-medium text-primary mb-1.5">Password</label>
            <input type="password" id="reg-password" required minlength="6" class="w-full px-4 py-3 border border-on-surface/20 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-500 text-sm bg-surface" placeholder="At least 6 characters">
          </div>
          <button type="submit" class="w-full bg-primary text-on-primary py-3.5 rounded-lg font-medium text-sm hover:opacity-90 transition-500 disabled:opacity-50" id="reg-btn">Create Account</button>
        </form>
        <p class="text-center text-sm text-secondary mt-6">Already have an account? <a href="#/auth/login" class="text-primary font-medium hover:underline">Sign in</a></p>
      </div>
    </div>`;
  },
  mount() {
    const form = document.getElementById('register-form');
    const btn = document.getElementById('reg-btn');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      btn.disabled = true; btn.textContent = 'Creating account...';
      try {
        const data = await api.auth.register({
          name: document.getElementById('reg-name').value,
          email: document.getElementById('reg-email').value,
          phone: document.getElementById('reg-phone').value,
          password: document.getElementById('reg-password').value,
        });
        toast.success('Account created! Please sign in.');
        router.navigate('auth/login');
      } catch (err) {
        toast.error(err.message || 'Registration failed.');
      } finally {
        btn.disabled = false; btn.textContent = 'Create Account';
      }
    });
  },
  cleanup() {},
});
