document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const patientId = params.get("patientId");

  if (!patientId) {
    document.body.innerHTML = "<p style='color:red;'>Error: No patient ID provided.</p>";
    return;
  }

  fetch(`/api/patients/${patientId}`)
    .then(res => {
      if (!res.ok) throw new Error("Patient not found");
      return res.json();
    })
    .then(p => {
      document.getElementById("patient-name").textContent = `${p.firstName || ""} ${p.lastName || ""}`;

      document.getElementById("title").textContent = p.title || "";
      document.getElementById("gender").textContent = p.gender || "";
      document.getElementById("dob").textContent = p.dob || "";

      document.getElementById("phonePrimary").textContent = p.phonePrimary || "";
      document.getElementById("phoneSecondary").textContent = p.phoneSecondary || "";
      document.getElementById("email").textContent = p.email || "";

      document.getElementById("addressLine1").textContent = p.addressLine1 || "";
      document.getElementById("addressLine2").textContent = p.addressLine2 || "";
      document.getElementById("city").textContent = p.city || "";
      document.getElementById("state").textContent = p.state || "";
      document.getElementById("zip").textContent = p.zip || "";

      // Show insurance names if available
      document.getElementById("insurancePrimary").textContent = p.insurancePrimary?.name || "—";
      document.getElementById("insuranceSecondary").textContent = p.insuranceSecondary?.name || "—";
    })
    .catch(err => {
      console.error(err);
      document.body.innerHTML = `<p style='color:red;'>Error loading patient data.</p>`;
    });
});
