// ============================================
// calendar.js — Scheduler logic (persistent, reload-free)
// ============================================

function initSchedulerCalendar(providerId = null) {
	const calendarEl = document.getElementById("calendar");
	if (!calendarEl) return;

	// ---- Resolve provider ----
	let stored = null;
	try {
		stored = JSON.parse(sessionStorage.getItem("ehr_selectedProvider") || "null");
	} catch { }
	const effectiveProviderId = providerId || stored?.id || 1;

	// ---- Update provider name in top bar ----
	(async () => {
		const input = document.getElementById("providerFilter");
		if (!input) return;

		if (!stored) {
			try {
				const res = await fetch(`/api/providers/${effectiveProviderId}`);
				if (res.ok) {
					const p = await res.json();
					sessionStorage.setItem("ehr_selectedProvider", JSON.stringify(p));
					input.value = p.displayName || `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim();
				}
			} catch (e) {
				console.warn("Could not load default provider:", e);
			}
		} else {
			input.value =
				stored.displayName || `${stored.firstName ?? ""} ${stored.lastName ?? ""}`.trim();
		}
	})();

	// ---- Helpers ----
	const pad2 = (n) => String(n).padStart(2, "0");
	const parseHHMM = (v) => (!v ? null : { h: +v.split(":")[0], m: +v.split(":")[1] });
	const addMinutes = (hhmm, minutes) => {
		const t = parseHHMM(hhmm);
		if (!t) return null;
		const total = t.h * 60 + t.m + (+minutes || 0);
		return `${pad2(Math.floor(total / 60) % 24)}:${pad2(total % 60)}`;
	};

	// ===========================================================
	// Provider Filter (Scheduler top search)
	// ===========================================================
	const providerInput = document.getElementById("providerFilter");
	const suggestBox = document.getElementById("providerFilter-suggest");

	if (providerInput && suggestBox) {
		let timer = null;

		document.addEventListener("click", (e) => {
			if (!providerInput.contains(e.target) && !suggestBox.contains(e.target))
				suggestBox.classList.add("hidden");
		});

		providerInput.addEventListener("input", () => {
			clearTimeout(timer);
			const query = providerInput.value.trim();
			if (!query) return suggestBox.classList.add("hidden");

			timer = setTimeout(async () => {
				const [first, last] = query.split(/\s+/, 2);
				const params = new URLSearchParams({
					firstName: first || "",
					lastName: last || "",
					inPracticeOnly: true,
					size: 12,
				});
				const res = await fetch(`/api/providers/search?${params}`);
				const data = await res.json();
				const list = data.providers || [];

				suggestBox.innerHTML = "";
				if (!list.length) return suggestBox.classList.add("hidden");

				list.forEach((p) => {
					const item = document.createElement("div");
					item.classList.add("suggestion-item");
					item.innerHTML = `
            <span class="suggestion-name">${p.displayName}</span>
            <span class="suggestion-meta">${p.specialty || ""}</span>`;
					item.addEventListener("click", () => {
						window.Scheduler.updateProvider(p);
						suggestBox.classList.add("hidden");
					});
					suggestBox.appendChild(item);
				});
				suggestBox.classList.remove("hidden");
			}, 180);
		});

		providerInput.addEventListener("keydown", async (e) => {
			if (e.key !== "Enter" && e.key !== "Tab") return;
			e.preventDefault();

			const query = providerInput.value.trim();
			const [first, last] = query.split(/\s+/, 2);
			const res = await fetch(
				`/api/providers/search?firstName=${encodeURIComponent(first || "")}&lastName=${encodeURIComponent(last || "")}&inPracticeOnly=true&size=12`
			);
			const data = await res.json();
			const list = data.providers || [];

			if (list.length === 1) {
				window.Scheduler.updateProvider(list[0]);
				return;
			}

			// Multiple → open Provider Search prefilled
			window.EHRState?.setPrefillProvider?.({
				first: first || "",
				last: last || "",
				inPracticeOnly: true,
			});
			sessionStorage.setItem("ehr_returnFromScheduler", "true");
			await ViewManager.loadView("provider", "/fragments/provider");
		});
	}

	// ===========================================================
	// FullCalendar setup
	// ===========================================================
	const calendar = new FullCalendar.Calendar(calendarEl, {
		initialView: "timeGridWeek",
		slotDuration: "00:15:00",
		expandRows: true,
		nowIndicator: true,
		height: "90vh",
		headerToolbar: {
			left: "prev,next today",
			center: "title",
			right: "dayGridMonth,timeGridWeek,timeGridDay",
		},

		events: (info, success, failure) =>
			fetch(
				`/api/schedule/provider/${effectiveProviderId}?start=${info.startStr}&end=${info.endStr}`
			)
				.then((r) => r.json())
				.then(success)
				.catch(failure),

		dateClick: (info) => {
			if (calendarEl.dataset.lastClick === info.dateStr) {
				delete calendarEl.dataset.lastClick;
				const [date, time] = info.dateStr.split("T");
				const timeStart = time?.slice(0, 5) || "09:00";
				const timeEnd = addMinutes(timeStart, 15);

				// ✅ Always trust the active calendar's provider
				const activeProvider = JSON.parse(sessionStorage.getItem("ehr_selectedProvider") || "null");
				const providerId = activeProvider?.id || effectiveProviderId || 1;

				// ✅ Keep sessionStorage synced with current calendar
				sessionStorage.setItem("ehr_selectedProvider", JSON.stringify(activeProvider || { id: providerId }));

				window.CurrentAppointmentData.reset();
				window.CurrentAppointmentData.setFromAppointment({
					providerId,
					date,
					timeStart,
					timeEnd,
				});

				window.AppointmentModal.open(providerId, info.dateStr);
			} else {
				calendarEl.dataset.lastClick = info.dateStr;
				setTimeout(() => delete calendarEl.dataset.lastClick, 350);
			}
		},


		eventClick: async (info) => {
			const apptId = info.event.id;
			if (calendarEl.dataset.lastEvent === apptId) {
				delete calendarEl.dataset.lastEvent;
				const res = await fetch(`/api/schedule/appointment/${apptId}`);
				const appt = await res.json();
				const startISO =
					appt.date && appt.timeStart ? `${appt.date}T${appt.timeStart}` : info.event.startStr;
				window.CurrentAppointmentData.reset();
				window.CurrentAppointmentData.setFromAppointment({
					...appt,
					providerId: appt.providerId || effectiveProviderId,
				});
				await window.AppointmentModal.open(appt.providerId || effectiveProviderId, startISO, appt);
			} else {
				calendarEl.dataset.lastEvent = apptId;
				setTimeout(() => delete calendarEl.dataset.lastEvent, 350);
			}
		},
	});

	calendar.render();
	window.currentCalendar = calendar;
}

// ===========================================================
// Scheduler helper for updating provider dynamically
// ===========================================================
window.Scheduler = {
	updateProvider(provider) {
		if (!provider) return;
		sessionStorage.setItem("ehr_selectedProvider", JSON.stringify(provider));

		const input = document.getElementById("providerFilter");
		if (input)
			input.value =
				provider.displayName ||
				`${provider.firstName ?? ""} ${provider.lastName ?? ""}`.trim();

		if (window.currentCalendar) {
			const src = window.currentCalendar.getEventSources()[0];
			if (src) src.remove();
			window.currentCalendar.addEventSource((info, success, failure) => {
				fetch(`/api/schedule/provider/${provider.id}?start=${info.startStr}&end=${info.endStr}`)
					.then((r) => r.json())
					.then(success)
					.catch(failure);
			});
			window.currentCalendar.refetchEvents();
		}
	},
};

// ===========================================================
// Handle return-from-search via EHRState
// ===========================================================
document.addEventListener("view:shown", (e) => {
	if (e.detail.name !== "scheduler") return;

	try {
		const pending = window.EHRState?.consumePendingReturn?.();
		if (!pending) {
			window.currentCalendar?.updateSize();
			return;
		}

		const active = window.EHRState?.getActiveAppointment?.();
		if (!active) return;

		const p = pending.entity;
		window.CurrentAppointmentData.reset();
		window.CurrentAppointmentData.setFromAppointment(active.apptData || active);

		if (pending.field === "patient") {
			window.CurrentAppointmentData.updateField("patient", {
				id: p.id,
				firstName: p.firstName,
				lastName: p.lastName,
			});
			window.CurrentAppointmentData.updateField("patientId", p.id);
		} else if (pending.field === "provider") {
			window.CurrentAppointmentData.updateField("provider", {
				id: p.id,
				firstName: p.firstName,
				lastName: p.lastName,
			});
			window.CurrentAppointmentData.updateField("providerId", p.id);
			if (window.Scheduler?.updateProvider) {
				window.Scheduler.updateProvider(p);
				console.log("🔄 Switched scheduler calendar to provider:", p.displayName || `${p.firstName} ${p.lastName}`);
			}
		}

		const appt = window.CurrentAppointmentData.getAll();
		const startISO = `${appt.date || ""}T${appt.timeStart || ""}`;
		const providerId = appt.providerId || p.id || active.providerId || 1;
		window.AppointmentModal.open(providerId, startISO, appt);
	} catch (err) {
		console.warn("return-from-search failed:", err);
	}
});
