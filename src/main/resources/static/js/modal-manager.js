// ============================================
// modal-manager.js
// Global modal controller (singleton)
// ============================================
//
// This file controls ALL modals in the EHR.
// Only ONE modal ever exists at a time.
// Supports:
//
//   • show(html)      – full render + mount DOM
//   • hide()          – full unmount
//   • softHide()      – hide visually, keep state in DOM
//   • softShow()      – show visually, DOM already exists
//   • isOpen()        – modal exists?
//
// WHY:
//   - Appointment modal must persist across view swaps
//   - Patient Search and Demographics must hide it, not destroy it
//   - Returning to modal requires DOM to still exist
//   - We dispatch `modal:shown` whenever modal becomes visible,
//     to allow fields (like patient name) to sync AFTER render.
// ============================================

(function () {
  const MODAL_CONTAINER_ID = "global-modal-container";
  const container = document.getElementById(MODAL_CONTAINER_ID);

  // ------------------------------------------------------------
  // Fail-safe: if the app root doesn't include a modal container
  // ------------------------------------------------------------
  if (!container) {
    console.error(`❌ ModalManager: Missing #${MODAL_CONTAINER_ID} in app.html`);
    window.ModalManager = {
      show: () => console.warn("⚠️ ModalManager.show() called but container missing."),
      hide: () => {},
      isOpen: () => false,
    };
    return; // stop executing
  }

  // Reference to the modal wrapper element currently mounted
  let currentModal = null;

  const ModalManager = {
    // ============================================================
    // show(html)
    // HARD SHOW — fresh creation of modal DOM
    //
    // Called:
    //   - When opening appointment modal the first time
    //   - When editing/creating appointments directly
    //
    // Behavior:
    //   - Destroys previous modal if any (safety)
    //   - Injects brand new HTML
    //   - Fires "modal:shown" AFTER DOM is painted
    // ============================================================
    show(html) {
      this.hide(); // enforce SINGLE modal at all times

      const wrapper = document.createElement("div");
      wrapper.className = "modal-wrapper visible";
      wrapper.innerHTML = `
        <div class="modal-backdrop"></div>
        <div class="modal-window">${html}</div>
      `;

      container.appendChild(wrapper);
      currentModal = wrapper;

      // Normalize ID — some scripts expect #appointment-modal
      const wnd = wrapper.querySelector(".modal-window");
      if (wnd) wnd.id = "appointment-modal";

      // Close when clicking backdrop (outside modal window)
      wrapper.querySelector(".modal-backdrop")
        .addEventListener("click", () => this.hide());

      // Lock scroll
      document.body.classList.add("modal-open");

      // 🔥 DOM IS NOW READY
      // Use requestAnimationFrame so scripts can safely query DOM.
      requestAnimationFrame(() => {
        document.dispatchEvent(new CustomEvent("modal:shown"));
      });
    },

    // ============================================================
    // hide()
    // HARD HIDE — removes modal and DOM content entirely.
    //
    // Called:
    //   - After saving appointment
    //   - After deleting an appointment
    //   - When clicking cancel/backdrop
    // ============================================================
    hide() {
      if (currentModal) {
        currentModal.remove(); // fully remove DOM
        currentModal = null;
        document.body.classList.remove("modal-open");

        // Allow listeners to reset state if needed
        document.dispatchEvent(new CustomEvent("modal:hidden"));
      }
    },

    // ============================================================
    // softHide()
    // Soft hide: modal stays mounted in DOM but invisible.
    //
    // WHY:
    //   Appointment modal is persistent during patient lookup.
    //   We want to "pause" the modal, not destroy it.
    // ============================================================
    softHide() {
      if (currentModal) {
        currentModal.classList.add("hidden");
        document.body.classList.remove("modal-open");
        // No events dispatched — modal technically still exists
      }
    },

    // ============================================================
    // softShow()
    // Soft show: bring back an ALREADY MOUNTED modal.
    //
    // Called:
    //   - When returning from patient search
    //   - When returning from demographics
    //
    // CRITICAL:
    //   We dispatch `modal:shown` here so that app.js can update
    //   fields (like patientName) AFTER the modal is visible again.
    // ============================================================
    softShow() {
      if (currentModal) {
        currentModal.classList.remove("hidden");
        document.body.classList.add("modal-open");

        // 🔥 Tell app.js the modal is now visible again.
        requestAnimationFrame(() => {
          document.dispatchEvent(new CustomEvent("modal:shown"));
        });
      }
    },

    // Simple boolean wrapper
    isOpen() {
      return !!currentModal;
    },
  };

  // Expose globally
  window.ModalManager = ModalManager;
  console.log("✅ ModalManager initialized");
})();
