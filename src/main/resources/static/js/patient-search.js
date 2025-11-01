window.PatientSearch = (function () {
  const PAGE_SIZE = 20;
  let currentPage = 0, currentSortBy = "lastName", currentSortDir = "asc";
  
  // detect if we're currently assigning a patient from appointment modal
  function cameFromScheduler() {
    try {
      return sessionStorage.getItem("ehr_returnExpect") === "true";
    } catch {
      return false;
    }
  }

  

  async function performSearch() {
    const params = new URLSearchParams({
      firstName: document.getElementById("filter-firstName")?.value || "",
      lastName: document.getElementById("filter-lastName")?.value || "",
      page: currentPage, size: PAGE_SIZE,
      sortBy: currentSortBy, sortDir: currentSortDir,
    });

    const tbody = document.querySelector("#patient-results tbody");
    const res = await fetch(`/api/patients/search?${params}`);
    const data = await res.json();
    const pts = data.patients || [];
    tbody.innerHTML = "";

    if (!pts.length) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;">No results found</td></tr>`;
      return;
    }

    pts.forEach((p) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${p.firstName}</td><td>${p.lastName}</td><td>${p.dob}</td>
        <td>${p.phone}</td><td>${p.address}</td><td>${p.city}</td>
        <td>${p.state}</td><td>${p.zip}</td><td>${p.email}</td>`;
      row.addEventListener("dblclick", () => onPatientSelect(p));
      tbody.appendChild(row);
    });
  }

  async function onPatientSelect(p) {
    const assigning = cameFromScheduler();

    if (assigning) {
      console.log("🔗 Assigning patient to appointment:", p);
      sessionStorage.setItem("ehr_selectedPatient", JSON.stringify(p));
      sessionStorage.setItem("ehr_returnExpect", "false"); // consume the flag

      // go back to scheduler and reopen modal
      setTimeout(() => loadSection("scheduler"), 150);
    } else {
      // Normal standalone search (not assigning)
      console.log("🧭 Future: open demographics for", p.firstName, p.lastName);
    }
  }


  function init(params = {}) {
    document.getElementById("search-btn").onclick = performSearch;
    if (params.firstName) document.getElementById("filter-firstName").value = params.firstName;
    if (params.lastName) document.getElementById("filter-lastName").value = params.lastName;
    if (params.firstName || params.lastName) performSearch();
  }

  return { init, performSearch };
})();
