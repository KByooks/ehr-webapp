// ============================================
// app.js
// Central app boot + persistent navigation using ViewManager
// ============================================

// ✅ Core navigation helper — universal load function
window.loadSection = async function loadSection(sectionName, force = false) {
  const url = `/fragments/${sectionName}`;
  await window.ViewManager.loadView(sectionName, url, { force });
};

// ============================================
// INITIAL BOOT
// ============================================

window.addEventListener("DOMContentLoaded", () => {
  // Default section to show on startup
  loadSection("scheduler");
});

// ============================================
// ROUTER — Sidebar navigation (no reloads)
// ============================================

document.addEventListener("click", (e) => {
  const link = e.target.closest("[data-nav]");
  if (!link) return;
  e.preventDefault();

  const section = link.getAttribute("data-nav");
  if (!section) return;

  // Update hash (optional, for back/forward buttons)
  location.hash = section;

  // Load the section dynamically
  loadSection(section);
});

// ============================================
// LIFECYCLE: Initialize sections after load
// ============================================

document.addEventListener("view:loaded", (e) => {
  const { name } = e.detail;
  console.log(`✅ View loaded: ${name}`);

  switch (name) {
    // Scheduler
    case "scheduler":
      if (typeof window.initSchedulerCalendar === "function") {
        window.initSchedulerCalendar();
      } else {
        console.warn("⚠️ initSchedulerCalendar not found.");
      }
      break;

    // Patient Search
    case "patient":
      if (window.PatientSearch?.init) {
        window.PatientSearch.init();
      } else {
        console.warn("⚠️ PatientSearch.init not found.");
      }
      break;

    // Billing
    case "billing":
      if (window.Billing?.init) window.Billing.init();
      break;

    // Reports
    case "reports":
      if (window.Reports?.init) window.Reports.init();
      break;

    default:
      console.log(`ℹ️ Loaded view: ${name}`);
  }
});

// ============================================
// OPTIONAL: Re-initialize when cached view re-shown
// ============================================

document.addEventListener("view:shown", (e) => {
  const { name } = e.detail;
  if (name !== "scheduler") return;

  // Re-sync return-from-search flow
  if (window.handleReturnFromPatientSearch) {
    window.handleReturnFromPatientSearch();
  }

  // Ensure FullCalendar is resized correctly after view restore
  if (window.currentCalendar) {
    requestAnimationFrame(() => {
      window.currentCalendar.updateSize();
    });
  }
});


// ============================================
// GLOBAL EVENT BUS (optional tiny pub/sub)
// ============================================

window.Bus = (() => {
  const target = document.createElement("span");
  return {
    on: (name, fn) => target.addEventListener(name, fn),
    off: (name, fn) => target.removeEventListener(name, fn),
    emit: (name, detail) =>
      target.dispatchEvent(new CustomEvent(name, { detail })),
  };
})();
