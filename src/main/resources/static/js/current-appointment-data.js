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
      // ✅ Align with UI & API everywhere as "duration"
      duration: 15,
      reason: "",
      appointmentType: "Follow-up",
      status: "Scheduled",
      patient: null,
    };
  }

  static setFromAppointment(appt) {
    const normalized = { ...appt };

    // ✅ Normalize different field names from backend
    if (normalized.duration == null && normalized.durationMinutes != null) {
      normalized.duration = normalized.durationMinutes;
    }

    // ✅ If duration is missing but start/end exist, compute it
    if (!normalized.duration && normalized.timeStart && normalized.timeEnd) {
      const parseHHMM = (v) => {
        if (!v) return null;
        const [h, m] = v.split(":").map(Number);
        return h * 60 + m;
      };
      const startMins = parseHHMM(normalized.timeStart);
      const endMins = parseHHMM(normalized.timeEnd);
      if (startMins != null && endMins != null) {
        normalized.duration = endMins - startMins;
      }
    }

    this.data = { ...this.data, ...normalized };
  }


  static updateField(field, value) {
    this.data[field] = value;
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
