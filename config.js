/*
  X2 LOTO / ЧҮКӨ — LMS integration config v19

  LMS controls:
  - language
  - currency / currencyDisplay
  - denominations
  - initial mode: "real" | "demo"
  - demoAllowed: whether user may switch REAL/DEMO
*/
window.X2_GAME_CONFIG = {
  gameId: 'CHUKO',

  denomination: 100,
  denominations: [25, 50, 100],

  language: 'RU',

  currency: 'KGS',
  currencyDisplay: 'сом',

  mode: 'real',
  demoAllowed: true,
  demoBalance: 10000,

  // Demo package default.
  // Production LMS: set false.
  mock: true,

  apiBase: '',
  endpoints: {
    balance: '/api/lms/player/balance',
    newGame: '/api/lms/game/new'
  },

  initMode: 'postMessage',
  sessionMode: 'postMessage',

  sessionQueryParam: 'session',
  sessionHeader: 'X-Session-ID',

  parentOrigin: '*',
  allowedParentOrigins: ['*'],

  requestTimeoutMs: 10000
};
