// ============================================
// view-manager.js
// Centralized single-page loader with caching
// and lifecycle events (view:loaded, view:shown)
// ============================================

(function () {
  class ViewManager {
    constructor(rootSelector = "#app-root") {
      this.root = document.querySelector(rootSelector);
      if (!this.root) throw new Error("❌ Missing #app-root in app.html");
      this.cache = new Map();
      this.current = null;
    }

    // Load a new fragment (fetch from server if needed)
    async loadView(name, url, { force = false } = {}) {
      if (!force && this.cache.has(name)) {
        this._render(name, this.cache.get(name));
        return;
      }

      const html = await this._fetchFragment(url);
      this.cache.set(name, html);
      this._render(name, html);
    }

    // Re-show a cached view (no fetch)
    showView(name) {
      if (!this.cache.has(name)) return;
      const html = this.cache.get(name);
      this._render(name, html, { silentLoaded: true });
    }

    async _fetchFragment(url) {
      const res = await fetch(url, { headers: { "X-Requested-With": "fetch" } });
      if (!res.ok) throw new Error(`Failed to load fragment ${url} (${res.status})`);
      return await res.text();
    }

    _render(name, html, { silentLoaded = false } = {}) {
      this.root.innerHTML = html;
      this.current = name;

      // Lifecycle events for modules to hook into
      if (!silentLoaded) {
        document.dispatchEvent(new CustomEvent("view:loaded", { detail: { name } }));
      }
      document.dispatchEvent(new CustomEvent("view:shown", { detail: { name } }));
    }
  }

  // ✅ Expose globally
  window.ViewManager = new ViewManager("#app-root");
})();
