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

  /* ---------- Hero: developer surrounded by the orbiting stack ---------- */
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
      var aspect = w / h, reach = 5.9, tanHalf = Math.tan(THREE.MathUtils.degToRad(20));
      camera.position.set(0, 0, Math.max(reach / tanHalf, reach / (tanHalf * aspect)));
      renderer.setSize(w, h, false);
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
    }
    fit();

    var world = new THREE.Group(); scene.add(world);
    var core = new THREE.Group(); world.add(core);

    // The developer at the centre of the orbits.
    scene.add(new THREE.HemisphereLight(0xffffff, 0x3a4256, 1.05));
    var sun = new THREE.DirectionalLight(0xffffff, 1.1); sun.position.set(3, 5, 6); scene.add(sun);
    var dev = buildDev(THREE);
    dev.root.rotation.set(0.1, -0.3, 0);
    dev.root.scale.setScalar(3.1);
    core.add(dev.root);

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
      dev.theme(dark);
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

      dev.animate(t);
      dev.root.position.y = -1.55 + 0.1 * Math.sin(t * 1.2);
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

      rx += (my * 0.25 - rx) * 0.05;
      ry += (mx * 0.4 - ry) * 0.05;
      world.rotation.x = rx; world.rotation.y = ry;
      renderer.render(scene, camera);
    }
    tick();
    canvas.classList.add('ready');
  }

  // A bearded developer sitting cross-legged with a laptop on his lap, typing
  // with one hand and resting his chin on the other. Built from primitives,
  // so there is no 3D model file to download.
  function buildDev(THREE) {
    var V = function (x, y, z) { return new THREE.Vector3(x, y, z); };
    var mat = function (c, extra) { return new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.65, metalness: 0.02 }, extra || {})); };
    var root = new THREE.Group();
    var add = function (parent, geo, m, x, y, z) { var mesh = new THREE.Mesh(geo, m); mesh.position.set(x, y, z); parent.add(mesh); return mesh; };
    var skin = mat('#e3b08c'), hairM = mat('#3b2a1f', { roughness: 0.9 }), beardM = mat('#4a3526', { roughness: 0.95 });
    var sweater = mat('#86acd6', { roughness: 0.9 }), pants = mat('#3d4555', { roughness: 0.85 });
    var shoe = mat('#ee8a2a'), sole = mat('#f4f1ea'), white = mat('#ffffff'), iris = mat('#4a6b8a'), pupil = mat('#15171c');
    var lip = mat('#c2544d'), silver = mat('#cfd2d8', { metalness: 0.5, roughness: 0.3 }), keys = mat('#2a2c33');
    var UP = V(0, 1, 0);

    // A limb is a tapered cylinder between two points with a rounded joint at the end.
    var limb = function (r, m, r2) {
      var shaft = new THREE.Mesh(new THREE.CylinderGeometry(r2 || r * 0.9, r, 1, 18), m);
      var joint = new THREE.Mesh(new THREE.SphereGeometry(r2 || r * 0.9, 18, 12), m);
      root.add(shaft); root.add(joint);
      return function (a, b) {
        var d = b.clone().sub(a), len = d.length();
        shaft.position.copy(a).addScaledVector(d, 0.5);
        shaft.scale.set(1, len, 1);
        shaft.quaternion.setFromUnitVectors(UP, d.normalize());
        joint.position.copy(b);
      };
    };

    // soft shadow so he feels grounded while floating
    var shadow = add(root, new THREE.CircleGeometry(0.62, 40), new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.18, depthWrite: false }), 0, -0.2, 0.15);
    shadow.rotation.x = -Math.PI / 2; shadow.scale.set(1, 0.7, 1);

    // hips and crossed legs
    add(root, new THREE.SphereGeometry(0.2, 24, 16), pants, 0, 0.02, -0.02).scale.set(1.4, 0.55, 1.05);
    [-1, 1].forEach(function (s) {
      var hip = V(s * 0.13, 0.02, 0.02), knee = V(s * 0.4, 0.04, 0.26), ankle = V(-s * 0.13, -0.05, s > 0 ? 0.36 : 0.24);
      limb(0.105, pants)(hip, knee);
      limb(0.088, pants)(knee, ankle);
      // sneaker pointing outward past the opposite knee
      var foot = new THREE.Group(); foot.position.set(-s * 0.3, -0.08, s > 0 ? 0.38 : 0.26); foot.rotation.y = -s * 1.35; root.add(foot);
      add(foot, new THREE.CapsuleGeometry(0.055, 0.16, 6, 12), shoe, 0, 0.015, 0).rotation.x = Math.PI / 2;
      add(foot, new THREE.BoxGeometry(0.13, 0.03, 0.27), sole, 0, -0.035, 0);
      add(foot, new THREE.SphereGeometry(0.058, 14, 10), sole, 0, -0.005, 0.1).scale.set(1.05, 0.55, 0.8);
      for (var l = 0; l < 3; l++) add(foot, new THREE.BoxGeometry(0.07, 0.008, 0.012), white, 0, 0.07, -0.03 + l * 0.035);
    });

    // torso and neck
    var torso = add(root, new THREE.CapsuleGeometry(0.2, 0.3, 8, 20), sweater, 0, 0.42, -0.05);
    torso.scale.set(1.5, 1, 0.92); torso.rotation.x = 0.1;
    add(root, new THREE.TorusGeometry(0.085, 0.025, 8, 20), sweater, 0, 0.68, -0.03).rotation.x = Math.PI / 2;
    add(root, new THREE.CylinderGeometry(0.075, 0.082, 0.14, 16), skin, 0, 0.73, -0.03);

    // head: big expressive eyes, full beard, swept-up hair
    var head = new THREE.Group(); head.position.set(0, 0.91, -0.01); root.add(head);
    add(head, new THREE.SphereGeometry(0.2, 30, 24), skin, 0, 0, 0).scale.set(0.95, 1.1, 1);
    add(head, new THREE.SphereGeometry(0.16, 24, 18), skin, 0, -0.08, 0.03).scale.set(0.95, 0.78, 0.97);
    add(head, new THREE.SphereGeometry(0.04, 14, 12), skin, 0, -0.02, 0.2).scale.set(0.85, 1, 1.1);
    [-1, 1].forEach(function (s) { add(head, new THREE.SphereGeometry(0.05, 12, 10), skin, s * 0.19, -0.01, 0).scale.set(0.45, 1, 0.75); });
    var eyes = new THREE.Group(); head.add(eyes);
    var irises = [];
    [-1, 1].forEach(function (s) {
      add(eyes, new THREE.SphereGeometry(0.042, 16, 12), white, s * 0.075, 0.03, 0.155).scale.set(1, 1.2, 0.8);
      var ir = new THREE.Group(); ir.position.set(s * 0.075, 0.03, 0.188); eyes.add(ir);
      add(ir, new THREE.SphereGeometry(0.022, 12, 10), iris, 0, 0, 0).scale.set(1, 1, 0.5);
      add(ir, new THREE.SphereGeometry(0.012, 10, 8), pupil, 0, 0, 0.008).scale.set(1, 1, 0.5);
      irises.push(ir);
      var brow = add(head, new THREE.CapsuleGeometry(0.014, 0.06, 4, 8), hairM, s * 0.08, 0.1, 0.17);
      brow.rotation.z = Math.PI / 2 - s * 0.18;
    });
    // hair: short sides with a swept-up quiff
    var cap = add(head, new THREE.SphereGeometry(0.212, 30, 16, 0, Math.PI * 2, 0, Math.PI * 0.55), hairM, 0, 0.03, -0.01);
    cap.scale.set(0.97, 1.12, 1.05); cap.rotation.x = -0.4;
    
    // baseball cap with headphones over it
    var capM = mat('#6d4fd8', { roughness: 0.8 }), phonesM = mat('#2a2c33', { roughness: 0.4, metalness: 0.3 }), cushion = mat('#5cc8ff', { roughness: 0.7 });
    var hat = add(head, new THREE.SphereGeometry(0.222, 30, 16, 0, Math.PI * 2, 0, Math.PI * 0.5), capM, 0, 0.06, -0.005);
    hat.scale.set(0.98, 0.95, 1.04); hat.rotation.x = -0.12;
    add(head, new THREE.CylinderGeometry(0.218, 0.222, 0.03, 30, 1, true), capM, 0, 0.06, -0.005).rotation.x = -0.12;
    var brim = add(head, new THREE.CylinderGeometry(0.17, 0.17, 0.014, 28, 1, false, -Math.PI / 2, Math.PI), capM, 0, 0.065, 0.14);
    brim.scale.set(1, 1, 0.85); brim.rotation.x = 0.18;
    add(head, new THREE.SphereGeometry(0.018, 10, 8), capM, 0, 0.27, -0.03);
    add(head, new THREE.TorusGeometry(0.245, 0.02, 10, 36, Math.PI), phonesM, 0, 0.03, -0.02);
    [-1, 1].forEach(function (s) {
      var cup = add(head, new THREE.CylinderGeometry(0.07, 0.07, 0.055, 22), phonesM, s * 0.215, -0.01, -0.01); cup.rotation.z = Math.PI / 2;
      var pad = add(head, new THREE.CylinderGeometry(0.058, 0.058, 0.02, 22), cushion, s * 0.186, -0.01, -0.01); pad.rotation.z = Math.PI / 2;
    });
    // full beard and moustache
    var beard = add(head, new THREE.SphereGeometry(0.163, 26, 16, 0, Math.PI * 2, Math.PI * 0.6, Math.PI * 0.4), beardM, 0, -0.085, 0.03);
    beard.scale.set(0.99, 0.82, 0.99);
    [-1, 1].forEach(function (s) { var m = add(head, new THREE.CapsuleGeometry(0.011, 0.04, 4, 8), beardM, s * 0.03, -0.062, 0.19); m.rotation.z = Math.PI / 2 + s * 0.2; });
    add(head, new THREE.CapsuleGeometry(0.011, 0.04, 4, 8), lip, 0, -0.088, 0.183).rotation.z = Math.PI / 2;

    // laptop on his lap: code on the screen facing him, glowing logo on the back
    var laptop = new THREE.Group(); laptop.position.set(0, 0.15, 0.3); laptop.rotation.x = 0.08; root.add(laptop);
    add(laptop, new THREE.BoxGeometry(0.44, 0.02, 0.3), silver, 0, 0, 0);
    add(laptop, new THREE.BoxGeometry(0.38, 0.004, 0.12), keys, 0, 0.012, -0.04);
    var lid = new THREE.Group(); lid.position.set(0, 0.01, 0.15); lid.rotation.x = 0.3; laptop.add(lid);
    add(lid, new THREE.BoxGeometry(0.44, 0.29, 0.014), silver, 0, 0.145, 0);
    var screenCanvas = document.createElement('canvas'); screenCanvas.width = 512; screenCanvas.height = 320;
    var screenTex = new THREE.CanvasTexture(screenCanvas);
    add(lid, new THREE.PlaneGeometry(0.4, 0.255), new THREE.MeshBasicMaterial({ map: screenTex }), 0, 0.145, -0.008).rotation.y = Math.PI;
    var logoCanvas = document.createElement('canvas'); logoCanvas.width = 128; logoCanvas.height = 128;
    var lc = logoCanvas.getContext('2d');
    lc.strokeStyle = '#5cc8ff'; lc.lineWidth = 12; lc.lineCap = 'round'; lc.lineJoin = 'round';
    lc.beginPath(); lc.moveTo(44, 36); lc.lineTo(16, 64); lc.lineTo(44, 92); lc.moveTo(84, 36); lc.lineTo(112, 64); lc.lineTo(84, 92); lc.moveTo(74, 26); lc.lineTo(54, 102); lc.stroke();
    var logoMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(logoCanvas), transparent: true });
    add(lid, new THREE.PlaneGeometry(0.11, 0.11), logoMat, 0, 0.145, 0.008);
    var glow = new THREE.PointLight('#9ad1ff', 0.6, 1.3); glow.position.set(0, 0.5, 0.2); root.add(glow);
    var lines = [[0, 60, '#a78bfa'], [70, 110, '#5cc8ff'], [30, 90, '#ff6fae'], [130, 70, '#f2b660'], [30, 150, '#9be15d'], [30, 80, '#5cc8ff'], [120, 90, '#ff6fae'], [0, 40, '#a78bfa']];
    var shown = -1;
    var drawScreen = function (count) {
      var c = screenCanvas.getContext('2d');
      c.fillStyle = '#1e1f26'; c.fillRect(0, 0, 512, 320);
      c.fillStyle = '#2a2c33'; c.fillRect(0, 0, 512, 36);
      ['#ff7a59', '#f2b660', '#9be15d'].forEach(function (col, i) { c.fillStyle = col; c.beginPath(); c.arc(24 + i * 22, 18, 7, 0, Math.PI * 2); c.fill(); });
      for (var i = 0; i < count && i < lines.length; i++) { var l = lines[i]; c.fillStyle = l[2]; c.beginPath(); c.roundRect(28 + l[0], 60 + i * 30, l[1] * 1.6, 14, 7); c.fill(); }
      c.fillStyle = '#ecebe6';
      if (count <= lines.length) c.fillRect(30, 56 + Math.min(count, lines.length) * 30, 5, 22);
      screenTex.needsUpdate = true;
    };

    // arms: one hand types, the other rests under his chin
    var mkArm = function (s) {
      add(root, new THREE.SphereGeometry(0.1, 16, 12), sweater, s * 0.31, 0.62, -0.05);
      return { upper: limb(0.078, sweater), fore: limb(0.068, sweater, 0.058), hand: add(root, new THREE.SphereGeometry(0.052, 16, 12), skin, 0, 0, 0) };
    };
    var typing = mkArm(-1), thinking = mkArm(1);
    typing.hand.scale.set(1.1, 0.7, 1.3);
    thinking.hand.scale.set(1, 1.1, 0.95);

    return {
      root: root,
      theme: function (isDark) { shadow.material.opacity = isDark ? 0.35 : 0.14; },
      animate: function (t) {
        // typing hand
        var tap = 0.012 * Math.max(0, Math.sin(t * 15));
        var th = V(-0.07, 0.19 + tap, 0.28), te = V(-0.36, 0.34, 0.1);
        typing.upper(V(-0.31, 0.62, -0.05), te);
        typing.fore(te, te.clone().lerp(th, 0.85));
        typing.hand.position.copy(th);
        // thinking hand under the chin, tapping now and then
        var chinTap = 0.008 * Math.max(0, Math.sin(t * 3.2));
        var ch = V(0.05, 0.7 + chinTap, 0.17), ce = V(0.3, 0.36, 0.24);
        thinking.upper(V(0.31, 0.62, -0.05), ce);
        thinking.fore(ce, ce.clone().lerp(ch, 0.86));
        thinking.hand.position.copy(ch);
        // head tilts as he thinks, eyes glance up and back to the screen
        var look = 0.5 + 0.5 * Math.sin(t * 0.7);
        head.rotation.x = -0.06 + 0.12 * (1 - look);
        head.rotation.z = -0.06 + 0.04 * Math.sin(t * 0.5);
        head.rotation.y = 0.08 * Math.sin(t * 0.4);
        irises.forEach(function (ir) { ir.position.y = 0.03 + 0.012 * (look - 0.5); ir.position.x = (ir.position.x > 0 ? 0.075 : -0.075) + 0.006; });
        eyes.scale.y = (t % 4.5) < 0.12 ? 0.15 : 1;
        torso.scale.y = 1 + 0.015 * Math.sin(t * 2);
        logoMat.opacity = 0.65 + 0.35 * Math.sin(t * 2.6);
        glow.intensity = 0.55 + 0.1 * Math.sin(t * 3);
        var n = Math.floor(t * 3) % (lines.length + 4);
        if (n !== shown) { shown = n; drawScreen(n); }
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
