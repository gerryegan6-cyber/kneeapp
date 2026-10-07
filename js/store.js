/* Saved on this phone only (localStorage). Wrapped in try/catch so the app still works if storage is blocked. */
(function () {
  const KA = (window.KA = window.KA || {});
  const KEY = 'kneeapp.v1';
  const defaults = () => ({ v: 1, stage: 1, knee: 'both', bothLegs: true, sessions: [], equip: {},
    settings: { sound: true, voice: false, vibrate: true }, remindTime: '18:00' });
  let data = defaults();
  try { const raw = localStorage.getItem(KEY); if (raw) data = Object.assign(defaults(), JSON.parse(raw)); } catch (e) { /* ignore */ }
  data.settings = Object.assign({ sound: true, voice: false, vibrate: true }, data.settings);
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* ignore */ } };
  KA.Store = {
    get d() { return data; },
    save,
    replace(obj) { data = Object.assign(defaults(), obj); save(); },
    reset() { data = defaults(); save(); },
  };
})();
