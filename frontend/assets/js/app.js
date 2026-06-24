(function () {
  function init() {
    const userData = localStorage.getItem(CONFIG.USER_KEY);
    if (userData) {
      try { store.set('user', JSON.parse(userData)); } catch {}
    }
    const cartData = sessionStorage.getItem('eao_cart');
    if (cartData) {
      try { store.set('cart', JSON.parse(cartData)); } catch {}
    }
    store.on('user', u => {
      store.set('admin', u && (u.role === 'ADMIN' || u.role === 'MANAGER'));
    });
    store.on('cart', c => {
      sessionStorage.setItem('eao_cart', JSON.stringify(c));
      const badge = document.getElementById('cart-badge');
      if (badge) {
        const count = c.reduce((sum, item) => sum + (item.quantity || 1), 0);
        badge.textContent = count;
        badge.classList.toggle('hidden', count === 0);
      }
    });
    router.init(document.getElementById('app-content'));
    loadNav();
  }
  function loadNav() {
    const user = store.get('user');
    const nav = document.getElementById('app-nav');
    if (!nav) return;
    if (user) {
      nav.innerHTML = `
        <div class="flex items-center gap-3">
          <a href="#/customer/dashboard" class="text-sm text-secondary hover:text-primary transition-500">Dashboard</a>
          <div class="relative group">
            <button class="flex items-center gap-2 text-sm text-secondary hover:text-primary transition-500">
              <span class="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">${(user.name || user.email || 'U')[0].toUpperCase()}</span>
              <span class="hidden md:inline">${user.name || user.email}</span>
            </button>
            <div class="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-xl border border-on-surface/10 py-2 hidden group-hover:block z-50">
              <a href="#/customer/dashboard" class="block px-4 py-2 text-sm text-secondary hover:text-primary hover:bg-surface-container-high">Dashboard</a>
              <a href="#/customer/profile" class="block px-4 py-2 text-sm text-secondary hover:text-primary hover:bg-surface-container-high">Profile</a>
              <a href="#/customer/orders" class="block px-4 py-2 text-sm text-secondary hover:text-primary hover:bg-surface-container-high">Orders</a>
              ${store.get('admin') ? '<a href="#/admin/dashboard" class="block px-4 py-2 text-sm text-secondary hover:text-primary hover:bg-surface-container-high border-t border-on-surface/5">Admin Panel</a>' : ''}
              <button onclick="app.handleLogout()" class="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50">Logout</button>
            </div>
          </div>
        </div>
      `;
      if (store.get('admin')) {
        const adminLink = document.createElement('a');
        adminLink.href = '#/admin/dashboard';
        adminLink.className = 'hidden md:flex items-center gap-1 text-xs font-medium text-secondary hover:text-primary border border-on-surface/20 px-3 py-1.5 rounded transition-500';
        adminLink.innerHTML = '<span>⚙️</span> Admin';
        $('#app-nav')?.prepend(adminLink);
      }
    } else {
      nav.innerHTML = `
        <div class="flex items-center gap-3">
          <a href="#/auth/login" class="text-sm text-secondary hover:text-primary transition-500">Login</a>
          <a href="#/auth/register" class="text-sm bg-primary text-on-primary px-4 py-2 rounded hover:opacity-90 transition-500">Register</a>
        </div>
      `;
    }
  }
  window.app = window.app || {};
  window.app.handleLogout = async function () {
    try { await api.auth.logout(); } catch {}
    localStorage.removeItem(CONFIG.TOKEN_KEY);
    localStorage.removeItem(CONFIG.REFRESH_KEY);
    localStorage.removeItem(CONFIG.USER_KEY);
    store.set('user', null);
    store.set('cart', []);
    toast.success('Logged out successfully');
    loadNav();
    router.navigate('customer/menu');
  };
  window.app.loadNav = loadNav;
  store.on('user', () => loadNav());
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
