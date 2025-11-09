// ============================================
// patient-search.js — supports prefill + search on view:shown
// ============================================

window.PatientSearch = {
  init() {
    this.table = new SearchTable({
      endpoint: "/api/patients/search",
      tableBody: "#patient-results tbody",
      trigger: "#search-btn",
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
      pageInfo: "#patient-page-info",
      prevBtn: "#patient-prev",
      nextBtn: "#patient-next",
      extractList: (d) => d.patients || [],
      onRowDblClick: (p) => this.selectPatient(p),
      autoSearch: false,
    });

    // one-time prefill when fragment first loads
    const prefill = window.EHRState?.consumePrefillPatient?.();
    if (prefill) this.prefillAndSearch(prefill);
  },

  // called when view is shown (or init) to fill filters and trigger search
  async prefillAndSearch(prefill) {
    if (!prefill) return;
    const fn = document.querySelector("#filter-firstName");
    const ln = document.querySelector("#filter-lastName");
    if (fn) fn.value = prefill.firstName || "";
    if (ln) ln.value = prefill.lastName || "";
    this.table.page = 0;
    await this.table.search();
  },

  selectPatient(patient) {
    const active = window.EHRState?.getActiveAppointment?.();
    if (active) {
      window.EHRState.setPendingReturn("patient", patient);
      ViewManager.loadView("scheduler", "/fragments/scheduler");
      return;
    }
  },
};

document.addEventListener("view:loaded", (e) => {
  if (e.detail.name === "patient") window.PatientSearch?.init();
});
