const api = {
  async request(method, path, body) {
    const url = `${CONFIG.API_BASE}${path}`;
    const headers = { 'Content-Type': 'application/json' };
    const token = localStorage.getItem(CONFIG.TOKEN_KEY);
    if (token) headers['Authorization'] = `Bearer ${token}`;
    try {
      const res = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (res.status === 401) {
        const refreshed = await this._refresh();
        if (refreshed) {
          headers['Authorization'] = `Bearer ${localStorage.getItem(CONFIG.TOKEN_KEY)}`;
          const retry = await fetch(url, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
          });
          const data = await retry.json();
          if (!retry.ok) throw { status: retry.status, ...data };
          return data;
        }
        this._clearAuth();
        throw { status: 401, message: 'Session expired. Please login again.' };
      }
      const data = await res.json();
      if (!res.ok) throw { status: res.status, ...data };
      return data;
    } catch (e) {
      if (e && e.status) throw e;
      throw { status: 0, message: 'Network error. Please check your connection.', errors: [e] };
    }
  },
  async _refresh() {
    const refresh = localStorage.getItem(CONFIG.REFRESH_KEY);
    if (!refresh) return false;
    try {
      const res = await fetch(`${CONFIG.API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: refresh }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      if (data.data) {
        localStorage.setItem(CONFIG.TOKEN_KEY, data.data.accessToken);
        if (data.data.refreshToken) {
          localStorage.setItem(CONFIG.REFRESH_KEY, data.data.refreshToken);
        }
        return true;
      }
      return false;
    } catch { return false; }
  },
  _clearAuth() {
    localStorage.removeItem(CONFIG.TOKEN_KEY);
    localStorage.removeItem(CONFIG.REFRESH_KEY);
    localStorage.removeItem(CONFIG.USER_KEY);
    store.set('user', null);
  },
  get(path) { return this.request('GET', path); },
  post(path, body) { return this.request('POST', path, body); },
  put(path, body) { return this.request('PUT', path, body); },
  patch(path, body) { return this.request('PATCH', path, body); },
  delete(path) { return this.request('DELETE', path); },
};

api.auth = {
  login(email, password) {
    return api.post('/auth/login', { email, password });
  },
  register(data) {
    return api.post('/auth/register', data);
  },
  forgotPassword(email) {
    return api.post('/auth/forgot-password', { email });
  },
  resetPassword(token, password) {
    return api.post('/auth/reset-password', { token, password });
  },
  logout() {
    return api.post('/auth/logout', { refreshToken: localStorage.getItem(CONFIG.REFRESH_KEY) });
  },
  me() {
    return api.get('/auth/me');
  },
};
