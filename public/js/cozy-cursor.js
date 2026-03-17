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
      clearTimeout(dragTimer);
      el.classList.remove('is-hover', 'is-active', 'is-pulsing', 'is-dragging');
      state = 'idle';
      el.style.opacity = '0';
    }
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

  document.addEventListener(
    'mousemove',
    function (e) {
      if (!readEnabled()) return;
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
    },
    { passive: true }
  );

  document.addEventListener(
    'mouseover',
    function (e) {
      if (!readEnabled()) return;
      if (!el.classList.contains('is-active')) {
        setState(resolve(e.target));
      }
    },
    { passive: true }
  );

  document.addEventListener('mousedown', function () {
    if (!readEnabled()) return;
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
    clearTimeout(dragTimer);
    el.classList.remove('is-active', 'is-dragging');
    setState(resolve(e.target));
  });

  document.addEventListener('mouseleave', function () {
    if (!readEnabled()) return;
    alive = false;
    clearTimeout(dragTimer);
    el.classList.remove('is-dragging');
    el.style.opacity = '0';
  });

  document.addEventListener('mouseenter', function () {
    if (!readEnabled()) return;
    alive = true;
    el.style.opacity = '1';
  });

  window.addEventListener('storage', function (event) {
    if (event.key === 'mirdaily.cozyCursorEnabled') {
      applyEnabled(readEnabled());
    }
  });

  applyEnabled(readEnabled());
})();
