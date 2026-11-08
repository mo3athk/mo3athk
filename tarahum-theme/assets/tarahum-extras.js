/**
 * Tarahum — extras bundle (donation amount box + floating quick donate).
 *
 * Deliberately a plain, dependency-free IIFE loaded with its own <script> tag
 * rather than a Vite module: it needs no build step, so the theme can be
 * repackaged without a Node toolchain and it survives upstream bundle updates.
 *
 * Copy shown to donors always comes from window.tarahumNgo (populated by
 * layout.jinja from the .po files) — no Arabic is hardcoded here.
 */
(function () {
  "use strict";

  var T = function () {
    return window.tarahumNgo || {};
  };

  /* =====================================================================
     1. Donation amount box  —  case page
     ---------------------------------------------------------------------
     The chips never submit anything themselves. They drive the theme's real
     #product-quantity input so add-to-cart, the sticky bar and variants.js
     keep working exactly as upstream intends.
     ===================================================================== */

  function initDonationAmount() {
    document.querySelectorAll("[data-donation-amount]").forEach(function (root) {
      if (root.dataset.daInit === "1") return;
      root.dataset.daInit = "1";

      var qtyInput = document.getElementById("product-quantity");
      if (!qtyInput) return;

      var unit = parseFloat(root.dataset.unitPrice) || 1;
      var cur = root.dataset.currency || "";
      var max = parseInt(root.dataset.max, 10);

      // The quantity field ships with an order cap (max="100" on this store).
      // For a donation the quantity IS the amount, so that cap silently
      // truncates real gifts — 132 SAR would reach the cart as 100. Lift it to
      // the amount actually still needed for this case.
      function liftCap() {
        if (!max) {
          qtyInput.removeAttribute("max");
          return;
        }
        var current = parseInt(qtyInput.getAttribute("max"), 10);
        if (!current || current < max) qtyInput.setAttribute("max", String(max));
      }
      liftCap();
      var chips = Array.prototype.slice.call(root.querySelectorAll("[data-amount-chip]"));
      var custom = root.querySelector("[data-amount-custom]");
      var totalEl = root.querySelector("[data-amount-total]");
      var hintEl = root.querySelector("[data-amount-hint]");

      // Hide the raw quantity row — for donations the amount IS the quantity.
      if (root.dataset.hideQuantity === "1") {
        var qtyWrap = qtyInput.closest("[data-quantity-wrapper]");
        if (qtyWrap) qtyWrap.classList.add("tarahum-qty-hidden");
      }

      function fmt(n) {
        // Keep decimals only when the number actually has them.
        var r = Math.round(n * 100) / 100;
        return (r % 1 === 0 ? r.toFixed(0) : r.toFixed(2)) + (cur ? " " + cur : "");
      }

      function setHint(msg) {
        if (!hintEl) return;
        if (!msg) {
          hintEl.hidden = true;
          hintEl.textContent = "";
          return;
        }
        hintEl.textContent = msg;
        hintEl.hidden = false;
      }

      /**
       * Apply a donated amount.
       * quantity = amount / unit price, floored to a whole unit and clamped to
       * stock. The real total is echoed back so the donor is never shown a
       * figure different from what the cart will charge.
       */
      function apply(amount, sourceChip) {
        var amt = parseFloat(amount);
        if (!amt || amt <= 0) return;

        liftCap(); // variants.js can rewrite max when options change
        var qty = Math.max(1, Math.round(amt / unit));
        if (max && qty > max) qty = max;

        qtyInput.value = String(qty);
        // Let the rest of the theme react (price display, sticky bar, cart).
        qtyInput.dispatchEvent(new Event("input", { bubbles: true }));
        qtyInput.dispatchEvent(new Event("change", { bubbles: true }));

        var real = qty * unit;
        if (totalEl) {
          totalEl.innerHTML =
            (T().totalLabel || "") + " <b>" + fmt(real) + "</b>";
          totalEl.hidden = false;
        }

        // Only warn when the requested amount could not be honoured exactly.
        if (Math.abs(real - amt) > 0.009) {
          setHint((T().amountRounded || "").replace("%s", fmt(real)));
        } else {
          setHint("");
        }

        chips.forEach(function (c) {
          c.setAttribute("aria-pressed", String(c === sourceChip));
        });
        if (!sourceChip && custom) {
          chips.forEach(function (c) {
            c.setAttribute("aria-pressed", "false");
          });
        }
      }

      chips.forEach(function (chip) {
        chip.addEventListener("click", function () {
          if (custom) custom.value = "";
          apply(chip.dataset.amountChip, chip);
        });
      });

      if (custom) {
        custom.addEventListener("input", function () {
          if (custom.value === "") {
            setHint("");
            if (totalEl) totalEl.hidden = true;
            return;
          }
          apply(custom.value, null);
        });
      }

      // Preselect the first chip so the box is never in an undefined state.
      if (chips.length) chips[0].click();
    });
  }

  /* =====================================================================
     2. Floating quick donate  —  every page
     ===================================================================== */

  function initQuickFloat() {
    document.querySelectorAll("[data-quick-float]").forEach(function (root) {
      if (root.dataset.qfInit === "1") return;
      root.dataset.qfInit = "1";

      var openBtn = root.querySelector("[data-quick-float-open]");
      var dialog = root.querySelector("[data-quick-float-dialog]");
      var backdrop = root.querySelector("[data-quick-float-backdrop]");
      var closeBtn = root.querySelector("[data-quick-float-close]");
      var custom = root.querySelector("[data-float-custom]");
      var submit = root.querySelector("[data-float-submit]");
      var errorEl = root.querySelector("[data-float-error]");
      var chips = Array.prototype.slice.call(root.querySelectorAll("[data-float-amount]"));
      var productId = root.dataset.productId || "";
      var lastFocus = null;

      if (!openBtn || !dialog) return;

      function showError(msg) {
        if (!errorEl) return;
        errorEl.textContent = msg || "";
        errorEl.hidden = !msg;
      }

      function open(e) {
        if (e) e.preventDefault();
        lastFocus = document.activeElement;
        dialog.hidden = false;
        if (backdrop) backdrop.hidden = false;
        openBtn.setAttribute("aria-expanded", "true");
        document.body.style.overflow = "hidden";
        var first = dialog.querySelector("button, input, a[href]");
        if (first) first.focus();
      }

      function close() {
        dialog.hidden = true;
        if (backdrop) backdrop.hidden = true;
        openBtn.setAttribute("aria-expanded", "false");
        document.body.style.overflow = "";
        showError("");
        if (lastFocus && lastFocus.focus) lastFocus.focus();
      }

      openBtn.addEventListener("click", open);
      if (closeBtn) closeBtn.addEventListener("click", close);
      if (backdrop) backdrop.addEventListener("click", close);
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && !dialog.hidden) close();
      });

      // Keep focus inside the dialog while it is open.
      dialog.addEventListener("keydown", function (e) {
        if (e.key !== "Tab") return;
        var f = dialog.querySelectorAll(
          'button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
        );
        if (!f.length) return;
        var first = f[0];
        var last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      });

      // Without a configured product the chips are plain links — nothing to do.
      if (!productId) return;

      async function donate(amount, btn) {
        var qty = parseInt(amount, 10);
        if (!qty || qty < 1) {
          showError(T().invalidAmount || "");
          return;
        }
        showError("");

        // The SDK is injected by {% vitrin_body %}; if it is not up yet, send
        // the donor to the cases page rather than failing silently.
        if (!window.zid || !window.zid.cart) {
          window.location.href = T().productsUrl || "/products";
          return;
        }

        var target = btn || submit;
        if (target) target.disabled = true;

        try {
          await window.zid.cart.addProduct(
            { product_id: productId, quantity: qty },
            { showErrorNotification: true }
          );
          window.location.href = T().cartUrl || "/cart";
        } catch (err) {
          showError(T().addFailed || "");
          if (target) target.disabled = false;
        }
      }

      chips.forEach(function (chip) {
        chip.addEventListener("click", function () {
          chips.forEach(function (c) {
            c.setAttribute("aria-pressed", String(c === chip));
          });
          if (custom) custom.value = chip.dataset.floatAmount;
          showError("");
        });
      });

      if (submit) {
        submit.addEventListener("click", function () {
          var picked = chips.filter(function (c) {
            return c.getAttribute("aria-pressed") === "true";
          })[0];
          var amount = custom && custom.value ? custom.value : picked ? picked.dataset.floatAmount : "";
          donate(amount, submit);
        });
      }

      if (custom) {
        custom.addEventListener("keydown", function (e) {
          if (e.key === "Enter") {
            e.preventDefault();
            if (submit) submit.click();
          }
        });
        custom.addEventListener("input", function () {
          chips.forEach(function (c) {
            c.setAttribute("aria-pressed", "false");
          });
        });
      }
    });
  }

  function boot() {
    initDonationAmount();
    initQuickFloat();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  // Re-run for content injected later (home hydration, quick view, filters).
  document.addEventListener("content:loaded", boot);
})();
