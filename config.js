/* X2 LOTO / ЧҮКӨ — LMS integration config v20 */
(() => {
  const q = new URLSearchParams(window.location.search);

  window.X2_GAME_CONFIG = {
    // LMS should launch the game with ?gameId=<numeric LMS game id>.
    // 137 is intentionally NOT hardcoded: it was supplied only as a request example.
    gameId: q.get('gameId') || 'CHUKO',

    denomination: Number(q.get('denomination') || 100),
    denominations: (q.get('denominations') || '25,50,100')
      .split(',').map(Number).filter(n => Number.isFinite(n) && n > 0),

    language: String(q.get('language') || 'RU').toUpperCase(),
    currency: String(q.get('currency') || 'KGS').toUpperCase(),
    currencyDisplay: q.get('currencyDisplay') || 'сом',

    mode: String(q.get('mode') || 'real').toLowerCase(),
    demoAllowed: String(q.get('demoAllowed') ?? 'true').toLowerCase() === 'true',
    demoBalance: Number(q.get('demoBalance') || 10000),

    // Public GitHub preview stays in mock mode.
    // LMS integration test: add ?mock=false and send X2_LMS_INIT from the parent LMS.
    mock: String(q.get('mock') ?? 'true').toLowerCase() !== 'false',

    apiBase: 'https://dev.superloto.kg',
    endpoints: {
      users: '/api/Lotto.Users.cls'
    },
    methods: {
      payTicket: 'PayTicket',
      // No balance method was supplied yet. LMS should pass the current balance in X2_LMS_INIT.
      // If the backend exposes one later, put its Method name here, e.g. 'GetBalance'.
      balance: null
    },

    initMode: 'postMessage',

    // PayTicket example has no token parameter, so browser session/cookies are used by default.
    // Change to 'postMessage' only if LMS wants to pass a session token/header explicitly.
    sessionMode: 'cookie',
    sessionQueryParam: 'session',
    sessionHeader: 'X-Session-ID',

    parentOrigin: '*',
    allowedParentOrigins: ['*'],
    requestTimeoutMs: 10000
  };
})();
