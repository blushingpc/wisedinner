// AUDIT PROBE (docs/AUDIT-2026-09-09.md): mechanical checks evaluated in the page by chrome-devtools.
// Lives in scripts/; for a run, copy it to public/_audit/probe.js (gitignored) so the page can fetch and eval it. Never linked from the site.
(function () {
  const vis = (e) => {
    const r = e.getBoundingClientRect();
    const cs = getComputedStyle(e);
    return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none" && cs.opacity !== "0";
  };
  const path = (e) => {
    const parts = [];
    let n = e;
    while (n && n.nodeType === 1 && parts.length < 4) {
      let s = n.tagName.toLowerCase();
      if (n.id) s += "#" + n.id;
      else if (n.className && typeof n.className === "string") s += "." + n.className.trim().split(/\s+/).slice(0, 2).join(".");
      parts.unshift(s);
      n = n.parentElement;
    }
    return parts.join(">");
  };
  const rect = (e) => {
    const r = e.getBoundingClientRect();
    return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) };
  };
  const inter = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  const parse = (c) => {
    const m = c.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/);
    return m ? [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]] : null;
  };
  const lum = ([r, g, b]) => {
    const f = (v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (a, b) => {
    const l1 = lum(a), l2 = lum(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  };
  const blend = (fg, bg) => [0, 1, 2].map((i) => Math.round(fg[i] * fg[3] + bg[i] * (1 - fg[3])));
  const bgOf = (e) => {
    let n = e;
    const stack = [];
    while (n && n.nodeType === 1) {
      const cs = getComputedStyle(n);
      const c = parse(cs.backgroundColor);
      if (cs.backgroundImage && cs.backgroundImage !== "none") return { c: null, note: "image:" + path(n) };
      if (c && c[3] > 0) {
        stack.push(c);
        if (c[3] >= 1) break;
      }
      n = n.parentElement;
    }
    let out = [255, 255, 255];
    for (let i = stack.length - 1; i >= 0; i--) out = blend(stack[i], out);
    return { c: out };
  };
  const all = [...document.querySelectorAll("body *")].filter((e) => !e.closest("script,style,noscript,dialog:not([open])"));
  const W = innerWidth, H = innerHeight;

  // 1. horizontal overflow
  const overflow = { scrollWidth: document.documentElement.scrollWidth, innerWidth: W, offenders: [] };
  if (overflow.scrollWidth > W + 1) {
    for (const e of all) {
      if (!vis(e)) continue;
      const r = e.getBoundingClientRect();
      if (r.right > W + 1 || r.left < -1) {
        // ignore elements inside an overflow-hidden/auto ancestor (chips row, phone screens)
        let n = e.parentElement, clipped = false;
        while (n && n !== document.body) {
          const o = getComputedStyle(n).overflowX;
          if (o === "hidden" || o === "auto" || o === "scroll" || o === "clip") { clipped = true; break; }
          n = n.parentElement;
        }
        if (!clipped) overflow.offenders.push({ el: path(e), r: rect(e) });
      }
      if (overflow.offenders.length > 8) break;
    }
  }

  // 2. truncation (single-line ellipsis / nowrap clipped)
  const truncation = [];
  for (const e of all) {
    if (!vis(e) || !e.textContent.trim()) continue;
    const cs = getComputedStyle(e);
    if ((cs.textOverflow === "ellipsis" || cs.whiteSpace === "nowrap") && cs.overflowX !== "visible" && e.scrollWidth > e.clientWidth + 1 && !e.closest("[class*='screen'], .pt-switcher, [role='tabpanel'], .sr-only")) truncation.push({ el: path(e), text: e.textContent.trim().slice(0, 40) });
    if (truncation.length > 8) break;
  }

  // 3. orphaned last word in headings
  const orphans = [];
  for (const h of document.querySelectorAll("h1, h2, h3")) {
    if (!vis(h)) continue;
    const words = [];
    const walker = document.createTreeWalker(h, NodeFilter.SHOW_TEXT);
    let t;
    while ((t = walker.nextNode())) {
      const re = /\S+/g;
      let m;
      while ((m = re.exec(t.nodeValue))) {
        const rg = document.createRange();
        rg.setStart(t, m.index);
        rg.setEnd(t, m.index + m[0].length);
        const rr = rg.getClientRects()[0];
        if (rr) words.push({ w: m[0], top: Math.round(rr.top) });
      }
    }
    if (words.length < 3) continue;
    const lastTop = words[words.length - 1].top;
    const lastLine = words.filter((x) => x.top === lastTop);
    const lines = new Set(words.map((x) => x.top)).size;
    if (lines > 1 && lastLine.length === 1) orphans.push({ el: path(h), text: h.textContent.trim().slice(0, 50), lines });
  }

  // 4. overlaps: cut-outs vs h1 / hero button; switcher arrows vs the phone panel; anything vs the sticky bar (only when shown)
  const overlaps = [];
  const h1 = document.querySelector("h1");
  const heroBtn = document.querySelector('button[data-placement="hero"]');
  for (const img of document.querySelectorAll('img[src*="cutout"]')) {
    if (!vis(img)) continue;
    const ir = img.getBoundingClientRect();
    for (const [name, el] of [["h1", h1], ["hero button", heroBtn], ["hero sub", h1 && h1.nextElementSibling]]) {
      if (el && inter(ir, el.getBoundingClientRect()) > 0) overlaps.push({ a: "cut-out " + img.getAttribute("src").split("/").pop(), b: name, area: Math.round(inter(ir, el.getBoundingClientRect())) });
    }
  }
  const panel = document.querySelector('#how [role="tabpanel"]');
  if (panel) {
    for (const b of document.querySelectorAll('#how button[aria-label$="screen"]')) {
      const a = inter(b.getBoundingClientRect(), panel.getBoundingClientRect());
      if (a > 0) overlaps.push({ a: b.getAttribute("aria-label"), b: "phone panel", area: Math.round(a) });
      const br = b.getBoundingClientRect();
      if (br.left < 0 || br.right > W) overlaps.push({ a: b.getAttribute("aria-label"), b: "viewport edge", area: Math.round(Math.max(-br.left, br.right - W)) });
    }
  }

  // 5. tap targets < 44 (inline text links exempt per WCAG 2.5.8 inline exception, reported separately)
  const small = [], smallInline = [];
  for (const e of document.querySelectorAll("a[href], button, [role='tab'], summary, input, textarea, select")) {
    if (!vis(e) || e.closest("dialog:not([open]), header, footer, .sr-only")) continue; // header/footer targets recorded once (A-05..A-08)
    const r = e.getBoundingClientRect();
    if (r.width < 44 || r.height < 44) (getComputedStyle(e).display === "inline" ? smallInline : small).push({ el: path(e), text: (e.getAttribute("aria-label") || e.textContent.trim()).slice(0, 30), w: Math.round(r.width), h: Math.round(r.height) });
  }

  // 6. inputs < 16px (iOS zoom)
  const smallInputs = [...document.querySelectorAll("input, textarea, select")].filter(vis).map((e) => ({ el: path(e), size: parseFloat(getComputedStyle(e).fontSize) })).filter((x) => x.size < 16);

  // 7. header at top and scrolled
  const header = document.querySelector("header");
  const y0 = scrollY;
  const hdr = {};
  if (header) {
    scrollTo(0, 0);
    hdr.top = { h: Math.round(header.getBoundingClientRect().height), shadow: getComputedStyle(header).boxShadow, border: getComputedStyle(header).borderBottomWidth };
    scrollTo(0, 600);
    hdr.scrolled = { h: Math.round(header.getBoundingClientRect().height), y: Math.round(header.getBoundingClientRect().top), shadow: getComputedStyle(header).boxShadow };
    scrollTo(0, y0);
  }

  // 8. fonts + palette
  const fonts = [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family + " " + f.weight);
  const badFonts = new Set();
  const colors = new Map();
  const ALLOWED = new Set(["rgb(17, 17, 17)", "rgb(107, 107, 107)", "rgb(11, 61, 46)", "rgb(16, 185, 129)", "rgb(255, 255, 255)", "rgb(214, 69, 69)", "rgb(245, 245, 247)", "rgb(230, 230, 230)", "rgb(231, 247, 240)", "rgb(8, 46, 34)", "rgba(0, 0, 0, 0)", "rgba(255, 255, 255, 0.8)", "rgba(17, 17, 17, 0.5)"]);
  for (const e of all) {
    const cs = getComputedStyle(e);
    if (/bricolage|plex/i.test(cs.fontFamily)) badFonts.add(cs.fontFamily.slice(0, 40));
    for (const c of [cs.color, cs.backgroundColor, cs.borderTopColor]) {
      if (!ALLOWED.has(c) && !c.startsWith("rgba(0, 0, 0, 0)")) colors.set(c, (colors.get(c) || 0) + 1);
    }
  }
  const unknownColors = [...colors.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([c, n]) => c + " x" + n);

  // 9. contrast on every element with its own text
  const contrast = [];
  const seen = new Set();
  for (const e of all) {
    if (!vis(e)) continue;
    const own = [...e.childNodes].filter((n) => n.nodeType === 3 && n.nodeValue.trim()).map((n) => n.nodeValue.trim()).join(" ");
    if (!own) continue;
    const cs = getComputedStyle(e);
    if (cs.position === "absolute" && cs.width === "1px") continue; // sr-only
    const fg = parse(cs.color);
    if (!fg) continue;
    const bg = bgOf(e);
    if (!bg.c) continue;
    const f = blend(fg, bg.c);
    const r = ratio(f, bg.c);
    const size = parseFloat(cs.fontSize);
    const bold = parseInt(cs.fontWeight) >= 700;
    const large = size >= 24 || (size >= 18.66 && bold);
    const need = large ? 3 : 4.5;
    if (r < need) {
      const key = cs.color + "|" + bg.c.join(",") + "|" + Math.round(size);
      if (seen.has(key)) continue;
      seen.add(key);
      contrast.push({ el: path(e), text: own.slice(0, 30), fg: cs.color, bg: "rgb(" + bg.c.join(", ") + ")", ratio: +r.toFixed(2), size, need });
    }
  }

  // 10. vh usage in inline styles (source grep covers CSS)
  const vh = [...document.querySelectorAll("[style*='vh']")].map(path);

  return { docH: document.documentElement.scrollHeight, url: location.pathname + location.hash, vp: W + "x" + H + "@" + devicePixelRatio, overflow, truncation, orphans, overlaps, small, smallInlineCount: smallInline.length, smallInputs, hdr, fonts, badFonts: [...badFonts], unknownColors, contrast, vh };
})();
