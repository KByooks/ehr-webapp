// ============================================
// current-appointment-data.js
// Central in-memory state for the active appointment
// ============================================

class CurrentAppointmentData {
  static reset() {
    this.data = {
      appointmentId: null,
      providerId: null,
      patientId: null,
      date: null,
      timeStart: null,
      timeEnd: null,
      durationMinutes: 15,
      reason: "",
      appointmentType: "Follow-up",
      status: "Scheduled",
      patient: null,
    };
  }

  static setFromAppointment(appt) {
    this.data = { ...this.data, ...appt };
  }

  static updateField(field, value) {
    if (this.data.hasOwnProperty(field)) {
      this.data[field] = value;
    }
  }

  static get(field) {
    return this.data[field];
  }

  static getAll() {
    return { ...this.data };
  }

  static isEmpty() {
    return !this.data.appointmentId && !this.data.patientId;
  }
}

CurrentAppointmentData.reset();
window.CurrentAppointmentData = CurrentAppointmentData;
