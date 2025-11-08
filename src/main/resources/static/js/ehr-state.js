// ============================================
// ehr-state.js — single source of truth for return flows
// ============================================

window.EHRState = (() => {
  const KEY = "ehr_state_v2";
  let state = {
    activeAppointment: null,
    prefillPatient: null,
    prefillProvider: null,
    pendingReturn: null,
  };

  const load = () => {
    const raw = sessionStorage.getItem(KEY);
    if (raw) state = { ...state, ...JSON.parse(raw) };
  };
  const save = () => sessionStorage.setItem(KEY, JSON.stringify(state));

  const update = (key, val) => {
    load();
    state[key] = val;
    save();
  };

  return {
    // ---- Appointment context ----
    saveActiveAppointment(apptData) {
      const providerId = apptData?.providerId || 1;
      const startISO = `${apptData?.date || ""}T${apptData?.timeStart || ""}`;
      update("activeAppointment", { providerId, startISO, apptData });
    },
    getActiveAppointment() { load(); return state.activeAppointment; },
    clearActiveAppointment() { update("activeAppointment", null); },

    // ---- Prefills ----
    setPrefillPatient(obj) { update("prefillPatient", obj || null); },
    consumePrefillPatient() { load(); const v = state.prefillPatient; state.prefillPatient = null; save(); return v; },

    setPrefillProvider(obj) { update("prefillProvider", obj || null); },
    consumePrefillProvider() { load(); const v = state.prefillProvider; state.prefillProvider = null; save(); return v; },

    // ---- Pending return ----
    setPendingReturn(field, entity) { update("pendingReturn", { field, entity }); },
    consumePendingReturn() { load(); const v = state.pendingReturn; state.pendingReturn = null; save(); return v; },

    // Optional util
    clearAll() { state = { activeAppointment:null, prefillPatient:null, prefillProvider:null, pendingReturn:null }; save(); },
  };
})();
