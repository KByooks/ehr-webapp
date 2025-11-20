// ============================================
// patient-search.js
//
// Responsibilities:
//   • Render and manage the Patient Search table
//   • Support manual search via filters + button/Enter
//   • Handle "new patient" → Demographics
//   • Handle double-click on row with appointment-awareness:
//        - If scheduling an appointment → return patient to modal
//        - Otherwise → open Demographics for that patient
//   • Support prefill when coming from AppointmentModal
//        (EHRState.setPrefillPatient + consumePrefillPatient)
// ============================================

window.PatientSearch = {
  initialized: false,
  table: null,

  // ------------------------------------------------
  // init()
  // Called once per app lifetime when patient view
  // is first loaded (hooked via view:loaded).
  // ------------------------------------------------
  init() {
    if (this.initialized) return;
    this.initialized = true;

    console.log("[PatientSearch] init");

    // ---------------------------------------------
    // Core SearchTable wiring
    // ---------------------------------------------
    this.table = new SearchTable({
      endpoint: "/api/patients/search",
      tableBody: "#patient-results tbody",
      trigger: "#search-btn",

      // Map filter fields → query params
      filters: {
        firstName: "#filter-firstName",
        lastName: "#filter-lastName",
        dob: "#filter-dob",
        phone: "#filter-phone",
        email: "#filter-email",
        city: "#filter-city",
        state: "#filter-state",
        zip: "#filter-zip",
      },

      // Columns rendered in the results table
      columns: [
        { key: "firstName" },
        { key: "lastName" },
        { key: "dob" },
        { key: "phone" },
        { key: "address" },
        { key: "city" },
        { key: "state" },
        { key: "zip" },
        { key: "email" },
      ],

      // 🔥 Context-aware double-click:
      //   If in appointment flow → return patient to scheduler/modal
      //   else → open demographics
      onRowDblClick: (patient) => this.handlePatientDblClick(patient),

      // Extracts patient list from API response
      extractList: (d) => d.patients || [],

      // We do NOT auto-search on load; only on:
      //   - manual click
      //   - Enter in filter
      //   - explicit prefill from AppointmentModal
      autoSearch: false,
    });

    // ---------------------------------------------
    // "New Patient" button → Demographics (new)
    // ---------------------------------------------
    document.getElementById("new-patient-btn")?.addEventListener("click", () => {
      window.EHRState?.setDemographicsContext?.({
        mode: "new",
        patientId: null,
        returnTo: null,
      });

      window.ViewManager.loadView("demographics", "/fragments/demographics");
    });
  },

  // ------------------------------------------------
  // handlePatientDblClick(patient)
  //
  // If we have an active appointment in EHRState:
  //    → We are in scheduling flow. Send patient back
  //      to the appointment modal via pendingReturn.
  //
  // If not:
  //    → Standalone patient search. Open demographics.
  // ------------------------------------------------
  async handlePatientDblClick(patient) {
    const active = window.EHRState?.getActiveAppointment?.();

    if (active) {
      // 🔥 Appointment flow: return to scheduler/modal
      console.log("[PatientSearch] dblclick → return to appointment modal", patient);

      // feed the chosen patient back into the pipeline
      window.EHRState?.setPendingReturn?.("patient", patient);

      // scheduler will restore modal + inject patient
      await window.ViewManager.loadView("scheduler", "/fragments/scheduler");
      return;
    }

    // Normal standalone mode → open demographics
    this.openDemographics(patient.id);
  },

  // ------------------------------------------------
  // onShown()
  //
  // Called whenever the patient view becomes visible.
  // Used to apply prefill ONLY when something explicitly
  // set EHRState.setPrefillPatient(...) beforehand.
  //
  // That means:
  //   - Coming from AppointmentModal: yes, prefill
  //   - Just navigating manually: do nothing
  //   - Returning without prefill: keep whatever is on screen
  // ------------------------------------------------
  async onShown() {
    const pf = window.EHRState?.consumePrefillPatient?.();
    if (!pf) return;

    const first = pf.first ?? pf.firstName ?? "";
    const last = pf.last ?? pf.lastName ?? "";

    if (!first && !last) return;

    console.log("[PatientSearch] onShown prefill:", { first, last });
    await this.prefillAndSearch({ first, last });
  },

  // ------------------------------------------------
  // prefillAndSearch({ first, last })
  //
  // Writes values into the first/last name filters and
  // triggers the first page search via SearchTable.
  // ------------------------------------------------
  async prefillAndSearch(prefill) {
    if (!prefill) return;

    const first = prefill.first ?? "";
    const last = prefill.last ?? "";

    const firstInput = document.querySelector("#filter-firstName");
    const lastInput = document.querySelector("#filter-lastName");

    if (firstInput) firstInput.value = first;
    if (lastInput) lastInput.value = last;

    this.table.page = 0;
    await this.table.search();
  },

  // ------------------------------------------------
  // openDemographics(patientId)
  //
  // Opens Demographics in "edit" mode for the chosen patient.
  // Used when NOT in appointment scheduling flow.
  // ------------------------------------------------
  openDemographics(patientId) {
    window.EHRState?.setDemographicsContext?.({
      mode: "edit",
      patientId,
      returnTo: null,
    });

    window.ViewManager.loadView("demographics", "/fragments/demographics");
  },
};

// --------------------------------------------------------
// Lifecycle hooks
//   - view:loaded → initialize once
//   - view:shown  → optional prefill if coming from appointment
// --------------------------------------------------------
document.addEventListener("view:loaded", (e) => {
  if (e.detail.name === "patient") window.PatientSearch.init();
});

document.addEventListener("view:shown", (e) => {
  if (e.detail.name === "patient") window.PatientSearch.onShown();
});
