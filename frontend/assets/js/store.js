const store = {
  _state: { user: null, cart: [], notifications: 0, admin: false },
  _listeners: {},
  get(key) { return this._state[key]; },
  set(key, val) {
    this._state[key] = val;
    (this._listeners[key] || []).forEach(fn => fn(val));
  },
  on(key, fn) {
    (this._listeners[key] = this._listeners[key] || []).push(fn);
    return () => { this._listeners[key] = this._listeners[key].filter(f => f !== fn); };
  },
  update(key, fn) { this.set(key, fn(this._state[key])); },
};
