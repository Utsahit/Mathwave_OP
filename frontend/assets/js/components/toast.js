const toast = {
  show(message, type) {
    type = type || 'info';
    const colors = { info: 'bg-blue-600', success: 'bg-green-700', error: 'bg-red-600', warning: 'bg-amber-600' };
    const bg = colors[type] || colors.info;
    const el = document.createElement('div');
    el.className = `fixed top-6 right-6 z-[9999] ${bg} text-white px-6 py-3.5 rounded-lg shadow-2xl font-medium text-sm max-w-sm transition-all duration-500 translate-x-0 opacity-0`;
    el.textContent = message;
    document.body.appendChild(el);
    requestAnimationFrame(() => {
      el.style.transform = 'translateX(0)';
      el.style.opacity = '1';
    });
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateX(100%)';
      setTimeout(() => el.remove(), 400);
    }, 3500);
  },
  success(m) { this.show(m, 'success'); },
  error(m) { this.show(m, 'error'); },
  info(m) { this.show(m, 'info'); },
  warning(m) { this.show(m, 'warning'); },
};
