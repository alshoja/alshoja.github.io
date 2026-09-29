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


  /* ---------- 3D scenes ----------
     Three.js (~600 KB) is fetched only after the page has loaded and the
     browser is idle, so text and buttons appear instantly; the scenes fade in. */
  function pageZoom() { return parseFloat(getComputedStyle(document.body).zoom) || 1; }

  function loadThree(done) {
    if (window.THREE) return done();
    var s = document.createElement('script');
    s.src = 'assets/vendor/three.min.js';
    s.async = true;
    s.onload = done;
    document.head.appendChild(s);
  }

  function start3D() {
    var heroCanvas = document.getElementById('universe');
    var stackCanvas = document.getElementById('stack-globe');
    if (!heroCanvas && !stackCanvas) return;
    loadThree(function () {
      THREE = window.THREE;
      if (heroCanvas) initHero(heroCanvas);
      if (stackCanvas) initStackGlobe(stackCanvas);
    });
  }

  var THREE;
  function whenIdle(fn) { if ('requestIdleCallback' in window) requestIdleCallback(fn, { timeout: 1500 }); else setTimeout(fn, 200); }
  if (document.readyState === 'complete') whenIdle(start3D);
  else window.addEventListener('load', function () { whenIdle(start3D); });

  /* ---------- Hero: neural-network globe surrounded by the orbiting stack ---------- */
  function initHero(canvas) {

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
    renderer.setPixelRatio(Math.min((window.devicePixelRatio || 1) * pageZoom(), 3));

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    var compact = false;

    function fit() {
      var w = canvas.clientWidth || 800, h = canvas.clientHeight || 760;
      compact = w < 520;
      // Pull the camera back until the outer orbit (plus badges) fits both the
      // width and the height of the canvas, whatever its shape.
      var aspect = w / h, tanHalf = Math.tan(THREE.MathUtils.degToRad(20));
      // the orbits are flattened ellipses, so on phones fit their width and height separately
      var reachX = 5.9, reachY = compact ? 3.6 : 5.9;
      camera.position.set(0, 0, Math.max(reachY / tanHalf, reachX / (tanHalf * aspect)));
      renderer.setSize(w, h, false);
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
    }
    fit();

    var world = new THREE.Group(); scene.add(world);
    var core = new THREE.Group(); world.add(core);

    // The neural-network globe at the centre of the orbits.
    var brain = buildNeural(THREE);
    core.add(brain.root);

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
        var sp = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false }));
        sp.userData = { shell: sh, phase: (k / sh.n) * Math.PI * 2 + sh.r, aspect: 1, item: ORBIT[idx] };
        pivot.add(sp);
        sprites.push(sp);
      }
    });

    var builtFor = null;
    var ink = new THREE.Color();
    function applyTheme(dark) {
      ink.set(dark ? '#ecebe6' : '#16171a');
      brain.theme(dark);
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

    // The network keeps reaching out: threads grow from its outer neurons to the
    // orbiting logos, hold on for a moment, then zip onto the logo and let go.
    var CN = 10, cPos = new Float32Array(CN * 6), cCol = new Float32Array(CN * 6), tipPos = new Float32Array(CN * 3), tipCol = new Float32Array(CN * 3);
    var cGeo = new THREE.BufferGeometry();
    cGeo.setAttribute('position', new THREE.BufferAttribute(cPos, 3));
    cGeo.setAttribute('color', new THREE.BufferAttribute(cCol, 3));
    var linkLines = new THREE.LineSegments(cGeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.85, depthWrite: false }));
    linkLines.renderOrder = 60; world.add(linkLines);
    var tGeo = new THREE.BufferGeometry();
    tGeo.setAttribute('position', new THREE.BufferAttribute(tipPos, 3));
    tGeo.setAttribute('color', new THREE.BufferAttribute(tipCol, 3));
    var linkTips = new THREE.Points(tGeo, new THREE.PointsMaterial({ size: 0.24, map: brain.dot, vertexColors: true, transparent: true, depthWrite: false, alphaTest: 0.02 }));
    linkTips.renderOrder = 61; world.add(linkTips);
    // glowing dots flowing along each thread, so the reach is easy to see
    var BP = 18, bPos = new Float32Array(CN * BP * 3), bCol = new Float32Array(CN * BP * 3);
    var bGeo = new THREE.BufferGeometry();
    bGeo.setAttribute('position', new THREE.BufferAttribute(bPos, 3));
    bGeo.setAttribute('color', new THREE.BufferAttribute(bCol, 3));
    var beams = new THREE.Points(bGeo, new THREE.PointsMaterial({ size: 0.11, map: brain.dot, vertexColors: true, transparent: true, depthWrite: false, alphaTest: 0.02 }));
    beams.renderOrder = 60; world.add(beams);
    var beamFlow = 0;
    var links = [], la = new THREE.Vector3(), lb = new THREE.Vector3(), lc = new THREE.Vector3(), lColA = new THREE.Color(), lColB = new THREE.Color();
    for (var li = 0; li < CN; li++) links.push({ sp: null, node: 0, stage: 3, k: 0, wait: 0.4 + li * 0.3 });
    var LINK_DUR = [0.7, 1.3, 0.45];
    var hideLink = function (i) {
      for (var c = 0; c < 6; c++) cPos[i * 6 + c] = 0;
      tipPos[i * 3] = 0; tipPos[i * 3 + 1] = 0; tipPos[i * 3 + 2] = 1000;
      for (var q = 0; q < BP; q++) bPos[(i * BP + q) * 3 + 2] = 1000;
    };
    var updateLinks = function (dt) {
      beamFlow = (beamFlow + dt * 1.6) % 1;
      links.forEach(function (L, i) {
        if (L.stage === 3) {
          L.wait -= dt;
          if (L.wait > 0 || !sprites.length) { hideLink(i); return; }
          L.sp = sprites[Math.floor(Math.random() * sprites.length)];
          L.sp.getWorldPosition(lb);
          L.node = brain.nearestOuter(lb);
          L.stage = 0; L.k = 0;
        }
        L.k += dt / LINK_DUR[L.stage];
        if (L.k >= 1) {
          L.stage++; L.k = 0;
          if (L.stage === 3) { L.wait = 0.2 + Math.random() * 1.2; hideLink(i); return; }
        }
        brain.nodeWorld(L.node, la); L.sp.getWorldPosition(lb);
        world.worldToLocal(la); world.worldToLocal(lb);
        var e = L.k * L.k * (3 - 2 * L.k);
        var from = L.stage === 2 ? lc.copy(la).lerp(lb, e) : la;
        var to = L.stage === 0 ? lc.copy(la).lerp(lb, e) : lb;
        cPos[i * 6] = from.x; cPos[i * 6 + 1] = from.y; cPos[i * 6 + 2] = from.z;
        cPos[i * 6 + 3] = to.x; cPos[i * 6 + 4] = to.y; cPos[i * 6 + 5] = to.z;
        tipPos[i * 3] = to.x; tipPos[i * 3 + 1] = to.y; tipPos[i * 3 + 2] = to.z;
        brain.nodeColor(L.node, lColA); lColB.set(L.sp.userData.item.c);
        cCol[i * 6] = lColA.r; cCol[i * 6 + 1] = lColA.g; cCol[i * 6 + 2] = lColA.b;
        cCol[i * 6 + 3] = lColB.r; cCol[i * 6 + 4] = lColB.g; cCol[i * 6 + 5] = lColB.b;
        tipCol[i * 3] = lColB.r; tipCol[i * 3 + 1] = lColB.g; tipCol[i * 3 + 2] = lColB.b;
        for (var q = 0; q < BP; q++) {
          var u = (q + beamFlow) / BP, o = (i * BP + q) * 3;
          bPos[o] = from.x + (to.x - from.x) * u; bPos[o + 1] = from.y + (to.y - from.y) * u; bPos[o + 2] = from.z + (to.z - from.z) * u;
          bCol[o] = lColA.r + (lColB.r - lColA.r) * u; bCol[o + 1] = lColA.g + (lColB.g - lColA.g) * u; bCol[o + 2] = lColA.b + (lColB.b - lColA.b) * u;
        }
      });
      cGeo.attributes.position.needsUpdate = true; cGeo.attributes.color.needsUpdate = true;
      tGeo.attributes.position.needsUpdate = true; tGeo.attributes.color.needsUpdate = true;
      bGeo.attributes.position.needsUpdate = true; bGeo.attributes.color.needsUpdate = true;
    };
    var lastLinkT = 0;

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

      brain.animate(t);
      stars.rotation.z = t * 0.01;

      // Intro: the core grows and the shells fly out.
      var p = reduceMotion ? 1 : Math.min(1, (now - t0) / 1800), e = 1 - Math.pow(1 - p, 3);
      core.scale.setScalar(0.6 + 0.4 * e);
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

      var linkDt = Math.max(0, Math.min(0.05, t - lastLinkT)); lastLinkT = t;
      updateLinks(linkDt);
      rx += (my * 0.25 - rx) * 0.05;
      ry += (mx * 0.4 - ry) * 0.05;
      world.rotation.x = rx; world.rotation.y = ry;
      renderer.render(scene, camera);
    }
    tick();
    canvas.classList.add('ready');
  }

  // A rippling "amoeba" neural network: glowing neurons on three layers, wired
  // by rainbow synapses, with signals travelling from neuron to neuron.
  function buildNeural(THREE) {
    var root = new THREE.Group();
    var palette = ['#ff6fae', '#ff7a59', '#f2b660', '#9be15d', '#5cc8ff', '#a78bfa'].map(function (h) { return new THREE.Color(h); });
    var tmp = new THREE.Color(), tmp2 = new THREE.Color();
    var rainbow = function (u, out) {
      u = Math.max(0, Math.min(palette.length - 1.001, u * (palette.length - 1)));
      var a = Math.floor(u);
      return out.copy(palette[a]).lerp(palette[a + 1], u - a);
    };
    // soft round sprite so points render as glowing dots, not squares
    var dot = (function () {
      var c = document.createElement('canvas'); c.width = c.height = 64;
      var g = c.getContext('2d'), grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.35, 'rgba(255,255,255,0.85)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
      return new THREE.CanvasTexture(c);
    })();
    var ripple = function (x, y, z, r, t) {
      return r * (1 + 0.09 * Math.sin(x * 3 + t * 1.3) * Math.cos(y * 4 - t * 0.9) + 0.05 * Math.sin(z * 5 + t * 1.7));
    };
    var fib = function (i, n, out, phase) {
      var y = 1 - ((i + 0.5) / n) * 2, r = Math.sqrt(1 - y * y), th = i * 2.399963 + (phase || 0);
      out[0] = Math.cos(th) * r; out[1] = y; out[2] = Math.sin(th) * r;
      return out;
    };

    // neurons on three layers
    var layers = [{ n: 230, r: 2.15 }, { n: 110, r: 1.45 }, { n: 36, r: 0.75 }];
    var dir = [], rad = [], layerOf = [], v = [0, 0, 0];
    layers.forEach(function (L, li) {
      for (var i = 0; i < L.n; i++) { fib(i, L.n, v, li * 1.3); dir.push(v[0], v[1], v[2]); rad.push(L.r); layerOf.push(li); }
    });
    var NN = rad.length, nPos = new Float32Array(NN * 3), nCol = new Float32Array(NN * 3);
    for (var i = 0; i < NN; i++) {
      rainbow((dir[i * 3 + 1] + 1) / 2 + 0.06 * Math.sin(Math.atan2(dir[i * 3 + 2], dir[i * 3]) * 2), tmp);
      nCol[i * 3] = tmp.r; nCol[i * 3 + 1] = tmp.g; nCol[i * 3 + 2] = tmp.b;
    }
    var nGeo = new THREE.BufferGeometry();
    nGeo.setAttribute('position', new THREE.BufferAttribute(nPos, 3));
    nGeo.setAttribute('color', new THREE.BufferAttribute(nCol, 3));
    var nMat = new THREE.PointsMaterial({ size: 0.16, map: dot, vertexColors: true, transparent: true, depthWrite: false, alphaTest: 0.02 });
    root.add(new THREE.Points(nGeo, nMat));

    // synapses: each neuron links to its nearest neighbours on the same layer
    // and to the closest neuron on the next layer in
    var edges = [], seen = {};
    var link = function (a, b) { var k = a < b ? a + '_' + b : b + '_' + a; if (!seen[k]) { seen[k] = 1; edges.push(a, b); } };
    var dotDir = function (a, b) { return dir[a * 3] * dir[b * 3] + dir[a * 3 + 1] * dir[b * 3 + 1] + dir[a * 3 + 2] * dir[b * 3 + 2]; };
    for (var a = 0; a < NN; a++) {
      var same = [], inner = -1, innerBest = -2;
      for (var b = 0; b < NN; b++) {
        if (a === b) continue;
        var d = dotDir(a, b);
        if (layerOf[b] === layerOf[a]) same.push([d, b]);
        else if (layerOf[b] === layerOf[a] + 1 && d > innerBest) { innerBest = d; inner = b; }
      }
      same.sort(function (p, q) { return q[0] - p[0]; });
      for (var k = 0; k < 3 && k < same.length; k++) link(a, same[k][1]);
      if (inner >= 0) link(a, inner);
    }
    var E = edges.length / 2, ePos = new Float32Array(E * 6), eCol = new Float32Array(E * 6);
    for (var e = 0; e < E; e++) {
      var p = edges[e * 2], q = edges[e * 2 + 1];
      for (var c = 0; c < 3; c++) { eCol[e * 6 + c] = nCol[p * 3 + c]; eCol[e * 6 + 3 + c] = nCol[q * 3 + c]; }
    }
    var eGeo = new THREE.BufferGeometry();
    eGeo.setAttribute('position', new THREE.BufferAttribute(ePos, 3));
    eGeo.setAttribute('color', new THREE.BufferAttribute(eCol, 3));
    var eMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.35, depthWrite: false });
    root.add(new THREE.LineSegments(eGeo, eMat));

    // which synapses leave each neuron, so signals can hop onwards
    var adj = [];
    for (var n = 0; n < NN; n++) adj.push([]);
    for (var e2 = 0; e2 < E; e2++) { adj[edges[e2 * 2]].push([e2, edges[e2 * 2 + 1]]); adj[edges[e2 * 2 + 1]].push([e2, edges[e2 * 2]]); }

    // signals travelling along synapses
    var P = 110, pPos = new Float32Array(P * 3), pCol = new Float32Array(P * 3), pulses = [];
    for (var s = 0; s < P; s++) {
      var from = Math.floor(Math.random() * NN), hop = adj[from][Math.floor(Math.random() * adj[from].length)];
      pulses.push({ from: from, to: hop[1], k: Math.random(), speed: 0.7 + Math.random() * 0.9 });
    }
    var pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
    var pMat = new THREE.PointsMaterial({ size: 0.2, map: dot, vertexColors: true, transparent: true, depthWrite: false, alphaTest: 0.02 });
    root.add(new THREE.Points(pGeo, pMat));

    // faint amoeba skin
    var S = 1600, sPos = new Float32Array(S * 3), sDir = new Float32Array(S * 3), sCol = new Float32Array(S * 3);
    for (var j = 0; j < S; j++) {
      fib(j, S, v); sDir[j * 3] = v[0]; sDir[j * 3 + 1] = v[1]; sDir[j * 3 + 2] = v[2];
      rainbow((v[1] + 1) / 2, tmp); sCol[j * 3] = tmp.r; sCol[j * 3 + 1] = tmp.g; sCol[j * 3 + 2] = tmp.b;
    }
    var sGeo = new THREE.BufferGeometry();
    sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
    sGeo.setAttribute('color', new THREE.BufferAttribute(sCol, 3));
    var sMat = new THREE.PointsMaterial({ size: 0.035, vertexColors: true, transparent: true, opacity: 0.45, depthWrite: false });
    root.add(new THREE.Points(sGeo, sMat));

    var lastT = 0;
    var place = function (i, t, out, o) {
      var x = dir[i * 3], y = dir[i * 3 + 1], z = dir[i * 3 + 2], d = ripple(x, y, z, rad[i], t);
      out[o] = x * d; out[o + 1] = y * d; out[o + 2] = z * d;
    };
    return {
      root: root,
      dot: dot,
      outerCount: layers[0].n,
      // world-space position of a neuron
      nodeWorld: function (i, out) { out.set(nPos[i * 3], nPos[i * 3 + 1], nPos[i * 3 + 2]); return root.localToWorld(out); },
      nodeColor: function (i, out) { return out.setRGB(nCol[i * 3], nCol[i * 3 + 1], nCol[i * 3 + 2]); },
      // the outer neuron closest to a world-space point
      nearestOuter: function (worldPos) {
        var p = root.worldToLocal(worldPos.clone()), best = 0, bd = Infinity;
        for (var i = 0; i < layers[0].n; i++) {
          var dx = nPos[i * 3] - p.x, dy = nPos[i * 3 + 1] - p.y, dz = nPos[i * 3 + 2] - p.z, d = dx * dx + dy * dy + dz * dz;
          if (d < bd) { bd = d; best = i; }
        }
        return best;
      },
      theme: function (isDark) {
        eMat.opacity = isDark ? 0.32 : 0.5;
        sMat.opacity = isDark ? 0.45 : 0.6;
      },
      animate: function (t) {
        var dt = Math.max(0, Math.min(0.05, t - lastT)); lastT = t;
        for (var i = 0; i < NN; i++) place(i, t, nPos, i * 3);
        nGeo.attributes.position.needsUpdate = true;
        for (var e = 0; e < E; e++) {
          var a = edges[e * 2] * 3, b = edges[e * 2 + 1] * 3;
          ePos[e * 6] = nPos[a]; ePos[e * 6 + 1] = nPos[a + 1]; ePos[e * 6 + 2] = nPos[a + 2];
          ePos[e * 6 + 3] = nPos[b]; ePos[e * 6 + 4] = nPos[b + 1]; ePos[e * 6 + 5] = nPos[b + 2];
        }
        eGeo.attributes.position.needsUpdate = true;
        for (var s = 0; s < P; s++) {
          var pl = pulses[s];
          pl.k += pl.speed * dt;
          if (pl.k >= 1) {
            var next = adj[pl.to][Math.floor(Math.random() * adj[pl.to].length)];
            pl.from = pl.to; pl.to = next[1]; pl.k -= 1;
          }
          var f = pl.from * 3, g = pl.to * 3, k = pl.k;
          pPos[s * 3] = nPos[f] + (nPos[g] - nPos[f]) * k;
          pPos[s * 3 + 1] = nPos[f + 1] + (nPos[g + 1] - nPos[f + 1]) * k;
          pPos[s * 3 + 2] = nPos[f + 2] + (nPos[g + 2] - nPos[f + 2]) * k;
          // signals glow brighter than the neurons they travel between
          tmp.setRGB(nCol[f], nCol[f + 1], nCol[f + 2]).lerp(tmp2.setRGB(nCol[g], nCol[g + 1], nCol[g + 2]), k).lerp(tmp2.set('#ffffff'), 0.45);
          pCol[s * 3] = tmp.r; pCol[s * 3 + 1] = tmp.g; pCol[s * 3 + 2] = tmp.b;
        }
        pGeo.attributes.position.needsUpdate = true;
        pGeo.attributes.color.needsUpdate = true;
        for (var j = 0; j < S; j++) {
          var x = sDir[j * 3], y = sDir[j * 3 + 1], z = sDir[j * 3 + 2], d = ripple(x, y, z, 2.3, t);
          sPos[j * 3] = x * d; sPos[j * 3 + 1] = y * d; sPos[j * 3 + 2] = z * d;
        }
        sGeo.attributes.position.needsUpdate = true;
        root.rotation.y = t * 0.12;
        root.rotation.x = 0.15 * Math.sin(t * 0.2);
      }
    };
  }

  // The rainbow particle globe on the left of the Stack section, with particle
  // streams flowing out of it across the section.
  function initStackGlobe(canvas) {
    var renderer;
    try { renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true }); } catch (e) { return; }
    renderer.setPixelRatio(Math.min((window.devicePixelRatio || 1) * pageZoom(), 2.5));
    var scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    var globe = new THREE.Group(); scene.add(globe);
    var hw = 5, dir = 1, gScale = 0.62, pxPerUnit = 150;
    var fit = function () {
      var w = canvas.clientWidth || 1440, h = canvas.clientHeight || 900, aspect = w / h;
      var narrow = w < 700;
      camera.position.set(0, 0, narrow ? 7.5 : 9);
      camera.aspect = aspect; camera.updateProjectionMatrix();
      var hh = Math.tan(THREE.MathUtils.degToRad(20)) * camera.position.z;
      hw = hh * aspect;
      // Size and place the globe in pixels so it sits in the empty left column
      // (above the rows on phones) whatever the section height.
      var px = h / (2 * hh);
      pxPerUnit = px;
      var radiusPx = narrow ? Math.min(90, w * 0.22) : Math.min(150, w * 0.1);
      var cx = narrow ? w - radiusPx - 24 : 80 + radiusPx + 10;
      var cy = narrow ? radiusPx + 60 : h * 0.4;
      gScale = radiusPx / (3.3 * px);
      globe.scale.setScalar(gScale);
      dir = narrow ? -1 : 1;
      globe.position.set((cx - w / 2) / px, (h / 2 - cy) / px, 0);
      renderer.setSize(w, h, false);
    };
    fit();
    if (window.ResizeObserver) new ResizeObserver(fit).observe(canvas);

    var palette = ['#ff6fae', '#ff7a59', '#f2b660', '#9be15d', '#5cc8ff', '#a78bfa'].map(function (h) { return new THREE.Color(h); });
    var tmp = new THREE.Color(), bg = new THREE.Color();
    var rainbow = function (u, out) {
      u = Math.max(0, Math.min(palette.length - 1.001, u * (palette.length - 1)));
      var a = Math.floor(u);
      return out.copy(palette[a]).lerp(palette[a + 1], u - a);
    };

    // globe
    var N = 4200, R = 2.1, base = new Float32Array(N * 3), pos = new Float32Array(N * 3);
    for (var i = 0; i < N; i++) {
      var y = 1 - (i / (N - 1)) * 2, r = Math.sqrt(1 - y * y), th = i * 2.399963;
      base[i * 3] = Math.cos(th) * r; base[i * 3 + 1] = y; base[i * 3 + 2] = Math.sin(th) * r;
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    var cols = new Float32Array(N * 3);
    for (var j = 0; j < N; j++) {
      rainbow((base[j * 3 + 1] + 1) / 2 + 0.07 * Math.sin(Math.atan2(base[j * 3 + 2], base[j * 3]) * 2), tmp);
      cols[j * 3] = tmp.r; cols[j * 3 + 1] = tmp.g; cols[j * 3 + 2] = tmp.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    var core = new THREE.Group(); globe.add(core);
    var globeMat = new THREE.PointsMaterial({ size: 0.045, vertexColors: true, transparent: true, depthWrite: false });
    core.add(new THREE.Points(geo, globeMat));
    var icoMat = new THREE.MeshBasicMaterial({ wireframe: true, transparent: true, opacity: 0.25, depthWrite: false });
    var ico = new THREE.Mesh(new THREE.IcosahedronGeometry(1.15, 1), icoMat); core.add(ico);

    // a tilted ring of particles around the globe
    var RN = 900, rPos = new Float32Array(RN * 3), rCol = new Float32Array(RN * 3);
    for (var k = 0; k < RN; k++) {
      var ang = (k / RN) * Math.PI * 2, rad = 3.0 + 0.25 * Math.sin(k * 12.9898) * Math.sin(k * 3.1);
      rPos[k * 3] = Math.cos(ang) * rad; rPos[k * 3 + 1] = 0.08 * Math.sin(k * 7.7); rPos[k * 3 + 2] = Math.sin(ang) * rad;
      rainbow(k / RN, tmp); rCol[k * 3] = tmp.r; rCol[k * 3 + 1] = tmp.g; rCol[k * 3 + 2] = tmp.b;
    }
    var ringGeo = new THREE.BufferGeometry();
    ringGeo.setAttribute('position', new THREE.BufferAttribute(rPos, 3));
    ringGeo.setAttribute('color', new THREE.BufferAttribute(rCol, 3));
    var ringMat = new THREE.PointsMaterial({ size: 0.035, vertexColors: true, transparent: true, opacity: 0.8, depthWrite: false });
    var ring = new THREE.Points(ringGeo, ringMat);
    ring.rotation.set(1.2, 0, 0.35); globe.add(ring);

    // particle streams flowing from the globe across the section
    var SN = 3600, LANES = 9;
    var sPos = new Float32Array(SN * 3), sCol = new Float32Array(SN * 3), sBase = new Float32Array(SN * 3);
    var prog = new Float32Array(SN), lane = new Float32Array(SN), jit = new Float32Array(SN * 2), speed = new Float32Array(SN);
    for (var q = 0; q < SN; q++) {
      prog[q] = Math.random(); lane[q] = q % LANES; speed[q] = 0.035 + Math.random() * 0.04;
      jit[q * 2] = (Math.random() - 0.5) * 0.35; jit[q * 2 + 1] = (Math.random() - 0.5) * 0.35;
      rainbow(lane[q] / (LANES - 1), tmp); sBase[q * 3] = tmp.r; sBase[q * 3 + 1] = tmp.g; sBase[q * 3 + 2] = tmp.b;
    }
    var streamGeo = new THREE.BufferGeometry();
    streamGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
    streamGeo.setAttribute('color', new THREE.BufferAttribute(sCol, 3));
    var streamMat = new THREE.PointsMaterial({ size: 0.04, vertexColors: true, transparent: true, depthWrite: false });
    scene.add(new THREE.Points(streamGeo, streamMat));

    // only animate while the section is on screen
    var visible = true;
    if (window.IntersectionObserver) new IntersectionObserver(function (en) { visible = en[0].isIntersecting; }).observe(canvas);
    var t0 = performance.now(), last = t0;
    var tick = function () {
      requestAnimationFrame(tick);
      if (!visible || document.hidden) return;
      var now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now;
      var t = reduceMotion ? 0 : (now - t0) / 1000;
      var dark = isDark();
      bg.set(dark ? '#0d0e11' : '#f6f4ef');
      icoMat.color.set(dark ? '#ecebe6' : '#16171a');
      for (var i = 0; i < N; i++) {
        var bx = base[i * 3], by = base[i * 3 + 1], bz = base[i * 3 + 2];
        var d = R * (1 + 0.09 * Math.sin(bx * 3 + t * 1.3) * Math.cos(by * 4 - t * 0.9) + 0.05 * Math.sin(bz * 5 + t * 1.7));
        pos[i * 3] = bx * d; pos[i * 3 + 1] = by * d; pos[i * 3 + 2] = bz * d;
      }
      geo.attributes.position.needsUpdate = true;
      core.rotation.y = t * 0.12;
      ico.rotation.x = t * 0.25; ico.rotation.y = -t * 0.18;
      ring.rotation.z = 0.35 + t * 0.05;
      // keep particles fine-grained however small the globe is drawn
      globeMat.size = 0.045 * gScale / 0.62;
      ringMat.size = globeMat.size * 0.78;
      streamMat.size = 0.04 * 150 / pxPerUnit;

      // streams start at the globe's edge and fan out towards the right
      // streams leave the globe towards the open side: right on desktop, left on phones
      var sx = globe.position.x + dir * 1.9 * globe.scale.x, gy = globe.position.y;
      var span = dir > 0 ? hw - sx + 1.2 : sx + hw + 1.2;
      for (var p = 0; p < SN; p++) {
        if (!reduceMotion) { prog[p] += speed[p] * dt; if (prog[p] > 1) prog[p] -= 1; }
        var u = prog[p], L = lane[p] - (LANES - 1) / 2;
        sPos[p * 3] = sx + dir * u * span;
        sPos[p * 3 + 1] = gy + L * 0.42 * u * 1.6 + Math.sin(u * 7 + L * 0.9 - t * 0.8) * (0.25 + 0.6 * u) + jit[p * 2] * u;
        sPos[p * 3 + 2] = Math.cos(u * 5 + L) * 0.6 * u + jit[p * 2 + 1];
        var fade = Math.pow(1 - u, 1.4) * Math.min(1, u * 12);
        tmp.setRGB(sBase[p * 3], sBase[p * 3 + 1], sBase[p * 3 + 2]).lerp(bg, 1 - fade);
        sCol[p * 3] = tmp.r; sCol[p * 3 + 1] = tmp.g; sCol[p * 3 + 2] = tmp.b;
      }
      streamGeo.attributes.position.needsUpdate = true;
      streamGeo.attributes.color.needsUpdate = true;
      renderer.render(scene, camera);
    };
    tick();
    canvas.classList.add('ready');
  }
})();
