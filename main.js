const { Plugin, Platform, MarkdownView } = require("obsidian");

module.exports = class AlignSidenoteWithMarkPlugin extends Plugin {
  onload() {
    if (Platform.isMobile) return;
    this.sourceTargets = [];
    this.visibleTargets = [];
    this.sourceTargetMap = new Map();
    this.visibleTargetMap = new Map();
    this.pinned = localStorage.getItem("align-sidenote-mark-nav-pinned") === "true";
    this.queueRefresh = this.debounce(() => requestAnimationFrame(() => this.refresh()), 160);
    this.registerEvent(this.app.workspace.on("layout-change", this.queueRefresh));
    this.registerEvent(this.app.workspace.on("active-leaf-change", this.queueRefresh));
    this.registerEvent(this.app.workspace.on("file-open", this.queueRefresh));
    this.registerEvent(this.app.vault.on("modify", (file) => { if (file?.path === this.activeFilePath) this.queueRefresh(); }));
    this.observer = new MutationObserver(this.queueRefresh);
    this.observer.observe(document.body, { childList: true, subtree: true });
    this.register(() => this.observer.disconnect());
    window.addEventListener("resize", this.queueRefresh);
    this.register(() => window.removeEventListener("resize", this.queueRefresh));
    this.injectStyles();
    this.queueRefresh();
  }

  onunload() { this.clearTransforms(); this.removeNav(); document.getElementById("align-sidenote-mark-style")?.remove(); }
  debounce(fn, delay) { let t = null; return () => { clearTimeout(t); t = setTimeout(fn, delay); }; }

  injectStyles() {
    if (document.getElementById("align-sidenote-mark-style")) return;
    const style = document.createElement("style"); style.id = "align-sidenote-mark-style";
    style.textContent = `
      .callout.sidenote-mark-aligned { transform: translateY(var(--sidenote-shift-y, 0px)); will-change: transform; }
      .sidenote-callout-nav { position: fixed; top: var(--sidenote-nav-top, 92px); right: var(--sidenote-nav-right, 12px); z-index: 1000; width: 46px; max-height: calc(100vh - 120px); overflow: hidden; border: 1px solid var(--background-modifier-border); border-radius: 16px; background: var(--background-primary); box-shadow: 0 8px 28px rgba(0,0,0,.18); opacity: .72; transition: width .18s ease, opacity .18s ease; }
      .sidenote-callout-nav:hover, .sidenote-callout-nav.is-pinned { width: var(--sidenote-nav-width, 230px); opacity: 1; }
      .sidenote-callout-nav-header { display: flex; align-items: center; gap: 8px; height: 40px; padding: 0 9px; border-bottom: 1px solid var(--background-modifier-border); }
      .sidenote-callout-nav-icon { width: 26px; height: 26px; border-radius: 999px; display: flex; align-items: center; justify-content: center; background: var(--background-secondary); color: var(--text-muted); }
      .sidenote-callout-nav-title, .sidenote-callout-nav-pin, .sidenote-callout-nav-label { opacity: 0; transition: opacity .18s ease; }
      .sidenote-callout-nav:hover .sidenote-callout-nav-title, .sidenote-callout-nav:hover .sidenote-callout-nav-pin, .sidenote-callout-nav:hover .sidenote-callout-nav-label, .sidenote-callout-nav.is-pinned .sidenote-callout-nav-title, .sidenote-callout-nav.is-pinned .sidenote-callout-nav-pin, .sidenote-callout-nav.is-pinned .sidenote-callout-nav-label { opacity: 1; }
      .sidenote-callout-nav-items { overflow-y: auto; padding: 6px; }
      .sidenote-callout-nav-item { width: 100%; border: 0; background: transparent; display: flex; align-items: center; gap: 8px; padding: 7px 8px; border-radius: 10px; cursor: pointer; color: var(--text-muted); }
      .sidenote-callout-nav-item:hover { background: var(--background-modifier-hover); color: var(--text-normal); }
      .sidenote-callout-nav-number { width: 24px; height: 24px; border-radius: 999px; display: flex; align-items: center; justify-content: center; background: var(--background-secondary); }
      .sidenote-callout-nav-label { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
    `; document.head.appendChild(style);
  }

  async refresh() {
    await this.refreshSourceTargets();
    this.alignAll();
    this.buildNav();
  }

  async refreshSourceTargets() {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    const root = document.querySelector(".workspace-leaf.mod-active .markdown-preview-view.indent, .workspace-leaf.mod-active .markdown-preview-view .indent");
    if (!view?.file || !root) { this.sourceTargets = []; this.sourceTargetMap.clear(); return; }
    this.activeFilePath = view.file.path;
    const text = await this.app.vault.cachedRead(view.file);
    this.sourceTargets = this.parseRightCalloutsFromMarkdown(text, view.file.path);
    this.sourceTargetMap.clear(); this.sourceTargets.forEach((t) => this.sourceTargetMap.set(t.id, t));
  }

  parseRightCalloutsFromMarkdown(text, filePath) {
    const lines = text.split(/\r?\n/); const targets = []; let inFence = false;
    for (let i = 0; i < lines.length; i++) {
      if (/^\s*(```|~~~)/.test(lines[i])) { inFence = !inFence; continue; }
      if (inFence) continue;
      const m = lines[i].match(/^\s*>\s*\[!([^\]|]+)(?:\|([^\]]+))?\][+-]?\s*(.*)$/i);
      if (!m) continue;
      const metadata = (m[2] || "").split(/\s+/).filter(Boolean);
      if (!metadata.includes("right")) continue;
      let j = i + 1; const body = [];
      while (j < lines.length && /^\s*>/.test(lines[j])) { body.push(lines[j].replace(/^\s*>\s?/, "")); j++; }
      const mark = this.findMarkedGroupInMarkdown(lines, j);
      const id = `sidenote-source-${this.hash(`${filePath}:${i}:${targets.length}`)}`;
      targets.push({ id, index: targets.length + 1, filePath, calloutLine: i, calloutEndLine: Math.max(i, j - 1), targetLine: mark?.firstLine ?? i, title: this.stripMarkdown(body.find((x) => x.trim()) || m[3] || `边注 ${targets.length + 1}`).slice(0, 60) });
    }
    return targets;
  }

  findMarkedGroupInMarkdown(lines, start) { let first = null, last = null; for (let i = start; i < lines.length; i++) { const s = lines[i].trim(); if (!s) continue; if (/<mark\b/i.test(s)) { first ??= i; last = i; continue; } if (first !== null) break; } return first === null ? null : { firstLine: first, lastLine: last }; }
  stripMarkdown(t) { return t.replace(/<mark[^>]*>/gi, "").replace(/<\/mark>/gi, "").replace(/<[^>]+>/g, "").replace(/[`*_~>#-]+/g, "").replace(/\s+/g, " ").trim(); }
  hash(text) { let h = 0; for (let i = 0; i < text.length; i++) { h = ((h << 5) - h) + text.charCodeAt(i); h |= 0; } return Math.abs(h).toString(36); }

  clearTransforms() { document.querySelectorAll(".callout.sidenote-mark-aligned").forEach((el) => { el.style.removeProperty("--sidenote-shift-y"); el.classList.remove("sidenote-mark-aligned"); delete el.dataset.sidenoteTranslateY; }); }
  alignAll() { this.visibleTargets = []; [...document.querySelectorAll(".markdown-preview-view.indent, .markdown-preview-view .indent")].forEach((root) => this.alignRoot(root)); }
  alignRoot(root) { [...root.querySelectorAll('.callout[data-callout-metadata~="right"]')].forEach((callout, i) => { const group = this.findMarkedGroupAfterCallout(callout); if (!group) return; const rect = callout.getBoundingClientRect(); const delta = ((group.top + group.bottom) / 2) - (rect.top + rect.height / 2); const oldY = Number.parseFloat(callout.dataset.sidenoteTranslateY || "0") || 0; const newY = oldY + delta; if (Math.abs(delta) > 1) { callout.dataset.sidenoteTranslateY = String(newY); callout.style.setProperty("--sidenote-shift-y", `${Math.round(newY)}px`); callout.classList.add("sidenote-mark-aligned"); } const source = this.sourceTargets[i]; if (source) this.visibleTargetMap.set(source.id, { ...source, callout, targetEl: group.firstElement }); }); }
  getPreviewBlock(e) { let c = e; while (c && c.parentElement) { if (c.parentElement.classList.contains("markdown-preview-section")) return c; c = c.parentElement; } return e; }
  findParagraphInBlock(b) { if (!b) return null; if (b.matches?.("p")) return b; return b.querySelector(":scope > p, :scope .el-p > p, p"); }
  findMarkedGroupAfterCallout(callout) { const block = this.getPreviewBlock(callout); let next = block?.nextElementSibling; let started = false, top = Infinity, bottom = -Infinity, first = null; while (next) { const p = this.findParagraphInBlock(next); if (p) { const marks = [...p.querySelectorAll("mark")]; if (marks.length) { started = true; for (const mark of marks) { for (const rect of [...mark.getClientRects()]) { top = Math.min(top, rect.top); bottom = Math.max(bottom, rect.bottom); } first ||= mark; } } else if (started) break; } else if (started && next.textContent.trim()) break; next = next.nextElementSibling; } return first ? { top, bottom, firstElement: first } : null; }

  buildNav() { const targets = this.sourceTargets.length ? this.sourceTargets : [...this.visibleTargetMap.values()]; if (!targets.length) return this.removeNav(); const nav = this.ensureNav(); const items = nav.querySelector(".sidenote-callout-nav-items"); items.innerHTML = ""; targets.forEach((t, i) => { const b = document.createElement("button"); b.type = "button"; b.className = "sidenote-callout-nav-item"; b.innerHTML = `<span class="sidenote-callout-nav-number">${i + 1}</span><span class="sidenote-callout-nav-label"></span>`; b.querySelector(".sidenote-callout-nav-label").textContent = t.title; b.addEventListener("click", () => this.jumpToTarget(t)); items.appendChild(b); }); }
  ensureNav() { if (this.navEl?.isConnected) return this.navEl; const nav = document.createElement("div"); nav.className = "sidenote-callout-nav" + (this.pinned ? " is-pinned" : ""); nav.innerHTML = `<div class="sidenote-callout-nav-header"><div class="sidenote-callout-nav-icon">¶</div><div class="sidenote-callout-nav-title">边注导航</div><button class="sidenote-callout-nav-pin" type="button">${this.pinned ? "收起" : "固定"}</button></div><div class="sidenote-callout-nav-items"></div>`; nav.querySelector(".sidenote-callout-nav-pin").addEventListener("click", () => { this.pinned = !this.pinned; nav.classList.toggle("is-pinned", this.pinned); localStorage.setItem("align-sidenote-mark-nav-pinned", String(this.pinned)); }); document.body.appendChild(nav); this.navEl = nav; return nav; }
  removeNav() { this.navEl?.remove(); this.navEl = null; }
  async jumpToTarget(target) { const visible = this.visibleTargetMap.get(target.id); if (visible?.targetEl) return visible.targetEl.scrollIntoView({ block: "center", behavior: "smooth" }); const file = this.app.vault.getAbstractFileByPath(target.filePath); const view = this.app.workspace.getActiveViewOfType(MarkdownView); if (file && view?.leaf) await view.leaf.openFile(file, { active: true, eState: { line: target.targetLine } }); }
};
