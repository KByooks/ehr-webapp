// ============================================
// app.js
// Central app boot + single source of truth for navigation
// ============================================

// Expose a single global loadSection that proxies to FragmentLoader.
// Accepts optional params object (e.g., { firstName, lastName }).
window.loadSection = function loadSection(sectionName, params = {}) {
  return window.FragmentLoader.load(sectionName, params);
};

// Default section on first load
window.addEventListener("DOMContentLoaded", () => {
  loadSection("scheduler");
});

// React to fragment loads and (re)initialize features
document.addEventListener("fragment:loaded", (e) => {
  const { section, params } = e.detail || {};

  switch (section) {
    case "scheduler":
      if (typeof window.initSchedulerCalendar === "function") {
        window.initSchedulerCalendar();
      } else {
        console.warn("initSchedulerCalendar not found.");
      }
      break;

    case "patient":
      if (window.PatientSearch?.init) {
        window.PatientSearch.init(params || {});
      } else {
        console.warn("PatientSearch.init not found.");
      }
      break;

    case "billing":
      if (window.Billing?.init) window.Billing.init();
      break;

    case "reports":
      if (window.Reports?.init) window.Reports.init();
      break;

    default:
      console.log(`Loaded section: ${section}`);
  }
});

// Utility: Open scheduler in a new popup window
window.openScheduleInNewWindow = function openScheduleInNewWindow(providerId = 1) {
  window.open(`/scheduler-popup?providerId=${providerId}`, "_blank", "width=1000,height=700");
};
