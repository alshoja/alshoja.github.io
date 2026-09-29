(function () {
  'use strict';

  var root = document.documentElement;
  var ICONS = window.STACK_ICONS || [];
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function isDark() { return root.getAttribute('data-theme') !== 'light'; }

  function lum(hex) {
    var n = parseInt(String(hex).replace('#', ''), 16);
    return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  }

  // Near-black logos become light in dark mode (and vice versa) so they stay visible.
  function logoColor(it, dark) {
    if (dark && lum(it.c) < 0.3) return '#ecebe6';
    if (!dark && lum(it.c) > 0.8) return '#16171a';
    return it.c;
  }

  /* ---------- Theme toggle ---------- */
  var themeBtn = document.getElementById('theme-toggle');
  var themeMeta = document.querySelector('meta[name="theme-color"]');
  var themeListeners = [];

  function applyThemeUi() {
    var dark = isDark();
    themeBtn.setAttribute('aria-label', dark ? 'Switch to Light Mode' : 'Switch to Dark Mode');
    if (themeMeta) themeMeta.setAttribute('content', dark ? '#0d0e11' : '#f6f4ef');
    themeListeners.forEach(function (fn) { fn(dark); });
  }

  themeBtn.addEventListener('click', function () {
    var next = isDark() ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('theme', next); } catch (e) {}
    applyThemeUi();
  });
  applyThemeUi();

  /* ---------- Mobile menu ---------- */
  var menuBtn = document.getElementById('menu-toggle');
  var navLinks = document.getElementById('nav-links');
  function setMenu(open) {
    navLinks.classList.toggle('open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? 'Close Menu' : 'Open Menu');
  }
  menuBtn.addEventListener('click', function () { setMenu(!navLinks.classList.contains('open')); });
  navLinks.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setMenu(false); });

  /* ---------- Stack chip logos ---------- */
  var byName = {};
  ICONS.forEach(function (it) { byName[it.n] = it; });
  var SVG_NS = 'http://www.w3.org/2000/svg';
  var chipPaths = [];

  // orbit = true prefers the letter-free glyph, so no text flies around the globe.
  function glyphMarkup(it, col, orbit) {
    if (it.o && (orbit || !it.p)) return it.o.replace(/COL/g, col);
    return '<path d="' + it.p + '" fill="' + col + '"/>';
  }
  document.querySelectorAll('.chips li').forEach(function (li) {
    var it = byName[li.textContent.trim()];
    if (!it) return;
    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    li.insertBefore(svg, li.firstChild);
    chipPaths.push({ svg: svg, it: it });
  });
  function colorChips(dark) {
    chipPaths.forEach(function (c) { c.svg.innerHTML = glyphMarkup(c.it, logoColor(c.it, dark)); });
  }
  themeListeners.push(colorChips);
  colorChips(isDark());

  /* ---------- Scroll reveal ---------- */
  var reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !reduceMotion) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('in'); });
  }

  var year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();

  /* ---------- Three.js "stack universe" ---------- */
  var canvas = document.getElementById('universe');
  if (!canvas || !window.THREE) return;
  var THREE = window.THREE;

  // Round, logo-only badge drawn as SVG, then used as a sprite texture.
  function badgeSvg(it, dark) {
    var col = logoColor(it, dark);
    var bg = dark ? '#16171c' : '#ffffff';
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 80 80">' +
      '<circle cx="40" cy="40" r="37" fill="' + bg + '" stroke="' + it.c + '" stroke-opacity="0.75" stroke-width="2.5"/>' +
      '<g transform="translate(22 22) scale(1.5)">' + glyphMarkup(it, col, true) + '</g></svg>';
    return { svg: svg, aspect: 1 };
  }

  function loadBadge(sprite, dark) {
    var b = badgeSvg(sprite.userData.item, dark);
    var url = URL.createObjectURL(new Blob([b.svg], { type: 'image/svg+xml' }));
    var img = new Image();
    img.onload = function () {
      URL.revokeObjectURL(url);
      var tex = new THREE.Texture(img);
      tex.anisotropy = 4;
      tex.needsUpdate = true;
      if (sprite.material.map) sprite.material.map.dispose();
      sprite.material.map = tex;
      sprite.material.needsUpdate = true;
      sprite.userData.aspect = b.aspect;
    };
    img.src = url;
  }

  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
  } catch (e) {
    canvas.style.display = 'none';
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  var compact = false;

  function fit() {
    var w = canvas.clientWidth || 800, h = canvas.clientHeight || 760;
    compact = w < 520;
    camera.position.set(0, 0, compact ? 15 : 15.5);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  fit();

  var world = new THREE.Group(); scene.add(world);
  var core = new THREE.Group(); world.add(core);

  // Particle core: a Fibonacci sphere with rainbow vertex colours.
  var N = 3800, R = 2.1, base = new Float32Array(N * 3), pos = new Float32Array(N * 3);
  for (var i = 0; i < N; i++) {
    var y = 1 - (i / (N - 1)) * 2, r = Math.sqrt(1 - y * y), th = i * 2.399963;
    base[i * 3] = Math.cos(th) * r; base[i * 3 + 1] = y; base[i * 3 + 2] = Math.sin(th) * r;
  }
  var geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  var stops = ['#ff6fae', '#ff7a59', '#f2b660', '#9be15d', '#5cc8ff', '#a78bfa'].map(function (h) { return new THREE.Color(h); });
  var cols = new Float32Array(N * 3), tmp = new THREE.Color();
  for (var j = 0; j < N; j++) {
    var u = (base[j * 3 + 1] + 1) / 2 * (stops.length - 1) + 0.35 * Math.sin(Math.atan2(base[j * 3 + 2], base[j * 3]) * 2);
    u = Math.max(0, Math.min(stops.length - 1.001, u));
    var a0 = Math.floor(u);
    tmp.copy(stops[a0]).lerp(stops[a0 + 1], u - a0);
    cols[j * 3] = tmp.r; cols[j * 3 + 1] = tmp.g; cols[j * 3 + 2] = tmp.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  var points = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.045, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false }));
  points.renderOrder = 50;
  core.add(points);

  var icoMat = new THREE.MeshBasicMaterial({ wireframe: true, transparent: true, opacity: 0.3, depthWrite: false });
  var ico = new THREE.Mesh(new THREE.IcosahedronGeometry(1.15, 1), icoMat);
  ico.renderOrder = 50;
  core.add(ico);

  // Starfield
  var S = 700, sPos = new Float32Array(S * 3);
  for (var s = 0; s < S; s++) {
    var sr = 9 + Math.random() * 14, sa = Math.random() * Math.PI * 2, sb = Math.acos(2 * Math.random() - 1);
    sPos[s * 3] = sr * Math.sin(sb) * Math.cos(sa);
    sPos[s * 3 + 1] = sr * Math.sin(sb) * Math.sin(sa);
    sPos[s * 3 + 2] = -Math.abs(sr * Math.cos(sb));
  }
  var sGeo = new THREE.BufferGeometry();
  sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
  var starMat = new THREE.PointsMaterial({ size: 0.05, transparent: true, opacity: 0.6, depthWrite: false });
  var stars = new THREE.Points(sGeo, starMat);
  scene.add(stars);

  // Orbit shells carrying the tech stack as SVG badges.
  var shells = [
    { r: 3.2, tilt: [1.22, 0.18], speed: 0.16, n: 10 },
    { r: 4.1, tilt: [1.02, -0.45], speed: -0.1, n: 12 },
    { r: 5.0, tilt: [1.38, 0.5], speed: 0.07, n: 12 }
  ];
  var ringMat = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.2, depthWrite: false });
  var sprites = [], idx = 0;
  var ORBIT = ICONS;
  shells.forEach(function (sh) {
    var pivot = new THREE.Group();
    pivot.rotation.set(sh.tilt[0], sh.tilt[1], 0);
    world.add(pivot);
    var pts = new THREE.EllipseCurve(0, 0, sh.r, sh.r, 0, Math.PI * 2).getPoints(200).map(function (p) { return new THREE.Vector3(p.x, p.y, 0); });
    var ring = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), ringMat);
    ring.renderOrder = 50;
    pivot.add(ring);
    for (var k = 0; k < sh.n && idx < ORBIT.length; k++, idx++) {
      var sp = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthTest: false, depthWrite: false }));
      sp.userData = { shell: sh, phase: (k / sh.n) * Math.PI * 2 + sh.r, aspect: 1, item: ORBIT[idx] };
      pivot.add(sp);
      sprites.push(sp);
    }
  });

  var builtFor = null;
  var ink = new THREE.Color();
  function applyTheme(dark) {
    ink.set(dark ? '#ecebe6' : '#16171a');
    icoMat.color.copy(ink); icoMat.opacity = dark ? 0.22 : 0.3;
    ringMat.color.copy(ink); ringMat.opacity = dark ? 0.16 : 0.22;
    starMat.color.copy(ink); starMat.opacity = dark ? 0.55 : 0.35;
    if (builtFor !== dark) {
      sprites.forEach(function (sp) { loadBadge(sp, dark); });
      builtFor = dark;
    }
  }
  themeListeners.push(applyTheme);
  applyTheme(isDark());

  if (window.ResizeObserver) {
    new ResizeObserver(function () { fit(); applyTheme(isDark()); }).observe(canvas);
  } else {
    window.addEventListener('resize', function () { fit(); applyTheme(isDark()); });
  }

  var mx = 0, my = 0;
  window.addEventListener('pointermove', function (e) {
    var b = canvas.getBoundingClientRect();
    mx = Math.max(-1, Math.min(1, ((e.clientX - b.left) / b.width - 0.5) * 2));
    my = Math.max(-1, Math.min(1, ((e.clientY - b.top) / b.height - 0.5) * 2));
  }, { passive: true });

  // Pause rendering while the hero is off screen or the tab is hidden.
  var visible = true;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (en) { visible = en[0].isIntersecting; }).observe(canvas);
  }

  var v = new THREE.Vector3();
  var t0 = performance.now(), rx = 0, ry = 0, raf = 0;
  function tick() {
    raf = requestAnimationFrame(tick);
    if (!visible || document.hidden) return;
    var now = performance.now(), t = reduceMotion ? 0 : (now - t0) / 1000;

    for (var i = 0; i < N; i++) {
      var bx = base[i * 3], by = base[i * 3 + 1], bz = base[i * 3 + 2];
      var d = R * (1 + 0.09 * Math.sin(bx * 3 + t * 1.3) * Math.cos(by * 4 - t * 0.9) + 0.05 * Math.sin(bz * 5 + t * 1.7));
      pos[i * 3] = bx * d; pos[i * 3 + 1] = by * d; pos[i * 3 + 2] = bz * d;
    }
    geo.attributes.position.needsUpdate = true;
    core.rotation.y = t * 0.12;
    ico.rotation.x = t * 0.25; ico.rotation.y = -t * 0.18;
    stars.rotation.z = t * 0.01;

    // Intro: the core grows and the shells fly out.
    var p = reduceMotion ? 1 : Math.min(1, (now - t0) / 1800), e = 1 - Math.pow(1 - p, 3);
    core.scale.setScalar(0.55 + 0.45 * e);
    var sizeH = compact ? 0.58 : 0.62;
    sprites.forEach(function (sp) {
      var ud = sp.userData, sh = ud.shell, a = ud.phase + t * sh.speed, rr = sh.r * (0.2 + 0.8 * e);
      sp.position.set(Math.cos(a) * rr, Math.sin(a) * rr, 0.15 * Math.sin(t * 0.8 + ud.phase));
      sp.getWorldPosition(v);
      var depth = Math.max(0, Math.min(1, (v.z / sh.r + 1) / 2));
      var sc = sizeH * (0.72 + 0.4 * depth) * e;
      sp.scale.set(sc * ud.aspect, sc, 1);
      sp.material.opacity = 0.25 + 0.75 * depth;
      sp.renderOrder = Math.round(depth * 100);
    });

    rx += (my * 0.25 - rx) * 0.05;
    ry += (mx * 0.4 - ry) * 0.05;
    world.rotation.x = rx; world.rotation.y = ry;
    renderer.render(scene, camera);
  }
  tick();
})();
