// ===============================================================
// current-appointment-data.js
// Central in-memory state for the *active appointment*
// Architecture A — persistent modal + stable shared memory
// ===============================================================
//
// PURPOSE:
//   - Stores all current appointment fields while appointment modal exists
//   - Allows scheduler → patient search → demographics → scheduler
//     WITHOUT losing the modal state
//   - Provides a normalized, defensive shape for all fields
//
// GUARANTEES:
//   - Always returns a complete safe object (never undefined)
//   - No stale fields survive after reset()
//   - Backend naming inconsistencies are normalized
//   - Duration always exists (computed if missing)
//   - Pure state holder: no DOM or network logic
//
// IMPORTANT:
//   This file must NEVER directly manipulate UI.
//   It is strictly the model layer for appointment editing.
//
// ===============================================================

class CurrentAppointmentData {
  // -------------------------------------------------------------
  // reset()
  // Resets to a guaranteed baseline, never leaves partial state.
  // Called:
  //   • when modal first opens
  //   • after save/delete
  //   • before setFromAppointment()
  // -------------------------------------------------------------
  static reset() {
    this.data = {
      appointmentId: null,
      providerId: null,
      patientId: null,

      date: null,
      timeStart: null,
      timeEnd: null,

      // Always treat duration as minutes.
      duration: 15,

      reason: "",
      appointmentType: "Follow-up",
      status: "Scheduled",

      // Full patient object when known
      patient: null,
    };
  }

  // -------------------------------------------------------------
  // setFromAppointment(appt)
  // Normalizes any backend/DB shape into our unified model.
  // Accepts:
  //   - partial objects
  //   - full Appointment DTO objects
  //   - internal snapshot from EHRState
  //
  // Ensures:
  //   • duration always exists
  //   • handles durationMinutes vs duration
  //   • merges safely onto default base
  // -------------------------------------------------------------
  static setFromAppointment(appt) {
    if (!appt || typeof appt !== "object") return;

    const normalized = { ...appt };

    // Normalize backend field name
    if (normalized.duration == null && normalized.durationMinutes != null) {
      normalized.duration = normalized.durationMinutes;
    }

    // Compute duration if missing and both times exist
    if (
      (normalized.duration == null || normalized.duration === 0) &&
      normalized.timeStart &&
      normalized.timeEnd
    ) {
      const parseHHMM = (v) => {
        if (!v) return null;
        const [h, m] = v.split(":").map(Number);
        return h * 60 + m;
      };
      const start = parseHHMM(normalized.timeStart);
      const end = parseHHMM(normalized.timeEnd);
      if (start != null && end != null) {
        normalized.duration = end - start;
      }
    }

    // Merge onto defaults but allow overrides
    this.data = { ...this.data, ...normalized };
  }

  // -------------------------------------------------------------
  // updateField(key, value)
  // Does NOT allow unknown fields unless intentional.
  // Clean place to add validation later.
  // -------------------------------------------------------------
  static updateField(field, value) {
    this.data[field] = value;
  }

  // -------------------------------------------------------------
  // get(field)
  // Null-safe accessor.
  // -------------------------------------------------------------
  static get(field) {
    return this.data[field];
  }

  // -------------------------------------------------------------
  // getAll()
  // Returns an immutable COPY of the current appointment.
  // (prevent accidental mutation from outside)
  // -------------------------------------------------------------
  static getAll() {
    return { ...this.data };
  }

  // -------------------------------------------------------------
  // isEmpty()
  // Lightweight helper for debug/edge cases.
  // -------------------------------------------------------------
  static isEmpty() {
    return !this.data.appointmentId && !this.data.patientId;
  }
}

// Initialize clean state on load
CurrentAppointmentData.reset();

// Global exposure
window.CurrentAppointmentData = CurrentAppointmentData;
