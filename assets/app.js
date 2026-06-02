// Vanilla JS for navigation/search/copy/sidebar/TOC/reveal.
(function () {
  const COPY = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide h-3.5 w-3.5"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>';
  const CHECK = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide h-3.5 w-3.5 text-accent"><path d="M20 6 9 17l-5-5"/></svg>';

  // Copy buttons (code blocks + landing cmds)
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-copy]");
    if (!btn) return;
    e.preventDefault();
    const text = decodeURIComponent(btn.getAttribute("data-copy") || "");
    navigator.clipboard.writeText(text).then(() => {
      const wasCmd = btn.classList.contains("copy-btn-cmd");
      if (wasCmd) {
        const icon = btn.querySelector(".copy-icon");
        if (icon) { const o = icon.innerHTML; icon.innerHTML = CHECK; setTimeout(() => icon.innerHTML = o, 1500); }
      } else {
        const o = btn.innerHTML; btn.innerHTML = CHECK; setTimeout(() => btn.innerHTML = o, 1500);
      }
    });
  });

  // Sidebar tree toggles
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-tree-toggle]");
    if (!btn) return;
    e.preventDefault();
    const li = btn.closest("[data-tree-item]");
    const children = li && li.querySelector("[data-tree-children]");
    if (!children) return;
    children.classList.toggle("hidden");
    const svg = btn.querySelector("svg");
    if (svg) svg.style.transform = children.classList.contains("hidden") ? "" : "rotate(90deg)";
  });
  document.querySelectorAll('[data-tree-item][data-expanded="true"] [data-tree-toggle] svg').forEach((s) => (s.style.transform = "rotate(90deg)"));

  // Mobile sidebar toggle
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-sidebar-toggle]");
    if (!btn) return;
    const sb = document.querySelector("[data-sidebar]");
    if (sb) sb.classList.toggle("open");
  });

  // Reveal on view
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } });
  }, { rootMargin: "-80px" });
  document.querySelectorAll(".reveal").forEach((el) => io.observe(el));

  // TOC scroll-spy
  const tocLinks = Array.from(document.querySelectorAll("[data-toc-link]"));
  if (tocLinks.length) {
    const headings = tocLinks.map((l) => document.getElementById(l.getAttribute("data-toc-link"))).filter(Boolean);
    const spy = new IntersectionObserver((entries) => {
      const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.target.getBoundingClientRect().top - b.target.getBoundingClientRect().top);
      if (!visible[0]) return;
      const id = visible[0].target.id;
      tocLinks.forEach((l) => {
        const active = l.getAttribute("data-toc-link") === id;
        l.classList.toggle("-ml-px", active);
        l.classList.toggle("border-primary", active);
        l.classList.toggle("text-foreground", active);
        l.classList.toggle("border-transparent", !active);
        l.classList.toggle("text-muted-foreground", !active);
      });
    }, { rootMargin: "-80px 0px -70% 0px", threshold: 0 });
    headings.forEach((h) => spy.observe(h));
  }

  // Search
  const modal = document.querySelector("[data-search-modal]");
  const input = document.querySelector("[data-search-input]");
  const resultsEl = document.querySelector("[data-search-results]");
  const countEl = document.querySelector("[data-search-count]");
  let INDEX = []; let fuse = null; let active = 0; let current = [];

  function openModal() {
    if (!modal) return;
    modal.classList.add("open"); modal.style.display = "flex";
    input.value = ""; active = 0;
    requestAnimationFrame(() => input.focus());
    renderResults("");
  }
  function closeModal() { if (modal) { modal.classList.remove("open"); modal.style.display = "none"; } }
  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-search-open]")) { e.preventDefault(); ensureLoaded().then(openModal); }
  });
  if (modal) modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });
  window.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); ensureLoaded().then(() => modal.classList.contains("open") ? closeModal() : openModal()); }
    if (e.key === "Escape") closeModal();
    if (modal && modal.classList.contains("open")) {
      if (e.key === "ArrowDown") { e.preventDefault(); active = Math.min(active + 1, current.length - 1); paintActive(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); active = Math.max(active - 1, 0); paintActive(); }
      else if (e.key === "Enter" && current[active]) { e.preventDefault(); navTo(current[active]); }
    }
  });
  if (input) input.addEventListener("input", () => { active = 0; renderResults(input.value); });

  async function ensureLoaded() {
    if (fuse) return;

    const data = await fetch("/assets/search-index.json")
      .then((r) => r.json());

    INDEX = data;

    fuse = new Fuse(INDEX, {
      keys: [
        { name: "title", weight: 0.7 },
        { name: "breadcrumb", weight: 0.3 }
      ],
      threshold: 0.35,
      ignoreLocation: true,
      minMatchCharLength: 2
    });
  }

  const FILE_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide h-3.5 w-3.5"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>';
  const HASH_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide h-3.5 w-3.5"><line x1="4" x2="20" y1="9" y2="9"/><line x1="4" x2="20" y1="15" y2="15"/><line x1="10" x2="8" y1="3" y2="21"/><line x1="16" x2="14" y1="3" y2="21"/></svg>';
  const CODE_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide h-3.5 w-3.5 text-accent"><path d="m18 16 4-4-4-4"/><path d="m6 8-4 4 4 4"/><path d="m14.5 4-5 16"/></svg>';
  function esc(s) { return String(s).replace(/[<>&"]/g, (c)=>({"<":"&lt;",">":"&gt;","&":"&amp;",'"':"&quot;"}[c])); }

  function renderResults(q) {
    if (!fuse) return;
    current = !q.trim() ? INDEX.slice(0, 30) : fuse.search(q, { limit: 40 }).map((r) => r.item);
    if (!current.length) {
      resultsEl.innerHTML = `<div class="px-4 py-12 text-center text-sm text-muted-foreground">No results for "${esc(q)}"</div>`;
    } else {
      resultsEl.innerHTML = current.map((r, i) => `
        <button data-idx="${i}" class="search-row flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left transition-colors ${i===active?"bg-primary/15 text-foreground":"text-muted-foreground hover:bg-muted/40"}">
          <span class="mt-0.5 grid h-7 w-7 flex-shrink-0 place-items-center rounded-md border border-border/60 bg-muted/40">${r.type === "page" ? FILE_ICON : r.type === "section" ? HASH_ICON : CODE_ICON}</span>
          <span class="min-w-0 flex-1"><span class="block truncate text-sm font-medium text-foreground">${esc(r.title)}</span><span class="block truncate text-xs text-muted-foreground">${esc(r.breadcrumb)}</span></span>
        </button>`).join("");
      resultsEl.querySelectorAll(".search-row").forEach((row) => {
        row.addEventListener("mouseenter", () => { active = parseInt(row.dataset.idx); paintActive(); });
        row.addEventListener("click", () => navTo(current[parseInt(row.dataset.idx)]));
      });
    }
    countEl.textContent = `${current.length} results`;
  }
  function paintActive() {
    resultsEl.querySelectorAll(".search-row").forEach((row, i) => {
      row.className = `search-row flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left transition-colors ${i===active?"bg-primary/15 text-foreground":"text-muted-foreground hover:bg-muted/40"}`;
    });
    const el = resultsEl.querySelector(`[data-idx="${active}"]`);
    if (el) el.scrollIntoView({ block: "nearest" });
  }
  function navTo(entry) {
    closeModal();
    const [path, hash] = entry.path.split("#");
    window.location.href = path + ".html" + (hash ? "#" + hash : "");
  }
})();
