// ============================================
// ehr-state.js — Global session state manager
// Single Source of Truth for cross-view navigation
// ============================================
//
// This module stores small pieces of state that must
// survive view swaps (scheduler ↔ patient search ↔ demographics).
//
// All storage happens in sessionStorage so the state persists
// across soft navigation but resets on full page reload.
//
// Structure aligns to "Architecture A"
// (persistent appointment modal, state-driven return flow).
// ============================================

window.EHRState = (() => {

	// Single storage key in sessionStorage
	const KEY = "ehr_state_v2";

	// Default backbone of the state store
	let state = {
		activeAppointment: null,     // Snapshot of modal when switching views
		prefillPatient: null,        // Patient name fragments used to prefill search
		prefillProvider: null,       // Provider name fragments used for provider search
		pendingReturn: null,         // { field, entity } returned to appointment modal
		lastSection: "scheduler",    // Last open section to restore on startup
		demographicsContext: null,   // Tells demographics which patient/mode to load
	};

	// ---- Internal helpers ----

	// Load state from sessionStorage (only merges known keys)
	const load = () => {
		const raw = sessionStorage.getItem(KEY);
		if (!raw) return;
		try {
			state = { ...state, ...JSON.parse(raw) };
		} catch (err) {
			console.warn("EHRState load failed:", err);
		}
	};

	// Save the entire state tree into sessionStorage
	const save = () => {
		sessionStorage.setItem(KEY, JSON.stringify(state));
	};

	// Update a single field in state
	const update = (key, val) => {
		load();
		state[key] = val;
		save();
	};

	// ---- Public API ----
	return {

		// ===============================================
		// ACTIVE APPOINTMENT SNAPSHOT
		// Used when leaving the appointment modal
		// ===============================================
		saveActiveAppointment(apptData) {
			const providerId = apptData?.providerId || null;
			const startISO = `${apptData?.date || ""}T${apptData?.timeStart || ""}`;

			update("activeAppointment", { providerId, startISO, apptData });

		},

		getActiveAppointment() {
			load();
			return state.activeAppointment;
		},

		clearActiveAppointment() {
			update("activeAppointment", null);
		},


		// ===============================================
		// PREFILL INPUTS (PATIENT + PROVIDER)
		// Used by Patient Search / Provider Search
		// ===============================================
		setPrefillPatient(obj) {
			update("prefillPatient", obj || null);
		},

		consumePrefillPatient() {
			load();
			const v = state.prefillPatient;
			state.prefillPatient = null;  // auto-clear after consumption
			save();
			return v;
		},

		setPrefillProvider(obj) {
			update("prefillProvider", obj || null);
		},

		consumePrefillProvider() {
			load();
			const v = state.prefillProvider;
			state.prefillProvider = null;
			save();
			return v;
		},


		// ===============================================
		// RETURN PAYLOAD (critical for appointment modal)
		// Example: { field: "patient", entity: { ...patient } }
		// ===============================================
		setPendingReturn(field, entity) {
			update("pendingReturn", { field, entity });
		},

		consumePendingReturn() {
			load();
			const v = state.pendingReturn;
			state.pendingReturn = null;  // auto-clear after use
			save();
			return v;
		},


		// ===============================================
		// LAST VIEW / SECTION
		// Used on startup to reopen previous tab
		// ===============================================
		setLastSection(sectionName) {
			update("lastSection", sectionName || "scheduler");
		},

		getLastSection() {
			load();
			return state.lastSection;
		},


		// ===============================================
		// DEMOGRAPHICS CONTEXT
		// Tells demographics page which patient to load, mode, etc.
		// ===============================================
		setDemographicsContext(ctx) {
			update("demographicsContext", ctx || null);
		},

		consumeDemographicsContext() {
			load();
			const v = state.demographicsContext;
			state.demographicsContext = null;
			save();
			return v;
		},


		// ===============================================
		// COMPLETE RESET (rare)
		// ===============================================
		clearAll() {
			state = {
				activeAppointment: null,
				prefillPatient: null,
				prefillProvider: null,
				pendingReturn: null,
				lastSection: "scheduler",
				demographicsContext: null,
			};
			save();
		},
	};
})();
