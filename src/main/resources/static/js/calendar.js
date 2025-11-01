// ============================================
// calendar.js
// Scheduler logic with context linking
// ============================================
// Run on scheduler load and also after patient assignment
window.handleReturnFromPatientSearch = async function (providerId = 1) {
  try {
    const returnExpect = sessionStorage.getItem("ehr_returnExpect") === "false"; // consumed already
    const activeRaw = sessionStorage.getItem("ehr_returnActive");
    const patientRaw = sessionStorage.getItem("ehr_selectedPatient");

    if (!activeRaw || !patientRaw) return;

    const activeAppt = JSON.parse(activeRaw);
    const patient = JSON.parse(patientRaw);

    console.log("🔁 Scheduler loaded with selected patient:", patient);

    // reopen modal
    setTimeout(() => {
      window.AppointmentModal.open(activeAppt.providerId || providerId, activeAppt.startISO);
      setTimeout(() => {
        const input = document.getElementById("patientName");
        if (input) {
          input.value = `${patient.firstName} ${patient.lastName}`.trim();
          input.dataset.patientId = patient.id;
        }
      }, 350);
    }, 250);
  } catch (e) {
    console.warn("handleReturnFromPatientSearch failed:", e);
  }
};

function initSchedulerCalendar(providerId = 1) {
  const calendarEl = document.getElementById("calendar");
  if (!calendarEl) return;

  // --- Handle return from patient search (session-based & robust) ---
  (async () => {
    try {
      const returnExpect = sessionStorage.getItem("ehr_returnExpect") === "true";
      const activeRaw = sessionStorage.getItem("ehr_returnActive");
      const patientRaw = sessionStorage.getItem("ehr_selectedPatient");
      if (returnExpect && activeRaw && patientRaw) {
        const activeAppt = JSON.parse(activeRaw);
        const patient = JSON.parse(patientRaw);

        // consume the flag so it doesn't loop
        sessionStorage.removeItem("ehr_returnExpect");

        console.log("🔁 Returning from patient search:", patient);
        setTimeout(() => {
          window.AppointmentModal.open(activeAppt.providerId || providerId, activeAppt.startISO);
          setTimeout(() => {
            const input = document.getElementById("patientName");
            if (input) {
              input.value = `${patient.firstName} ${patient.lastName}`.trim();
              input.dataset.patientId = patient.id;
            }
          }, 350);
        }, 250);
      }
    } catch (e) {
      console.warn("Return-from-search init check failed:", e);
    }
  })();

  // --- Calendar setup ---
  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: "timeGridDay",
    slotDuration: "00:15:00",
    expandRows: true,
    nowIndicator: true,
    height: "90vh",
    headerToolbar: {
      left: "prev,next today",
      center: "title",
      right: "dayGridMonth,timeGridWeek,timeGridDay",
    },
    events: (fetchInfo, success, failure) => {
      fetch(`/api/schedule/${providerId}?start=${fetchInfo.startStr}&end=${fetchInfo.endStr}`)
        .then((r) => r.json())
        .then(success)
        .catch(failure);
    },

    // --- Double-click empty slot -> create flow ---
    dateClick: (info) => {
      if (calendarEl.dataset.lastClick === info.dateStr) {
        delete calendarEl.dataset.lastClick;

        // store context so, if we jump to patient search, we can come back
        try {
          sessionStorage.setItem("ehr_returnActive", JSON.stringify({
            providerId,
            startISO: info.dateStr
          }));
        } catch {}
        window.AppointmentModal.open(providerId, info.dateStr);
      } else {
        calendarEl.dataset.lastClick = info.dateStr;
        setTimeout(() => delete calendarEl.dataset.lastClick, 350);
      }
    },

    // --- Double-click existing event -> edit flow ---
    eventClick: async (info) => {
      const event = info.event;
      const apptId = event.id;

      if (calendarEl.dataset.lastEvent === apptId) {
        delete calendarEl.dataset.lastEvent;

        try {
          // preload details so modal can fill faster
          const res = await fetch(`/api/schedule/appointment/${apptId}`);
          const appt = await res.json();

          const startISO =
            (appt.date && appt.timeStart) ? `${appt.date}T${appt.timeStart}` : event.startStr;

          // mark that we're editing this one
          window.lastLoadedAppointmentId = apptId;

          await window.AppointmentModal.open(appt.providerId || providerId, startISO);

          // prefill fields shortly after modal injects
          setTimeout(() => {
            const modal = document.querySelector(".modal-content");
            if (!modal) return;
            const setVal = (sel, val) => {
              const el = modal.querySelector(sel);
              if (el && val != null) el.value = val;
            };
            setVal("#date", appt.date);
            setVal("#timeStart", appt.timeStart?.slice(0, 5));
            setVal("#timeEnd", appt.timeEnd?.slice(0, 5));
            setVal("#reason", appt.reason);
            setVal("#appointmentType", appt.appointmentType);
            setVal("#status", appt.status);
            if (appt.patient) {
              const input = modal.querySelector("#patientName");
              if (input) {
                input.value = `${appt.patient.firstName} ${appt.patient.lastName}`;
                input.dataset.patientId = appt.patient.id;
              }
            }
          }, 250);
        } catch (e) {
          console.error("Failed to load appointment details:", e);
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
