// ============================================
// demographics.js — Persistent create/edit view
//
// Responsibilities:
//   • Manage patient demographic form (new + edit)
//   • Load patient data for editing
//   • Update patient records
//   • Support two modes:
//        - Standalone demographics ➜ stay on page
//        - Appointment flow ➜ return new/edited patient
//
// Architecture:
//   • View is persistent (cached by ViewManager)
//   • Initialization happens once (view:loaded)
//   • Context is applied every time view is shown (view:shown)
//   • Uses EHRState for "context" and "return pipeline"
// ============================================

window.Demographics = {
  initialized: false,
  mode: "new",                 // "new" or "edit"
  currentPatientId: null,      // ID if editing
  returnTo: null,              // reserved for future use

  // ----------------------------------------------------
  // init() — runs ONCE when demographics fragment loads
  // ----------------------------------------------------
  init() {
    if (this.initialized) return;
    this.initialized = true;

    console.log("[Demographics] init");

    const form = document.getElementById("demographics-form");
    if (!form) {
      console.warn("[Demographics] no form found");
      return;
    }

    // ---- Form submit handler ----
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      this.save();
    });

    // ---- Navigation buttons ----
    document.getElementById("demo-back-btn")?.addEventListener("click", () => {
      window.ViewManager.loadView("patient", "/fragments/patient");
    });

    document.getElementById("demographics-cancel")?.addEventListener("click", () => {
      window.ViewManager.loadView("patient", "/fragments/patient");
    });

    // ---- Apply initial context if any ----
    const ctx = window.EHRState?.consumeDemographicsContext?.();
    if (ctx) {
      console.log("[Demographics] init: applying context", ctx);
      this.applyContext(ctx);
    }
  },

  // ----------------------------------------------------
  // onShown() — runs EVERY TIME the view becomes visible
  // ----------------------------------------------------
  async onShown() {
    const ctx = window.EHRState?.consumeDemographicsContext?.();
    if (ctx) {
      console.log("[Demographics] onShown: applying context", ctx);
      await this.applyContext(ctx);
    }
  },

  // ----------------------------------------------------
  // applyContext(ctx)
  //
  // Interprets an object like:
  //   { mode: "new" | "edit", patientId, returnTo }
  //
  // Updates header + form mode + loads patient if needed.
  // ----------------------------------------------------
  async applyContext(ctx) {
    const form = document.getElementById("demographics-form");
    const header = document.getElementById("demo-header");
    if (!form || !header) return;

    this.mode = ctx.mode || "new";
    this.currentPatientId = ctx.patientId || null;
    this.returnTo = ctx.returnTo || null;

    if (this.mode === "new") {
      header.textContent = "New Patient";
      form.reset();
      form.removeAttribute("data-patient-id");
      return;
    }

    if (this.mode === "edit" && this.currentPatientId) {
      header.textContent = "Edit Patient";
      await this.loadPatient(this.currentPatientId);
    }
  },

  // ----------------------------------------------------
  // loadPatient(id) — Fetch patient and populate form
  // ----------------------------------------------------
  async loadPatient(id) {
    try {
      const res = await fetch(`/api/patients/${id}`);
      if (!res.ok) throw new Error("Failed loading patient");

      const p = await res.json();
      const form = document.getElementById("demographics-form");

      // helper
      const setVal = (id, v) => {
        const el = document.getElementById(id);
        if (el) el.value = v ?? "";
      };

      // Populate fields
      setVal("demo-title", p.title);
      setVal("demo-gender", p.gender);
      setVal("demo-firstName", p.firstName);
      setVal("demo-middleName", p.middleName);
      setVal("demo-lastName", p.lastName);
      setVal("demo-dob", p.dob || "");
      setVal("demo-phonePrimary", p.phonePrimary);
      setVal("demo-phoneSecondary", p.phoneSecondary);
      setVal("demo-email", p.email);
      setVal("demo-addressLine1", p.addressLine1);
      setVal("demo-addressLine2", p.addressLine2);
      setVal("demo-city", p.city);
      setVal("demo-state", p.state);
      setVal("demo-zip", p.zip);

      // Mark form in edit mode
      form.dataset.patientId = p.id;
      this.mode = "edit";
      this.currentPatientId = p.id;

    } catch (err) {
      console.error(err);
      alert("Error loading patient.");
    }
  },

  // ----------------------------------------------------
  // save() — Create or update patient
  //
  // Special behavior:
  //   🔥 If an appointment is active, we DO NOT stay here.
  //      Instead we return the new/edited patient to
  //      the appointment modal (via setPendingReturn).
  // ----------------------------------------------------
  async save() {
    const form = document.getElementById("demographics-form");
    if (!form) return;

    const existingId = form.dataset.patientId
      ? Number(form.dataset.patientId)
      : null;

    const getVal = (id) => document.getElementById(id)?.value?.trim() || null;

    const payload = {
      title: getVal("demo-title"),
      gender: getVal("demo-gender"),
      firstName: getVal("demo-firstName"),
      middleName: getVal("demo-middleName"),
      lastName: getVal("demo-lastName"),
      dob: getVal("demo-dob"),
      phonePrimary: getVal("demo-phonePrimary"),
      phoneSecondary: getVal("demo-phoneSecondary"),
      email: getVal("demo-email"),
      addressLine1: getVal("demo-addressLine1"),
      addressLine2: getVal("demo-addressLine2"),
      city: getVal("demo-city"),
      state: getVal("demo-state"),
      zip: getVal("demo-zip"),
    };

    // basic validation
    if (!payload.firstName || !payload.lastName || !payload.dob) {
      alert("First name, last name and DOB are required.");
      return;
    }

    const url = existingId ? `/api/patients/${existingId}` : "/api/patients";
    const method = existingId ? "PUT" : "POST";

    try {
      console.log("[Demographics] save() ->", method, url, payload);

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error("[Demographics] save failed:", res.status, json);
        alert("Could not save patient.");
        return;
      }

      const saved = json.patient || json;
      console.log("[Demographics] saved patient:", saved);

      // ==========================================================
      // 🔥🔥🔥 ALWAYS normalize into EDIT MODE
      // ==========================================================
      const header = document.getElementById("demo-header");

      form.dataset.patientId = saved.id;
      this.mode = "edit";
      this.currentPatientId = saved.id;
      if (header) header.textContent = "Edit Patient";

      // ==========================================================
      // 🔥🔥🔥 ALWAYS set demographics context after ANY save
      // ==========================================================
      window.EHRState?.setDemographicsContext({
        mode: "edit",
        patientId: saved.id,
      });

      // ----------------------------------------------------
      // 🔥 RETURN TO APPOINTMENT WORKFLOW (if applicable)
      // ----------------------------------------------------
      const active = window.EHRState?.getActiveAppointment?.();
      console.log("[Demographics] active appointment after save?", active);

      if (active) {
        console.log("[Demographics] returning to appointment flow");

        const patientForReturn = {
          id: saved.id,
          firstName: saved.firstName,
          lastName: saved.lastName,
        };
		alert("Patient saved.");
        window.EHRState.setPendingReturn("patient", patientForReturn);

        // Go back to scheduler (modal will soft-show)
        await window.ViewManager.loadView("scheduler", "/fragments/scheduler");
        return;
      }

      // ----------------------------------------------------
      // Normal standalone save behavior
      // ----------------------------------------------------
      

    } catch (err) {
      console.error("[Demographics] save error:", err);
      alert("Save failed.");
    }
  },
};

// ----------------------------------------------------
// Lifecycle hooks
// ----------------------------------------------------
document.addEventListener("view:loaded", (e) => {
  if (e.detail.name === "demographics") window.Demographics.init();
});

document.addEventListener("view:shown", (e) => {
  if (e.detail.name === "demographics") window.Demographics.onShown();
});
