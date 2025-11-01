// ============================================
// ehr-context.js
// Global context for scheduler <-> patient search flow
// ============================================

window.EHRContext = (function () {
  const state = {
    activeAppointment: null,
    selectedPatient: null,
    wasJustAssigned: false,
  };

  function persist() {
    sessionStorage.setItem("ehr_state", JSON.stringify(state));
  }

  function load() {
    const raw = sessionStorage.getItem("ehr_state");
    if (raw) Object.assign(state, JSON.parse(raw));
  }

  // --- Appointment context ---
  function setActiveAppointment(providerId, startISO) {
    state.activeAppointment = { providerId, startISO };
    persist();
    console.log("📌 Active appointment set:", state.activeAppointment);
  }

  function getActiveAppointment() {
    load();
    return state.activeAppointment;
  }

  // --- Patient context ---
  function setSelectedPatient(patient) {
    state.selectedPatient = patient;
    persist();
    console.log("👤 Selected patient set:", state.selectedPatient);
  }

  function getSelectedPatient() {
    load();
    return state.selectedPatient;
  }

  // --- Flow control ---
  function setReturnContext({ providerId, startISO }) {
    setActiveAppointment(providerId, startISO);
    state.wasJustAssigned = false;
    persist();
  }

  function markJustAssigned(flag = true) {
    state.wasJustAssigned = flag;
    persist();
  }

  function wasJustAssigned() {
    load();
    return state.wasJustAssigned;
  }

  function clearAppointmentContext() {
    Object.assign(state, { activeAppointment: null, selectedPatient: null, wasJustAssigned: false });
    persist();
    console.log("🧹 Cleared appointment context");
  }

  return {
    setActiveAppointment,
    getActiveAppointment,
    setSelectedPatient,
    getSelectedPatient,
    setReturnContext,
    markJustAssigned,
    wasJustAssigned,
    clearAppointmentContext,
  };
})();
