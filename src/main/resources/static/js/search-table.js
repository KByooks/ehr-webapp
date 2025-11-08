// =====================================================
// search-table.js
// Generic reusable search table component (no auto search)
// =====================================================

class SearchTable {
  constructor({
    endpoint,
    tableBody,
    filters = {},
    trigger,
    columns = [],
    pageInfo,
    prevBtn,
    nextBtn,
    size = 20,
    onRowDblClick = null,
    extractList = (data) => data.items || [],
    autoSearch = false, // ✅ new flag: disables initial search unless requested
  }) {
    this.endpoint = endpoint;
    this.tableBody = document.querySelector(tableBody);
    this.filters = filters;
    this.trigger = document.querySelector(trigger);
    this.columns = columns;
    this.pageInfo = document.querySelector(pageInfo);
    this.prevBtn = document.querySelector(prevBtn);
    this.nextBtn = document.querySelector(nextBtn);
    this.page = 0;
    this.size = size;
    this.totalPages = 0;
    this.onRowDblClick = onRowDblClick;
    this.extractList = extractList;

    this.bindEvents();

    // 🚫 don’t automatically search unless explicitly asked
    if (autoSearch) this.search();
  }

  bindEvents() {
    if (this.trigger)
      this.trigger.addEventListener("click", () => {
        this.page = 0;
        this.search();
      });

    Object.values(this.filters).forEach((inputSel) => {
      const el = document.querySelector(inputSel);
      if (el)
        el.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            this.page = 0;
            this.search();
          }
        });
    });

    if (this.prevBtn)
      this.prevBtn.addEventListener("click", () => {
        if (this.page > 0) {
          this.page--;
          this.search();
        }
      });

    if (this.nextBtn)
      this.nextBtn.addEventListener("click", () => {
        if (this.page + 1 < this.totalPages) {
          this.page++;
          this.search();
        }
      });
  }

  buildParams() {
    const params = new URLSearchParams({ page: this.page, size: this.size });
    for (const [key, sel] of Object.entries(this.filters)) {
      const el = document.querySelector(sel);
      if (!el) continue;
      const val = el.value?.trim();
      if (val !== "" && val != null) params.set(key, val);
    }
    return params;
  }

  async search() {
    if (!this.tableBody) return;
    this.tableBody.innerHTML = `<tr><td colspan="${this.columns.length}" class="p-2 text-gray-500">Loading...</td></tr>`;
    try {
      const res = await fetch(`${this.endpoint}?${this.buildParams().toString()}`);
      const data = await res.json();
      const list = this.extractList(data);
      this.totalPages = data.totalPages ?? 1;
      this.page = data.page ?? 0;
      this.render(list);
    } catch (err) {
      console.error("Search failed:", err);
      this.tableBody.innerHTML = `<tr><td colspan="${this.columns.length}" class="p-2 text-red-600">Error loading results.</td></tr>`;
    }
  }

  render(list) {
    if (!list.length) {
      this.tableBody.innerHTML = `<tr><td colspan="${this.columns.length}" class="p-2 text-gray-500">No results.</td></tr>`;
      this.updatePageInfo();
      return;
    }

    this.tableBody.innerHTML = "";
    list.forEach((item) => {
      const tr = document.createElement("tr");
      tr.innerHTML = this.columns.map((c) => `<td>${item[c.key] ?? ""}</td>`).join("");
      if (this.onRowDblClick) tr.addEventListener("dblclick", () => this.onRowDblClick(item));
      this.tableBody.appendChild(tr);
    });
    this.updatePageInfo();
  }

  updatePageInfo() {
    if (!this.pageInfo) return;
    this.pageInfo.textContent = `Page ${this.page + 1} of ${this.totalPages}`;
    if (this.prevBtn) this.prevBtn.disabled = this.page === 0;
    if (this.nextBtn) this.nextBtn.disabled = this.page + 1 >= this.totalPages;
  }
}

window.SearchTable = SearchTable;
