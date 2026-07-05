const { Plugin } = require("obsidian");

module.exports = class AlignSidenoteWithMarkPlugin extends Plugin {
  onload() {
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

  onunload() {
    document.querySelectorAll(".callout.sidenote-mark-aligned").forEach((callout) => {
      callout.style.transform = "";
      callout.classList.remove("sidenote-mark-aligned");
    });
  }

  debounce(fn, delay) {
    let timer = null;
    return () => {
      clearTimeout(timer);
      timer = setTimeout(fn, delay);
    };
  }

  alignAll() {
    const roots = new Set([
      ...document.querySelectorAll(".markdown-preview-view.indent"),
      ...document.querySelectorAll(".markdown-preview-view .indent")
    ]);

    roots.forEach((root) => this.alignRoot(root));
  }

  alignRoot(root) {
    const callouts = [...root.querySelectorAll('.callout[data-callout-metadata~="right"]')];

    callouts.forEach((callout) => {
      callout.style.transform = "";
      callout.classList.remove("sidenote-mark-aligned");
    });

    callouts.forEach((callout) => {
      const mark = this.findMarkInNextParagraph(callout);
      if (!mark) return;

      const calloutRect = callout.getBoundingClientRect();
      const markRect = mark.getBoundingClientRect();
      const deltaY = Math.round(markRect.top - calloutRect.top);

      callout.style.transform = `translateY(${deltaY}px)`;
      callout.classList.add("sidenote-mark-aligned");
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

  findMarkInNextParagraph(callout) {
    const block = this.getPreviewBlock(callout);
    if (!block) return null;
    let next = block.nextElementSibling;
    while (next) {
      const paragraph = next.matches?.("p") ? next : next.querySelector(":scope > p, p");
      if (paragraph) return paragraph.querySelector("mark");
      next = next.nextElementSibling;
    }
    return null;
  }
};
