const { Plugin, Platform, MarkdownView, Notice } = require("obsidian");

module.exports = class AlignSidenoteWithMarkPlugin extends Plugin {
  onload() {
    if (Platform.isMobile) {
      return;
    }

    this.sourceTargets = [];
    this.sourceTargetMap = new Map();
    this.visibleTargets = [];
    this.visibleTargetMap = new Map();
    this.navEl = null;
    this.raf = null;
    this.scrollRaf = null;
    this.idSeed = 0;
    this.refreshToken = 0;
    this.activeFilePath = null;

    this.queueRefresh = this.debounce(() => {
      if (this.raf) cancelAnimationFrame(this.raf);
      this.raf = requestAnimationFrame(() => {
        this.refreshAll();
      });
    }, 160);

    this.queueActiveUpdate = () => {
      if (this.scrollRaf) return;
      this.scrollRaf = requestAnimationFrame(() => {
        this.scrollRaf = null;
        this.updateActiveNavItem();
      });
    };

    this.registerEvent(this.app.workspace.on("layout-change", this.queueRefresh));
    this.registerEvent(this.app.workspace.on("active-leaf-change", this.queueRefresh));
    this.registerEvent(this.app.workspace.on("file-open", this.queueRefresh));
    this.registerEvent(this.app.vault.on("modify", (file) => {
      if (file?.path === this.activeFilePath) this.queueRefresh();
    }));

    this.observer = new MutationObserver((mutations) => {
      if (this.isOnlyNavMutation(mutations)) return;
      this.queueRefresh();
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    this.register(() => this.observer.disconnect());

    window.addEventListener("resize", this.queueRefresh, { passive: true });
    window.addEventListener("scroll", this.queueActiveUpdate, { passive: true, capture: true });

    this.register(() => window.removeEventListener("resize", this.queueRefresh));
    this.register(() => window.removeEventListener("scroll", this.queueActiveUpdate, { capture: true }));

    this.injectStyles();
    this.queueRefresh();
  }

  onunload() {
    this.clearAllTransforms();
    this.removeNav();
    const style = document.getElementById("align-sidenote-mark-style");
    if (style) style.remove();
  }

  debounce(fn, delay) {
    let timer = null;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  isOnlyNavMutation(mutations) {
    if (!this.navEl) return false;
    return mutations.length > 0 && mutations.every((mutation) => {
      const target = mutation.target;
      if (target === this.navEl || this.navEl.contains(target)) return true;
      const nodes = [...mutation.addedNodes, ...mutation.removedNodes];
      return nodes.length > 0 && nodes.every((node) => {
        if (!(node instanceof HTMLElement)) return true;
        return node === this.navEl || this.navEl.contains(node) || node.classList.contains("sidenote-callout-nav");
      });
    });
  }

  injectStyles() {
    if (document.getElementById("align-sidenote-mark-style")) return;

    const style = document.createElement("style");
    style.id = "align-sidenote-mark-style";
    style.textContent = `
      .callout.sidenote-mark-aligned {
        transform: translateY(var(--sidenote-shift-y, 0px));
        will-change: transform;
      }

      .callout.sidenote-nav-flash,
      mark.sidenote-nav-flash {
        outline: 2px solid var(--interactive-accent);
        outline-offset: 3px;
        transition: outline-color 0.2s ease;
      }

      .sidenote-callout-nav {
        position: fixed;
        top: var(--sidenote-nav-top, 92px);
        right: var(--sidenote-nav-right, 12px);
        z-index: var(--layer-popover, 1000);
        width: 46px;
        max-height: calc(100vh - var(--sidenote-nav-top, 92px) - 24px);
        box-sizing: border-box;
        overflow: hidden;
        border: 1px solid var(--background-modifier-border);
        border-radius: 16px;
        background: var(--background-primary);
        box-shadow: 0 8px 28px rgba(0, 0, 0, 0.18);
        opacity: 0.72;
        transition: width 0.18s ease, opacity 0.18s ease, max-height 0.18s ease;
        user-select: none;
      }

      .sidenote-callout-nav:not(:hover):not(.is-pinned) {
        max-height: 46px;
      }

      .sidenote-callout-nav:hover,
      .sidenote-callout-nav.is-pinned {
        width: var(--sidenote-nav-width, 230px);
        opacity: 1;
      }

      .sidenote-callout-nav-header {
        display: flex;
        align-items: center;
        gap: 8px;
        height: 40px;
        padding: 0 9px;
        border-bottom: 1px solid var(--background-modifier-border);
        box-sizing: border-box;
      }

      .sidenote-callout-nav:not(:hover):not(.is-pinned) .sidenote-callout-nav-header {
        border-bottom-color: transparent;
      }

      .sidenote-callout-nav-icon {
        width: 26px;
        height: 26px;
        border-radius: 999px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--text-muted);
        background: var(--background-secondary);
        flex: 0 0 auto;
        font-size: 14px;
        line-height: 1;
      }

      .sidenote-callout-nav-title {
        min-width: 0;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
        font-size: 13px;
        color: var(--text-muted);
        flex: 1 1 auto;
        opacity: 0;
        transition: opacity 0.18s ease;
      }

      .sidenote-callout-nav:hover .sidenote-callout-nav-title,
      .sidenote-callout-nav.is-pinned .sidenote-callout-nav-title {
        opacity: 1;
      }

      .sidenote-callout-nav-pin {
        border: none;
        background: transparent;
        color: var(--text-faint);
        cursor: pointer;
        font-size: 13px;
        padding: 4px;
        border-radius: 6px;
        opacity: 0;
        transition: opacity 0.18s ease, background 0.18s ease;
      }

      .sidenote-callout-nav:hover .sidenote-callout-nav-pin,
      .sidenote-callout-nav.is-pinned .sidenote-callout-nav-pin {
        opacity: 1;
      }

      .sidenote-callout-nav-pin:hover {
        background: var(--background-modifier-hover);
        color: var(--text-normal);
      }

      .sidenote-callout-nav-items {
        max-height: calc(100vh - var(--sidenote-nav-top, 92px) - 72px);
        overflow-y: auto;
        padding: 6px;
        box-sizing: border-box;
      }

      .sidenote-callout-nav:not(:hover):not(.is-pinned) .sidenote-callout-nav-items {
        display: none;
      }

      .sidenote-callout-nav-item {
        width: 100%;
        border: none;
        background: transparent;
        color: var(--text-muted);
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 7px 8px;
        border-radius: 10px;
        cursor: pointer;
        text-align: left;
        box-sizing: border-box;
        font-size: 13px;
        line-height: 1.25;
      }

      .sidenote-callout-nav-item:hover {
        background: var(--background-modifier-hover);
        color: var(--text-normal);
      }

      .sidenote-callout-nav-item.is-active {
        background: var(--background-modifier-active-hover);
        color: var(--text-normal);
      }

      .sidenote-callout-nav-number {
        width: 24px;
        height: 24px;
        border-radius: 999px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--background-secondary);
        color: var(--text-muted);
        font-size: 12px;
        flex: 0 0 auto;
      }

      .sidenote-callout-nav-item.is-active .sidenote-callout-nav-number {
        background: var(--interactive-accent);
        color: var(--text-on-accent);
      }

      .sidenote-callout-nav-label {
        min-width: 0;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
        opacity: 0;
        transition: opacity 0.18s ease;
      }

      .sidenote-callout-nav:hover .sidenote-callout-nav-label,
      .sidenote-callout-nav.is-pinned .sidenote-callout-nav-label {
        opacity: 1;
      }
    `;

    document.head.appendChild(style);
  }

  async refreshAll() {
    const token = ++this.refreshToken;
    await this.refreshSourceTargets();
    if (token !== this.refreshToken) return;

    this.alignAll();
    this.buildNav();
    this.updateActiveNavItem();
  }

  async refreshSourceTargets() {
    const view = this.getActiveMarkdownView();
    const activeRoot = this.getActiveIndentRoot();

    if (!view?.file || !activeRoot) {
      this.activeFilePath = null;
      this.sourceTargets = [];
      this.sourceTargetMap.clear();
      return;
    }

    this.activeFilePath = view.file.path;

    try {
      const text = await this.app.vault.cachedRead(view.file);
      const parsed = this.parseRightCalloutsFromMarkdown(text, view.file.path);
      this.sourceTargets = parsed;
      this.sourceTargetMap.clear();
      parsed.forEach((target) => this.sourceTargetMap.set(target.id, target));
    } catch (error) {
      console.error("Align Sidenote With Mark: failed to parse markdown", error);
      this.sourceTargets = [];
      this.sourceTargetMap.clear();
    }
  }

  getActiveMarkdownView() {
    return this.app.workspace.getActiveViewOfType(MarkdownView);
  }

  parseRightCalloutsFromMarkdown(text, filePath) {
    const lines = text.split(/\r?\n/);
    const targets = [];
    let inFence = false;
    let fenceMarker = null;

    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      const fence = line.match(/^\s*(```+|~~~+)/);
      if (fence) {
        const marker = fence[1][0];
        if (!inFence) {
          inFence = true;
          fenceMarker = marker;
        } else if (fenceMarker === marker) {
          inFence = false;
          fenceMarker = null;
        }
        continue;
      }

      if (inFence) continue;

      const match = line.match(/^\s*>\s*\[!([^\]|]+)(?:\|([^\]]+))?\]([+-])?\s*(.*)$/i);
      if (!match) continue;

      const metadata = (match[2] || "").split(/\s+/).map((item) => item.trim()).filter(Boolean);
      if (!metadata.includes("right")) continue;

      const calloutLine = i;
      const headerTitle = (match[4] || "").trim();
      let j = i + 1;
      const bodyLines = [];

      while (j < lines.length && /^\s*>/.test(lines[j])) {
        bodyLines.push(lines[j].replace(/^\s*>\s?/, ""));
        j += 1;
      }

      const calloutEndLine = Math.max(calloutLine, j - 1);
      const markInfo = this.findMarkedGroupInMarkdown(lines, j);
      const title = this.getMarkdownCalloutTitle(headerTitle, bodyLines, targets.length + 1);
      const id = this.makeSourceTargetId(filePath, calloutLine, targets.length + 1);

      targets.push({
        id,
        filePath,
        index: targets.length + 1,
        calloutLine,
        calloutEndLine,
        targetLine: markInfo?.firstLine ?? calloutLine,
        targetEndLine: markInfo?.lastLine ?? calloutEndLine,
        title
      });
    }

    return targets;
  }

  makeSourceTargetId(filePath, line, index) {
    return `sidenote-source-${this.simpleHash(`${filePath}:${line}:${index}`)}`;
  }

  simpleHash(text) {
    let hash = 0;
    for (let i = 0; i < text.length; i += 1) {
      hash = ((hash << 5) - hash) + text.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(36);
  }

  getMarkdownCalloutTitle(headerTitle, bodyLines, number) {
    if (headerTitle) return this.normalizeLabel(this.stripMarkdown(headerTitle), 60);

    const firstBodyLine = bodyLines
      .map((line) => this.stripMarkdown(line).trim())
      .find(Boolean);

    if (firstBodyLine) return this.normalizeLabel(firstBodyLine, 60);
    return `边注 ${number}`;
  }

  stripMarkdown(text) {
    return text
      .replace(/<mark[^>]*>/gi, "")
      .replace(/<\/mark>/gi, "")
      .replace(/<[^>]+>/g, "")
      .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/[`*_~>#-]+/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  findMarkedGroupInMarkdown(lines, startLine) {
    let firstLine = null;
    let lastLine = null;
    let groupStarted = false;
    let inFence = false;
    let fenceMarker = null;

    for (let i = startLine; i < lines.length; i += 1) {
      const line = lines[i];
      const fence = line.match(/^\s*(```+|~~~+)/);
      if (fence) {
        const marker = fence[1][0];
        if (!inFence) {
          inFence = true;
          fenceMarker = marker;
        } else if (fenceMarker === marker) {
          inFence = false;
          fenceMarker = null;
        }
        if (groupStarted) break;
        continue;
      }

      if (inFence) continue;

      const trimmed = line.trim();
      if (!trimmed) {
        if (groupStarted) continue;
        continue;
      }

      const hasMark = /<mark\b[^>]*>/i.test(line);

      if (hasMark) {
        if (!groupStarted) {
          firstLine = i;
          groupStarted = true;
        }
        lastLine = i;
        continue;
      }

      if (groupStarted) break;
    }

    if (firstLine === null) return null;
    return { firstLine, lastLine };
  }

  clearAllTransforms() {
    document
      .querySelectorAll(".callout.sidenote-mark-aligned")
      .forEach((callout) => {
        callout.style.removeProperty("--sidenote-shift-y");
        callout.classList.remove("sidenote-mark-aligned", "sidenote-nav-flash");
        delete callout.dataset.sidenoteTranslateY;
        delete callout.dataset.sidenoteNavId;
      });
  }

  getAllIndentRoots() {
    const roots = [...document.querySelectorAll(".markdown-preview-view.indent, .markdown-preview-view .indent")];
    return roots.filter((root, index) => roots.indexOf(root) === index);
  }

  getActiveIndentRoot() {
    const activeLeaf = document.querySelector(".workspace-leaf.mod-active");
    if (activeLeaf) {
      const activeRoot = activeLeaf.querySelector(".markdown-preview-view.indent, .markdown-preview-view .indent");
      if (activeRoot) return activeRoot;
    }

    const roots = this.getAllIndentRoots();
    return roots.length ? roots[0] : null;
  }

  alignAll() {
    this.visibleTargets = [];
    this.visibleTargetMap.clear();

    const roots = this.getAllIndentRoots();
    const activeRoot = this.getActiveIndentRoot();

    roots.forEach((root) => {
      const rootTargets = this.alignRoot(root);
      if (root === activeRoot) {
        this.visibleTargets = rootTargets;
        rootTargets.forEach((target) => this.visibleTargetMap.set(target.id, target));
      }
    });
  }

  alignRoot(root) {
    const callouts = [...root.querySelectorAll('.callout[data-callout-metadata~="right"]')];
    const targets = [];
    const usedSourceIds = new Set();

    callouts.forEach((callout, visibleIndex) => {
      const sourceLine = this.getSourceLineForElement(callout);
      const sourceTarget = this.findSourceTargetForVisibleCallout(sourceLine, visibleIndex, usedSourceIds);
      const markGroup = this.findMarkedGroupAfterCallout(callout);
      if (!markGroup) return;

      const id = sourceTarget?.id || callout.dataset.sidenoteNavId || this.newTargetId();
      callout.dataset.sidenoteNavId = id;
      if (sourceTarget) usedSourceIds.add(sourceTarget.id);

      const calloutRect = callout.getBoundingClientRect();
      const calloutCenter = calloutRect.top + calloutRect.height / 2;
      const targetCenter = (markGroup.top + markGroup.bottom) / 2;
      const deltaY = targetCenter - calloutCenter;

      const oldY = Number.parseFloat(callout.dataset.sidenoteTranslateY || "0") || 0;
      const newY = oldY + deltaY;

      if (Math.abs(deltaY) > 1) {
        callout.dataset.sidenoteTranslateY = String(newY);
        callout.style.setProperty("--sidenote-shift-y", `${Math.round(newY)}px`);
        callout.classList.add("sidenote-mark-aligned");
      } else if (!callout.classList.contains("sidenote-mark-aligned")) {
        callout.dataset.sidenoteTranslateY = String(oldY);
        callout.style.setProperty("--sidenote-shift-y", `${Math.round(oldY)}px`);
        callout.classList.add("sidenote-mark-aligned");
      }

      const title = sourceTarget?.title || this.getCalloutTitleFromDom(callout, visibleIndex + 1);

      targets.push({
        id,
        index: sourceTarget?.index ?? visibleIndex + 1,
        callout,
        targetEl: markGroup.firstElement,
        title,
        top: markGroup.top,
        bottom: markGroup.bottom,
        sourceLine: sourceTarget?.targetLine
      });
    });

    return targets;
  }

  findSourceTargetForVisibleCallout(sourceLine, visibleIndex, usedSourceIds) {
    if (!this.sourceTargets.length) return null;

    if (Number.isFinite(sourceLine)) {
      const exact = this.sourceTargets.find((target) => {
        if (usedSourceIds.has(target.id)) return false;
        return sourceLine >= target.calloutLine && sourceLine <= target.calloutEndLine;
      });
      if (exact) return exact;

      const nearby = this.sourceTargets
        .filter((target) => !usedSourceIds.has(target.id))
        .map((target) => ({ target, distance: Math.abs(target.calloutLine - sourceLine) }))
        .filter((item) => item.distance <= 5)
        .sort((a, b) => a.distance - b.distance)[0];
      if (nearby) return nearby.target;
    }

    return this.sourceTargets.filter((target) => !usedSourceIds.has(target.id))[visibleIndex] || null;
  }

  getSourceLineForElement(element) {
    let current = element;
    while (current && current !== document.body) {
      if (current instanceof HTMLElement && current.hasAttribute("data-line")) {
        const value = Number.parseInt(current.getAttribute("data-line"), 10);
        if (Number.isFinite(value)) return value;
      }
      current = current.parentElement;
    }
    return null;
  }

  newTargetId() {
    this.idSeed += 1;
    return `sidenote-target-${Date.now()}-${this.idSeed}`;
  }

  getCalloutTitleFromDom(callout, number) {
    const titleInner = callout.querySelector(".callout-title-inner");
    const title = titleInner?.textContent?.trim();
    if (title) return this.normalizeLabel(title, 60);

    const content = callout.querySelector(".callout-content")?.textContent?.trim();
    if (content) {
      const firstLine = content.split(/\n+/).map((line) => line.trim()).find(Boolean);
      if (firstLine) return this.normalizeLabel(firstLine, 60);
    }

    return `边注 ${number}`;
  }

  normalizeLabel(text, maxLength) {
    const normalized = text.replace(/\s+/g, " ").trim();
    if (normalized.length <= maxLength) return normalized;
    return `${normalized.slice(0, maxLength - 1)}…`;
  }

  getPreviewBlock(element) {
    let current = element;

    while (current && current.parentElement) {
      if (current.parentElement.classList?.contains("markdown-preview-section")) {
        return current;
      }
      current = current.parentElement;
    }

    return element;
  }

  findParagraphInBlock(block) {
    if (!block || !(block instanceof HTMLElement)) return null;
    if (block.matches("p")) return block;
    return block.querySelector(":scope > p, :scope .el-p > p, p");
  }

  findMarkedGroupAfterCallout(callout) {
    const block = this.getPreviewBlock(callout);
    if (!block) return null;

    let next = block.nextElementSibling;
    let groupStarted = false;
    const elements = [];
    let firstElement = null;
    let top = Infinity;
    let bottom = -Infinity;

    while (next) {
      const paragraph = this.findParagraphInBlock(next);

      if (paragraph) {
        const marks = [...paragraph.querySelectorAll("mark")];

        if (marks.length) {
          groupStarted = true;

          marks.forEach((mark) => {
            const rects = [...mark.getClientRects()].filter((rect) => rect.width || rect.height);
            const usableRects = rects.length ? rects : [mark.getBoundingClientRect()];

            usableRects.forEach((rect) => {
              top = Math.min(top, rect.top);
              bottom = Math.max(bottom, rect.bottom);
            });

            if (!firstElement) firstElement = mark;
            elements.push(mark);
          });
        } else if (groupStarted) {
          break;
        }
      } else if (groupStarted && !this.isIgnorableBlock(next)) {
        break;
      }

      next = next.nextElementSibling;
    }

    if (!elements.length || !Number.isFinite(top) || !Number.isFinite(bottom)) return null;

    return {
      top,
      bottom,
      firstElement
    };
  }

  isIgnorableBlock(block) {
    const text = block.textContent?.trim() || "";
    return text.length === 0;
  }

  buildNav() {
    const navTargets = this.sourceTargets.length ? this.sourceTargets : this.visibleTargets;

    if (!navTargets.length) {
      this.removeNav();
      return;
    }

    const nav = this.ensureNav();
    const itemsEl = nav.querySelector(".sidenote-callout-nav-items");
    itemsEl.replaceChildren();

    navTargets.forEach((target, i) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "sidenote-callout-nav-item";
      item.dataset.targetId = target.id;
      item.setAttribute("aria-label", `跳转到 ${target.title}`);

      const number = document.createElement("span");
      number.className = "sidenote-callout-nav-number";
      number.textContent = String(i + 1);

      const label = document.createElement("span");
      label.className = "sidenote-callout-nav-label";
      label.textContent = target.title;

      item.appendChild(number);
      item.appendChild(label);

      item.addEventListener("click", () => this.jumpToTarget(target.id));
      itemsEl.appendChild(item);
    });
  }

  ensureNav() {
    if (this.navEl && document.body.contains(this.navEl)) return this.navEl;

    const nav = document.createElement("div");
    nav.className = "sidenote-callout-nav";

    if (localStorage.getItem("align-sidenote-mark-nav-pinned") === "true") {
      nav.classList.add("is-pinned");
    }

    const header = document.createElement("div");
    header.className = "sidenote-callout-nav-header";

    const icon = document.createElement("div");
    icon.className = "sidenote-callout-nav-icon";
    icon.textContent = "¶";

    const title = document.createElement("div");
    title.className = "sidenote-callout-nav-title";
    title.textContent = "边注导航";

    const pin = document.createElement("button");
    pin.type = "button";
    pin.className = "sidenote-callout-nav-pin";
    pin.textContent = nav.classList.contains("is-pinned") ? "收起" : "固定";
    pin.setAttribute("aria-label", "固定或收起边注导航");
    pin.addEventListener("click", (event) => {
      event.stopPropagation();
      nav.classList.toggle("is-pinned");
      const pinned = nav.classList.contains("is-pinned");
      pin.textContent = pinned ? "收起" : "固定";
      localStorage.setItem("align-sidenote-mark-nav-pinned", pinned ? "true" : "false");
    });

    const items = document.createElement("div");
    items.className = "sidenote-callout-nav-items";

    header.appendChild(icon);
    header.appendChild(title);
    header.appendChild(pin);
    nav.appendChild(header);
    nav.appendChild(items);
    document.body.appendChild(nav);

    this.navEl = nav;
    return nav;
  }

  removeNav() {
    if (this.navEl) {
      this.navEl.remove();
      this.navEl = null;
    }
  }

  async jumpToTarget(id) {
    const visibleTarget = this.visibleTargetMap.get(id);
    if (visibleTarget) {
      this.scrollToVisibleTarget(visibleTarget);
      return;
    }

    const sourceTarget = this.sourceTargetMap.get(id);
    if (!sourceTarget) return;

    await this.jumpToSourceLine(sourceTarget);

    const centered = await this.waitAndCenterTarget(id, sourceTarget);
    if (!centered) {
      new Notice("边注导航：已跳转，但无法精确居中。", 2200);
    }
  }

  async waitAndCenterTarget(id, sourceTarget) {
    for (let i = 0; i < 14; i += 1) {
      await this.sleep(i < 3 ? 120 : 180);
      await this.refreshAll();

      const visibleTarget = this.visibleTargetMap.get(id);
      if (visibleTarget) {
        this.scrollToVisibleTarget(visibleTarget);
        return true;
      }

      const lineEl = this.findRenderedLineElement(sourceTarget.targetLine);
      if (lineEl) {
        this.centerElement(lineEl);
        lineEl.classList.add("sidenote-nav-flash");
        window.setTimeout(() => lineEl.classList.remove("sidenote-nav-flash"), 1200);
        return true;
      }
    }

    return false;
  }

  sleep(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  scrollToVisibleTarget(target) {
    const destination = target.targetEl || target.callout;
    this.centerElement(destination);

    const flashEl = target.callout || destination;
    flashEl.classList.add("sidenote-nav-flash");
    window.setTimeout(() => {
      flashEl.classList.remove("sidenote-nav-flash");
    }, 1200);
  }

  centerElement(element) {
    if (!element) return;

    const scroller = this.findScrollableAncestor(element);
    const elementRect = element.getBoundingClientRect();

    if (scroller) {
      const scrollerRect = scroller.getBoundingClientRect();
      const elementCenter = elementRect.top + elementRect.height / 2;
      const scrollerCenter = scrollerRect.top + scrollerRect.height / 2;
      const delta = elementCenter - scrollerCenter;
      scroller.scrollTo({
        top: scroller.scrollTop + delta,
        behavior: "smooth"
      });
      return;
    }

    const viewportCenter = window.innerHeight / 2;
    const elementCenter = elementRect.top + elementRect.height / 2;
    const delta = elementCenter - viewportCenter;
    window.scrollTo({
      top: window.scrollY + delta,
      behavior: "smooth"
    });
  }

  findScrollableAncestor(element) {
    let current = element.parentElement;

    while (current && current !== document.body) {
      const style = window.getComputedStyle(current);
      const overflowY = style.overflowY;
      const canScroll = /(auto|scroll|overlay)/.test(overflowY) && current.scrollHeight > current.clientHeight + 2;
      if (canScroll) return current;
      current = current.parentElement;
    }

    return null;
  }

  findRenderedLineElement(line) {
    if (!Number.isFinite(line)) return null;

    const root = this.getActiveIndentRoot();
    if (!root) return null;

    const lineEls = [...root.querySelectorAll("[data-line]")]
      .map((el) => ({
        el,
        line: Number.parseInt(el.getAttribute("data-line"), 10)
      }))
      .filter((item) => Number.isFinite(item.line));

    if (!lineEls.length) return null;

    const exact = lineEls.find((item) => item.line === line);
    if (exact) return exact.el;

    const nearest = lineEls
      .map((item) => ({ ...item, distance: Math.abs(item.line - line) }))
      .filter((item) => item.distance <= 8)
      .sort((a, b) => a.distance - b.distance)[0];

    return nearest?.el || null;
  }

  async jumpToSourceLine(target) {
    const file = this.app.vault.getAbstractFileByPath(target.filePath);
    if (!file) return;

    const view = this.getActiveMarkdownView();
    const leaf = view?.leaf || this.app.workspace.getLeaf(false);
    const line = Number.isFinite(target.targetLine) ? target.targetLine : target.calloutLine;

    try {
      if (leaf?.openFile) {
        await leaf.openFile(file, {
          active: true,
          eState: { line }
        });
      }
    } catch (error) {
      console.error("Align Sidenote With Mark: openFile line jump failed", error);
      new Notice("边注导航：跳转失败，请尝试切换到阅读模式后再点一次。", 3000);
    }
  }

  updateActiveNavItem() {
    if (!this.navEl) return;

    const visibleTargets = [...this.visibleTargetMap.values()].filter((target) => target.targetEl?.isConnected);
    if (!visibleTargets.length) return;

    const viewportCenter = window.innerHeight / 2;
    let best = null;
    let bestDistance = Infinity;

    visibleTargets.forEach((target) => {
      const rect = target.targetEl.getBoundingClientRect();
      const center = rect.top + rect.height / 2;
      const distance = Math.abs(center - viewportCenter);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = target;
      }
    });

    this.navEl.querySelectorAll(".sidenote-callout-nav-item").forEach((item) => {
      item.classList.toggle("is-active", best && item.dataset.targetId === best.id);
    });
  }
};
