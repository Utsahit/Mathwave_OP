router.add('auth/login', {
  async render() {
    return `
    <div class="min-h-screen flex items-center justify-center px-4 py-20">
      <div class="w-full max-w-md bg-white rounded-2xl shadow-sm border border-on-surface/10 p-8 md:p-10">
        <div class="text-center mb-8">
          <h1 class="font-display text-3xl text-primary mb-2">Welcome Back</h1>
          <p class="text-secondary text-sm">Sign in to your Elixir & Oak account</p>
        </div>
        <form id="login-form" class="space-y-5">
          <div>
            <label class="block text-sm font-medium text-primary mb-1.5">Email</label>
            <input type="email" id="login-email" required class="w-full px-4 py-3 border border-on-surface/20 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-500 text-sm bg-surface" placeholder="you@example.com">
          </div>
          <div>
            <div class="flex justify-between items-center mb-1.5">
              <label class="text-sm font-medium text-primary">Password</label>
              <a href="#/auth/forgot-password" class="text-xs text-secondary hover:text-primary transition-500">Forgot?</a>
            </div>
            <input type="password" id="login-password" required class="w-full px-4 py-3 border border-on-surface/20 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-500 text-sm bg-surface" placeholder="••••••••">
          </div>
          <button type="submit" class="w-full bg-primary text-on-primary py-3.5 rounded-lg font-medium text-sm hover:opacity-90 transition-500 disabled:opacity-50" id="login-btn">Sign In</button>
        </form>
        <p class="text-center text-sm text-secondary mt-6">Don't have an account? <a href="#/auth/register" class="text-primary font-medium hover:underline">Register</a></p>
      </div>
    </div>`;
  },
  mount() {
    const form = document.getElementById('login-form');
    const btn = document.getElementById('login-btn');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      btn.disabled = true; btn.textContent = 'Signing in...';
      try {
        const data = await api.auth.login(
          document.getElementById('login-email').value,
          document.getElementById('login-password').value
        );
        if (data.data) {
          localStorage.setItem(CONFIG.TOKEN_KEY, data.data.accessToken);
          localStorage.setItem(CONFIG.REFRESH_KEY, data.data.refreshToken);
          localStorage.setItem(CONFIG.USER_KEY, JSON.stringify(data.data.user || data.data));
          store.set('user', data.data.user || data.data);
          toast.success('Welcome back!');
          const user = data.data.user || data.data;
          if (user.role === 'ADMIN' || user.role === 'MANAGER') {
            router.navigate('admin/dashboard');
          } else {
            router.navigate('customer/dashboard');
          }
        }
      } catch (err) {
        toast.error(err.message || 'Invalid email or password.');
      } finally {
        btn.disabled = false; btn.textContent = 'Sign In';
      }
    });
  },
  cleanup() {},
});
