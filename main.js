const { Plugin, Platform, MarkdownView } = require("obsidian");

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
    this.lastClickedTargetId = null;

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

    this.navOffsetTimer = window.setInterval(() => this.updateNavPosition(), 700);
    this.register(() => window.clearInterval(this.navOffsetTimer));
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
        right: var(--sidenote-nav-computed-right, var(--sidenote-nav-right, 12px));
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
        transition: width 0.18s ease, opacity 0.18s ease, max-height 0.18s ease, right 0.18s ease;
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
        max-height: min(
          calc(100vh - var(--sidenote-nav-top, 92px) - 72px),
          var(--sidenote-nav-items-max-height, 772px)
        );
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
        justify-content: flex-start;
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
        flex: 1 1 auto;
        min-width: 0;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
        text-align: left;
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
    this.updateNavPosition();
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

    if (this.activeFilePath !== view.file.path) {
      this.lastClickedTargetId = null;
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
    // 导航条目优先显示 callout 正文，而不是 callout 标题。
    // 例如 > [!note|right] 批注 的标题是“批注”，但导航里更有用的是下面的批注内容。
    const firstBodyLine = bodyLines
      .map((line) => this.stripMarkdown(line).trim())
      .find(Boolean);

    if (firstBodyLine) return this.normalizeLabel(firstBodyLine, 80);

    if (headerTitle) return this.normalizeLabel(this.stripMarkdown(headerTitle), 80);
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

      const hasMark = /<mark\b[^>]*>/i.test(line) || /(^|[^=])==[^=].*?==([^=]|$)/.test(line);

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

    // 没有 data-line 时，不再按“当前可见序号”强行匹配全文序号。
    // Obsidian 长文档可能只渲染局部 DOM，当前第 1 个可见 callout 不等于全文第 1 个 callout。
    // 旧逻辑会导致点击导航第 1 条时误滚到当前可见区域，无法跳回文档前部。
    return null;
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

    const targetIds = new Set(navTargets.map((target) => target.id));
    if (this.lastClickedTargetId && !targetIds.has(this.lastClickedTargetId)) {
      this.lastClickedTargetId = null;
    }

    if (!navTargets.length) {
      this.removeNav();
      return;
    }

    const nav = this.ensureNav();
    this.updateNavPosition();
    const itemsEl = nav.querySelector(".sidenote-callout-nav-items");
    itemsEl.replaceChildren();

    navTargets.forEach((target, i) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "sidenote-callout-nav-item";
      item.dataset.targetId = target.id;
      // 不设置 aria-label/title，避免 Obsidian 在悬停时显示黑色 tooltip。

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
    // 不设置 aria-label/title，避免显示黑色 tooltip。
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



  updateNavPosition() {
    if (!this.navEl) return;

    const baseRight = this.getCssPixelVariable("--sidenote-nav-right", 12);
    const sidebarWidth = this.getRightSidebarWidth();
    const safeRight = Math.max(baseRight, Math.round(sidebarWidth + baseRight));
    this.navEl.style.setProperty("--sidenote-nav-computed-right", `${safeRight}px`);
  }

  getCssPixelVariable(name, fallback) {
    const raw = window.getComputedStyle(document.body).getPropertyValue(name).trim();
    if (!raw) return fallback;

    if (raw.endsWith("px")) {
      const value = Number.parseFloat(raw);
      return Number.isFinite(value) ? value : fallback;
    }

    const numeric = Number.parseFloat(raw);
    if (Number.isFinite(numeric)) return numeric;
    return fallback;
  }

  getRightSidebarWidth() {
    const selectors = [
      ".workspace-split.mod-right-split",
      ".workspace-sidedock.mod-right",
      ".mod-right-split"
    ];

    const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
    let maxWidth = 0;

    selectors.forEach((selector) => {
      document.querySelectorAll(selector).forEach((el) => {
        if (!(el instanceof HTMLElement)) return;

        const style = window.getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden" || Number.parseFloat(style.opacity || "1") === 0) {
          return;
        }

        const rect = el.getBoundingClientRect();
        if (rect.width < 40 || rect.height < 40) return;

        // 只把贴近窗口右侧的面板视为“右边栏”。这样不会误判正文中的普通分栏。
        const touchesRightEdge = rect.right >= viewportWidth - 8;
        const nearRightEdge = rect.left >= viewportWidth * 0.55 && rect.right >= viewportWidth - 80;
        if (!touchesRightEdge && !nearRightEdge) return;

        maxWidth = Math.max(maxWidth, rect.width + Math.max(0, viewportWidth - rect.right));
      });
    });

    return maxWidth;
  }

  removeNav() {
    if (this.navEl) {
      this.navEl.remove();
      this.navEl = null;
    }
  }

  async jumpToTarget(id) {
    this.lastClickedTargetId = id;
    this.updateActiveNavItem();

    const sourceTarget = this.sourceTargetMap.get(id);
    if (sourceTarget) {
      // 导航列表来自全文 Markdown。点击导航项时优先按源文档行号跳转，
      // 不优先使用 visibleTargetMap。这样可以避免长文档虚拟渲染时，
      // 可见 callout 被错误映射到第 1 条等早期条目，导致跳不回去。
      await this.jumpToSourceLine(sourceTarget);
      await this.waitAndCenterTarget(id, sourceTarget);
      return;
    }

    const visibleTarget = this.visibleTargetMap.get(id);
    if (visibleTarget && this.isVisibleTargetConnected(visibleTarget)) {
      this.scrollToVisibleTarget(visibleTarget);
    }
  }

  isVisibleTargetConnected(target) {
    return Boolean(
      (target?.targetEl && target.targetEl.isConnected) ||
      (target?.callout && target.callout.isConnected)
    );
  }

  async waitAndCenterTarget(id, sourceTarget) {
    for (let i = 0; i < 18; i += 1) {
      await this.sleep(i < 4 ? 100 : 160);
      await this.refreshAll();

      const visibleTarget = this.visibleTargetMap.get(id);
      if (visibleTarget) {
        this.scrollToVisibleTarget(visibleTarget);
        return true;
      }

      const centered = this.centerBestVisibleCandidate(sourceTarget);
      if (centered) return true;
    }

    // 不再弹出“无法精确居中”的提示。Obsidian 偶尔不会暴露可定位的 data-line，
    // 此时 openFile 的行号跳转本身仍然已经执行。
    return false;
  }

  centerBestVisibleCandidate(sourceTarget) {
    const line = Number.isFinite(sourceTarget.targetLine) ? sourceTarget.targetLine : sourceTarget.calloutLine;

    const lineEl = this.findRenderedLineElement(line);
    if (lineEl) {
      this.centerElement(lineEl);
      this.flashElement(lineEl);
      return true;
    }

    const root = this.getActiveIndentRoot();
    if (!root) return false;

    const candidates = [
      ...root.querySelectorAll("mark"),
      ...root.querySelectorAll('.callout[data-callout-metadata~="right"]')
    ].filter((el) => el instanceof HTMLElement && el.isConnected);

    if (!candidates.length) return false;

    const viewportCenter = window.innerHeight / 2;
    const nearest = candidates
      .map((el) => {
        const rect = el.getBoundingClientRect();
        return { el, distance: Math.abs((rect.top + rect.height / 2) - viewportCenter) };
      })
      .sort((a, b) => a.distance - b.distance)[0]?.el;

    if (!nearest) return false;

    this.centerElement(nearest);
    this.flashElement(nearest);
    return true;
  }

  flashElement(element) {
    if (!element) return;
    element.classList.add("sidenote-nav-flash");
    window.setTimeout(() => element.classList.remove("sidenote-nav-flash"), 1200);
  }

  sleep(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  scrollToVisibleTarget(target) {
    const destination = target.targetEl || target.callout;
    this.centerElement(destination);

    const flashEl = target.callout || destination;
    this.flashElement(flashEl);
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
    const preferred = element.closest(
      ".view-content, .markdown-reading-view, .markdown-preview-view, .markdown-source-view.mod-cm6 .cm-scroller"
    );

    if (preferred && preferred.scrollHeight > preferred.clientHeight + 2) {
      return preferred;
    }

    let current = element.parentElement;

    while (current && current !== document.body) {
      const style = window.getComputedStyle(current);
      const overflowY = style.overflowY;
      const canScroll = /(auto|scroll|overlay|hidden)/.test(overflowY) && current.scrollHeight > current.clientHeight + 2;
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

      // 如果当前模式暴露了编辑器接口，额外执行一次行号滚动。
      // 在某些 Obsidian 状态下，同一文件内反复 openFile 不一定重新滚动到旧位置；
      // 这个补充逻辑可以改善从后文跳回第 1 条批注时失效的问题。
      await this.sleep(50);
      this.scrollEditorToLineIfAvailable(line);
    } catch (error) {
      console.error("Align Sidenote With Mark: openFile line jump failed", error);
    }
  }

  scrollEditorToLineIfAvailable(line) {
    const view = this.getActiveMarkdownView();
    const editor = view?.editor;
    if (!editor || !Number.isFinite(line)) return false;

    try {
      const pos = { line, ch: 0 };
      if (typeof editor.setCursor === "function") editor.setCursor(pos);
      if (typeof editor.scrollIntoView === "function") {
        editor.scrollIntoView({ from: pos, to: pos }, true);
        return true;
      }
    } catch (error) {
      console.debug("Align Sidenote With Mark: editor line scroll skipped", error);
    }

    return false;
  }

  updateActiveNavItem() {
    if (!this.navEl) return;

    this.navEl.querySelectorAll(".sidenote-callout-nav-item").forEach((item) => {
      item.classList.toggle("is-active", Boolean(this.lastClickedTargetId) && item.dataset.targetId === this.lastClickedTargetId);
    });
  }
};
