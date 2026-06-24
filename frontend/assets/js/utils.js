function $(sel, ctx) { return (ctx || document).querySelector(sel); }
function $$(sel, ctx) { return Array.from((ctx || document).querySelectorAll(sel)); }
function html(strings, ...vals) {
  return strings.reduce((acc, str, i) => acc + str + (vals[i] || ''), '');
}
function esc(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}
function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
}
function formatTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}
function formatDateTime(iso) {
  if (!iso) return '';
  return `${formatDate(iso)} ${formatTime(iso)}`;
}
function formatCurrency(n) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n || 0);
}
function getParams() {
  const hash = location.hash.slice(1);
  const parts = hash.split('?');
  const params = {};
  if (parts[1]) {
    parts[1].split('&').forEach(p => {
      const [k, v] = p.split('=');
      params[decodeURIComponent(k)] = decodeURIComponent(v || '');
    });
  }
  return { route: parts[0].split('/').filter(Boolean), params };
}
function loadingSpinner() {
  return '<div class="flex justify-center items-center py-20"><div class="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div></div>';
}
function emptyState(icon, title, desc) {
  return `<div class="text-center py-16 px-4"><div class="text-5xl mb-4 opacity-30">${icon}</div><h3 class="text-xl font-display text-primary mb-2">${esc(title)}</h3><p class="text-secondary text-sm">${esc(desc)}</p></div>`;
}
function errorState(msg) {
  return `<div class="text-center py-16 px-4"><div class="text-5xl mb-4">⚠️</div><h3 class="text-xl font-display text-primary mb-2">Something went wrong</h3><p class="text-secondary text-sm">${esc(msg || 'Please try again.')}</p></div>`;
}
function navItem(label, href, icon, active) {
  const a = document.createElement('a');
  a.href = href;
  a.className = `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-500 ${active ? 'bg-primary/10 text-primary' : 'text-secondary hover:bg-surface-container-high hover:text-primary'}`;
  if (icon) {
    const ic = document.createElement('span');
    ic.className = 'text-lg';
    ic.textContent = icon;
    a.prepend(ic);
  }
  a.append(label);
  return a.outerHTML;
}
