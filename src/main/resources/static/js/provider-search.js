window.ProviderSearch = {
  init() {
    this.table = new SearchTable({
      endpoint: "/api/providers/search",
      tableBody: "#provider-results tbody",
      trigger: "#prov-search-btn",
      filters: {
        firstName: "#prov-firstName",
        lastName: "#prov-lastName",
        specialty: "#prov-specialty",
        phone: "#prov-phone",
        email: "#prov-email",
        activeOnly: "#prov-active",
        inPracticeOnly: "#prov-inPracticeOnly",
      },
      columns: [
        { key: "title" },
        { key: "firstName" },
        { key: "lastName" },
        { key: "specialty" },
        { key: "phone" },
        { key: "email" },
        { key: "active" },
        { key: "inPractice" },
      ],
      pageInfo: "#prov-page-info",
      prevBtn: "#prov-prev",
      nextBtn: "#prov-next",
      extractList: (d) => d.providers || [],
      onRowDblClick: (p) => this.selectProvider(p),
      autoSearch: false,
    });

    const prefill = window.EHRState?.consumePrefillProvider?.();
    if (prefill) {
      const fn = document.querySelector("#prov-firstName");
      const ln = document.querySelector("#prov-lastName");
      const chk = document.querySelector("#prov-inPracticeOnly");
      if (fn) fn.value = prefill.first || "";
      if (ln) ln.value = prefill.last || "";
      if (chk) chk.value = prefill.inPracticeOnly ? "true" : "";
      this.table.page = 0;
      this.table.search();
    }
  },

  selectProvider(provider) {
    if (!provider) return;

    const active = window.EHRState?.getActiveAppointment?.();

    // ---- Case 1: Appointment modal flow ----
    if (active) {
      window.EHRState.setPendingReturn("provider", provider);
      ViewManager.loadView("scheduler", "/fragments/scheduler");
      return;
    }

    // ---- Case 2: Scheduler top filter flow (switch calendar provider) ----
    const switching = sessionStorage.getItem("ehr_returnFromScheduler") === "true";
    if (switching) {
      console.log("✅ Returning to Scheduler with new provider calendar:", provider);
      // Clean up the temporary flags
      sessionStorage.removeItem("ehr_returnFromScheduler");
      sessionStorage.removeItem("ehr_prefillProvider");

      // Save selected provider for Scheduler calendar reload
      sessionStorage.setItem("ehr_selectedProvider", JSON.stringify(provider));

      // Load the Scheduler view again — calendar.js will use that saved provider
      ViewManager.loadView("scheduler", "/fragments/scheduler");
      return;
    }

    // ---- Case 3: Normal sidebar navigation ----
    console.log("ℹ️ ProviderSearch opened directly (would open demographics):", provider);
  },
};

document.addEventListener("view:loaded", (e) => {
  if (e.detail.name === "provider") window.ProviderSearch?.init();
});
