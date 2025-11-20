// ============================================================================
// app.js — Application Root Controller
// ----------------------------------------------------------------------------
// Responsibilities:
//
//   • Boot the SPA and load the last active section (scheduler by default)
//   • Handle sidebar navigation (data-nav="…")
//   • Initialize each view when its fragment first loads
//   • Handle "return from patient search / demographics"
//   • Coordinate modal visibility when switching views
//
// IMPORTANT ARCHITECTURE:
//
//   ViewManager = persistent cached view loader
//   ModalManager = persistent modal controller (never destroyed during lookups)
//
//   Together these allow true SPA navigation:
//     - Switching sections does NOT unload JS
//     - Appointment modal stays hidden during patient search
//     - Returning from search restores modal + patient field
// ============================================================================


// ============================================================================
// SECTION LOADING (SPA ROUTING)
// ============================================================================

// Unified loader: load a fragment, using cached DOM if available.
window.loadSection = async function loadSection(sectionName, force = false) {
    const url = `/fragments/${sectionName}`;
    await window.ViewManager.loadView(sectionName, url, { force });
};


// ---------------------------------------------------------------------------
// BOOT — On page load, restore last section (default "scheduler")
// ---------------------------------------------------------------------------
window.addEventListener("DOMContentLoaded", () => {
    const last = window.EHRState?.getLastSection?.() || "scheduler";
    loadSection(last);
});


// ---------------------------------------------------------------------------
// SIDEBAR ROUTER (data-nav="sectionName")
// ---------------------------------------------------------------------------
document.addEventListener("click", async (e) => {
    const link = e.target.closest("[data-nav]");
    if (!link) return;

    e.preventDefault();

    const section = link.getAttribute("data-nav");
    if (!section) return;

    // Persist user selection so reload returns them here again
    window.EHRState?.setLastSection?.(section);

    await window.ViewManager.loadView(section, `/fragments/${section}`);
});


// ============================================================================
// VIEW LOADED (runs ONCE per view load — initializations)
// ============================================================================

document.addEventListener("view:loaded", (e) => {
    const { name } = e.detail;
    console.log("✅ View loaded:", name);

    switch (name) {
        case "scheduler":
            window.initSchedulerCalendar?.();
            break;

        case "patient":
            window.PatientSearch?.init?.();
            break;

        case "demographics":
            window.Demographics?.init?.();
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


// ===========================================================
// 🔥 Unified handler: return-from-patient-search / provider-search
//    OR demographics → back into appointment modal
// ===========================================================
window.handleReturnFromPatientSearch = function () {
  const pending = window.EHRState?.consumePendingReturn?.();
  if (!pending) return;

  const { field, entity } = pending;
  console.log("🔄 [Return] pending selection:", pending);

  const active = window.EHRState?.getActiveAppointment?.();
  if (!active) {
    console.warn("⚠️ No active appointment to restore.");
    return;
  }

  // Restore previous appointment snapshot
  window.CurrentAppointmentData.reset();
  window.CurrentAppointmentData.setFromAppointment(active.apptData || active);

  // 🔥 Handle patient OR provider payloads
  if (field === "patient") {
    window.CurrentAppointmentData.updateField("patient", entity);
    window.CurrentAppointmentData.updateField("patientId", entity.id);
    window._ehr_pendingPatientUpdate = entity; // for DOM sync on modal:shown
  } else if (field === "provider") {
    window.CurrentAppointmentData.updateField("providerId", entity.id);
    window._ehr_pendingProviderUpdate = entity; // 🔥 NEW: provider DOM sync
  } else {
    console.warn("⚠️ Unknown pending field:", field);
  }

  // Show modal again — fields will be patched in modal:shown
  window.ModalManager.softShow();
};

// ============================================================================
// MODAL SHOWN — patch DOM fields AFTER modal becomes visible again
// (Needed because fields must exist in DOM first)
// ============================================================================
document.addEventListener("modal:shown", () => {

	// -----------------------------------------
	 // Patient DOM Sync
	 // -----------------------------------------
	 const patient = window._ehr_pendingPatientUpdate;
	 if (patient) {
	   const pn = document.querySelector("#patientName");
	   if (pn) {
	     pn.value = `${patient.firstName} ${patient.lastName}`;
	     pn.dataset.patientId = String(patient.id);
	     console.log("✨ Patient field updated via modal:shown");
	   }
	   window._ehr_pendingPatientUpdate = null;
	 }

	 // -----------------------------------------
	 // Provider DOM Sync
	 // -----------------------------------------
	 const provider = window._ehr_pendingProviderUpdate;
	 if (provider) {
	   const provInput = document.querySelector("#providerName");
	   if (provInput) {
	     const display =
	       provider.displayName ||
	       `${provider.firstName ?? ""} ${provider.lastName ?? ""}`.trim();

	     provInput.value = display;
	     provInput.dataset.providerId = String(provider.id);
	     console.log("✨ Provider field updated via modal:shown");
	   }
	   
	   // 🔥🔥🔥 NEW: Switch scheduler to this provider
	   if (window.Scheduler?.updateProvider) {
	     console.log("🔄 Switching scheduler calendar to:", provider.displayName);
	     window.Scheduler.updateProvider(provider);

	     // Fix calendar layout properly
	     if (window.currentCalendar) {
	       requestAnimationFrame(() => window.currentCalendar.updateSize());
	     }
	   }
	   window._ehr_pendingProviderUpdate = null;
	 }
	
});


// ============================================================================
// VIEW SHOWN — runs EVERY time a view is displayed
// ============================================================================

document.addEventListener("view:shown", (e) => {
    const { name } = e.detail;
    console.log("📺 view:shown →", name);

    // ---------------------------------------------------------
    // Modal visibility rule:
    //   Scheduler → modal should be visible
    //   Anything else → modal should be hidden
    // ---------------------------------------------------------
    if (window.ModalManager?.isOpen?.()) {
        if (name === "scheduler") window.ModalManager.softShow();
        else window.ModalManager.softHide();
    }

    // ---------------------------------------------------------
    // Scheduler-specific on-show logic
    // Return-from-search + calendar resize
    // ---------------------------------------------------------
    if (name === "scheduler") {

        console.log("🔍 Scheduler: checking for pending return...");

        // Handle return-selection (patient)
        window.handleReturnFromPatientSearch?.();

        // Fix FullCalendar sizing when switching back
        if (window.currentCalendar) {
            requestAnimationFrame(() => window.currentCalendar.updateSize());
        }
    }
});
