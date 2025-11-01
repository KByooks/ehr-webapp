//scehduler-popup.js
function initSchedulerCalendar(providerId) {
  const calendarEl = document.getElementById('calendar');

  if (!calendarEl) {
    console.error('Calendar element not found.');
    return;
  }
  if (typeof FullCalendar === 'undefined') {
    console.error('FullCalendar not loaded.');
    return;
  }

  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'timeGridDay',
    slotDuration: '00:15:00',
    slotMinHeight: 18,
    expandRows: true,
    slotMinTime: '06:00:00',
    slotMaxTime: '21:00:00',
    allDaySlot: false,
    nowIndicator: true,
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek,timeGridDay'
    },
    events: function(fetchInfo, successCallback, failureCallback) {
      fetch(`/api/schedule/${providerId}`)
        .then(res => res.json())
        .then(data => successCallback(data))
        .catch(err => failureCallback(err));
    },
    dateClick: function(info) {
		if (window.AppointmentModal) {
		   window.AppointmentModal.open(providerId, info.dateStr);
		 } else {
		   console.error("AppointmentModal not loaded.");
		 }
    }
  });

  calendar.render();
}
