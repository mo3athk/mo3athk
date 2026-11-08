/**
 * Tarahum — homepage hydration + banner slider.
 *
 * Hydration: `{% template_components %}` renders nothing until the merchant adds
 * sections in the Theme Editor, so a freshly activated theme would show an empty
 * homepage. We fetch the theme's OWN server-rendered /products and /categories
 * pages, clone the first N cards into the homepage grids, and reuse the theme's
 * card markup — zero API coupling, automatic identity styling.
 *
 * On failure the whole band hides (it starts hidden and is only revealed on
 * success), so the homepage degrades gracefully instead of showing skeletons
 * forever.
 */

const MOUNTS = [
  { id: "mf-home-products", selector: "[data-grid-root] > *" },
  { id: "mf-home-categories", selector: "[data-categories-grid] > *, [data-grid-root] > *" }
];

async function hydrate({ id, selector }) {
  const grid = document.getElementById(id);
  if (!grid || grid.dataset.tarahumDone === "1") return;

  const band = grid.closest("[data-mf-home-section]");
  const src = grid.dataset.src;
  const max = parseInt(grid.dataset.max || "6", 10);
  if (!src) return;

  try {
    const res = await fetch(src, { credentials: "same-origin" });
    if (!res.ok) throw new Error("HTTP " + res.status);

    const doc = new DOMParser().parseFromString(await res.text(), "text/html");
    const cards = Array.from(doc.querySelectorAll(selector)).slice(0, max);
    if (!cards.length) throw new Error("no cards");

    grid.innerHTML = "";
    cards.forEach((card) => grid.appendChild(document.importNode(card, true)));
    grid.dataset.tarahumDone = "1";

    // With only one or two published items a 3-column grid leaves the row
    // lopsided, so centre it instead of stranding a card in the corner.
    if (cards.length < 3) grid.classList.add("tarahum-grid--few");

    if (band) band.hidden = false;

    // Let wishlist / quick-view / carousels re-bind to the injected markup
    window.dispatchEvent(new CustomEvent("content:loaded"));
  } catch (err) {
    // Graceful: never leave skeletons or a broken band on screen
    if (band) band.remove();
    else grid.remove();
  }
}

function initHomeHydration() {
  if (document.body.dataset.template !== "home") return;
  MOUNTS.forEach(hydrate);
}

/* ------------------------------------------------------------------ slider */

function initSliders() {
  document.querySelectorAll("[data-tarahum-slider]").forEach((root) => {
    if (root.dataset.tarahumSlider === "1") return;
    root.dataset.tarahumSlider = "1";

    const track = root.querySelector("[data-slider-track]");
    const dotsBox = root.querySelector("[data-slider-dots]");
    if (!track) return;

    const slides = Array.from(track.children);
    if (slides.length < 2) return;

    let index = 0;
    let timer = null;

    // Build dots
    const dots = slides.map((_, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.setAttribute("aria-label", `${i + 1} / ${slides.length}`);
      b.addEventListener("click", () => {
        go(i);
        restart();
      });
      dotsBox?.appendChild(b);
      return b;
    });

    function paint() {
      dots.forEach((d, i) => d.setAttribute("aria-current", i === index ? "true" : "false"));
    }

    // Engines disagree on RTL scrollLeft (0-at-right vs negative), and
    // scrollIntoView({inline:"start"}) picks the wrong edge in RTL. scrollBy
    // takes a RELATIVE physical delta, so it is correct in both directions.
    // Slides are exactly 100% wide, so aligning left edges aligns the slide.
    function go(i, behavior) {
      index = (i + slides.length) % slides.length;
      const delta =
        slides[index].getBoundingClientRect().left - track.getBoundingClientRect().left;
      if (Math.abs(delta) > 1) {
        track.scrollBy({ left: delta, behavior: behavior || "smooth" });
      }
      paint();
    }

    function restart() {
      if (timer) clearInterval(timer);
      timer = setInterval(() => go(index + 1), 5000);
    }

    // Keep dots in sync when the user swipes — observe which slide is on screen
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (!e.isIntersecting) return;
            const i = slides.indexOf(e.target);
            if (i > -1 && i !== index) {
              index = i;
              paint();
            }
          });
        },
        { root: track, threshold: 0.6 }
      );
      slides.forEach((s) => io.observe(s));
    }

    root.addEventListener("mouseenter", () => timer && clearInterval(timer));
    root.addEventListener("mouseleave", restart);

    // Force the first slide on load — RTL tracks otherwise open on the last one
    go(0, "auto");
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) restart();
  });
}

/* ------------------------------------------------------- header height sync */

/**
 * --header-h is hardcoded to 107px in the CSS, but the real sticky header is
 * taller or shorter depending on the announcement bar, the logo size and the
 * viewport. The mobile drawer is positioned at `top: var(--header-h)`, so a
 * stale value leaves a strip of the page visible above the open drawer.
 *
 * growth-theme already solves this, but only inside blog-scripts.jinja — i.e.
 * on blog pages only. Lifted here so every page keeps the variable accurate.
 */
function syncHeaderHeight() {
  const headerEl = document.querySelector("header");
  const sticky = headerEl && headerEl.parentElement;
  if (!sticky || sticky.dataset.tarahumHeaderSync === "1") return;
  sticky.dataset.tarahumHeaderSync = "1";

  const sync = () => {
    document.documentElement.style.setProperty("--header-h", sticky.offsetHeight + "px");
  };

  sync();
  window.addEventListener("resize", sync);
  window.addEventListener("orientationchange", sync);
  if (window.ResizeObserver) new ResizeObserver(sync).observe(sticky);
}

function init() {
  syncHeaderHeight();
  initHomeHydration();
  initSliders();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

window.addEventListener("content:loaded", initSliders);
