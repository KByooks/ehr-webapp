// ============================================
// appointment.js
// Appointment modal logic using ModalManager
// Includes inline patient search + CRUD (create, update, delete)
// ============================================

window.AppointmentModal = (function () {
  let currentProviderId = null;
  let currentStartISO = null;

  // ---------- Time helpers ----------
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

  // ---------- Inline patient suggest helpers ----------
  function parseNameQuery(raw) {
    const parts = raw.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return { firstName: "", lastName: "" };
    if (parts.length === 1) return { firstName: parts[0], lastName: "" };
    return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
  }

  let activeSuggestAbort = null;
  async function fetchCandidates(firstName, lastName, limit = 6) {
    try {
      if (activeSuggestAbort) activeSuggestAbort.abort();
      activeSuggestAbort = new AbortController();

      const params = new URLSearchParams({
        firstName: firstName || "",
        lastName: lastName || "",
        page: 0,
        size: limit,
        sortBy: "lastName",
        sortDir: "asc",
      });

      const r = await fetch(`/api/patients/search?${params.toString()}`, {
        signal: activeSuggestAbort.signal,
      });
      if (!r.ok) return [];
      const data = await r.json();
      return data.patients || [];
    } catch {
      return [];
    }
  }

  function renderSuggestions(dropdown, list) {
    if (!dropdown) return;
    if (!list || list.length === 0 || list.length > 5) {
      dropdown.classList.add("hidden");
      dropdown.innerHTML = "";
      return;
    }
    dropdown.innerHTML = list
      .map((p) => {
        const fn = p.firstName || "";
        const ln = p.lastName || "";
        const dob = p.dob ? ` • ${p.dob}` : "";
        return `<div class="suggestion-item" data-id="${p.id}" data-fn="${fn}" data-ln="${ln}">
                  <span class="suggestion-name">${fn} ${ln}</span>
                  <span class="suggestion-meta">${dob}</span>
                </div>`;
      })
      .join("");
    dropdown.classList.remove("hidden");
  }

  function attachPatientSuggest(root) {
    const input = root.querySelector("#patientName");
    const dropdown = root.querySelector("#patient-suggest");
    if (!input || !dropdown) return;

    let debounceTimer = null;
    let lastKey = "";

    function lockSelection(p) {
      input.value = `${p.firstName || ""} ${p.lastName || ""}`.trim();
      input.dataset.patientId = p.id;
      renderSuggestions(dropdown, []);
      console.log("✅ Patient locked from suggestions:", p);
    }

    dropdown.addEventListener("click", (e) => {
      const item = e.target.closest(".suggestion-item");
      if (!item) return;
      lockSelection({
        id: item.dataset.id,
        firstName: item.dataset.fn,
        lastName: item.dataset.ln,
      });
    });

    // Live suggestions (debounced)
    input.addEventListener("input", () => {
      delete input.dataset.patientId; // typing invalidates previous selection
      const raw = input.value;
      const { firstName, lastName } = parseNameQuery(raw);
      if (!firstName && !lastName) {
        renderSuggestions(dropdown, []);
        return;
      }

      const key = `${firstName}|${lastName}`;
      if (key === lastKey) return;
      lastKey = key;

      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        const list = await fetchCandidates(firstName, lastName, 6);
        renderSuggestions(dropdown, list);
      }, 220);
    });

    // Enter/Tab → lock 1 result or jump to full search
    input.addEventListener("keydown", async (e) => {
      if (e.key !== "Enter" && e.key !== "Tab") return;

      const raw = input.value.trim();
      if (!raw) return;
      const { firstName, lastName } = parseNameQuery(raw);
      const list = await fetchCandidates(firstName, lastName, 6);

      if (list.length === 1) {
        lockSelection(list[0]);
      } else {
        // mark context so calendar reopens modal after double-click selection
        try {
          sessionStorage.setItem("ehr_returnActive", JSON.stringify({
            providerId: currentProviderId,
            startISO: currentStartISO
          }));
          sessionStorage.setItem("ehr_returnExpect", "true");
        } catch {}
        if (window.ModalManager?.hide) window.ModalManager.hide();

        if (typeof loadSection === "function") {
          loadSection("patient");
          // prefill filters after fragment injects
          setTimeout(() => {
            const fnEl = document.getElementById("filter-firstName");
            const lnEl = document.getElementById("filter-lastName");
            if (fnEl) fnEl.value = firstName || "";
            if (lnEl) lnEl.value = lastName || "";
            if (window.PatientSearch?.performSearch) window.PatientSearch.performSearch();
          }, 350);
        } else {
          const params = new URLSearchParams({ firstName, lastName });
          window.location.href = `/fragments/patient?${params.toString()}`;
        }
      }
    });
  }

  // ---------- Modal lifecycle ----------
  async function open(providerId, startISO) {
    currentProviderId = providerId;
    currentStartISO = startISO;

    console.log("🗓 Opening appointment modal for provider", providerId, "at", startISO);

    // Clear any existing modal safely
    if (window.ModalManager?.hide) window.ModalManager.hide();

    // Load the appointment-details fragment
    const resp = await fetch("/fragments/appointment-details");
    if (!resp.ok) {
      console.error("Failed to fetch appointment-details fragment");
      return;
    }
    const html = await resp.text();

    const temp = document.createElement("div");
    temp.innerHTML = html.trim();
    const modalInner = temp.querySelector("#appointment-modal > .modal-content");
    const contentHTML = modalInner ? modalInner.innerHTML : html;

    // Render modal
    window.ModalManager.show(contentHTML);

    const container = document.querySelector(".modal-content");
    const form = container?.querySelector("#appointment-form");
    if (!form) {
      console.error("Appointment form not found!");
      return;
    }

    // Reset edit state / delete button
    form.querySelector("#delete-appointment")?.remove();
    delete form.dataset.appointmentId;
    const hiddenId = container.querySelector("#appointmentId");
    if (hiddenId) hiddenId.value = "";

    // Fill provider + date/time
    const dt = new Date(startISO);
    container.querySelector("#ctx-provider").textContent = `Provider #${providerId}`;
    container.querySelector("#date").value = dt.toISOString().split("T")[0];
    const hh = pad2(dt.getHours());
    const mm = pad2(dt.getMinutes());
    container.querySelector("#timeStart").value = `${hh}:${mm}`;
    container.querySelector("#timeEnd").value = addMinutes(`${hh}:${mm}`, 15);

    // Prefill patient if returning
    try {
      const stored = sessionStorage.getItem("ehr_selectedPatient");
      if (stored) {
        const maybeP = JSON.parse(stored);
        const input = container.querySelector("#patientName");
        if (maybeP && input) {
          input.value = `${maybeP.firstName} ${maybeP.lastName}`.trim();
          input.dataset.patientId = maybeP.id;
        }
      }
    } catch {}

    // Attach suggest
    attachPatientSuggest(container);

    // Bind save + cancel
    form.onsubmit = onSubmit;
	const cancelBtn = container.querySelector("#cancel-appointment");
	if (cancelBtn) {
	  cancelBtn.onclick = () => {
	    console.log("❌ Appointment creation/edit canceled");
	    window.ModalManager.hide();

	    // 🧹 Clear any lingering context so the modal doesn't reopen later
	    try {
	      sessionStorage.removeItem("ehr_activeAppointment");
	      sessionStorage.removeItem("ehr_selectedPatient");
	      sessionStorage.removeItem("ehr_returnExpect");
	      sessionStorage.removeItem("ehr_returnActive");
	      sessionStorage.removeItem("ehr_justAssigned");
	    } catch (e) {
	      console.warn("Failed to clear session context:", e);
	    }

	    if (window.EHRContext?.clearAppointmentContext) {
	      window.EHRContext.clearAppointmentContext();
	    }

	    window.lastLoadedAppointmentId = null;
	  };
	}


    // If calendar told us we're editing an existing appointment, attach delete + mark id
    if (window.lastLoadedAppointmentId) {
      form.dataset.appointmentId = String(window.lastLoadedAppointmentId);
      if (hiddenId) hiddenId.value = String(window.lastLoadedAppointmentId);

      let delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.id = "delete-appointment";
      delBtn.className = "delete-btn";
      delBtn.textContent = "Delete";
      delBtn.style.marginRight = "auto";
      form.querySelector(".form-actions").prepend(delBtn);

      delBtn.addEventListener("click", onDelete);
    }
  }

  // ---------- Delete handler ----------
  async function onDelete() {
    const form = document.querySelector("#appointment-form");
    const targetId = form?.dataset?.appointmentId || document.querySelector("#appointmentId")?.value;
    if (!targetId) {
      alert("No appointment selected to delete.");
      return;
    }
    if (!confirm("Are you sure you want to delete this appointment?")) return;

    try {
      const res = await fetch(`/api/schedule/${targetId}`, { method: "DELETE" });
      const result = await res.json();
      if (result.success) {
        console.log(`🗑️ Deleted appointment ${targetId}`);
        if (window.ModalManager?.hide) window.ModalManager.hide();
        window.lastLoadedAppointmentId = null;
        window.currentCalendar?.refetchEvents?.();
      } else {
        alert(result.error || "Failed to delete appointment.");
      }
    } catch (err) {
      console.error("Error deleting appointment:", err);
      alert("Error deleting appointment.");
    }
  }

  // ---------- Save handler (create or update) ----------
  async function onSubmit(e) {
    e.preventDefault();
    const form = e.currentTarget;

    // Determine edit vs create
    const apptId = form.dataset.appointmentId || document.querySelector("#appointmentId")?.value || null;
    const isUpdate = !!apptId;

    let patientId = form.querySelector("#patientName")?.dataset?.patientId || null;
    if (!patientId) {
      // fallback to session if user came from search
      try {
        const stored = sessionStorage.getItem("ehr_selectedPatient");
        if (stored) {
          const p = JSON.parse(stored);
          if (p?.id) patientId = p.id;
        }
      } catch {}
    }

    if (!patientId) {
      alert("Please select or confirm a patient first.");
      return;
    }

    const payload = {
      providerId: currentProviderId,
      patientId,
      appointmentType: form.appointmentType.value,
      reason: form.reason.value,
      status: form.status.value,
      date: form.date.value,
      timeStart: form.timeStart.value + ":00",
      timeEnd: form.timeEnd.value + ":00",
      durationMinutes: parseInt(form.duration.value, 10),
    };

    console.log(`💾 ${isUpdate ? "Updating" : "Saving"} appointment payload:`, payload);

    try {
      const url = isUpdate ? `/api/schedule/${apptId}` : "/api/schedule/create";
      const method = isUpdate ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await res.json();

      if (result.success) {
        console.log(`✅ Appointment ${isUpdate ? "updated" : "created"}:`, result);
        // clear only the temp flags—don’t nuke general session usage
        sessionStorage.removeItem("ehr_returnActive");
        sessionStorage.removeItem("ehr_returnExpect");
        if (window.ModalManager?.hide) window.ModalManager.hide();
        window.lastLoadedAppointmentId = null;
        window.currentCalendar?.refetchEvents?.();
      } else {
        alert(result.error || "Error saving appointment.");
      }
    } catch (err) {
      console.error("Error saving appointment:", err);
      alert("Error saving appointment.");
    }
  }

  return { open };
})();
