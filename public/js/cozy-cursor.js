;(function () {
  'use strict';

  var el = document.getElementById('cozy-cursor');
  if (!el) return;

  var state = 'idle';
  var alive = false;
  var mouseX = -50;
  var mouseY = -50;
  var dragTimer = null;
  var rootEl = document.documentElement;
  var hiddenByScrollbar = false;

  function readEnabled() {
    try {
      var stored = localStorage.getItem('mirdaily.cozyCursorEnabled');
      if (stored === 'false') return false;
      if (stored === 'true') return true;
    } catch (error) {}
    return rootEl.getAttribute('data-cozy-cursor') !== 'off';
  }

  function applyEnabled(enabled) {
    rootEl.setAttribute('data-cozy-cursor', enabled ? 'on' : 'off');
    if (!enabled) {
      alive = false;
      hiddenByScrollbar = false;
      clearTimeout(dragTimer);
      el.classList.remove('is-hover', 'is-active', 'is-pulsing', 'is-dragging');
      state = 'idle';
      el.style.opacity = '0';
    }
  }

  function syncOpacity() {
    el.style.opacity = alive && !hiddenByScrollbar ? '1' : '0';
  }

  function setState(next) {
    if (next === state) return;
    el.classList.remove('is-hover', 'is-active', 'is-pulsing', 'is-dragging');
    if (next === 'hover') el.classList.add('is-hover');
    if (next === 'active') el.classList.add('is-active');
    state = next;
  }

  function resolve(target) {
    if (!target || !target.closest) return 'idle';
    if (target.closest('[data-cursor="hover"]')) return 'hover';
    if (
      target.closest(
        'a, button, [role="button"], [tabindex]:not([tabindex="-1"]), input[type="submit"], select, .cursor-pointer'
      )
    ) {
      return 'hover';
    }
    return 'idle';
  }

  function updatePos() {
    el.style.transform =
      'translate3d(' + (mouseX - 3).toFixed(1) + 'px,' +
      (mouseY - 1).toFixed(1) + 'px, 0)';
  }

  function pulse() {
    el.classList.remove('is-pulsing');
    void el.offsetWidth;
    el.classList.add('is-pulsing');
  }

  function isScrollable(node) {
    if (!node || node === document.body || node === document.documentElement) return false;
    if (!node.clientHeight || !node.clientWidth) return false;
    if (node.scrollHeight <= node.clientHeight && node.scrollWidth <= node.clientWidth) return false;
    var style = window.getComputedStyle(node);
    var overflowY = style.overflowY;
    var overflowX = style.overflowX;
    var canScrollY = (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') && node.scrollHeight > node.clientHeight;
    var canScrollX = (overflowX === 'auto' || overflowX === 'scroll' || overflowX === 'overlay') && node.scrollWidth > node.clientWidth;
    return canScrollY || canScrollX;
  }

  function nearestScrollableAncestor(target) {
    var node = target;
    while (node && node !== document.body && node !== document.documentElement) {
      if (node.nodeType === 1 && isScrollable(node)) return node;
      node = node.parentElement;
    }
    return null;
  }

  function isOverScrollbar(target, e) {
    if (!e) return false;
    var viewportHasVScroll = window.innerWidth > document.documentElement.clientWidth;
    var viewportHasHScroll = window.innerHeight > document.documentElement.clientHeight;
    if (viewportHasVScroll && e.clientX >= document.documentElement.clientWidth) return true;
    if (viewportHasHScroll && e.clientY >= document.documentElement.clientHeight) return true;

    var scrollable = nearestScrollableAncestor(target);
    if (!scrollable) return false;

    var rect = scrollable.getBoundingClientRect();
    if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
      return false;
    }

    var hasV = scrollable.scrollHeight > scrollable.clientHeight;
    var hasH = scrollable.scrollWidth > scrollable.clientWidth;
    if (hasV && e.clientX >= rect.left + scrollable.clientWidth) return true;
    if (hasH && e.clientY >= rect.top + scrollable.clientHeight) return true;
    return false;
  }

  function syncScrollbarVisibility(target, e) {
    var nextHidden = isOverScrollbar(target, e);
    if (nextHidden === hiddenByScrollbar) return;
    hiddenByScrollbar = nextHidden;
    syncOpacity();
  }

  function clearPressState(target) {
    clearTimeout(dragTimer);
    el.classList.remove('is-active', 'is-dragging');
    setState(resolve(target || document.elementFromPoint(mouseX, mouseY)));
  }

  document.addEventListener(
    'mousemove',
    function (e) {
      if (!readEnabled()) return;
      mouseX = e.clientX;
      mouseY = e.clientY;
      if (!alive) {
        alive = true;
      }
      syncScrollbarVisibility(e.target, e);
      syncOpacity();
      updatePos();
      if (!el.classList.contains('is-active')) {
        setState(resolve(e.target));
      }
    },
    { passive: true }
  );

  document.addEventListener(
    'mouseover',
    function (e) {
      if (!readEnabled()) return;
      syncScrollbarVisibility(e.target, e);
      if (!el.classList.contains('is-active')) {
        setState(resolve(e.target));
      }
    },
    { passive: true }
  );

  document.addEventListener('mousedown', function () {
    if (!readEnabled()) return;
    if (hiddenByScrollbar) return;
    el.classList.remove('is-hover');
    el.classList.add('is-active');
    state = 'active';
    pulse();
    dragTimer = setTimeout(function () {
      el.classList.add('is-dragging');
    }, 250);
  });

  document.addEventListener('mouseup', function (e) {
    if (!readEnabled()) return;
    clearPressState(e.target);
  });

  window.addEventListener('pointerup', function () {
    if (!readEnabled()) return;
    clearPressState(document.elementFromPoint(mouseX, mouseY));
  });

  window.addEventListener('blur', function () {
    if (!readEnabled()) return;
    clearPressState(document.elementFromPoint(mouseX, mouseY));
  });

  document.addEventListener('mouseleave', function () {
    if (!readEnabled()) return;
    alive = false;
    hiddenByScrollbar = false;
    clearTimeout(dragTimer);
    el.classList.remove('is-dragging');
    syncOpacity();
  });

  document.addEventListener('mouseenter', function () {
    if (!readEnabled()) return;
    alive = true;
    syncOpacity();
  });

  window.addEventListener('storage', function (event) {
    if (event.key === 'mirdaily.cozyCursorEnabled') {
      applyEnabled(readEnabled());
    }
  });

  applyEnabled(readEnabled());
})();
