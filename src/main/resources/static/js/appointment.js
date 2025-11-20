// ============================================
// appointment.js — Appointment Modal (SPA)
// Handles:
// - Opening modal
// - Binding form fields
// - Provider & patient suggestion dropdowns
// - Patient search flow
// - Save / delete / cancel
// - Auto-sync duration/start/end
//
// IMPORTANT ARCHITECTURE NOTE:
// This modal is PERSISTENT. It is not destroyed
// when navigating to patient search or demographics.
// It is "soft-hidden" instead.
// ============================================

window.AppointmentModal = (() => {

  // -------------------------------
  // Utility helpers
  // -------------------------------

  const pad2 = (n) => String(n).padStart(2, "0");

  const parseHHMM = (v) => {
    if (!v) return null;
    const [h, m] = v.split(":").map(Number);
    return h * 60 + m;
  };

  const addMinutes = (hhmm, minutes) => {
    const t = parseHHMM(hhmm);
    if (!t) return null;
    const total = t + (+minutes || 0);
    return `${pad2(Math.floor(total / 60) % 24)}:${pad2(total % 60)}`;
  };

  const setVal = (selector, val) => {
    const el = document.querySelector(selector);
    if (el && val != null) el.value = val;
  };

  const getCsrfHeaders = () => {
    const token = document.querySelector('meta[name="_csrf"]')?.content;
    const header = document.querySelector('meta[name="_csrf_header"]')?.content || "X-CSRF-TOKEN";
    return token ? { [header]: token } : {};
  };


  // =======================================================
  // OPEN MODAL
  // Seeds CurrentAppointmentData,
  // Saves snapshot to EHRState,
  // Loads modal HTML,
  // Then initializes bindings.
  // =======================================================
  async function open(providerId, startISO, appt = null) {
	console.log("Modal opened with provider:", providerId);
    // ---- Seed fresh in-memory model ----
    window.CurrentAppointmentData.reset();
    window.CurrentAppointmentData.setFromAppointment({
      providerId,
      ...appt,
      date: appt?.date || startISO.split("T")[0],
      timeStart: appt?.timeStart || startISO.split("T")[1]?.slice(0, 5),
      timeEnd: appt?.timeEnd || addMinutes(startISO.split("T")[1]?.slice(0, 5), 15),
    });

    // ---- Save a snapshot for return navigation ----
    window.EHRState?.saveActiveAppointment?.(window.CurrentAppointmentData.getAll());

    // ---- Load modal HTML ----
    const resp = await fetch("/fragments/appointment-details", {
      headers: { "X-Requested-With": "fetch" },
    });
    if (!resp.ok) return console.error("❌ Failed to load appointment-details:", resp.status);

    const html = await resp.text();

    // Extract inner modal HTML
    const tmp = document.createElement("div");
    tmp.innerHTML = html.trim();
    const inner = tmp.querySelector("#appointment-modal > .modal-content");

    // Show modal (persistent)
    window.ModalManager.show(inner ? inner.innerHTML : html);

    // Initialize all JS bindings *after* DOM is placed
    requestAnimationFrame(() => initBindings());
  }


  // =======================================================
  // INIT BINDINGS (runs once per modal instance)
  // Wires form fields → CurrentAppointmentData
  // Wires auto-sync, patient suggest, provider suggest, etc.
  // =======================================================
  async function initBindings() {
	


	  // =======================================================
	  // HANDLE PENDING RETURN (provider or patient selected from Search views)
	  // =======================================================

	  // --- Provider selected from Provider Search ---
	  const pendingProvider = window.EHRState?.consumePendingReturn?.("provider");
	  if (pendingProvider) {
	    window.CurrentAppointmentData.updateField("providerId", pendingProvider.id);
	    window.CurrentAppointmentData.updateField("provider", pendingProvider);

	    // Persist scheduler selection for visual consistency
	    sessionStorage.setItem("ehr_selectedProvider", JSON.stringify(pendingProvider));
	  }

	  // --- Patient selected from Patient Search ---
	  const pendingPatient = window.EHRState?.consumePendingReturn?.("patient");
	  if (pendingPatient) {
	    window.CurrentAppointmentData.updateField("patientId", pendingPatient.id);
	    window.CurrentAppointmentData.updateField("patient", pendingPatient);
	  }


    const form = document.querySelector("#appointment-form");
    if (!form) return console.warn("⚠️ appointment form not found");

    const data = window.CurrentAppointmentData.getAll();
    const apptId = data.appointmentId || data.id;

    // ---- Tag form with appointment ID (update mode) ----
    if (apptId) {
      form.dataset.appointmentId = String(apptId);
      window.CurrentAppointmentData.updateField("appointmentId", apptId);
    }

    // ---- Hide delete if this is a new appointment ----
    const deleteBtn = document.getElementById("delete-appointment");
    if (deleteBtn) deleteBtn.classList.toggle("hidden", !apptId);

    // ---- Populate core fields ----
    ["date", "timeStart", "timeEnd", "duration", "reason", "appointmentType", "status"]
      .forEach((f) => setVal(`#${f}`, data[f]));


    // =======================================================
    // PREFILL PROVIDER FIELD
    // =======================================================
    const providerInput = document.querySelector("#providerName");
    if (providerInput && data.providerId) {
      try {
        const cached = JSON.parse(sessionStorage.getItem("ehr_selectedProvider") || "null");
        const provider =
          cached?.id === data.providerId
            ? cached
            : await (await fetch(`/api/providers/${data.providerId}`)).json();

        providerInput.value =
          provider.displayName ||
          `${provider.firstName ?? ""} ${provider.lastName ?? ""}`.trim();

        providerInput.dataset.providerId = provider.id;
      } catch (err) {
        console.warn("⚠️ Could not auto-fill provider:", err);
      }
    }


    // =======================================================
    // PREFILL PATIENT FIELD
    // =======================================================
    const pn = document.querySelector("#patientName");
    if (pn && data.patient) {
      pn.value = `${data.patient.firstName} ${data.patient.lastName}`;
      pn.dataset.patientId = data.patient.id ?? data.patientId ?? "";
    }


    // =======================================================
    // AUTO-SYNC timeStart ↔ timeEnd ↔ duration
    // =======================================================
    const startEl = form.querySelector("#timeStart");
    const endEl = form.querySelector("#timeEnd");
    const durEl = form.querySelector("#duration");

    const formatHHMM = (mins) => {
      const h = Math.floor((mins % (24 * 60)) / 60);
      const m = mins % 60;
      return `${pad2(h)}:${pad2(m)}`;
    };

    function syncTimes(source) {
      const start = parseHHMM(startEl?.value);
      const end = parseHHMM(endEl?.value);
      const dur = Number(durEl?.value) || data.duration;

      if (!startEl || !endEl || !durEl) return;

      if (source === "start" && start != null && dur > 0) {
        endEl.value = formatHHMM(start + dur);
      }
      else if (source === "end" && end != null && start != null) {
        const newDur = end - start;
        durEl.value = newDur;
      }
      else if (source === "duration" && start != null && dur > 0) {
        endEl.value = formatHHMM(start + dur);
      }

      // Always persist
      window.CurrentAppointmentData.updateField("timeStart", startEl.value);
      window.CurrentAppointmentData.updateField("timeEnd", endEl.value);
      window.CurrentAppointmentData.updateField("duration", durEl.value);
    }

    if (startEl) startEl.addEventListener("change", () => syncTimes("start"));
    if (endEl) endEl.addEventListener("change", () => syncTimes("end"));
    if (durEl) durEl.addEventListener("change", () => syncTimes("duration"));


    // =======================================================
    // Bind suggest dropdowns + modal buttons
    // =======================================================
    attachPatientSuggest(document);
    attachProviderSuggest(document);
    bindAppointmentModalButtons();
  }


  // =======================================================
  // BUTTON HANDLERS (save, delete, cancel)
  // Bound ONCE globally
  // =======================================================
  let __apptHandlersBound = false;
  let __isSaving = false;
  let __isDeleting = false;

  function bindAppointmentModalButtons() {
    if (__apptHandlersBound) return;
    __apptHandlersBound = true;

    // ---- Form submit → save ----
    document.addEventListener("submit", async (e) => {
      const form = e.target.closest("#appointment-form");
      if (!form) return;
      e.preventDefault();
      await onSubmit(form);
    });

    // ---- Clicks: save, delete, cancel ----
    document.addEventListener("click", async (e) => {
      const form = document.querySelector("#appointment-form");
      if (!form) return;

      if (e.target.closest(".save-btn")) {
        e.preventDefault();
        await onSubmit(form);
      }

      if (e.target.closest("#delete-appointment")) {
        e.preventDefault();
        await onDelete();
      }

      if (e.target.closest("#cancel-appointment")) {
        e.preventDefault();
        onCancel();
      }
    });
  }


  // =======================================================
  // SAVE APPOINTMENT
  // =======================================================
  async function onSubmit(form) {
    if (__isSaving) return;
    __isSaving = true;

    try {
      const getVal = (id) => form.querySelector(`#${id}`)?.value?.trim() || null;
      const model = window.CurrentAppointmentData.getAll();

      // Fresh values from form
      const fresh = {
        date: getVal("date"),
        timeStart: getVal("timeStart"),
        timeEnd: getVal("timeEnd"),
        duration: Number(getVal("duration")) || model.duration || 15,
        reason: getVal("reason"),
        appointmentType: getVal("appointmentType"),
        status: getVal("status"),
      };

      // Provider & patient
      const providerInput = form.querySelector("#providerName");
      const patientInput = form.querySelector("#patientName");

      const providerId = Number(providerInput?.dataset?.providerId || model.providerId);
      const patientId = Number(patientInput?.dataset?.patientId || model.patientId);

      if (!patientId) { alert("Select a patient first."); return; }
      if (!providerId) { alert("Select a provider first."); return; }

      // Sync model
      Object.entries(fresh).forEach(([k, v]) =>
        window.CurrentAppointmentData.updateField(k, v)
      );

      window.CurrentAppointmentData.updateField("providerId", providerId);
      window.CurrentAppointmentData.updateField("patientId", patientId);

      const data = window.CurrentAppointmentData.getAll();

      // Create/update mode
      const apptId = form.dataset.appointmentId || data.appointmentId || null;
      const isUpdate = !!apptId;
      const url = isUpdate ? `/api/schedule/${apptId}` : "/api/schedule";
      const method = isUpdate ? "PUT" : "POST";

      // Disable save to prevent double submit
      const saveBtn = form.querySelector(".save-btn");
      if (saveBtn) saveBtn.disabled = true;

      // Send request
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...getCsrfHeaders(),
        },
        body: JSON.stringify(data),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        alert(`Save failed (${res.status})`);
        return;
      }

      // Close modal, refresh events
      window.ModalManager.hide();
      window.currentCalendar?.refetchEvents?.();
      window.CurrentAppointmentData.reset();
      window.EHRState?.clearActiveAppointment?.();

    } catch (err) {
      console.error("Save error:", err);
      alert("Network error while saving appointment.");
    } finally {
      __isSaving = false;

      const form = document.querySelector("#appointment-form");
      const saveBtn = form?.querySelector?.(".save-btn");
      if (saveBtn) saveBtn.disabled = false;
    }
  }


  // =======================================================
  // DELETE APPOINTMENT
  // =======================================================
  async function onDelete() {
    if (__isDeleting) return;
    __isDeleting = true;

    try {
      const id = window.CurrentAppointmentData.get("appointmentId");
      if (!id) { alert("No appointment to delete."); return; }
      if (!confirm("Are you sure?")) return;

      const res = await fetch(`/api/schedule/${id}`, {
        method: "DELETE",
        headers: { Accept: "application/json", ...getCsrfHeaders() },
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        alert("Delete failed.");
        return;
      }

      window.ModalManager.hide();
      window.currentCalendar?.refetchEvents?.();
      window.CurrentAppointmentData.reset();
      window.EHRState?.clearActiveAppointment?.();

    } catch (err) {
      console.error("Delete error:", err);
      alert("Network error while deleting appointment.");
    } finally {
      __isDeleting = false;
    }
  }


  // =======================================================
  // CANCEL
  // =======================================================
  function onCancel() {
    window.ModalManager.hide();
    window.CurrentAppointmentData.reset();
    window.EHRState?.clearActiveAppointment?.();
  }


  // =======================================================
  // PATIENT SUGGEST DROPDOWN
  // Handles inline search + Tab/Enter → patient search
  // =======================================================
  function attachPatientSuggest(root) {
    const input = root.querySelector("#patientName");
    const dropdown = root.querySelector("#patient-suggest");
    if (!input || !dropdown) return;

    const showDD = () => dropdown.classList.remove("hidden");
    const hideDD = () => (dropdown.classList.add("hidden"), dropdown.innerHTML = "");

    // ---- Inline autocomplete ----
    input.addEventListener("input", async () => {
      const query = input.value.trim();
      if (!query) return hideDD();

      const [first, last] = query.split(/\s+/, 2);

      const res = await fetch(`/api/patients/search?firstName=${first || ""}&lastName=${last || ""}&size=6`);
      const data = await res.json();
      const list = data.patients || [];

      if (!list.length) return hideDD();

      dropdown.innerHTML = list.map(
        (p) => `
          <div class="suggestion-item"
               data-id="${p.id}"
               data-name="${p.firstName} ${p.lastName}">
            ${p.firstName} ${p.lastName}
          </div>`
      ).join("");

      showDD();
    });

    // ---- Select from dropdown ----
    dropdown.addEventListener("click", (e) => {
      const item = e.target.closest(".suggestion-item");
      if (!item) return;

      input.value = item.dataset.name;
      input.dataset.patientId = item.dataset.id;

      hideDD();
    });

    // ---- Enter/Tab logic ----
    input.addEventListener("keydown", async (e) => {

      if (e.key !== "Enter" && e.key !== "Tab") return;
      e.preventDefault();

      const query = input.value.trim();
      const [first, last] = query.split(/\s+/, 2);

      const res = await fetch(`/api/patients/search?firstName=${first || ""}&lastName=${last || ""}&size=6`);
      const data = await res.json();
      const list = data.patients || [];

      // ---- Exactly one match → auto-fill ----
      if (list.length === 1) {
        const p = list[0];

        input.value = `${p.firstName} ${p.lastName}`;
        input.dataset.patientId = p.id;

        window.CurrentAppointmentData.updateField("patient", p);
        window.CurrentAppointmentData.updateField("patientId", p.id);
        return;
      }

      // ---- Multiple / Zero → go to Patient Search ----
      const active = window.CurrentAppointmentData.getAll();
      window.EHRState.saveActiveAppointment(active);

      window.EHRState.setPrefillPatient({
        first: first || "",
        last: last || "",
      });

      window.ModalManager.softHide();

      await ViewManager.loadView("patient", "/fragments/patient");
    });
  }


  // =======================================================
  // PROVIDER SUGGEST DROPDOWN
  // =======================================================
  function attachProviderSuggest(root) {
    const input = root.querySelector("#providerName");
    const dropdown = root.querySelector("#provider-suggest");
    if (!input || !dropdown) return;

    const showDD = () => dropdown.classList.remove("hidden");
    const hideDD = () => (dropdown.classList.add("hidden"), dropdown.innerHTML = "");

    // ---- Inline autocomplete ----
    input.addEventListener("input", async () => {
      const query = input.value.trim();
      if (!query) return hideDD();

      const [first, last] = query.split(/\s+/, 2);

      const res = await fetch(`/api/providers/search?firstName=${first || ""}&lastName=${last || ""}&inPracticeOnly=true&size=12`);
      const data = await res.json();
      const list = data.providers || [];

      if (!list.length) return hideDD();

      dropdown.innerHTML = list.map(
        (p) => `
          <div class="suggestion-item"
               data-id="${p.id}"
               data-name="${p.displayName}">
            ${p.displayName}
            <span class="suggestion-meta">${p.specialty || ""}</span>
          </div>`
      ).join("");

      showDD();
    });

    // ---- Select provider ----
    dropdown.addEventListener("click", (e) => {
      const item = e.target.closest(".suggestion-item");
      if (!item) return;

      const providerId = Number(item.dataset.id);

      input.value = item.dataset.name;
      input.dataset.providerId = providerId;

      hideDD();

      window.CurrentAppointmentData.updateField("providerId", providerId);

      // Switch scheduler calendar to selected provider
      if (window.Scheduler?.updateProvider) {
        fetch(`/api/providers/${providerId}`)
          .then((r) => r.json())
          .then((prov) => {
            window.Scheduler.updateProvider(prov);
            console.log("🔄 Switched scheduler to provider:", prov.displayName);
          })
          .catch((err) => console.warn("Failed to switch provider:", err));
      }
    });

    // ---- Enter/Tab logic ----
    input.addEventListener("keydown", async (e) => {
      if (e.key !== "Enter" && e.key !== "Tab") return;
      e.preventDefault();

      const query = input.value.trim();
      const [first, last] = query.split(/\s+/, 2);

      const res = await fetch(`/api/providers/search?firstName=${first || ""}&lastName=${last || ""}&inPracticeOnly=true&size=12`);
      const data = await res.json();
      const list = data.providers || [];

      // ---- One match → auto-select + switch calendar ----
      if (list.length === 1) {
        const p = list[0];

        input.value = p.displayName;
        input.dataset.providerId = p.id;

        window.CurrentAppointmentData.updateField("providerId", p.id);

        if (window.Scheduler?.updateProvider) {
          window.Scheduler.updateProvider(p);
        }

        return;
      }

      // ---- Multiple → provider search ----
      window.EHRState.setPrefillProvider({
        first: first || "",
        last: last || "",
        inPracticeOnly: true,
      });

      window.ModalManager.softHide();

      await ViewManager.loadView("provider", "/fragments/provider");
    });
  }


  // =======================================================
  // EXPORT PUBLIC API
  // =======================================================
  return { open };

})();
