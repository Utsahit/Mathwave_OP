router.add('auth/reset-password', {
  async render(params) {
    return `
    <div class="min-h-screen flex items-center justify-center px-4 py-20">
      <div class="w-full max-w-md bg-white rounded-2xl shadow-sm border border-on-surface/10 p-8 md:p-10">
        <div class="text-center mb-8">
          <h1 class="font-display text-3xl text-primary mb-2">Reset Password</h1>
          <p class="text-secondary text-sm">Enter your new password</p>
        </div>
        <form id="reset-form" class="space-y-5">
          <input type="hidden" id="reset-token" value="${esc(params.token || '')}">
          <div>
            <label class="block text-sm font-medium text-primary mb-1.5">New Password</label>
            <input type="password" id="reset-password" required minlength="6" class="w-full px-4 py-3 border border-on-surface/20 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-500 text-sm bg-surface" placeholder="At least 6 characters">
          </div>
          <div>
            <label class="block text-sm font-medium text-primary mb-1.5">Confirm Password</label>
            <input type="password" id="reset-confirm" required minlength="6" class="w-full px-4 py-3 border border-on-surface/20 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-500 text-sm bg-surface" placeholder="Repeat password">
          </div>
          <button type="submit" class="w-full bg-primary text-on-primary py-3.5 rounded-lg font-medium text-sm hover:opacity-90 transition-500 disabled:opacity-50" id="reset-btn">Reset Password</button>
        </form>
        <p class="text-center text-sm text-secondary mt-6"><a href="#/auth/login" class="text-primary font-medium hover:underline">Back to sign in</a></p>
      </div>
    </div>`;
  },
  mount() {
    const form = document.getElementById('reset-form');
    const btn = document.getElementById('reset-btn');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const pwd = document.getElementById('reset-password').value;
      const confirm = document.getElementById('reset-confirm').value;
      if (pwd !== confirm) { toast.error('Passwords do not match.'); return; }
      const token = document.getElementById('reset-token').value;
      if (!token) { toast.error('Missing reset token.'); return; }
      btn.disabled = true; btn.textContent = 'Resetting...';
      try {
        await api.auth.resetPassword(token, pwd);
        toast.success('Password reset successfully. Please sign in.');
        router.navigate('auth/login');
      } catch (err) {
        toast.error(err.message || 'Reset failed. The link may have expired.');
      } finally {
        btn.disabled = false; btn.textContent = 'Reset Password';
      }
    });
  },
  cleanup() {},
});
