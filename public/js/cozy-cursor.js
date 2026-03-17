/* ═══════════════════════════════════════════════════════
   mirdaily — Cozy Pebble Cursor (JS)
   Zero dependencies. Requires #cozy-cursor in the DOM.
═══════════════════════════════════════════════════════ */
;(function () {
  'use strict';

  var el = document.getElementById('cozy-cursor');
  if (!el) return;

  var state    = 'idle';
  var alive    = false;
  var mouseX   = -50;
  var mouseY   = -50;
  var dragTimer = null;

  function markInteractive(root) {
    if (!root) return;

    var candidates = [];
    if (root.nodeType === 1) {
      candidates.push(root);
    }
    if (root.querySelectorAll) {
      var found = root.querySelectorAll('[role="button"], [tabindex], [onclick]');
      for (var i = 0; i < found.length; i++) candidates.push(found[i]);
    }

    for (var j = 0; j < candidates.length; j++) {
      var node = candidates[j];
      if (!node || !node.matches) continue;
      if (node.hasAttribute('data-cursor')) continue;
      if (node.matches('a, button, input, select, textarea, label')) continue;
      if (node.matches('[tabindex="-1"]')) continue;
      if (node.getAttribute('contenteditable') === 'true') continue;
      if (!node.matches('[role="button"], [tabindex], [onclick]')) continue;
      node.setAttribute('data-cursor', 'hover');
    }
  }

  // ── State machine ──
  function setState(next) {
    if (next === state) return;
    el.classList.remove('is-hover', 'is-active', 'is-pulsing', 'is-dragging');
    if (next === 'hover')  el.classList.add('is-hover');
    if (next === 'active') el.classList.add('is-active');
    state = next;
  }

  // ── Target resolution ──
  function resolve(target) {
    if (!target || !target.closest) return 'idle';
    if (target.closest('[data-cursor="hover"]')) return 'hover';
    if (target.closest('a, button, [role="button"], input[type="submit"], select')) return 'hover';
    return 'idle';
  }

  // ── Position ──
  function updatePos() {
    el.style.transform =
      'translate3d(' + (mouseX - 3).toFixed(1) + 'px,' +
                       (mouseY - 1).toFixed(1) + 'px, 0)';
  }

  // ── Pulse (click feedback) ──
  function pulse() {
    el.classList.remove('is-pulsing');
    void el.offsetWidth;
    el.classList.add('is-pulsing');
  }

  // ── Events ──
  document.addEventListener('mousemove', function (e) {
    mouseX = e.clientX;
    mouseY = e.clientY;
    if (!alive) {
      alive = true;
      el.style.opacity = '1';
    }
    updatePos();
    if (!el.classList.contains('is-active')) {
      setState(resolve(e.target));
    }
  }, { passive: true });

  document.addEventListener('mouseover', function (e) {
    if (!el.classList.contains('is-active')) {
      setState(resolve(e.target));
    }
  }, { passive: true });

  document.addEventListener('mousedown', function () {
    el.classList.remove('is-hover');
    el.classList.add('is-active');
    state = 'active';
    pulse();
    dragTimer = setTimeout(function () {
      el.classList.add('is-dragging');
    }, 250);
  });

  document.addEventListener('mouseup', function (e) {
    clearTimeout(dragTimer);
    el.classList.remove('is-active', 'is-dragging');
    setState(resolve(e.target));
  });

  document.addEventListener('mouseleave', function () {
    alive = false;
    clearTimeout(dragTimer);
    el.classList.remove('is-dragging');
    el.style.opacity = '0';
  });

  document.addEventListener('mouseenter', function () {
    alive = true;
    el.style.opacity = '1';
  });

  markInteractive(document.body);
  var observer = new MutationObserver(function (mutations) {
    for (var i = 0; i < mutations.length; i++) {
      var mutation = mutations[i];
      if (mutation.type === 'childList') {
        for (var j = 0; j < mutation.addedNodes.length; j++) {
          markInteractive(mutation.addedNodes[j]);
        }
      }
      if (mutation.type === 'attributes' && mutation.target) {
        markInteractive(mutation.target);
      }
    }
  });

  observer.observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['role', 'tabindex', 'onclick'],
  });

})();
