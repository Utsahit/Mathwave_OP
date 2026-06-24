const CONFIG = {
  API_BASE: (function () {
    if (window.__API_BASE__) return window.__API_BASE__;
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') return 'http://localhost:5000/api/v1';
    return 'https://elixir-oak-api.onrender.com/api/v1';
  })(),
  APP_NAME: 'Elixir & Oak',
  TOKEN_KEY: 'eao_access_token',
  REFRESH_KEY: 'eao_refresh_token',
  USER_KEY: 'eao_user',
};
