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

		attachPatientSuggest(document);
		attachProviderSuggest(document);

		bindAppointmentModalButtons();
	}

	// ---------- BIND BUTTONS ----------
	function bindAppointmentModalButtons() {
		document.addEventListener("submit", async (e) => {
			const form = e.target.closest("#appointment-form");
			if (form) {
				e.preventDefault();
				await onSubmit(form);
			}
		});

		document.addEventListener("click", async (e) => {
			if (e.target.closest(".save-btn")) {
				const form = document.querySelector("#appointment-form");
				if (form) await onSubmit(form);
			}
			if (e.target.closest("#delete-appointment")) await onDelete();
			if (e.target.closest("#cancel-appointment")) onCancel();
		});
	}

	// ---------- SAVE / CANCEL / DELETE ----------
	async function onSubmit(form) {
		const data = window.CurrentAppointmentData.getAll();
		const apptId = form.dataset.appointmentId || data.appointmentId || null;
		const isUpdate = !!apptId;

		const patientInput = form.querySelector("#patientName");
		const patientId = Number(patientInput?.dataset?.patientId);
		if (!patientId) return alert("Select a patient first.");
		data.patientId = patientId;

		const url = isUpdate ? `/api/schedule/${apptId}` : "/api/schedule";
		const method = isUpdate ? "PUT" : "POST";

		try {
			const res = await fetch(url, {
				method,
				headers: { "Content-Type": "application/json", Accept: "application/json", ...getCsrfHeaders() },
				body: JSON.stringify(data),
			});
			const json = await res.json().catch(() => ({}));
			if (!res.ok || !json.success) return alert(`Save failed (${res.status})`);

			window.ModalManager.hide();
			window.currentCalendar?.refetchEvents?.();
			window.CurrentAppointmentData.reset();
			window.EHRState?.clearActiveAppointment?.();
		} catch (err) {
			console.error("Save error:", err);
			alert("Network error while saving appointment.");
		}
	}

	function onCancel() {
		window.ModalManager.hide();
		window.CurrentAppointmentData.reset();
		window.EHRState?.clearActiveAppointment?.();
	}

	async function onDelete() {
		const id = window.CurrentAppointmentData.get("appointmentId");
		if (!id) return alert("No appointment to delete.");
		if (!confirm("Are you sure?")) return;

		try {
			const res = await fetch(`/api/schedule/${id}`, { method: "DELETE", headers: { Accept: "application/json", ...getCsrfHeaders() } });
			const json = await res.json().catch(() => ({}));
			if (!res.ok || !json.success) return alert(`Delete failed`);

			window.ModalManager.hide();
			window.currentCalendar?.refetchEvents?.();
			window.CurrentAppointmentData.reset();
			window.EHRState?.clearActiveAppointment?.();
		} catch (err) {
			console.error("Delete error:", err);
			alert("Network error while deleting appointment.");
		}
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
			const res = await fetch(`/api/providers/search?firstName=${first || ""}&lastName=${last || ""}&inPracticeOnly=true&size=12`);
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
			input.value = item.dataset.name;
			input.dataset.providerId = item.dataset.id;
			hideDD();
			window.CurrentAppointmentData.updateField("providerId", Number(item.dataset.id));
		});

		input.addEventListener("keydown", async (e) => {
			if (e.key !== "Enter" && e.key !== "Tab") return;
			e.preventDefault();
			const q = input.value.trim();
			const [first, last] = q.split(/\s+/, 2);
			const res = await fetch(`/api/providers/search?firstName=${first || ""}&lastName=${last || ""}&inPracticeOnly=true&size=12`);
			const data = await res.json();
			const list = data.providers || [];

			if (list.length === 1) {
				const p = list[0];
				input.value = p.displayName || `${p.firstName} ${p.lastName}`;
				input.dataset.providerId = p.id;
				window.CurrentAppointmentData.updateField("providerId", p.id);
				return;
			}

			window.EHRState.setPrefillProvider({ first: first || "", last: last || "", inPracticeOnly: true });
			window.ModalManager.softHide();
			await ViewManager.loadView("provider", "/fragments/provider");
		});
	}

	return { open };
})();
