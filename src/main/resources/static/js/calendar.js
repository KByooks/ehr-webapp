// ============================================================================
// calendar.js — Scheduler logic (persistent, reload-free)
// ----------------------------------------------------------------------------
// Responsibilities:
//
//   • Initialize FullCalendar (week/day/month views)
//   • Load events for the actively selected provider
//   • Handle double-click time slots → open appointment modal
//   • Handle double-click events → edit appointment in modal
//   • Handle drag/drop + resize updates
//   • Manage provider switching via the top provider filter
//
// Architecture guarantees:
//
//   • Scheduler never reloads the entire app
//   • Provider selection persists in sessionStorage
//   • Appointment modal is persistent (soft-hide), so returning from
//     patient search or demographics restores it seamlessly
//
// IMPORTANT:
//   This file assumes the existence of:
//     - window.CurrentAppointmentData
//     - window.AppointmentModal
//     - window.EHRState
//     - window.ViewManager
//   and exposes:
//     - global function initSchedulerCalendar
//     - window.Scheduler helper
//
//   Behavior is intentionally preserved from your working version.
// ============================================================================

function initSchedulerCalendar(providerId = null) {
  // --------------------------------------------------------------------------
  // DOM guard — if no calendar element, nothing to initialize
  // --------------------------------------------------------------------------
  const calendarEl = document.getElementById("calendar");
  if (!calendarEl) return;

  // --------------------------------------------------------------------------
  // Determine effective provider:
  //   1. Explicit `providerId` argument (e.g. when switching providers)
  //   2. Cached "ehr_selectedProvider" from sessionStorage
  //   3. Fallback: provider with id = 1
  //
  // NOTE:
  //   - Effective provider id is used only for the initial event source.
  //   - After you call Scheduler.updateProvider, the event source is swapped
  //     to use that provider.id instead.
  // --------------------------------------------------------------------------
  let stored = null;
  try {
    stored = JSON.parse(sessionStorage.getItem("ehr_selectedProvider") || "null");
  } catch {
    // swallow parse errors and fall back to defaults
  }

  const effectiveProviderId = providerId || stored?.id || 1;

  // --------------------------------------------------------------------------
  // PRELOAD: Update the provider filter text box at the top of the scheduler.
  // This runs async and does NOT block calendar initialization.
  // --------------------------------------------------------------------------
  (async () => {
    const input = document.getElementById("providerFilter");
    if (!input) return;

    // No provider cached? Load the default provider by id.
    if (!stored) {
      try {
        const res = await fetch(`/api/providers/${effectiveProviderId}`);
        if (res.ok) {
          const p = await res.json();
          sessionStorage.setItem("ehr_selectedProvider", JSON.stringify(p));

          input.value =
            p.displayName ||
            `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim();
        }
      } catch (e) {
        console.warn("[Scheduler] Could not load default provider:", e);
      }
    } else {
      // Use cached provider info
      input.value =
        stored.displayName ||
        `${stored.firstName ?? ""} ${stored.lastName ?? ""}`.trim();
    }
  })();

  // ==========================================================================
  // Utility helpers (used throughout calendar)
  // ==========================================================================
  const pad2 = (n) => String(n).padStart(2, "0");

  const parseHHMM = (v) => {
    if (!v) return null;
    const [h, m] = v.split(":").map(Number);
    return { h, m };
  };

  const addMinutes = (hhmm, minutes) => {
    const t = parseHHMM(hhmm);
    if (!t) return null;
    const total = t.h * 60 + t.m + (+minutes || 0);
    return `${pad2(Math.floor(total / 60) % 24)}:${pad2(total % 60)}`;
  };

  // ==========================================================================
  // Provider Filter Suggestion Dropdown (Scheduler top bar)
  //   - Inline search by first/last name
  //   - Click suggestion → switch provider calendar
  //   - Enter/Tab → auto-select single match or go to Provider Search view
  // ==========================================================================
  const providerInput = document.getElementById("providerFilter");
  const suggestBox = document.getElementById("providerFilter-suggest");

  if (providerInput && suggestBox) {
    let timer = null;

    // Hide dropdown on outside click
    document.addEventListener("click", (e) => {
      if (!providerInput.contains(e.target) && !suggestBox.contains(e.target)) {
        suggestBox.classList.add("hidden");
      }
    });

    // ---- Autocomplete logic on provider filter input ----
    providerInput.addEventListener("input", () => {
      clearTimeout(timer);

      const query = providerInput.value.trim();
      if (!query) {
        suggestBox.classList.add("hidden");
        return;
      }

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
        if (!list.length) {
          suggestBox.classList.add("hidden");
          return;
        }

        // Build suggestion rows
        list.forEach((p) => {
          const item = document.createElement("div");
          item.classList.add("suggestion-item");
          item.innerHTML = `
            <span class="suggestion-name">${p.displayName}</span>
            <span class="suggestion-meta">${p.specialty || ""}</span>
          `;
          item.addEventListener("click", () => {
            window.Scheduler.updateProvider(p);
            suggestBox.classList.add("hidden");
          });
          suggestBox.appendChild(item);
        });

        suggestBox.classList.remove("hidden");
      }, 180);
    });

    // ---- Enter/Tab behavior for provider filter ----
    providerInput.addEventListener("keydown", async (e) => {
      if (e.key !== "Enter" && e.key !== "Tab") return;
      e.preventDefault();

      const query = providerInput.value.trim();
      const [first, last] = query.split(/\s+/, 2);

      const res = await fetch(
        `/api/providers/search?firstName=${encodeURIComponent(first || "")}` +
        `&lastName=${encodeURIComponent(last || "")}` +
        `&inPracticeOnly=true&size=12`
      );

      const data = await res.json();
      const list = data.providers || [];

      // Exactly one provider → auto-select and switch calendar
      if (list.length === 1) {
        window.Scheduler.updateProvider(list[0]);
        return;
      }

      // Multiple/none → go to Provider Search view with prefill
      window.EHRState?.setPrefillProvider?.({
        first: first || "",
        last: last || "",
        inPracticeOnly: true,
      });

      sessionStorage.setItem("ehr_returnFromScheduler", "true");

      await ViewManager.loadView("provider", "/fragments/provider");
    });
  }

  // ==========================================================================
  // FullCalendar Initialization
  // ==========================================================================
  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: "timeGridWeek",
    editable: true,
    eventDurationEditable: true,
    slotDuration: "00:15:00",
    expandRows: true,
    nowIndicator: true,
    height: "90vh",

    headerToolbar: {
      left: "prev,next today",
      center: "title",
      right: "dayGridMonth,timeGridWeek,timeGridDay",
    },

    // ------------------------------------------------------------------------
    // EVENTS SOURCE:
    // Loads appointments for the active provider + date range.
    // NOTE:
    //   - Uses `effectiveProviderId` at initialization.
    //   - After calling Scheduler.updateProvider, the event source is replaced
    //     to use that selected provider instead.
    // ------------------------------------------------------------------------
    events: (info, success, failure) =>
      fetch(
        `/api/schedule/provider/${effectiveProviderId}` +
        `?start=${info.startStr}&end=${info.endStr}`
      )
        .then((r) => r.json())
        .then(success)
        .catch(failure),

    // ------------------------------------------------------------------------
    // Double-click on empty time slot → create appointment
    //
    // FullCalendar doesn't have native dblclick for dateClick.
    // We emulate double-click using a short-timed toggle on `calendarEl`.
    // ------------------------------------------------------------------------
    dateClick: (info) => {
      if (calendarEl.dataset.lastClick === info.dateStr) {
        // second click within window ⇒ treat as double-click
        delete calendarEl.dataset.lastClick;

        // Parse date/time from click event
        const [date, time] = info.dateStr.split("T");
        const timeStart = time?.slice(0, 5) || "09:00";
        const timeEnd = addMinutes(timeStart, 15);

        const activeProvider = JSON.parse(
          sessionStorage.getItem("ehr_selectedProvider") || "null"
        );
        const selectedProviderId = activeProvider?.id || effectiveProviderId || 1;

        console.log("[Scheduler] New appointment double-click for provider:", selectedProviderId);

        // Ensure selected provider is cached
        sessionStorage.setItem(
          "ehr_selectedProvider",
          JSON.stringify(activeProvider || { id: selectedProviderId })
        );

        // Seed fresh model
        window.CurrentAppointmentData.reset();
        window.CurrentAppointmentData.setFromAppointment({
          providerId: selectedProviderId,
          date,
          timeStart,
          timeEnd,
        });

        // Open modal
        window.AppointmentModal.open(selectedProviderId, info.dateStr);
      } else {
        // first click → arm the double-click detector
        calendarEl.dataset.lastClick = info.dateStr;
        setTimeout(() => delete calendarEl.dataset.lastClick, 350);
      }
    },

    // ------------------------------------------------------------------------
    // Double-click on existing event → edit appointment
    //
    // Same dblclick emulation as above, but keyed off event.id.
    // ------------------------------------------------------------------------
    eventClick: async (info) => {
      const apptId = info.event.id;

      if (calendarEl.dataset.lastEvent === apptId) {
        delete calendarEl.dataset.lastEvent;

        const res = await fetch(`/api/schedule/appointment/${apptId}`);
        const appt = await res.json();

        const startISO =
          appt.date && appt.timeStart
            ? `${appt.date}T${appt.timeStart}`
            : info.event.startStr;

        // Seed CurrentAppointmentData with full DTO, including providerId.
        window.CurrentAppointmentData.reset();
        window.CurrentAppointmentData.setFromAppointment({
          ...appt,
          providerId: appt.providerId || effectiveProviderId,
        });

        await window.AppointmentModal.open(
          appt.providerId || effectiveProviderId,
          startISO,
          appt
        );
      } else {
        calendarEl.dataset.lastEvent = apptId;
        setTimeout(() => delete calendarEl.dataset.lastEvent, 350);
      }
    },

    // ------------------------------------------------------------------------
    // Drag event (move appointment)
    //   - Updates date/time on the backend
    //   - Keeps provider, status, etc. unchanged
    // ------------------------------------------------------------------------
    eventDrop: async (info) => {
      try {
        const event = info.event;
        const id = event.id;

        const [date, timeStartRaw] = event.startStr.split("T");
        const [, timeEndRaw] = event.endStr.split("T");

        const timeStart = timeStartRaw.slice(0, 5);
        const timeEnd = timeEndRaw.slice(0, 5);

        const payload = { date, timeStart, timeEnd };

        const res = await fetch(`/api/schedule/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        // Update local persistent model
        window.CurrentAppointmentData.updateField("date", date);
        window.CurrentAppointmentData.updateField("timeStart", timeStart);
        window.CurrentAppointmentData.updateField("timeEnd", timeEnd);
      } catch (err) {
        console.error("⚠️ Failed to move appointment:", err);
        info.revert();
      }
    },

    // ------------------------------------------------------------------------
    // Resize event (change duration)
    //   - Updates end time on backend
    //   - Provider remains unchanged
    // ------------------------------------------------------------------------
    eventResize: async (info) => {
      try {
        const event = info.event;
        const id = event.id;

        const [date, timeStartRaw] = event.startStr.split("T");
        const [, timeEndRaw] = event.endStr.split("T");

        const timeStart = timeStartRaw.slice(0, 5);
        const timeEnd = timeEndRaw.slice(0, 5);

        const payload = { date, timeStart, timeEnd };

        const res = await fetch(`/api/schedule/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        window.CurrentAppointmentData.updateField("date", date);
        window.CurrentAppointmentData.updateField("timeStart", timeStart);
        window.CurrentAppointmentData.updateField("timeEnd", timeEnd);
      } catch (err) {
        console.error("⚠️ Failed to resize appointment:", err);
        info.revert();
      }
    },
  });

  // Render the calendar & expose it globally
  calendar.render();
  window.currentCalendar = calendar;
}

// ============================================================================
// Scheduler Helper — Provider Switching
// ----------------------------------------------------------------------------
// This object is used by:
//
//   • ProviderFilter search bar (top of scheduler)
//   • Appointment modal provider suggest
//   • Any future provider-switch UI
//
// Responsibilities:
//
//   - Persist selected provider in sessionStorage
//   - Update scheduler top-bar input
//   - Swap FullCalendar event source to the new provider
//
// NOTE:
//   This does NOT touch the appointment modal directly. The modal itself
//   uses providerId from CurrentAppointmentData and DTOs.
// ============================================================================
window.Scheduler = {
  updateProvider(provider) {
    if (!provider) return;

    // Persist selected provider
    sessionStorage.setItem("ehr_selectedProvider", JSON.stringify(provider));

    // Update UI field (scheduler top bar)
    const input = document.getElementById("providerFilter");
    if (input) {
      input.value =
        provider.displayName ||
        `${provider.firstName ?? ""} ${provider.lastName ?? ""}`.trim();
    }

    console.log(
      "[Scheduler] updateProvider →",
      provider.id,
      provider.displayName ||
        `${provider.firstName ?? ""} ${provider.lastName ?? ""}`.trim()
    );

    // Update calendar event source to load appointments for this provider
    if (window.currentCalendar) {
      const src = window.currentCalendar.getEventSources()[0];
      if (src) src.remove();

      window.currentCalendar.addEventSource((info, success, failure) => {
        fetch(
          `/api/schedule/provider/${provider.id}` +
          `?start=${info.startStr}&end=${info.endStr}`
        )
          .then((r) => r.json())
          .then(success)
          .catch(failure);
      });

      window.currentCalendar.refetchEvents();
    }
  },
};
