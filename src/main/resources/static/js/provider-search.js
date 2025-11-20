// ============================================
// provider-search.js — supports prefill + search on view:shown
// ============================================

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

    // one-time prefill when fragment first loads
    const prefill = window.EHRState?.consumePrefillProvider?.();
    if (prefill) this.prefillAndSearch(prefill);
  },

  // called when view is shown (or init) to fill filters and trigger search
  async prefillAndSearch(prefill) {
    if (!prefill) return;

    // ✅ Fill in the fields
    const fn = document.querySelector("#prov-firstName");
    const ln = document.querySelector("#prov-lastName");
    const chk = document.querySelector("#prov-inPracticeOnly");

    if (fn) fn.value = prefill.first || "";
    if (ln) ln.value = prefill.last || "";

    // ✅ Always enforce in-practice when coming from scheduler/modal
    if (chk) {
      chk.checked = true;
      chk.value = "true";
    }

    // ✅ Run the search immediately
    this.table.page = 0;
    await this.table.search();
  },
  
 async onShown() {
    const pf = window.EHRState?.consumePrefillProvider?.();
    if (!pf) return;

    console.log("[ProviderSearch] onShown prefill:", pf);

    const first = pf.first ?? "";
    const last  = pf.last ?? "";

    // Fill inputs
    const fn = document.querySelector("#prov-firstName");
    const ln = document.querySelector("#prov-lastName");
    const chk = document.querySelector("#prov-inPracticeOnly");

    if (fn) fn.value = first;
    if (ln) ln.value = last;

    if (chk) {
      chk.checked = true;
      chk.value = "true";
    }

    // Trigger table search
    this.table.page = 0;
    this.table.search();
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

      // Persist selection for context
      sessionStorage.setItem("ehr_selectedProvider", JSON.stringify(provider));

      // ✅ Directly update scheduler without reload
      if (window.Scheduler?.updateProvider) {
        ViewManager.showView("scheduler");
        window.Scheduler.updateProvider(provider);
        if (window.currentCalendar)
          requestAnimationFrame(() => window.currentCalendar.updateSize());
      } else {
        // fallback if scheduler inactive
        ViewManager.loadView("scheduler", "/fragments/scheduler");
      }
      return;
    }

    // ---- Case 3: Normal sidebar navigation ----
    console.log("ℹ️ ProviderSearch opened directly (would open demographics):", provider);
  },
};

document.addEventListener("view:loaded", (e) => {
  if (e.detail.name === "provider") window.ProviderSearch?.init();
});

// --------------------------------------------------------
// Lifecycle hook — run prefill on showing provider view
// --------------------------------------------------------
document.addEventListener("view:shown", (e) => {
  if (e.detail.name === "provider") {
    window.ProviderSearch?.onShown?.();
  }
});

