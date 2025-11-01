// ==============================================
// fragment-loader.js
// Handles dynamic Thymeleaf fragment injection
// ==============================================

window.FragmentLoader = (function () {
  const contentContainerId = "main-content";

  async function load(section, params = {}) {
    const container = document.getElementById(contentContainerId);
    if (!container) {
      console.error(`#${contentContainerId} missing`);
      return;
    }

    const query = new URLSearchParams(params).toString();
    const url = `/fragments/${section}${query ? "?" + query : ""}`;

    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error("Failed to load fragment");
      const html = await resp.text();
      container.innerHTML = html;

      // ✅ Dispatch an event so other modules (calendar, patient search, etc.) know what just loaded
      document.dispatchEvent(new CustomEvent("fragment:loaded", {
        detail: { section, params }
      }));
    } catch (err) {
      console.error("Fragment load error:", err);
      container.innerHTML = `<p style="color:red;">Error loading ${section}</p>`;
    }
  }

  return { load };
})();

// ==============================================
// Global fragment-load handler
// ==============================================
document.addEventListener("fragment:loaded", (e) => {
  // Scheduler loaded → initialize calendar
  if (e.detail.section === "scheduler" && typeof initSchedulerCalendar === "function") {
    initSchedulerCalendar();
  }

  // Patient fragment loaded → initialize patient search
  if (e.detail.section === "patient" && window.PatientSearch?.init) {
    window.PatientSearch.init(e.detail.params || {});
  }

  // ✅ Scheduler loaded after returning from patient search → reopen modal with selected patient
  if (e.detail.section === "scheduler" && typeof window.handleReturnFromPatientSearch === "function") {
    window.handleReturnFromPatientSearch();
  }
});
