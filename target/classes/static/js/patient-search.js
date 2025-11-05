// ============================================
// patient-search.js
// ViewManager-integrated Patient Search
// - Reads prefill from sessionStorage (ehr_prefillPatient)
// - Double-click row selects patient and returns to Scheduler
// ============================================

window.PatientSearch = (function () {
  function init() {
    bind();
    prefillFromSession();
    performSearch(); // initial load (with or without prefill)
  }

  function bind() {
    document.getElementById("search-btn")?.addEventListener("click", performSearch);

    // Enter-to-search
    document.getElementById("patient-search-filters")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        performSearch();
      }
    });
  }

  function prefillFromSession() {
    try {
      const raw = sessionStorage.getItem("ehr_prefillPatient");
      if (!raw) return;
      const { first, last } = JSON.parse(raw);
      const fn = document.getElementById("filter-firstName");
      const ln = document.getElementById("filter-lastName");
      if (fn) fn.value = first || "";
      if (ln) ln.value = last || "";
      // keep it for back/forward until selection or manual clear
    } catch {}
  }

  async function performSearch() {
    const fn = document.getElementById("filter-firstName")?.value?.trim() || "";
    const ln = document.getElementById("filter-lastName")?.value?.trim() || "";
    const dob = document.getElementById("filter-dob")?.value?.trim() || "";
    const phone = document.getElementById("filter-phone")?.value?.trim() || "";
    const email = document.getElementById("filter-email")?.value?.trim() || "";
    const city = document.getElementById("filter-city")?.value?.trim() || "";
    const state = document.getElementById("filter-state")?.value?.trim() || "";
    const zip = document.getElementById("filter-zip")?.value?.trim() || "";

    const params = new URLSearchParams({
      firstName: fn, lastName: ln, dob, phone, email, city, state, zip, size: 20
    });

    const tbody = document.querySelector("#patient-results tbody");
    if (tbody) tbody.innerHTML = `<tr><td colspan="9" class="p-2">Searching…</td></tr>`;

    try {
      const res = await fetch(`/api/patients/search?${params.toString()}`);
      const data = await res.json();
      renderRows(data.patients || []);
    } catch (err) {
      console.error("Patient search failed:", err);
      if (tbody) tbody.innerHTML = `<tr><td colspan="9" class="p-2 text-red-700">Search failed.</td></tr>`;
    }
  }

  function renderRows(list) {
    const tbody = document.querySelector("#patient-results tbody");
    if (!tbody) return;

    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="9" class="p-2 text-gray-600">No matches.</td></tr>`;
      return;
    }

    tbody.innerHTML = "";
    list.forEach((p) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${p.firstName || ""}</td>
        <td>${p.lastName || ""}</td>
        <td>${p.dob || ""}</td>
        <td>${p.phone ?? p.phonePrimary ?? ""}</td>
        <td>${p.address ?? p.addressLine1 ?? ""}</td>
        <td>${p.city || ""}</td>
        <td>${p.state || ""}</td>
        <td>${p.zip || ""}</td>
        <td>${p.email || ""}</td>
      `;

      tr.ondblclick = () => selectPatient(p);
      tbody.appendChild(tr);
    });
  }

  function selectPatient(p) {
    const expect = sessionStorage.getItem("ehr_returnExpect") === "true";
    const active = sessionStorage.getItem("ehr_returnActive");

    // Save selection for modal reopen
    sessionStorage.setItem("ehr_selectedPatient", JSON.stringify({
      id: p.id, firstName: p.firstName, lastName: p.lastName
    }));

    // Clear prefill (we've chosen)
    sessionStorage.removeItem("ehr_prefillPatient");

    if (expect && active) {
      // Go back to Scheduler (app.js → view:shown → handleReturnFromPatientSearch)
      ViewManager.loadView("scheduler", "/fragments/scheduler");
    } else {
      // Future path: open demographics view
      console.log("Non-modal selection path — open demographics for", p);
    }
  }

  return { init, performSearch };
})();
