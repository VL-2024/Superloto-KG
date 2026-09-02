(function (global) {
  'use strict';

  const cfg = global.X2_GAME_CONFIG || {};
  const params = new URLSearchParams(global.location.search);

  let session = params.get(cfg.sessionQueryParam || 'session') || null;
  let sessionResolve = null;
  let initResolve = null;
  let runtimeInit = null;
  let lastRealBalance = null;

  let mockCounter = 0;
  const mockBalances = {KGS:12450, RUB:50000, USD:150, EUR:140};

  const sessionPromise = new Promise(resolve => {
    sessionResolve = resolve;
    if (session) resolve(session);
  });

  const initPromise = new Promise(resolve => {
    initResolve = resolve;
  });

  function isAllowedOrigin(origin) {
    const allowed = cfg.allowedParentOrigins || ['*'];
    return allowed.includes('*') || allowed.includes(origin);
  }

  function targetOrigin() {
    return cfg.parentOrigin && cfg.parentOrigin !== '*' ? cfg.parentOrigin : '*';
  }

  function emit(type, payload = {}) {
    if (global.parent && global.parent !== global) {
      global.parent.postMessage({source:'X2_CHUKO', type, ...payload}, targetOrigin());
    }
  }

  function parseNumbers(value) {
    if (Array.isArray(value)) return value.map(Number).filter(Number.isFinite);
    if (typeof value !== 'string') return null;
    return value.split(',').map(x => Number(x.trim())).filter(Number.isFinite);
  }

  function querySettings() {
    const denominations = parseNumbers(params.get('denominations'));
    return {
      gameId: params.get('gameId') || cfg.gameId || 'CHUKO',
      denomination: Number(params.get('denomination') || cfg.denomination || 100),
      denominations: denominations || cfg.denominations || [cfg.denomination || 100],
      currency: String(params.get('currency') || cfg.currency || 'KGS').toUpperCase(),
      currencyDisplay: params.get('currencyDisplay') || cfg.currencyDisplay || cfg.currency || 'KGS',
      language: String(params.get('language') || cfg.language || 'RU').toUpperCase(),
      mode: String(params.get('mode') || cfg.mode || 'real').toLowerCase(),
      demoAllowed: String(params.get('demoAllowed') ?? cfg.demoAllowed).toLowerCase() === 'true',
      demoBalance: Number(params.get('demoBalance') || cfg.demoBalance || 10000),
      balance: params.get('balance') != null ? Number(params.get('balance')) : undefined
    };
  }

  global.addEventListener('message', event => {
    if (!isAllowedOrigin(event.origin)) return;
    const data = event.data || {};

    if (data.type === 'X2_LMS_INIT') {
      runtimeInit = {
        gameId: data.gameId || cfg.gameId || 'CHUKO',
        denomination: data.denomination,
        denominations: data.denominations,
        currency: data.currency,
        currencyDisplay: data.currencyDisplay || data.currencyLabel || data.currencySymbol,
        language: data.language,
        mode: data.mode,
        demoAllowed: data.demoAllowed,
        demoBalance: data.demoBalance,
        balance: data.balance
      };

      if (Number.isFinite(Number(data.balance))) lastRealBalance = Number(data.balance);

      if (data.session) {
        session = String(data.session);
        if (sessionResolve) sessionResolve(session);
      }

      if (initResolve) initResolve(runtimeInit);
      return;
    }

    if (data.type === 'X2_LMS_SESSION' && data.session) {
      session = String(data.session);
      if (sessionResolve) sessionResolve(session);
    }

    if (data.type === 'X2_LMS_BALANCE' && Number.isFinite(Number(data.balance))) {
      lastRealBalance = Number(data.balance);
    }
  });

  function makeError(code, message, status) {
    const err = new Error(message || code);
    err.code = code;
    err.status = status;
    return err;
  }

  async function getGameSettings() {
    if (cfg.mock || cfg.initMode === 'config' || global.parent === global) {
      const q = querySettings();
      if (Number.isFinite(Number(q.balance))) lastRealBalance = Number(q.balance);
      return q;
    }

    if (runtimeInit) return {...querySettings(), ...runtimeInit};

    emit('X2_GAME_READY', {
      gameId: params.get('gameId') || cfg.gameId || 'CHUKO',
      needsInit: true,
      needsSession: cfg.sessionMode === 'postMessage'
    });

    const timeout = Number(cfg.requestTimeoutMs || 10000);
    const supplied = await Promise.race([
      initPromise,
      new Promise((_, reject) => setTimeout(
        () => reject(makeError('INIT_TIMEOUT', 'LMS did not send X2_LMS_INIT')),
        timeout
      ))
    ]);

    return {...querySettings(), ...supplied};
  }

  async function waitForSession() {
    if (cfg.mock || cfg.sessionMode === 'cookie' || cfg.sessionMode === 'none') return null;
    if (session) return session;

    if (cfg.sessionMode === 'query') {
      throw makeError('SESSION_REQUIRED', 'Session query parameter is missing');
    }

    const timeout = Number(cfg.requestTimeoutMs || 10000);
    return Promise.race([
      sessionPromise,
      new Promise((_, reject) => setTimeout(
        () => reject(makeError('SESSION_TIMEOUT', 'LMS session was not provided by parent iframe')),
        timeout
      ))
    ]);
  }

  function unwrapPayload(value) {
    if (!value || typeof value !== 'object') return value || {};
    for (const key of ['data', 'result', 'response']) {
      if (value[key] && typeof value[key] === 'object' && !Array.isArray(value[key])) {
        return {...value, ...value[key]};
      }
    }
    return value;
  }

  async function apiRequest(path, options = {}) {
    const sessionValue = await waitForSession();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Number(cfg.requestTimeoutMs || 10000));

    const headers = {Accept:'application/json', ...(options.headers || {})};
    if (sessionValue && cfg.sessionHeader) headers[cfg.sessionHeader] = sessionValue;

    try {
      const response = await fetch((cfg.apiBase || '') + path, {
        method: options.method || 'GET',
        headers,
        credentials:'include',
        signal:controller.signal,
        cache:'no-store'
      });

      const rawText = await response.text();
      let parsed = {};
      if (rawText) {
        try { parsed = JSON.parse(rawText); }
        catch (_) { parsed = {raw:rawText}; }
      }
      const data = unwrapPayload(parsed);

      if (!response.ok || data.success === false || data.ok === false || data.error) {
        const code = data.code || data.errorCode ||
          (response.status === 401 ? 'SESSION_EXPIRED' :
           response.status === 409 ? 'INSUFFICIENT_FUNDS' :
           'LMS_HTTP_' + response.status);
        const message = data.message || data.error || data.errorMessage || 'LMS request failed';
        throw makeError(code, String(message), response.status);
      }

      return data;
    } catch (err) {
      if (err.name === 'AbortError') throw makeError('LMS_TIMEOUT', 'LMS request timed out');
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }

  function normalizeBalance(data, requestedCurrency) {
    const balance = Number(data.balance ?? data.newBalance ?? data.balanceAfterGame ?? data.amount);
    if (!Number.isFinite(balance)) {
      throw makeError('BAD_BALANCE_RESPONSE', 'LMS balance response has no numeric balance');
    }
    lastRealBalance = balance;
    return {
      balance,
      currency: String(data.currency || requestedCurrency || cfg.currency || 'KGS').toUpperCase(),
      currencyDisplay: data.currencyDisplay || data.currencyLabel || data.currencySymbol || cfg.currencyDisplay || requestedCurrency
    };
  }

  function normalizeTicket(data, requested) {
    const ticketId = data.ticketId ?? data.ticketID ?? data.ticket_id ?? data.ticketNumber ?? data.ticket_number ?? data.id;
    const scenario = Number(data.scenario ?? data.scenarioId ?? data.scenario_id ?? data.resultScenario);
    const win = Number(data.win ?? data.prize ?? data.winAmount ?? data.prizeAmount ?? 0);
    const balance = Number(data.balance ?? data.newBalance ?? data.balanceAfterGame);
    const denomination = Number(data.denomination ?? data.amount ?? requested.denomination);
    const currency = String(data.currency || requested.currency || cfg.currency || 'KGS').toUpperCase();

    if (ticketId == null || ticketId === '') throw makeError('BAD_TICKET_RESPONSE', 'LMS response has no ticketId');
    if (![1,2,3,4,5].includes(scenario)) throw makeError('BAD_SCENARIO_RESPONSE', 'Scenario must be 1..5');
    if (!Number.isFinite(win) || win < 0) throw makeError('BAD_WIN_RESPONSE', 'LMS response has invalid win');
    if (!Number.isFinite(balance)) throw makeError('BAD_BALANCE_RESPONSE', 'LMS ticket response has no numeric balance');

    lastRealBalance = balance;
    return {
      ticketId:String(ticketId),
      scenario,
      win,
      balance,
      denomination,
      currency,
      currencyDisplay: data.currencyDisplay || data.currencyLabel || data.currencySymbol || requested.currencyDisplay || cfg.currencyDisplay || currency,
      language:requested.language,
      multiplier:data.multiplier != null ? Number(data.multiplier) : null,
      raw:data
    };
  }

  async function getBalance({currency} = {}) {
    const cur = String(currency || cfg.currency || 'KGS').toUpperCase();

    if (cfg.mock) {
      await new Promise(r => setTimeout(r, 180));
      if (!(cur in mockBalances)) mockBalances[cur] = 1000;
      return {balance:mockBalances[cur], currency:cur, currencyDisplay:cfg.currencyDisplay || cur};
    }

    if (Number.isFinite(lastRealBalance)) {
      return {balance:lastRealBalance, currency:cur, currencyDisplay:cfg.currencyDisplay || cur};
    }

    const balanceMethod = cfg.methods && cfg.methods.balance;
    if (!balanceMethod) {
      throw makeError('BALANCE_REQUIRED', 'LMS must send balance in X2_LMS_INIT or configure methods.balance');
    }

    const qs = new URLSearchParams({Method:String(balanceMethod)});
    const path = (cfg.endpoints && cfg.endpoints.users || '/api/Lotto.Users.cls') + '?' + qs.toString();
    const data = await apiRequest(path, {method:'GET'});
    return normalizeBalance(data, cur);
  }

  async function createTicket({gameId, denomination, currency, currencyDisplay, language}) {
    const cur = String(currency || cfg.currency || 'KGS').toUpperCase();
    const lang = String(language || cfg.language || 'RU').toUpperCase();

    if (cfg.mock) {
      await new Promise(r => setTimeout(r, 260));
      const forced = Number(params.get('scenario'));
      const scenario = [1,2,3,4,5].includes(forced) ? forced : ((mockCounter++ % 5) + 1);
      const mockMultipliers = {1:0,2:1,3:2,4:10,5:50};
      const multiplier = mockMultipliers[scenario];
      const win = Number(denomination) * multiplier;
      if (!(cur in mockBalances)) mockBalances[cur] = 1000;
      if (mockBalances[cur] < Number(denomination)) throw makeError('INSUFFICIENT_FUNDS', 'Insufficient mock balance', 409);
      mockBalances[cur] = mockBalances[cur] - Number(denomination) + win;
      return {
        ticketId:'MOCK-' + Date.now(), scenario, win, balance:mockBalances[cur],
        denomination:Number(denomination), currency:cur,
        currencyDisplay:currencyDisplay || cfg.currencyDisplay || cur,
        language:lang, multiplier
      };
    }

    const numericAmount = Number(denomination);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      throw makeError('BAD_AMOUNT', 'Ticket amount must be a positive number');
    }

    const payMethod = cfg.methods && cfg.methods.payTicket || 'PayTicket';
    const qs = new URLSearchParams({
      Method:String(payMethod),
      gameId:String(gameId),
      amount:String(numericAmount)
    });
    const path = (cfg.endpoints && cfg.endpoints.users || '/api/Lotto.Users.cls') + '?' + qs.toString();

    // LMS format supplied by Superloto programmer:
    // GET /api/Lotto.Users.cls?Method=PayTicket&gameId=137&amount=15
    const data = await apiRequest(path, {method:'GET'});

    return normalizeTicket(data, {
      gameId,
      denomination:numericAmount,
      currency:cur,
      currencyDisplay:currencyDisplay || cfg.currencyDisplay,
      language:lang
    });
  }

  async function createDemoTicket({gameId, denomination, currency, currencyDisplay, language, demoBalance}) {
    await new Promise(r => setTimeout(r, 180));
    const forced = Number(params.get('scenario'));
    const scenario = [1,2,3,4,5].includes(forced) ? forced : ((mockCounter++ % 5) + 1);
    const demoMultipliers = {1:0,2:1,3:2,4:10,5:50};
    const multiplier = demoMultipliers[scenario];
    const win = Number(denomination) * multiplier;
    const startBalance = Number(demoBalance || cfg.demoBalance || 10000);
    const nextBalance = startBalance - Number(denomination) + win;
    return {
      ticketId:'DEMO-' + Date.now(), scenario, win, balance:nextBalance,
      denomination:Number(denomination),
      currency:String(currency || cfg.currency || 'KGS').toUpperCase(),
      currencyDisplay:currencyDisplay || cfg.currencyDisplay || currency || '',
      language:String(language || cfg.language || 'RU').toUpperCase(),
      multiplier, demo:true
    };
  }

  global.X2LMS = {
    getGameSettings,
    getBalance,
    createTicket,
    createDemoTicket,
    emit,
    getSession:() => session
  };

  setTimeout(() => {
    emit('X2_GAME_READY', {
      gameId:params.get('gameId') || cfg.gameId || 'CHUKO',
      needsInit:!cfg.mock && cfg.initMode === 'postMessage',
      needsSession:!cfg.mock && cfg.sessionMode === 'postMessage'
    });
  }, 0);
})(window);
