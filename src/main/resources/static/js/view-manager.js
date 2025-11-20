// ============================================
// view-manager.js — Persistent Cached View Manager
//
// Core Responsibilities:
//   • Load fragment HTML into #app-root
//   • Cache views so we don't re-fetch unnecessarily
//   • Emit `view:loaded` (HTML inserted) and `view:shown` (visible)
//   • Work seamlessly with persistent appointment modal
//
// Architecture Guarantees:
//   • Only ONE active view at a time
//   • All views remain in DOM once loaded (cached)
//   • Switching views is instant (no full reload)
//
// Compatible with entire SPA:
//   - Scheduler
//   - Patient Search
//   - Demographics
//   - Provider Search
//   - Billing
//   - Reports
// ============================================

window.ViewManager = (() => {

  // Root of the application
  const rootId = "app-root";

  // Cache mapping: sectionName → wrapper element <div id="view-X">
  const cache = new Map();

  // Get the app root safely
  const root = () => {
    const el = document.getElementById(rootId);
    if (!el) throw new Error("ViewManager: missing #app-root");
    return el;
  };

  // Optional loading spinner toggle
  const toggleLoading = (on) => {
    const el = document.getElementById("view-loading");
    if (el) el.classList.toggle("active", on);
  };

  // ---------------------------------------------------------
  // loadView(name, url, { force })
  // Fetches + renders view, OR reveals cached version
  // ---------------------------------------------------------
  async function loadView(name, url, opts = {}) {
    const force = !!opts.force;
    const container = root();

    // If cached and not forcing a reload → just reveal it
    if (cache.has(name) && !force) {
      showView(name);
      return;
    }

    toggleLoading(true);

    try {
      const resp = await fetch(url, {
        headers: { "X-Requested-With": "fetch" },
      });
      if (!resp.ok) throw new Error(`Failed to load ${name}: ${resp.status}`);

      const html = await resp.text();

      // Create wrapper if not cached yet
      let wrapper = cache.get(name);
      if (!wrapper) {
        wrapper = document.createElement("div");
        wrapper.id = `view-${name}`;
        wrapper.className = "ehr-view";
        wrapper.style.display = "none";

        container.appendChild(wrapper);
        cache.set(name, wrapper);
      }

      // Inject new HTML (fresh load or force reload)
      wrapper.innerHTML = html;

      // Hide all views except this one
      for (const [key, el] of cache.entries()) {
        el.style.display = key === name ? "block" : "none";
      }

      // Dispatch lifecycle events
      document.dispatchEvent(
        new CustomEvent("view:loaded", { detail: { name } })
      );

      requestAnimationFrame(() => {
        document.dispatchEvent(
          new CustomEvent("view:shown", { detail: { name } })
        );
      });

    } catch (err) {
      console.error("ViewManager error:", err);

    } finally {
      toggleLoading(false);
    }
  }

  // ---------------------------------------------------------
  // showView(name)
  // Reveals already cached view without reloading HTML
  // ---------------------------------------------------------
  function showView(name) {
    if (!cache.has(name)) {
      console.warn(`ViewManager.showView: '${name}' does not exist in cache.`);
      return;
    }

    for (const [key, el] of cache.entries()) {
      el.style.display = key === name ? "block" : "none";
    }

    document.dispatchEvent(
      new CustomEvent("view:shown", { detail: { name } })
    );
  }

  // Expose public API
  return { loadView, showView };

})();
