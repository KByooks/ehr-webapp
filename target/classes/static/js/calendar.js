// ============================================
// calendar.js
// Scheduler logic integrated with ViewManager
// ============================================

function initSchedulerCalendar(providerId = 1) {
	const calendarEl = document.getElementById("calendar");
	if (!calendarEl) return;

	// --- Utilities ---
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

	// --- Return from patient search ---
	window.handleReturnFromPatientSearch = function() {
		try {
			const expect = sessionStorage.getItem("ehr_returnExpect") === "true";
			const activeRaw = sessionStorage.getItem("ehr_returnActive");
			const selectedRaw = sessionStorage.getItem("ehr_selectedPatient");
			if (!expect || !activeRaw || !selectedRaw) return;

			const active = JSON.parse(activeRaw);
			const patient = JSON.parse(selectedRaw);
			sessionStorage.removeItem("ehr_returnExpect");
			sessionStorage.removeItem("ehr_selectedPatient");

			window.CurrentAppointmentData.reset();
			window.CurrentAppointmentData.setFromAppointment(active);

			if (patient) {
				const formatted = {
					id: patient.id,
					firstName: patient.firstName || "",
					lastName: patient.lastName || "",
				};
				window.CurrentAppointmentData.updateField("patient", formatted);
				window.CurrentAppointmentData.updateField("patientId", formatted.id);
			}

			const startISO = `${active.date || ""}T${active.timeStart || ""}`;
			const apptData = window.CurrentAppointmentData.getAll(); // includes patient & patientId
			setTimeout(() => {
				window.AppointmentModal.open(apptData.providerId || providerId, startISO, apptData);
			}, 100);
		} catch (e) {
			console.warn("Return-from-search restore failed:", e);
		}
	};

	// --- FullCalendar setup ---
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

		// Load events from backend
		events: (fetchInfo, success, failure) => {
			fetch(
				`/api/schedule/provider/${providerId}?start=${fetchInfo.startStr}&end=${fetchInfo.endStr}`
			)
				.then((r) => r.json())
				.then(success)
				.catch(failure);
		},

		// --- Double-click empty slot → New appointment ---
		dateClick: (info) => {
			if (calendarEl.dataset.lastClick === info.dateStr) {
				delete calendarEl.dataset.lastClick;

				const startISO = info.dateStr;
				const [date, time] = startISO.split("T");
				const timeStart = time?.slice(0, 5) || "09:00";
				const timeEnd = addMinutes(timeStart, 15);

				window.CurrentAppointmentData.reset();
				window.CurrentAppointmentData.setFromAppointment({
					providerId,
					date,
					timeStart,
					timeEnd,
				});

				window.AppointmentModal.open(providerId, startISO);
			} else {
				calendarEl.dataset.lastClick = info.dateStr;
				setTimeout(() => delete calendarEl.dataset.lastClick, 350);
			}
		},

		// --- Double-click existing event → Edit appointment ---
		eventClick: async (info) => {
			const apptId = info.event.id;
			if (calendarEl.dataset.lastEvent === apptId) {
				delete calendarEl.dataset.lastEvent;
				try {
					const res = await fetch(`/api/schedule/appointment/${apptId}`);
					const appt = await res.json();
					const startISO =
						appt.date && appt.timeStart
							? `${appt.date}T${appt.timeStart}`
							: info.event.startStr;

					window.CurrentAppointmentData.reset();
					window.CurrentAppointmentData.setFromAppointment({
						...appt,
						providerId: appt.providerId || providerId,
					});
					window.CurrentAppointmentData.updateField("appointmentId", appt.id);

					await window.AppointmentModal.open(
						appt.providerId || providerId,
						startISO,
						appt
					);
				} catch (e) {
					console.error("Failed to load appointment:", e);
				}
			} else {
				calendarEl.dataset.lastEvent = apptId;
				setTimeout(() => delete calendarEl.dataset.lastEvent, 350);
			}
		},
	});

	calendar.render();
	window.currentCalendar = calendar;
}

// --- View restoration ---
document.addEventListener("view:shown", (e) => {
	if (e.detail.name !== "scheduler") return;
	try {
		window.handleReturnFromPatientSearch();
		if (window.currentCalendar)
			requestAnimationFrame(() => window.currentCalendar.updateSize());
	} catch (err) {
		console.warn("view:shown reopen failed:", err);
	}
});
