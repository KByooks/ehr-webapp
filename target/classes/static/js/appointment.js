// ============================================
// appointment.js
// Appointment modal flow with seamless
// patient handoff + central data sync
// ============================================

window.AppointmentModal = (function() {
	let appointmentButtonsBound = false;

	// ---------- helpers ----------
	const pad2 = (n) => String(n).padStart(2, "0");
	const parseHHMM = (v) => {
		if (!v) return null;
		const [h, m] = v.split(":").map(Number);
		return isNaN(h) || isNaN(m) ? null : { h, m };
	};
	const addMinutes = (hhmm, minutes) => {
		const t = parseHHMM(hhmm);
		if (!t) return null;
		const total = t.h * 60 + t.m + (Number(minutes) || 0);
		return `${pad2(Math.floor(total / 60) % 24)}:${pad2(total % 60)}`;
	};
	const setVal = (sel, val) => {
		const el = document.querySelector(sel);
		if (el && val != null) el.value = val;
	};
	const getCsrfHeaders = () => {
		const token = document.querySelector('meta[name="_csrf"]')?.content;
		const header =
			document.querySelector('meta[name="_csrf_header"]')?.content ||
			"X-CSRF-TOKEN";
		return token ? { [header]: token } : {};
	};

	// ---------- delegated submit (once) ----------
	function bindAppointmentModalButtons() {

		if (appointmentButtonsBound) return;
		appointmentButtonsBound = true;

		document.addEventListener(
			"submit",
			(e) => {
				const form = e.target;
				if (form && form.id === "appointment-form") {
					e.preventDefault();
					onSubmit(form).catch((err) => console.error("Submit error:", err));
				}
			},
			true
		);

		document.addEventListener("click", (e) => {
			const btn = e.target.closest(".save-btn");
			if (!btn) return;
			const form = btn.closest("form#appointment-form");
			if (!form) return;
			e.preventDefault();
			form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
		});

		// ✅ NEW: Delegated delete button binding (always works)
		document.addEventListener("click", (e) => {
			const del = e.target.closest("#delete-appointment");
			if (!del) return;
			e.preventDefault();
			console.log("🗑️ Delete button clicked");
			onDelete();
		});

		// ✅ Delegated cancel binding (always works)
		document.addEventListener("click", (e) => {
			const cancel = e.target.closest("#cancel-appointment");
			if (!cancel) return;
			e.preventDefault();
			onCancel();
		});

	}

	// ---------- OPEN ----------
	async function open(providerId, startISO, appt = null) {
		window.CurrentAppointmentData.reset();
		window.CurrentAppointmentData.setFromAppointment({
			providerId,
			...appt,
			date: appt?.date || startISO.split("T")[0],
			timeStart: appt?.timeStart || startISO.split("T")[1]?.slice(0, 5),
			timeEnd: appt?.timeEnd || addMinutes(startISO.split("T")[1]?.slice(0, 5), 15),
		});

		const resp = await fetch("/fragments/appointment-details", {
			headers: { "X-Requested-With": "fetch" },
		});
		if (!resp.ok) {
			console.error("❌ Failed to load appointment-details fragment", resp.status);
			return;
		}

		const html = await resp.text();
		const tmp = document.createElement("div");
		tmp.innerHTML = html.trim();
		const inner = tmp.querySelector("#appointment-modal > .modal-content");
		const contentHTML = inner ? inner.innerHTML : html;

		window.ModalManager.show(contentHTML);

		const tryBind = setInterval(() => {
			const form = document.querySelector("#appointment-form");
			if (form) {
				clearInterval(tryBind);
				initBindings();
			}
		}, 50);

		bindAppointmentModalButtons();
	}

	// ---------- INIT BINDINGS ----------
	function initBindings() {
		const form = document.querySelector("#appointment-form");
		if (!form) return console.error("❌ Appointment form not found");

		console.log("✅ appointment-form found, binding context");
		const data = window.CurrentAppointmentData.getAll();

		// ✅ Ensure the appointment ID always propagates correctly
		const id = data.appointmentId || data.id;
		if (id) {
			form.dataset.appointmentId = String(id);
			console.log("🧾 Bound appointment ID:", form.dataset.appointmentId);
			window.CurrentAppointmentData.updateField("appointmentId", id);
		}
		const deleteBtn = document.getElementById("delete-appointment");
		if (deleteBtn) {
			if (id) deleteBtn.classList.remove("hidden");
			else deleteBtn.classList.add("hidden");
		}
		setVal("#providerId", data.providerId);
		setVal("#date", data.date);
		setVal("#timeStart", data.timeStart);
		setVal("#timeEnd", data.timeEnd);
		setVal("#duration", data.durationMinutes);
		setVal("#reason", data.reason);
		setVal("#appointmentType", data.appointmentType);
		setVal("#status", data.status);

		const pn = document.querySelector("#patientName");
		if (pn && data.patient) {
			pn.value = `${data.patient.firstName} ${data.patient.lastName}`;
			pn.dataset.patientId = data.patient.id ?? data.patientId ?? "";
		}

		attachPatientSuggest(document);
	}

	// ---------- SAVE ----------
	async function onSubmit(form) {
		console.log("🚀 onSubmit triggered");
		const data = window.CurrentAppointmentData.getAll();
		const apptId = form.dataset.appointmentId || data.appointmentId || null;
		const isUpdate = !!apptId;

		const patientInput = form.querySelector("#patientName");
		const patientId = Number(patientInput?.dataset?.patientId);
		if (!patientId) {
			alert("Select a patient first.");
			return;
		}
		data.patientId = patientId;

		console.log("💾 Sending payload →", data);

		const url = isUpdate ? `/api/schedule/${apptId}` : "/api/schedule";
		const method = isUpdate ? "PUT" : "POST";

		try {
			const res = await fetch(url, {
				method,
				headers: {
					"Content-Type": "application/json",
					Accept: "application/json",
					...getCsrfHeaders(),
				},
				body: JSON.stringify({
					appointmentId: data.appointmentId ?? null,
					providerId: data.providerId,
					patientId: data.patientId,
					date: data.date,
					timeStart: data.timeStart,
					timeEnd: data.timeEnd,
					durationMinutes: data.durationMinutes,
					reason: data.reason,
					appointmentType: data.appointmentType,
					status: data.status,
				}),
			});
			const bodyText = await res.text();
			let json = {};
			try {
				json = JSON.parse(bodyText);
			} catch { }

			console.log("📡 Server response:", res.status, json || bodyText);

			if (!res.ok) {
				alert(`Save failed (${res.status}): ${json.error || bodyText}`);
				return;
			}

			if (json.success) {
				window.ModalManager.hide();
				window.currentCalendar?.refetchEvents?.();
				window.CurrentAppointmentData.reset();
			} else {
				alert("Save did not succeed. Check console for details.");
			}
		} catch (err) {
			console.error("🔥 Save error:", err);
			alert("Network error while saving appointment.");
		}
	}

	// ---------- CANCEL ----------
	function onCancel() {
		window.ModalManager.hide();
		sessionStorage.removeItem("ehr_returnExpect");
		window.CurrentAppointmentData.reset();
	}

	async function onDelete() {
		const id = window.CurrentAppointmentData.get("appointmentId");
		if (!id) return alert("No appointment to delete.");

		if (!confirm("Are you sure you want to delete this appointment?")) return;

		try {
			const res = await fetch(`/api/schedule/${id}`, {
				method: "DELETE",
				headers: { Accept: "application/json", ...getCsrfHeaders() },
			});

			const json = await res.json();

			if (!res.ok || !json.success) {
				alert(`Delete failed: ${json.error || res.statusText}`);
				return;
			}

			window.ModalManager.hide();
			window.currentCalendar?.refetchEvents?.();
			window.CurrentAppointmentData.reset();
			alert("Appointment deleted successfully.");
		} catch (err) {
			console.error("🔥 Delete error:", err);
			alert("Network error while deleting appointment.");
		}
	}


	// ---------- Inline patient search + handoff ----------
	function attachPatientSuggest(root) {
		const input = root.querySelector("#patientName");
		const dropdown = root.querySelector("#patient-suggest");
		if (!input || !dropdown) return;

		const showDD = () => dropdown.classList.remove("hidden");
		const hideDD = () => {
			dropdown.classList.add("hidden");
			dropdown.innerHTML = "";
		};

		let timer = null;
		input.addEventListener("input", () => {
			clearTimeout(timer);
			const query = input.value.trim();
			if (!query) return hideDD();
			timer = setTimeout(async () => {
				const [first, last] = query.split(/\s+/, 2);
				const params = new URLSearchParams({
					firstName: first || "",
					lastName: last || "",
					size: 6,
				});
				const res = await fetch(`/api/patients/search?${params}`);
				const data = await res.json();
				const list = data.patients || [];
				if (!list.length) return hideDD();

				dropdown.innerHTML = list
					.map(
						(p) =>
							`<div class="suggestion-item" data-id="${p.id}" data-name="${p.firstName} ${p.lastName}">
               ${p.firstName} ${p.lastName}
             </div>`
					)
					.join("");
				showDD();
			}, 150);
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
			const res = await fetch(
				`/api/patients/search?firstName=${encodeURIComponent(first || "")}&lastName=${encodeURIComponent(last || "")}&size=6`
			);
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

			sessionStorage.setItem(
				"ehr_returnActive",
				JSON.stringify(window.CurrentAppointmentData.getAll())
			);
			sessionStorage.setItem("ehr_returnExpect", "true");
			sessionStorage.setItem(
				"ehr_prefillPatient",
				JSON.stringify({ first: first || "", last: last || "" })
			);

			await ViewManager.loadView("patient", "/fragments/patient");
			window.ModalManager.hide();
		});
	}

	return { open };
})();
