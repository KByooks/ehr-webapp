// ============================================
// app.js — persistent navigation via ViewManager
// ============================================

window.loadSection = async function loadSection(sectionName, force = false) {
  const url = `/fragments/${sectionName}`;
  await window.ViewManager.loadView(sectionName, url, { force });
};

// ---- boot ----
window.addEventListener("DOMContentLoaded", () => loadSection("scheduler"));

// ---- sidebar router ----
document.addEventListener("click", (e) => {
  const link = e.target.closest("[data-nav]");
  if (!link) return;
  e.preventDefault();
  const section = link.getAttribute("data-nav");
  if (section) loadSection(section);
});

// ---- lifecycle handlers ----
document.addEventListener("view:loaded", (e) => {
  const { name } = e.detail;
  console.log("✅ View loaded:", name);

  switch (name) {
    case "scheduler":
      if (typeof window.initSchedulerCalendar === "function")
        window.initSchedulerCalendar();
      handleSchedulerReturnAndSwitch();
      break;
    case "patient":
      window.PatientSearch?.init?.();
      break;
    case "provider":
      window.ProviderSearch?.init?.();
      break;
    case "billing":
      window.Billing?.init?.();
      break;
    case "reports":
      window.Reports?.init?.();
      break;
  }
});

// ---- global modal visibility + return logic ----
document.addEventListener("view:shown", (e) => {
  const { name } = e.detail;
  console.log("📺 view:shown →", name);

  // Hide modal when leaving scheduler
  if (window.ModalManager?.isOpen?.()) {
    if (name === "scheduler") {
      window.ModalManager.softShow();
    } else {
      window.ModalManager.softHide();
    }
  }

  // Handle return to scheduler
  if (name === "scheduler") {
    if (typeof window.handleReturnFromPatientSearch === "function")
      window.handleReturnFromPatientSearch();
    if (typeof window.handleReturnFromProviderSearch === "function")
      window.handleReturnFromProviderSearch();
    if (window.currentCalendar)
      requestAnimationFrame(() => window.currentCalendar.updateSize());
  }
});

// ---- scheduler return helper ----
function handleSchedulerReturnAndSwitch() {
  try {
    if (typeof window.handleReturnFromPatientSearch === "function")
      window.handleReturnFromPatientSearch();
    if (typeof window.handleReturnFromProviderSearch === "function")
      window.handleReturnFromProviderSearch();

    const raw = sessionStorage.getItem("ehr_switchProviderId");
    if (raw) {
      const id = Number(raw);
      sessionStorage.removeItem("ehr_switchProviderId");
      if (id && typeof window.initSchedulerCalendar === "function") {
        window.initSchedulerCalendar(id);
      }
    }

    if (window.currentCalendar)
      requestAnimationFrame(() => window.currentCalendar.updateSize());
  } catch (e) {
    console.warn("Scheduler switch restore failed:", e);
  }
}

// ---- simple event bus (unchanged) ----
window.Bus = (() => {
  const target = document.createElement("span");
  return {
    on: (n, f) => target.addEventListener(n, f),
    off: (n, f) => target.removeEventListener(n, f),
    emit: (n, d) => target.dispatchEvent(new CustomEvent(n, { detail: d })),
  };
})();
