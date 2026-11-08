/**
 * Tarahum — NGO features: quick-donate bar and zakat calculator.
 *
 * Both degrade to something usable when their prerequisites are missing: the
 * quick-donate chips are plain links until a product id is configured, and the
 * calculator is inert markup until this script runs.
 */

/* ------------------------------------------------------------ quick donate */

function initQuickDonate() {
  document.querySelectorAll("[data-quick-donate]").forEach((root) => {
    if (root.dataset.quickInit === "1") return;

    const productId = root.dataset.productId;
    // No product configured — the template already rendered links, leave them.
    if (!productId) return;
    root.dataset.quickInit = "1";

    const errorEl = root.querySelector("[data-quick-error]");
    const customEl = root.querySelector("[data-quick-custom]");

    function showError(msg) {
      if (!errorEl) return;
      errorEl.textContent = msg;
      errorEl.hidden = false;
    }

    function clearError() {
      if (errorEl) errorEl.hidden = true;
    }

    async function donate(amount, btn) {
      const qty = parseInt(amount, 10);
      if (!qty || qty < 1) {
        showError(window.tarahumNgo?.invalidAmount || "");
        return;
      }
      clearError();

      // The platform SDK is injected by {% vitrin_body %}; if it hasn't loaded
      // yet, fall back to the cases page rather than silently doing nothing.
      if (!window.zid || !window.zid.cart) {
        window.location.href = window.tarahumNgo?.productsUrl || "/products";
        return;
      }

      const label = btn ? btn.innerHTML : null;
      if (btn) {
        btn.disabled = true;
        btn.classList.add("is-loading");
      }

      try {
        await window.zid.cart.addProduct(
          { product_id: productId, quantity: qty },
          { showErrorNotification: true }
        );
        window.location.href = window.tarahumNgo?.cartUrl || "/cart";
      } catch (e) {
        showError(window.tarahumNgo?.addFailed || "");
        if (btn) {
          btn.disabled = false;
          btn.classList.remove("is-loading");
          if (label !== null) btn.innerHTML = label;
        }
      }
    }

    root.querySelectorAll("[data-quick-amount]").forEach((btn) => {
      btn.addEventListener("click", () => donate(btn.dataset.quickAmount, btn));
    });

    const submitEl = root.querySelector("[data-quick-submit]");
    if (submitEl && customEl) {
      submitEl.addEventListener("click", () => donate(customEl.value, submitEl));
      customEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          donate(customEl.value, submitEl);
        }
      });
    }
  });
}

/* --------------------------------------------------------- zakat calculator */

function initZakat() {
  document.querySelectorAll("[data-zakat]").forEach((root) => {
    if (root.dataset.zakatInit === "1") return;
    root.dataset.zakatInit = "1";

    const nisab = parseFloat(root.dataset.nisab || "0") || 0;
    const rate = parseFloat(root.dataset.rate || "2.5") || 2.5;
    const currency = root.dataset.currency || "SAR";

    const inputs = Array.from(root.querySelectorAll("[data-zakat-input]"));
    const totalEl = root.querySelector("[data-zakat-total]");
    const dueEl = root.querySelector("[data-zakat-due]");
    const hintEl = root.querySelector("[data-zakat-hint]");

    const fmt = (n) =>
      new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 2 }).format(n) + " " + currency;

    function recalc() {
      let total = 0;
      inputs.forEach((el) => {
        const v = parseFloat(el.value);
        if (isNaN(v) || v < 0) return;
        total += el.hasAttribute("data-zakat-negative") ? -v : v;
      });

      if (total < 0) total = 0;
      const due = (total * rate) / 100;

      if (totalEl) totalEl.textContent = fmt(total);
      if (dueEl) dueEl.textContent = fmt(due);

      if (hintEl) {
        // Only warn about the nisab when the merchant has actually set one —
        // never invent a threshold, since it tracks the gold price.
        if (nisab > 0 && total > 0 && total < nisab) {
          hintEl.textContent = window.tarahumNgo?.belowNisab || "";
          hintEl.hidden = !hintEl.textContent;
        } else {
          hintEl.hidden = true;
        }
      }
    }

    inputs.forEach((el) => {
      el.addEventListener("input", recalc);
      el.addEventListener("change", recalc);
    });
    recalc();
  });
}

function init() {
  initQuickDonate();
  initZakat();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

window.addEventListener("content:loaded", init);
