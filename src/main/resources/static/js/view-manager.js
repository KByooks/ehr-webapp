// ============================================
// view-manager.js — persistent cached view manager
// ============================================

window.ViewManager = (() => {
  const rootId = "app-root";
  const cache = new Map(); // sectionName -> wrapper element

  const root = () => {
    const el = document.getElementById(rootId);
    if (!el) throw new Error("ViewManager: missing #app-root");
    return el;
  };

  const toggleLoading = (on) => {
    const el = document.getElementById("view-loading");
    if (el) el.classList.toggle("active", on);
  };

  // ---- Load or reveal a section ----
  async function loadView(name, url, opts = {}) {
    const force = !!opts.force;
    const container = root();

    // if cached and not forcing reload, just show
    if (cache.has(name) && !force) {
      showView(name);
      return;
    }

    toggleLoading(true);

    try {
      const resp = await fetch(url, { headers: { "X-Requested-With": "fetch" } });
      if (!resp.ok) throw new Error(`Failed to load ${name}: ${resp.status}`);

      const html = await resp.text();

      // create a wrapper for this view if not exists
      let wrapper = cache.get(name);
      if (!wrapper) {
        wrapper = document.createElement("div");
        wrapper.id = `view-${name}`;
        wrapper.className = "ehr-view";
        wrapper.style.display = "none";
        container.appendChild(wrapper);
        cache.set(name, wrapper);
      }

      // replace innerHTML (fresh or force)
      wrapper.innerHTML = html;

      // hide all other views
      for (const [key, el] of cache.entries()) {
        el.style.display = key === name ? "block" : "none";
      }

      document.dispatchEvent(new CustomEvent("view:loaded", { detail: { name } }));
      requestAnimationFrame(() =>
        document.dispatchEvent(new CustomEvent("view:shown", { detail: { name } }))
      );
    } catch (err) {
      console.error("ViewManager error:", err);
    } finally {
      toggleLoading(false);
    }
  }

  // ---- Show existing cached view ----
  function showView(name) {
    for (const [key, el] of cache.entries()) {
      el.style.display = key === name ? "block" : "none";
    }
    document.dispatchEvent(new CustomEvent("view:shown", { detail: { name } }));
  }

  return { loadView, showView };
})();
