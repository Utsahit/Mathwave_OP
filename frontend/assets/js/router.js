const router = {
  _routes: [],
  _guards: [],
  _current: null,
  _container: null,
  init(container) {
    this._container = container;
    window.addEventListener('hashchange', () => this._handle());
    this._handle();
  },
  add(pattern, handler, meta) {
    const parts = pattern.split('/').filter(Boolean);
    this._routes.push({ pattern, parts, handler, meta: meta || {} });
    return this;
  },
  guard(fn) { this._guards.push(fn); return this; },
  navigate(hash) { location.hash = hash; },
  async _handle() {
    const { route, params } = getParams();
    let match = null;
    let routeParams = { ...params };
    for (const r of this._routes) {
      if (r.parts.length !== route.length && !r.parts.includes('*')) continue;
      let matched = true;
      const rp = {};
      for (let i = 0; i < r.parts.length; i++) {
        if (r.parts[i] === '*') { break; }
        if (r.parts[i].startsWith(':')) {
          rp[r.parts[i].slice(1)] = route[i];
        } else if (r.parts[i] !== route[i]) {
          matched = false;
          break;
        }
      }
      if (matched) { match = r; routeParams = { ...rp, ...params }; break; }
    }
    if (!match) { this.navigate('customer/menu'); return; }
    for (const guard of this._guards) {
      const redirect = await guard(match, routeParams);
      if (redirect) { this.navigate(redirect); return; }
    }
    if (this._current && this._current.cleanup) this._current.cleanup();
    this._current = match.handler;
    const container = this._container;
    container.innerHTML = loadingSpinner();
    try {
      const html = await match.handler.render(routeParams);
      container.innerHTML = html;
      if (match.handler.mount) await match.handler.mount(routeParams);
    } catch (e) {
      container.innerHTML = errorState(e.message || 'Failed to load page.');
    }
  },
};
