// ============================================
// appointment.js — modal + inline suggests + EHRState flows
// ============================================

window.AppointmentModal = (() => {

	const pad2 = (n) => String(n).padStart(2, "0");
	const parseHHMM = (v) => (!v ? null : { h: +v.split(":")[0], m: +v.split(":")[1] });
	const addMinutes = (hhmm, minutes) => {
		const t = parseHHMM(hhmm);
		if (!t) return null;
		const total = t.h * 60 + t.m + (+minutes || 0);
		return `${pad2(Math.floor(total / 60) % 24)}:${pad2(total % 60)}`;
	};

	const setVal = (sel, val) => {
		const el = document.querySelector(sel);
		if (el && val != null) el.value = val;
	};
	const getCsrfHeaders = () => {
		const token = document.querySelector('meta[name="_csrf"]')?.content;
		const header = document.querySelector('meta[name="_csrf_header"]')?.content || "X-CSRF-TOKEN";
		return token ? { [header]: token } : {};
	};

	// ---------- OPEN ----------
	async function open(providerId, startISO, appt = null) {
		// Seed CurrentAppointmentData
		window.CurrentAppointmentData.reset();
		window.CurrentAppointmentData.setFromAppointment({
			providerId,
			...appt,
			date: appt?.date || startISO.split("T")[0],
			timeStart: appt?.timeStart || startISO.split("T")[1]?.slice(0, 5),
			timeEnd: appt?.timeEnd || addMinutes(startISO.split("T")[1]?.slice(0, 5), 15),
		});

		// Persist appt snapshot to EHRState for return navigation
		window.EHRState?.saveActiveAppointment?.(window.CurrentAppointmentData.getAll());

		const resp = await fetch("/fragments/appointment-details", { headers: { "X-Requested-With": "fetch" } });
		if (!resp.ok) return console.error("❌ Failed to load appointment-details", resp.status);

		const html = await resp.text();
		const tmp = document.createElement("div");
		tmp.innerHTML = html.trim();
		const inner = tmp.querySelector("#appointment-modal > .modal-content");
		window.ModalManager.show(inner ? inner.innerHTML : html);

		requestAnimationFrame(() => initBindings());
	}

	// ---------- INIT BINDINGS ----------
	async function initBindings() {
		const form = document.querySelector("#appointment-form");
		if (!form) return console.warn("Appointment form not found");

		const data = window.CurrentAppointmentData.getAll();
		const id = data.appointmentId || data.id;
		if (id) {
			form.dataset.appointmentId = String(id);
			window.CurrentAppointmentData.updateField("appointmentId", id);
		}

		const deleteBtn = document.getElementById("delete-appointment");
		if (deleteBtn) deleteBtn.classList.toggle("hidden", !id);

		// Populate fields
		["date", "timeStart", "timeEnd", "duration", "reason", "appointmentType", "status"]
			.forEach((f) => setVal(`#${f}`, data[f]));

		// Provider
		const providerInput = document.querySelector("#providerName");
		if (providerInput && data.providerId) {
			try {
				const stored = JSON.parse(sessionStorage.getItem("ehr_selectedProvider") || "null");
				const provider = stored?.id === data.providerId ? stored :
					await (await fetch(`/api/providers/${data.providerId}`)).json();
				providerInput.value = provider.displayName || `${provider.firstName ?? ""} ${provider.lastName ?? ""}`.trim();
				providerInput.dataset.providerId = provider.id;
			} catch (err) {
				console.warn("⚠️ Could not auto-fill provider:", err);
			}
		}

		// Patient
		const pn = document.querySelector("#patientName");
		if (pn && data.patient) {
			pn.value = `${data.patient.firstName} ${data.patient.lastName}`;
			pn.dataset.patientId = data.patient.id ?? data.patientId ?? "";
		}
		
		// ---- Auto-sync start/end/duration fields ----
		const startEl = form.querySelector("#timeStart");
		const endEl = form.querySelector("#timeEnd");
		const durEl = form.querySelector("#duration");

		const parseHHMM = (v) => {
		  if (!v) return null;
		  const [h, m] = v.split(":").map(Number);
		  return h * 60 + m;
		};
		const formatHHMM = (mins) => {
		  const h = Math.floor((mins % (24 * 60)) / 60);
		  const m = mins % 60;
		  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
		};

		function syncTimes(source) {
		  const start = parseHHMM(startEl?.value);
		  const end = parseHHMM(endEl?.value);
		  const dur = Number(durEl?.value) || 0;

		  if (!startEl || !endEl || !durEl) return;

		  if (source === "start" && start != null && dur > 0) {
		    endEl.value = formatHHMM(start + dur);
		    window.CurrentAppointmentData.updateField("timeEnd", endEl.value);
		  }
		  else if (source === "end" && end != null && dur > 0) {
			// when end changes → recalc duration
			 const newDur = end - start;
			 durEl.value = newDur;
			 window.CurrentAppointmentData.updateField("duration", newDur);
		  }
		  else if (source === "duration" && start != null && dur > 0) {
		    endEl.value = formatHHMM(start + dur);
		    window.CurrentAppointmentData.updateField("timeEnd", endEl.value);
		  }

		  // always persist the base values
		  window.CurrentAppointmentData.updateField("timeStart", startEl.value);
		  window.CurrentAppointmentData.updateField("timeEnd", endEl.value);
		  window.CurrentAppointmentData.updateField("duration", durEl.value);
		}

		// Bind once per modal instance
		if (startEl) startEl.addEventListener("change", () => syncTimes("start"));
		if (endEl) endEl.addEventListener("change", () => syncTimes("end"));
		if (durEl) durEl.addEventListener("change", () => syncTimes("duration"));


		attachPatientSuggest(document);
		attachProviderSuggest(document);

		bindAppointmentModalButtons();
	}

	// ---------- BIND BUTTONS (idempotent, delegated, single-fire) ----------
	let __apptHandlersBound = false;
	let __isSaving = false;
	let __isDeleting = false;

	function bindAppointmentModalButtons() {
	  if (__apptHandlersBound) return; // bind once
	  __apptHandlersBound = true;

	  // Submit via form submit
	  document.addEventListener("submit", async (e) => {
	    const form = e.target.closest("#appointment-form");
	    if (!form) return;
	    e.preventDefault();
	    await onSubmit(form);
	  });

	  // Click handlers (save / delete / cancel)
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

	// ---------- SAVE ----------
	async function onSubmit(form) {
	  if (__isSaving) return;
	  __isSaving = true;

	  try {
	    // Always take the freshest values FROM THE FORM, then sync model
	    const getVal = (id) => form.querySelector(`#${id}`)?.value?.trim() || null;

	    const model = window.CurrentAppointmentData.getAll();

	    // Fresh values
	    const fresh = {
	      date: getVal("date"),
	      timeStart: getVal("timeStart"),
	      timeEnd: getVal("timeEnd"),
	      duration: Number(getVal("duration")) || model.duration || 15,
	      reason: getVal("reason"),
	      appointmentType: getVal("appointmentType"),
	      status: getVal("status"),
	    };

	    // IDs from data-attrs
	    const providerInput = form.querySelector("#providerName");
	    const patientInput = form.querySelector("#patientName");
	    const providerId = Number(providerInput?.dataset?.providerId || model.providerId);
	    const patientId = Number(patientInput?.dataset?.patientId || model.patientId);

	    if (!patientId) { alert("Select a patient first."); return; }
	    if (!providerId) { alert("Select a provider first."); return; }

	    // Sync model
	    Object.entries(fresh).forEach(([k, v]) => {
	      if (v != null) window.CurrentAppointmentData.updateField(k, v);
	    });
	    window.CurrentAppointmentData.updateField("patientId", patientId);
	    window.CurrentAppointmentData.updateField("providerId", providerId);

	    const data = window.CurrentAppointmentData.getAll();

	    // Determine create vs update
	    const apptId = form.dataset.appointmentId || data.appointmentId || null;
	    const isUpdate = !!apptId;
	    const url = isUpdate ? `/api/schedule/${apptId}` : "/api/schedule";
	    const method = isUpdate ? "PUT" : "POST";

	    // Disable save button during request
	    const saveBtn = form.querySelector(".save-btn");
	    if (saveBtn) saveBtn.disabled = true;

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

	// ---------- DELETE ----------
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
	      alert(`Delete failed`);
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



	function onCancel() {
		window.ModalManager.hide();
		window.CurrentAppointmentData.reset();
		window.EHRState?.clearActiveAppointment?.();
	}


	// ---------- PATIENT SUGGEST ----------
	function attachPatientSuggest(root) {
		const input = root.querySelector("#patientName");
		const dropdown = root.querySelector("#patient-suggest");
		if (!input || !dropdown) return;

		const showDD = () => dropdown.classList.remove("hidden");
		const hideDD = () => (dropdown.classList.add("hidden"), (dropdown.innerHTML = ""));

		input.addEventListener("input", async () => {
			const query = input.value.trim();
			if (!query) return hideDD();
			const [first, last] = query.split(/\s+/, 2);
			const res = await fetch(`/api/patients/search?firstName=${first || ""}&lastName=${last || ""}&size=6`);
			const data = await res.json();
			const list = data.patients || [];
			if (!list.length) return hideDD();
			dropdown.innerHTML = list.map((p) =>
				`<div class="suggestion-item" data-id="${p.id}" data-name="${p.firstName} ${p.lastName}">${p.firstName} ${p.lastName}</div>`
			).join("");
			showDD();
		});

		dropdown.addEventListener("click", (e) => {
			const item = e.target.closest(".suggestion-item");
			if (!item) return;
			input.value = item.dataset.name;
			input.dataset.patientId = item.dataset.id;
			hideDD();
		});

		input.addEventListener("keydown", async (e) => {
		  if (e.key !== "Enter" && e.key !== "Tab") return;
		  e.preventDefault();

		  const query = input.value.trim();
		  const [first, last] = query.split(/\s+/, 2);

		  // ✅ Correct endpoint: patients, not providers
		  const res = await fetch(`/api/patients/search?firstName=${first || ""}&lastName=${last || ""}&size=6`);
		  const data = await res.json();
		  const list = data.patients || [];

		  if (list.length === 1) {
		    const p = list[0];
		    input.value = `${p.firstName} ${p.lastName}`;
		    input.dataset.patientId = p.id;
		    window.CurrentAppointmentData.updateField("patient", p);
		    window.CurrentAppointmentData.updateField("patientId", p.id);
		    return;
		  }

		  // Multiple → open search
		  const active = window.CurrentAppointmentData.getAll();
		  window.EHRState.saveActiveAppointment(active);
		  window.EHRState.setPrefillPatient({ firstName: first || "", lastName: last || "" });
		  window.ModalManager.softHide();
		  await ViewManager.loadView("patient", "/fragments/patient");
		});

	}

	// ---------- PROVIDER SUGGEST ----------
	function attachProviderSuggest(root) {
		const input = root.querySelector("#providerName");
		const dropdown = root.querySelector("#provider-suggest");
		if (!input || !dropdown) return;

		const showDD = () => dropdown.classList.remove("hidden");
		const hideDD = () => (dropdown.classList.add("hidden"), (dropdown.innerHTML = ""));

		input.addEventListener("input", async () => {
			const query = input.value.trim();
			if (!query) return hideDD();
			const [first, last] = query.split(/\s+/, 2);
			const res = await fetch(`/api/providers/search?firstName=${first || ""}&lastName=${last || ""}&inPracticeOnly=true&size=12`);
			const data = await res.json();
			const list = data.providers || [];
			if (!list.length) return hideDD();
			dropdown.innerHTML = list.map((p) =>
				`<div class="suggestion-item" data-id="${p.id}" data-name="${p.displayName}">
           ${p.displayName} <span class="suggestion-meta">${p.specialty || ""}</span>
         </div>`
			).join("");
			showDD();
		});

		dropdown.addEventListener("click", (e) => {
		  const item = e.target.closest(".suggestion-item");
		  if (!item) return;

		  const providerId = Number(item.dataset.id);
		  input.value = item.dataset.name;
		  input.dataset.providerId = providerId;
		  hideDD();

		  window.CurrentAppointmentData.updateField("providerId", providerId);

		  // ✅ Switch scheduler calendar immediately when provider changes
		  if (window.Scheduler?.updateProvider) {
		    fetch(`/api/providers/${providerId}`)
		      .then((r) => r.json())
		      .then((prov) => {
		        window.Scheduler.updateProvider(prov);
		        console.log("🔄 Switched scheduler calendar to provider via dropdown:", prov.displayName || `${prov.firstName} ${prov.lastName}`);
		      })
		      .catch((err) => console.warn("Failed to switch provider calendar:", err));
		  }
		});


		input.addEventListener("keydown", async (e) => {
		  if (e.key !== "Enter" && e.key !== "Tab") return;
		  e.preventDefault();

		  const q = input.value.trim();
		  const [first, last] = q.split(/\s+/, 2);
		  const res = await fetch(`/api/providers/search?firstName=${first || ""}&lastName=${last || ""}&inPracticeOnly=true&size=12`);
		  const data = await res.json();
		  const list = data.providers || [];

		  // ✅ Case 1: Exactly one match → auto-fill and switch calendar
		  if (list.length === 1) {
		    const p = list[0];
		    input.value = p.displayName || `${p.firstName} ${p.lastName}`;
		    input.dataset.providerId = p.id;
		    window.CurrentAppointmentData.updateField("providerId", p.id);

		    // ✅ Also switch scheduler calendar to this provider
		    if (window.Scheduler?.updateProvider) {
		      window.Scheduler.updateProvider(p);
		      console.log("🔄 Switched scheduler calendar to provider via Tab/Enter:", p.displayName || `${p.firstName} ${p.lastName}`);
		    }
		    return;
		  }

		  // ✅ Case 2: Multiple matches → open provider search
		  window.EHRState.setPrefillProvider({
		    first: first || "",
		    last: last || "",
		    inPracticeOnly: true,
		  });
		  window.ModalManager.softHide();
		  await ViewManager.loadView("provider", "/fragments/provider");
		});

	}

	return { open };
})();
