const { Plugin, Platform } = require("obsidian");

module.exports = class AlignSidenoteWithMarkPlugin extends Plugin {
  onload() {
    if (Platform.isMobile) return;
    this.queueAlign = this.debounce(() => {
      if (this.raf) cancelAnimationFrame(this.raf);
      this.raf = requestAnimationFrame(() => this.alignAll());
    }, 100);
    this.registerEvent(this.app.workspace.on("layout-change", this.queueAlign));
    this.registerEvent(this.app.workspace.on("active-leaf-change", this.queueAlign));
    this.registerEvent(this.app.workspace.on("file-open", this.queueAlign));
    this.observer = new MutationObserver(this.queueAlign);
    this.observer.observe(document.body, { childList: true, subtree: true });
    this.register(() => this.observer.disconnect());
    window.addEventListener("resize", this.queueAlign);
    this.register(() => window.removeEventListener("resize", this.queueAlign));
    this.queueAlign();
  }

  onunload() { this.clearTransforms(); }
  debounce(fn, delay) { let t = null; return () => { clearTimeout(t); t = setTimeout(fn, delay); }; }

  clearTransforms() {
    document.querySelectorAll(".callout.sidenote-mark-aligned").forEach((callout) => {
      callout.style.transform = "";
      callout.classList.remove("sidenote-mark-aligned");
      delete callout.dataset.sidenoteTranslateY;
    });
  }

  alignAll() {
    [...document.querySelectorAll(".markdown-preview-view.indent, .markdown-preview-view .indent")]
      .forEach((root) => this.alignRoot(root));
  }

  alignRoot(root) {
    const callouts = [...root.querySelectorAll('.callout[data-callout-metadata~="right"]')];
    callouts.forEach((callout) => {
      const group = this.findMarkedGroupAfterCallout(callout);
      if (!group) return;
      const rect = callout.getBoundingClientRect();
      const calloutCenter = rect.top + rect.height / 2;
      const targetCenter = (group.top + group.bottom) / 2;
      const deltaY = targetCenter - calloutCenter;
      const oldY = Number.parseFloat(callout.dataset.sidenoteTranslateY || "0") || 0;
      const newY = oldY + deltaY;
      if (Math.abs(deltaY) > 1) {
        callout.dataset.sidenoteTranslateY = String(newY);
        callout.style.transform = `translateY(${Math.round(newY)}px)`;
        callout.classList.add("sidenote-mark-aligned");
      }
    });
  }

  getPreviewBlock(element) {
    let current = element;
    while (current && current.parentElement) {
      if (current.parentElement.classList.contains("markdown-preview-section")) return current;
      current = current.parentElement;
    }
    return element;
  }

  findParagraphInBlock(block) {
    if (!block) return null;
    if (block.matches?.("p")) return block;
    return block.querySelector(":scope > p, :scope .el-p > p, p");
  }

  findMarkedGroupAfterCallout(callout) {
    const block = this.getPreviewBlock(callout);
    let next = block?.nextElementSibling;
    let started = false;
    let top = Infinity;
    let bottom = -Infinity;
    let first = null;

    while (next) {
      const p = this.findParagraphInBlock(next);
      if (p) {
        const marks = [...p.querySelectorAll("mark")];
        if (marks.length) {
          started = true;
          for (const mark of marks) {
            const rects = [...mark.getClientRects()].filter((r) => r.width || r.height);
            for (const rect of rects.length ? rects : [mark.getBoundingClientRect()]) {
              top = Math.min(top, rect.top);
              bottom = Math.max(bottom, rect.bottom);
            }
            first ||= mark;
          }
        } else if (started) break;
      } else if (started && next.textContent.trim()) break;
      next = next.nextElementSibling;
    }

    if (!first || !Number.isFinite(top) || !Number.isFinite(bottom)) return null;
    return { top, bottom, firstElement: first };
  }
};
