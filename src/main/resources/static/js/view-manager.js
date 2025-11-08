// ============================================
// view-manager.js — unified fragment loader
// ============================================

window.ViewManager = (() => {
  const rootId = "app-root";

  const root = () => {
    const el = document.getElementById(rootId);
    if (!el) throw new Error("ViewManager: missing #app-root");
    return el;
  };

  const toggleLoading = (on) => {
    const el = document.getElementById("view-loading");
    if (el) el.classList.toggle("active", on);
  };

  async function loadView(name, url) {
    toggleLoading(true);
    const container = root();

    try {
      const resp = await fetch(url, { headers: { "X-Requested-With": "fetch" } });
      if (!resp.ok) throw new Error(`Failed to load ${name}: ${resp.status}`);

      const html = await resp.text();
      container.innerHTML = html;

      document.dispatchEvent(new CustomEvent("view:loaded", { detail: { name } }));
      requestAnimationFrame(() => document.dispatchEvent(new CustomEvent("view:shown", { detail: { name } })));
    } catch (err) {
      console.error("ViewManager error:", err);
    } finally {
      toggleLoading(false);
    }
  }

  return { loadView };
})();
