// modal-manager.js
window.ModalManager = (function () {
  const container = document.getElementById("global-modal-container");

  function show(htmlContent) {
    hide(); // ensure only one modal at a time
    const wrapper = document.createElement("div");
    wrapper.className = "modal";
    wrapper.innerHTML = `
      <div class="modal-overlay"></div>
      <div class="modal-content">${htmlContent}</div>
    `;
    container.appendChild(wrapper);
    wrapper.querySelector(".modal-overlay").addEventListener("click", hide);
    document.addEventListener("keydown", escHandler);
    document.body.classList.add("modal-open");
  }

  function hide() {
    container.innerHTML = "";
    document.body.classList.remove("modal-open");
    document.removeEventListener("keydown", escHandler);
  }

  function escHandler(e) {
    if (e.key === "Escape") hide();
  }

  return { show, hide };
})();
