// ============================================
// modal-manager.js
// Global modal controller (singleton)
// ============================================

(function () {
  const MODAL_CONTAINER_ID = "global-modal-container";
  const container = document.getElementById(MODAL_CONTAINER_ID);

  if (!container) {
    console.error(`❌ ModalManager: Missing #${MODAL_CONTAINER_ID} in app.html`);
    window.ModalManager = {
      show: () => console.warn("⚠️ ModalManager.show() called but container missing."),
      hide: () => {},
      isOpen: () => false,
    };
    return;
  }

  let currentModal = null;

  const ModalManager = {
    show(html) {
      this.hide(); // enforce single modal

      const wrapper = document.createElement("div");
      wrapper.className = "modal-wrapper visible";
      wrapper.innerHTML = `
        <div class="modal-backdrop"></div>
        <div class="modal-window">${html}</div>
      `;

      container.appendChild(wrapper);
      currentModal = wrapper;
	  
	  const wnd = wrapper.querySelector(".modal-window");
	  if (wnd) wnd.id = "appointment-modal";

      // dismiss on backdrop click
      wrapper.querySelector(".modal-backdrop")
        .addEventListener("click", () => this.hide());

      document.body.classList.add("modal-open");

      // ✅ let scripts know the modal is ready in DOM
      document.dispatchEvent(new CustomEvent("modal:shown"));
    },

    hide() {
      if (currentModal) {
        currentModal.remove();
        currentModal = null;
        document.body.classList.remove("modal-open");
		// ✅ Notify listeners
		document.dispatchEvent(new CustomEvent("modal:hidden"));
      }
    },
	
	// ✅ NEW: soft hide/show (used when swapping sections)
	softHide() {
	  if (currentModal) {
	    currentModal.classList.add("hidden");
	    document.body.classList.remove("modal-open");
	  }
	},
	softShow() {
	  if (currentModal) {
	    currentModal.classList.remove("hidden");
	    document.body.classList.add("modal-open");
	  }
	},

    isOpen() {
      return !!currentModal;
    },
  };

  window.ModalManager = ModalManager;
  console.log("✅ ModalManager initialized");
})();
