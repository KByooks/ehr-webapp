// =====================================
// context-manager.js
// Shared global context manager
// =====================================
window.EHRContext = (function () {
  const KEY_SELECTED_PATIENT = "selectedPatient";
  const KEY_RETURN_CTX = "returnToScheduler";

  function setSelectedPatient(p) {
    if (p) sessionStorage.setItem(KEY_SELECTED_PATIENT, JSON.stringify(p));
    else sessionStorage.removeItem(KEY_SELECTED_PATIENT);
  }

  function getSelectedPatient() {
    const val = sessionStorage.getItem(KEY_SELECTED_PATIENT);
    return val ? JSON.parse(val) : null;
  }

  function setReturnContext(ctx) {
    if (ctx) sessionStorage.setItem(KEY_RETURN_CTX, JSON.stringify(ctx));
    else sessionStorage.removeItem(KEY_RETURN_CTX);
  }

  function getReturnContext() {
    const val = sessionStorage.getItem(KEY_RETURN_CTX);
    return val ? JSON.parse(val) : null;
  }

  function clearAll() {
    sessionStorage.removeItem(KEY_SELECTED_PATIENT);
    sessionStorage.removeItem(KEY_RETURN_CTX);
  }

  return { setSelectedPatient, getSelectedPatient, setReturnContext, getReturnContext, clearAll };
})();
