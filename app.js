/* ═══════════════════════════════════════════════════════════════
   MOBA-INOX | app.js
   Capas: configuración, utilidades, preloader, scroll suave,
   navegación, hero, animaciones por scroll, galería, formulario.
   Todo degrada con gracia: si GSAP/Lenis no cargan, la página
   sigue siendo completa y legible (sin la clase html.motion).
   ═══════════════════════════════════════════════════════════════ */
(() => {
    'use strict';

    /* ───────── 1. CONFIGURACIÓN (único lugar para cambiar datos del cliente) ───────── */
    const CONFIG = {
        whatsapp: '527714054500',   // 52 + número a 10 dígitos, sin signos
        brand: 'MOBA-INOX'
    };

    /* ───────── 2. UTILIDADES ───────── */
    const $ = (sel, ctx = document) => ctx.querySelector(sel);
    const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
    const root = document.documentElement;
    const body = document.body;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const hasGsap = Boolean(window.gsap && window.ScrollTrigger);
    const motion = hasGsap && !reduceMotion;

    const rand = (min, max) => min + Math.random() * (max - min);
    const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

    /* clip-path animado con números explícitos.
       GSAP interpola mal "inset(...)" porque el navegador abrevia el valor calculado
       (p. ej. "34% 27%"), lo que hacía que la imagen se abriera de forma asimétrica. */
    const insetCss = (v) => `inset(${v.t}% ${v.r}% ${v.b}% ${v.l}% round ${v.rad}px)`;
    const insetProxy = (a) => ({ t: a[0], r: a[1], b: a[2], l: a[3], rad: a[4] });
    function tweenInset(el, from, to, vars) {
        const p = insetProxy(from);
        el.style.clipPath = insetCss(p);
        return gsap.to(p, Object.assign({ t: to[0], r: to[1], b: to[2], l: to[3], rad: to[4], onUpdate: () => { el.style.clipPath = insetCss(p); } }, vars));
    }

    const waLink = (msg) => `https://wa.me/${CONFIG.whatsapp}` + (msg ? `?text=${encodeURIComponent(msg)}` : '');

    if (hasGsap) {
        gsap.registerPlugin(ScrollTrigger);
        ScrollTrigger.config({ ignoreMobileResize: true });
    }
    if (motion) root.classList.add('motion');

    /* Ejecuta una función en cada frame (ticker de GSAP o rAF si no hay GSAP) */
    const frameCallbacks = [];
    let rafStarted = false;
    function onFrame(fn) {
        if (hasGsap) { gsap.ticker.add(fn); return; }
        frameCallbacks.push(fn);
        if (!rafStarted) {
            rafStarted = true;
            const loop = (t) => { frameCallbacks.forEach((cb) => cb(t / 1000)); requestAnimationFrame(loop); };
            requestAnimationFrame(loop);
        }
    }

    /* ───────── 3. ENLACES DE WHATSAPP (mensaje prellenado por botón) ───────── */
    $$('[data-wa]').forEach((a) => { a.href = waLink(a.dataset.msg); });

    /* ───────── 4. PRELOADER ───────── */
    function runLoader() {
        return new Promise((resolve) => {
            const loader = $('#loader');
            if (!loader) { body.classList.remove('is-loading'); resolve(); return; }

            const num = $('#ld-num');
            const fill = $('#ld-fill');
            const MIN = reduceMotion ? 350 : 2500;     // duración mínima de la simulación
            const MAX = 9000;                          // seguro contra cargas lentas
            const t0 = performance.now();
            let loaded = document.readyState === 'complete';
            window.addEventListener('load', () => { loaded = true; }, { once: true });
            const easeOut = (p) => 1 - Math.pow(1 - p, 3);

            const tick = (now) => {
                const elapsed = now - t0;
                const cap = loaded ? 1 : 0.92;
                let p = Math.min(easeOut(Math.min(elapsed / MIN, 1)), cap);
                if (elapsed > MAX) p = 1;
                num.textContent = Math.round(p * 100);
                fill.style.transform = `scaleX(${p})`;
                if (p < 1) { requestAnimationFrame(tick); return; }
                finish();
            };

            const finish = () => {
                loader.classList.add('is-done');
                body.classList.remove('is-loading');
                // el hero arranca mientras las puertas se abren
                setTimeout(resolve, reduceMotion ? 0 : 520);
                setTimeout(() => loader.remove(), 1700);
            };

            requestAnimationFrame(tick);
        });
    }

    /* ───────── 5. SCROLL SUAVE (Lenis) ───────── */
    let lenis = null;
    function initSmoothScroll() {
        if (!window.Lenis || reduceMotion) return;
        lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.92, smoothWheel: true });
        lenis.stop();                                  // se libera al terminar el preloader
        if (hasGsap) {
            lenis.on('scroll', ScrollTrigger.update);
            gsap.ticker.add((time) => lenis.raf(time * 1000));
            gsap.ticker.lagSmoothing(0);
        } else {
            onFrame((t) => lenis.raf(t * 1000));
        }
    }

    const scrollToTarget = (target, offset = -76) => {
        if (lenis) lenis.scrollTo(target, { offset, duration: 1.7, easing: (t) => 1 - Math.pow(1 - t, 4) });
        else target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    };

    function initAnchors() {
        document.addEventListener('click', (e) => {
            const a = e.target.closest('a[href^="#"]');
            if (!a) return;
            const id = a.getAttribute('href');
            if (id.length < 2) return;
            const target = $(id);
            if (!target) return;
            e.preventDefault();
            closeMenu();
            // pequeño retraso para que el menú móvil termine de liberar el scroll
            setTimeout(() => scrollToTarget(target, id === '#inicio' || id === '#servicios' ? 0 : -76), 60);
        });
    }

    /* ───────── 6. NAVEGACIÓN ───────── */
    const nav = $('#nav');
    const burger = $('#burger');
    const menu = $('#menu');
    let menuOpen = false;

    function setMenu(open) {
        menuOpen = open;
        menu.classList.toggle('is-open', open);
        menu.setAttribute('aria-hidden', String(!open));
        burger.setAttribute('aria-expanded', String(open));
        burger.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
        body.classList.toggle('menu-open', open);
        if (lenis) (open ? lenis.stop() : lenis.start());
        else body.style.overflow = open ? 'hidden' : '';
    }
    function closeMenu() { if (menuOpen) setMenu(false); }

    function initNav() {
        burger.addEventListener('click', () => setMenu(!menuOpen));
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });
        window.matchMedia('(min-width: 1100px)').addEventListener('change', (e) => { if (e.matches) closeMenu(); });

        // Estado "pegado" (fondo de cristal): ScrollTrigger si hay GSAP, si no un centinela con IntersectionObserver
        if (hasGsap) {
            ScrollTrigger.create({
                start: 0, end: 'max',
                onUpdate: (self) => {
                    const y = self.scroll();
                    nav.classList.toggle('is-stuck', y > 40);
                    const hide = self.direction === 1 && y > 600 && !menuOpen;
                    nav.classList.toggle('is-hidden', hide);
                }
            });
        } else {
            const sentinel = document.createElement('div');
            sentinel.style.cssText = 'position:absolute;top:0;left:0;width:1px;height:60px;pointer-events:none';
            body.prepend(sentinel);
            new IntersectionObserver(([en]) => nav.classList.toggle('is-stuck', !en.isIntersecting)).observe(sentinel);
        }

        // Enlace activo según la sección visible
        const links = $$('.nav-links a');
        const map = new Map(links.map((a) => [a.getAttribute('href').slice(1), a]));
        const io = new IntersectionObserver((entries) => {
            entries.forEach((en) => {
                if (!en.isIntersecting) return;
                links.forEach((l) => l.classList.remove('is-current'));
                const link = map.get(en.target.id);
                if (link) link.classList.add('is-current');
            });
        }, { rootMargin: '-45% 0px -50% 0px' });
        map.forEach((_, id) => { const s = document.getElementById(id); if (s) io.observe(s); });
    }

    /* ───────── 7. DIVISIÓN DE TEXTO EN PALABRAS ───────── */
    function splitWords(el) {
        const walk = (node) => {
            Array.from(node.childNodes).forEach((child) => {
                if (child.nodeType === 3) {
                    const frag = document.createDocumentFragment();
                    child.textContent.split(/(\s+)/).forEach((part) => {
                        if (!part) return;
                        if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
                        const w = document.createElement('span'); w.className = 'w';
                        const wi = document.createElement('span'); wi.className = 'wi';
                        wi.textContent = part; w.appendChild(wi); frag.appendChild(w);
                    });
                    child.replaceWith(frag);
                } else if (child.nodeType === 1 && !child.classList.contains('w')) {
                    walk(child);
                }
            });
        };
        walk(el);
        return $$('.wi', el);
    }

    function splitManifesto(el) {
        const text = el.textContent.trim();
        el.textContent = '';
        text.split(/\s+/).forEach((word, i, arr) => {
            const s = document.createElement('span'); s.className = 'mw'; s.textContent = word;
            el.appendChild(s);
            if (i < arr.length - 1) el.appendChild(document.createTextNode(' '));
        });
        return $$('.mw', el);
    }

    /* ───────── 8. CAMPO DE PARTÍCULAS Y CHISPAS (canvas) ───────── */
    class SparkField {
        /* mode 'light': polvo de acero + chispas ámbar sobre fondo claro
           mode 'dark' : arco de soldadura TIG con chispas que rebotan */
        constructor(canvas, mode) {
            this.c = canvas;
            this.ctx = canvas.getContext('2d');
            this.mode = mode;
            this.motes = [];
            this.sparks = [];
            this.progress = 0.5;
            this.visible = false;
            this.last = 0;
            this.t = 0;
            this.burstIn = 0.8;
            this.tick = this.tick.bind(this);

            new ResizeObserver(() => this.resize()).observe(canvas);
            new IntersectionObserver(([en]) => { this.visible = en.isIntersecting; if (this.visible) this.start(); }).observe(canvas);
            document.addEventListener('visibilitychange', () => { if (!document.hidden && this.visible) this.start(); });
            this.resize();
        }
        resize() {
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            this.w = this.c.clientWidth; this.h = this.c.clientHeight;
            if (!this.w || !this.h) return;
            this.c.width = Math.round(this.w * dpr);
            this.c.height = Math.round(this.h * dpr);
            this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            const density = this.mode === 'light' ? 70 : 90;
            const n = Math.max(26, Math.round(density * Math.min(1, (this.w * this.h) / (1300 * 800))));
            this.motes = Array.from({ length: n }, () => this.mote(true));
            if (reduceMotion) this.draw();
        }
        mote(initial) {
            return {
                x: rand(0, this.w), y: initial ? rand(0, this.h) : this.h + 8,
                r: rand(0.7, 2.2), vx: rand(-9, 9), vy: -rand(6, 26), a: rand(0.18, 0.6), ph: rand(0, 6.28)
            };
        }
        burst() {
            // ráfaga de chispas en un punto de la zona visual del hero
            const zone = $('.hero-visual');
            const cr = this.c.getBoundingClientRect();
            let x = this.w * rand(0.55, 0.95), y = this.h * rand(0.25, 0.75);
            if (zone) {
                const r = zone.getBoundingClientRect();
                x = r.left - cr.left + r.width * rand(0.1, 0.95);
                y = r.top - cr.top + r.height * rand(0.1, 0.9);
            }
            const n = Math.round(rand(6, 12));
            for (let i = 0; i < n; i++) this.spark(x, y, 1);
        }
        spark(x, y, power) {
            if (this.sparks.length > 170) return;
            const ang = rand(-Math.PI, 0);
            const sp = rand(80, 330) * power;
            this.sparks.push({ x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, life: 0, max: rand(0.5, 1.3), bounce: 0 });
        }
        start() {
            if (reduceMotion || this.running) return;
            this.running = true; this.last = performance.now();
            requestAnimationFrame(this.tick);
        }
        tick(now) {
            if (!this.visible || document.hidden) { this.running = false; return; }
            const dt = Math.min((now - this.last) / 1000, 0.05);
            this.last = now; this.t += dt;
            this.update(dt);
            this.draw();
            requestAnimationFrame(this.tick);
        }
        update(dt) {
            for (const m of this.motes) {
                m.x += (m.vx + Math.sin(this.t + m.ph) * 6) * dt;
                m.y += m.vy * dt;
                if (m.y < -10 || m.x < -10 || m.x > this.w + 10) Object.assign(m, this.mote(false));
            }
            if (this.mode === 'light') {
                this.burstIn -= dt;
                if (this.burstIn <= 0) { this.burst(); this.burstIn = rand(1.1, 2.4); }
            } else {
                const ex = this.w * (0.16 + 0.68 * this.progress);
                const ey = this.h * 0.62;
                const rate = 46 * dt;
                const n = Math.floor(rate) + (Math.random() < rate % 1 ? 1 : 0);
                for (let i = 0; i < n; i++) this.spark(ex + rand(-6, 6), ey + rand(-4, 4), 1.15);
            }
            const floor = this.h * 0.72;
            for (let i = this.sparks.length - 1; i >= 0; i--) {
                const s = this.sparks[i];
                s.life += dt;
                s.vy += 560 * dt;
                s.x += s.vx * dt; s.y += s.vy * dt;
                if (this.mode === 'dark' && s.y > floor && s.vy > 0 && s.bounce < 2) { s.vy *= -0.38; s.vx *= 0.7; s.bounce++; }
                if (s.life > s.max) this.sparks.splice(i, 1);
            }
        }
        draw() {
            const { ctx, w, h } = this;
            ctx.clearRect(0, 0, w, h);
            const dark = this.mode === 'dark';
            ctx.globalCompositeOperation = dark ? 'lighter' : 'source-over';

            // red de puntos: líneas finas entre partículas cercanas
            const maxD = dark ? 90 : 120;
            for (let i = 0; i < this.motes.length; i++) {
                const a = this.motes[i];
                for (let j = i + 1; j < this.motes.length; j++) {
                    const b = this.motes[j];
                    const dx = a.x - b.x, dy = a.y - b.y;
                    const d2 = dx * dx + dy * dy;
                    if (d2 < maxD * maxD) {
                        const k = 1 - Math.sqrt(d2) / maxD;
                        ctx.strokeStyle = dark ? `rgba(120,190,230,${0.12 * k})` : `rgba(15,76,117,${0.13 * k})`;
                        ctx.lineWidth = 1;
                        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
                    }
                }
            }
            for (const m of this.motes) {
                ctx.fillStyle = dark ? `rgba(150,210,255,${m.a * 0.7})` : `rgba(15,76,117,${m.a})`;
                ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, 6.2832); ctx.fill();
            }

            // resplandor del arco TIG
            if (dark) {
                const ex = w * (0.16 + 0.68 * this.progress), ey = h * 0.62;
                const pulse = 0.8 + Math.sin(this.t * 22) * 0.12 + Math.sin(this.t * 7) * 0.08;
                const g = ctx.createRadialGradient(ex, ey, 0, ex, ey, 110 * pulse);
                g.addColorStop(0, 'rgba(210,235,255,.55)');
                g.addColorStop(0.25, 'rgba(90,160,255,.28)');
                g.addColorStop(1, 'rgba(90,160,255,0)');
                ctx.fillStyle = g; ctx.fillRect(ex - 130, ey - 130, 260, 260);
            }

            // chispas
            ctx.lineCap = 'round';
            for (const s of this.sparks) {
                const k = 1 - s.life / s.max;
                const tx = s.x - s.vx * 0.04, ty = s.y - s.vy * 0.04;
                ctx.strokeStyle = dark ? `rgba(255,170,70,${k})` : `rgba(226,108,12,${k * 0.9})`;
                ctx.lineWidth = dark ? 1.8 : 1.6;
                ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(tx, ty); ctx.stroke();
                ctx.fillStyle = dark ? `rgba(255,255,255,${k})` : `rgba(255,200,120,${k})`;
                ctx.beginPath(); ctx.arc(s.x, s.y, 1.2, 0, 6.2832); ctx.fill();
            }
            ctx.globalCompositeOperation = 'source-over';
        }
    }

    /* ───────── 9. HERO ───────── */
    const heroTitle = $('[data-hero-title]');
    let heroWords = [];
    let tigField = null;

    function prepareHero() {
        heroWords = splitWords(heroTitle);
        if (!motion) return;
        gsap.set(heroWords, { yPercent: 118 });
        gsap.set('[data-hero]', { y: 28 });
        gsap.set('.hv--main, .hv--second', { opacity: 0 });
        $$('.hv--main, .hv--second').forEach((el) => { el.style.clipPath = insetCss(insetProxy([100, 0, 0, 0, 26])); });
        gsap.set('.hv--seal', { opacity: 0, scale: 0.4, rotation: -80 });
    }

    function playHeroIntro() {
        if (!motion) return;
        const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
        tl.to(heroWords, { yPercent: 0, duration: 1.5, stagger: 0.08 }, 0)
          .to('[data-hero]', { opacity: 1, y: 0, duration: 1.2, stagger: 0.13, clearProps: 'transform' }, 0.2)
          .to('.hv--main', { opacity: 1, duration: 0.6 }, 0.25)
          .to('.hv--second', { opacity: 1, duration: 0.6 }, 0.5)
          .to('.hv--seal', { opacity: 1, scale: 1, rotation: 0, duration: 1.4, ease: 'back.out(1.5)' }, 0.9);
        [['.hv--main', 0.25], ['.hv--second', 0.5]].forEach(([sel, delay]) => {
            const el = $(sel);
            tweenInset(el, [100, 0, 0, 0, 26], [0, 0, 0, 0, 26], { duration: 1.6, ease: 'expo.out', delay, onComplete: () => { el.style.clipPath = ''; } });
        });
    }

    function initHeroInteractions() {
        const hero = $('#inicio');
        const frames = $$('[data-depth]', hero);
        let tx = 0, ty = 0, cx = 0, cy = 0, inView = true;

        new IntersectionObserver(([en]) => { inView = en.isIntersecting; }).observe(hero);

        if (finePointer && !reduceMotion) {
            hero.addEventListener('pointermove', (e) => {
                const r = hero.getBoundingClientRect();
                tx = (e.clientX - r.left) / r.width - 0.5;
                ty = (e.clientY - r.top) / r.height - 0.5;
                hero.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`);
                hero.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`);
            });
            hero.addEventListener('pointerleave', () => { tx = 0; ty = 0; });
            onFrame(() => {
                if (!inView) return;
                cx += (tx - cx) * 0.06; cy += (ty - cy) * 0.06;
                frames.forEach((f) => {
                    const d = Number(f.dataset.depth);
                    f.style.translate = `${(-cx * d).toFixed(2)}px ${(-cy * d).toFixed(2)}px`;
                });
            });
        }
        new SparkField($('#fx-hero'), 'light');
    }

    /* ───────── 10. MARQUEE (reacciona a la velocidad del scroll) ───────── */
    function initMarquee() {
        const track = $('#marquee-track');
        if (!track || reduceMotion) return;
        const anim = track.getAnimations()[0];
        if (!anim) return;
        let vel = 0, rate = 1;
        if (lenis) lenis.on('scroll', (e) => { vel = Math.abs(e.velocity || 0); });
        onFrame(() => {
            const target = 1 + Math.min(vel * 0.55, 7);
            rate += (target - rate) * 0.08;
            vel *= 0.9;
            anim.playbackRate = rate;
        });
    }

    /* ───────── 11. ANIMACIONES POR SCROLL ───────── */
    function initScrollAnimations() {
        if (!motion) return;
        const mm = gsap.matchMedia();

        // Barra de progreso de lectura
        gsap.to('#scroll-progress', { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: 0.2 } });

        // Hero: al salir, el contenido se desplaza más lento que el scroll
        gsap.to('.hero-copy', { yPercent: -14, opacity: 0.25, ease: 'none', scrollTrigger: { trigger: '#inicio', start: 'top top', end: 'bottom top', scrub: true } });
        gsap.to('.hero-visual', { yPercent: -9, ease: 'none', scrollTrigger: { trigger: '#inicio', start: 'top top', end: 'bottom top', scrub: true } });

        /* Los bloques ANCLADOS (pin) se crean primero y en orden de aparición;
           así ScrollTrigger calcula bien las posiciones de todo lo que sigue. */

        // ── Imagen que se abre a pantalla completa ──
        mm.add({ wide: '(min-width: 768px)', narrow: '(max-width: 767px)' }, (ctx) => {
            const { wide } = ctx.conditions;
            // Tarjeta centrada con título arriba y abajo; crece hasta cubrir la pantalla
            const media = $('#expand-media');
            const box = insetProxy(wide ? [34, 27, 34, 27, 28] : [36, 7, 36, 7, 22]);
            media.style.clipPath = insetCss(box);
            gsap.set('#expand-media img', { scale: 1.12 });
            gsap.set('.expand-scrim', { opacity: 0 });
            gsap.set('#expand-copy', { opacity: 0, y: 40 });

            const tl = gsap.timeline({
                defaults: { ease: 'none' },
                scrollTrigger: { trigger: '.expand-pin', start: 'top top', end: '+=170%', pin: true, scrub: 1, anticipatePin: 1, invalidateOnRefresh: true }
            });
            tl.to(box, { t: 0, r: 0, b: 0, l: 0, rad: 0, duration: 1, onUpdate: () => { media.style.clipPath = insetCss(box); } }, 0)
              .to('#expand-media img', { scale: 1, duration: 1 }, 0)
              .to('.et--l', { yPercent: -150, opacity: 0, duration: 0.6 }, 0.05)
              .to('.et--r', { yPercent: 150, opacity: 0, duration: 0.6 }, 0.05)
              .to('.expand-scrim', { opacity: 1, duration: 0.35 }, 0.65)
              .to('#expand-copy', { opacity: 1, y: 0, duration: 0.3 }, 0.78)
              .to({}, { duration: 0.3 });
            return () => { media.style.clipPath = ''; gsap.set(['#expand-media img', '.expand-scrim', '#expand-copy', '.et'], { clearProps: 'all' }); };
        });

        // ── Servicios: scroll horizontal anclado (escritorio) ──
        mm.add('(min-width: 1024px)', () => {
            const track = $('#srv-track');
            const view = $('.srv-viewport');
            const bar = $('#srv-bar');
            const dist = () => Math.max(0, track.scrollWidth - view.clientWidth);
            const tween = gsap.to(track, {
                x: () => -dist(), ease: 'none',
                scrollTrigger: {
                    trigger: '#srv-pin', start: 'top top', end: () => `+=${dist()}`,
                    pin: true, scrub: 1, anticipatePin: 1, invalidateOnRefresh: true,
                    onUpdate: (self) => { bar.style.transform = `scaleX(${self.progress})`; }
                }
            });
            $$('.srv-card img').forEach((img) => {
                gsap.fromTo(img, { xPercent: -5 }, {
                    xPercent: 5, ease: 'none',
                    scrollTrigger: { trigger: img.parentElement, containerAnimation: tween, start: 'left right', end: 'right left', scrub: true }
                });
            });
            return () => { bar.style.transform = ''; gsap.set(track, { clearProps: 'all' }); gsap.set('.srv-card img', { clearProps: 'all' }); };
        });

        /* ── A partir de aquí, todo lo que no ancla ── */

        // Titulares: máscara de palabras
        $$('[data-split]').forEach((h) => {
            const words = splitWords(h);
            gsap.set(words, { yPercent: 118 });
            ScrollTrigger.create({
                trigger: h, start: 'top 88%', once: true,
                onEnter: () => gsap.to(words, { yPercent: 0, duration: 1.3, stagger: 0.06, ease: 'expo.out' })
            });
        });

        // Manifiesto: las palabras se "encienden" con el scroll
        const manifesto = $('#manifesto');
        if (manifesto) {
            const mw = splitManifesto(manifesto);
            gsap.to(mw, {
                opacity: 1, ease: 'none', stagger: 0.12,
                scrollTrigger: { trigger: manifesto, start: 'top 82%', end: 'bottom 48%', scrub: 0.6 }
            });
        }

        // Elementos con [data-reveal]
        const plain = $$('[data-reveal]').filter((el) => !el.hasAttribute('data-tilt'));
        const tilted = $$('[data-reveal][data-tilt]');
        gsap.set(plain, { y: 38 });
        ScrollTrigger.batch(plain, {
            start: 'top 91%', once: true,
            onEnter: (batch) => gsap.to(batch, { opacity: 1, y: 0, duration: 1.2, stagger: 0.12, ease: 'expo.out', clearProps: 'transform' })
        });
        tilted.forEach((el) => { el.style.clipPath = insetCss(insetProxy([14, 6, 14, 6, 22])); });
        ScrollTrigger.batch(tilted, {
            start: 'top 90%', once: true,
            onEnter: (batch) => batch.forEach((el, i) => {
                gsap.to(el, { opacity: 1, duration: 1.2, delay: i * 0.14, ease: 'power2.out' });
                tweenInset(el, [14, 6, 14, 6, 22], [0, 0, 0, 0, 22], { duration: 1.5, delay: i * 0.14, ease: 'expo.out', onComplete: () => { el.style.clipPath = ''; } });
            })
        });

        // Contadores
        $$('.count').forEach((el) => {
            const to = Number(el.dataset.to);
            const o = { v: 0 };
            el.textContent = '0';
            ScrollTrigger.create({
                trigger: el, start: 'top 92%', once: true,
                onEnter: () => gsap.to(o, { v: to, duration: 2.4, ease: 'power3.out', onUpdate: () => { el.textContent = Math.round(o.v); } })
            });
        });

        // Soldadura TIG: paralaje entre imágenes y arco que sigue el scroll
        $$('[data-parallax]').forEach((el) => {
            gsap.to(el, {
                yPercent: Number(el.dataset.parallax), ease: 'none',
                scrollTrigger: { trigger: '.tig-visual', start: 'top bottom', end: 'bottom top', scrub: true }
            });
        });
        ScrollTrigger.create({
            trigger: '#soldadura', start: 'top bottom', end: 'bottom top',
            onUpdate: (self) => { if (tigField) tigField.progress = self.progress; }
        });

        // Proceso: la línea se llena y cada etapa se enciende
        gsap.to('#tl-fill', { scaleY: 1, ease: 'none', scrollTrigger: { trigger: '#timeline', start: 'top 62%', end: 'bottom 58%', scrub: 0.6 } });
        $$('.tl-item').forEach((item) => {
            ScrollTrigger.create({
                trigger: item, start: 'top 62%',
                onEnter: () => item.classList.add('is-on'),
                onLeaveBack: () => item.classList.remove('is-on')
            });
        });

        // Galería: cada imagen se revela con una máscara
        $$('.g-item').forEach((item) => {
            const img = $('img', item);
            item.style.clipPath = insetCss(insetProxy([100, 0, 0, 0, 20]));
            gsap.set(img, { scale: 1.35 });
            ScrollTrigger.create({
                trigger: item, start: 'top 94%', once: true,
                onEnter: () => {
                    tweenInset(item, [100, 0, 0, 0, 20], [0, 0, 0, 0, 20], { duration: 1.4, ease: 'expo.out', onComplete: () => { item.style.clipPath = ''; } });
                    gsap.to(img, { scale: 1, duration: 1.8, ease: 'expo.out', clearProps: 'transform' });
                }
            });
        });

        // CTA y footer
        gsap.fromTo('.cta-card', { scale: 0.92 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: '.cta-card', start: 'top bottom', end: 'top 35%', scrub: true } });
        gsap.fromTo('.footer-giant', { yPercent: 38, opacity: 0.15 }, { yPercent: 0, opacity: 1, ease: 'none', scrollTrigger: { trigger: '.footer', start: 'top 85%', end: 'bottom bottom', scrub: true } });
    }

    /* ───────── 12. EFECTOS DE PUNTERO (botones magnéticos y tarjetas con inclinación) ───────── */
    function initPointerEffects() {
        if (!finePointer || reduceMotion) return;

        if (hasGsap) {
            $$('[data-magnetic]').forEach((el) => {
                el.addEventListener('pointermove', (e) => {
                    const r = el.getBoundingClientRect();
                    const x = (e.clientX - (r.left + r.width / 2)) * 0.22;
                    const y = (e.clientY - (r.top + r.height / 2)) * 0.32;
                    gsap.to(el, { '--bx': `${x}px`, '--by': `${y}px`, duration: 0.6, ease: 'power3.out', overwrite: 'auto' });
                });
                el.addEventListener('pointerleave', () => {
                    gsap.to(el, { '--bx': '0px', '--by': '0px', duration: 0.9, ease: 'elastic.out(1, 0.45)', overwrite: 'auto' });
                });
            });
        }

        $$('[data-tilt]').forEach((card) => {
            card.addEventListener('pointermove', (e) => {
                const r = card.getBoundingClientRect();
                const px = (e.clientX - r.left) / r.width;
                const py = (e.clientY - r.top) / r.height;
                card.style.setProperty('--ry', `${((px - 0.5) * 7).toFixed(2)}deg`);
                card.style.setProperty('--rx', `${((0.5 - py) * 7).toFixed(2)}deg`);
                card.style.setProperty('--mx', `${(px * 100).toFixed(1)}%`);
                card.style.setProperty('--my', `${(py * 100).toFixed(1)}%`);
            });
            card.addEventListener('pointerleave', () => { card.style.setProperty('--rx', '0deg'); card.style.setProperty('--ry', '0deg'); });
        });
    }

    /* ───────── 13. GALERÍA: VISOR CON ANIMACIÓN DE EXPANSIÓN ───────── */
    function initLightbox() {
        const dlg = $('#lightbox');
        if (!dlg || typeof dlg.showModal !== 'function') return;
        const imgEl = $('#lb-img');
        const capEl = $('#lb-cap');
        const tiles = $$('.g-btn');
        let index = 0;

        const setImage = (i) => {
            index = (i + tiles.length) % tiles.length;
            const tile = tiles[index];
            const src = $('img', tile);
            imgEl.src = src.currentSrc || src.src;
            imgEl.alt = src.alt;
            capEl.textContent = tile.dataset.cap || src.alt;
        };

        const open = async (i) => {
            setImage(i);
            dlg.showModal();
            if (lenis) lenis.stop(); else body.style.overflow = 'hidden';
            if (!motion) return;
            try { await imgEl.decode(); } catch (e) { /* imagen ya en caché */ }
            // FLIP: la imagen del visor nace desde el recorte de la miniatura
            const from = $('img', tiles[index]).getBoundingClientRect();
            const to = imgEl.getBoundingClientRect();
            if (!to.width || !to.height) return;
            const s = Math.max(from.width / to.width, from.height / to.height);
            const dx = (from.left + from.width / 2) - (to.left + to.width / 2);
            const dy = (from.top + from.height / 2) - (to.top + to.height / 2);
            const iy = Math.max(0, (to.height - from.height / s) / 2);
            const ix = Math.max(0, (to.width - from.width / s) / 2);
            gsap.fromTo(dlg, { opacity: 0 }, { opacity: 1, duration: 0.45, ease: 'power2.out' });
            gsap.fromTo(imgEl,
                { x: dx, y: dy, scale: s, clipPath: `inset(${iy}px ${ix}px ${iy}px ${ix}px round ${20 / s}px)` },
                { x: 0, y: 0, scale: 1, clipPath: 'inset(0px 0px 0px 0px round 16px)', duration: 1.05, ease: 'expo.out', clearProps: 'transform,clipPath' });
            gsap.fromTo('#lb-cap', { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.8, delay: 0.35, ease: 'expo.out' });
        };

        const close = () => {
            if (!dlg.open) return;
            if (motion) {
                gsap.to(dlg, { opacity: 0, duration: 0.3, ease: 'power2.in', onComplete: () => { dlg.close(); gsap.set(dlg, { clearProps: 'opacity' }); } });
            } else dlg.close();
        };

        const step = (dir) => {
            setImage(index + dir);
            if (motion) gsap.fromTo(imgEl, { opacity: 0, x: 50 * dir }, { opacity: 1, x: 0, duration: 0.7, ease: 'expo.out', clearProps: 'transform' });
        };

        tiles.forEach((tile, i) => tile.addEventListener('click', () => open(i)));
        $('#lb-close').addEventListener('click', close);
        $('#lb-prev').addEventListener('click', () => step(-1));
        $('#lb-next').addEventListener('click', () => step(1));
        dlg.addEventListener('click', (e) => { if (e.target === dlg) close(); });
        dlg.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
        dlg.addEventListener('close', () => { if (lenis) lenis.start(); else body.style.overflow = ''; });
        dlg.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') step(-1);
            if (e.key === 'ArrowRight') step(1);
        });
    }

    /* ───────── 14. PESTAÑAS (misión, visión, valores) ───────── */
    function initTabs() {
        const tabs = $$('[role="tab"]');
        const activate = (tab, focus) => {
            tabs.forEach((t) => {
                const on = t === tab;
                t.classList.toggle('is-active', on);
                t.setAttribute('aria-selected', String(on));
                t.tabIndex = on ? 0 : -1;
                const panel = document.getElementById(t.getAttribute('aria-controls'));
                if (panel) { panel.hidden = !on; panel.classList.toggle('is-active', on); }
            });
            if (focus) tab.focus();
            if (hasGsap) ScrollTrigger.refresh();
        };
        tabs.forEach((tab, i) => {
            tab.addEventListener('click', () => activate(tab, false));
            tab.addEventListener('keydown', (e) => {
                let next = null;
                if (e.key === 'ArrowRight') next = tabs[(i + 1) % tabs.length];
                if (e.key === 'ArrowLeft') next = tabs[(i - 1 + tabs.length) % tabs.length];
                if (e.key === 'Home') next = tabs[0];
                if (e.key === 'End') next = tabs[tabs.length - 1];
                if (next) { e.preventDefault(); activate(next, true); }
            });
        });
    }

    /* ───────── 15. FORMULARIO → WHATSAPP ───────── */
    function initForm() {
        const form = $('#quote-form');
        if (!form) return;
        const fields = {
            name: { el: $('#f-name'), err: $('#e-name') },
            phone: { el: $('#f-phone'), err: $('#e-phone') },
            type: { el: $('#f-type'), err: $('#e-type') }
        };
        const ok = $('#form-ok');
        const fallback = $('#form-fallback');

        const setError = (key, msg) => {
            const f = fields[key];
            f.err.textContent = msg;
            f.el.setAttribute('aria-invalid', msg ? 'true' : 'false');
            f.el.closest('.field').classList.toggle('has-error', Boolean(msg));
            return !msg;
        };

        const validate = () => {
            const name = fields.name.el.value.trim();
            const phone = fields.phone.el.value.trim();
            const type = fields.type.el.value;
            const a = setError('name', name.length < 2 ? 'Escribe tu nombre para poder atenderte.' : '');
            const b = setError('phone', phone && !/^[\d\s()+-]{8,18}$/.test(phone) ? 'Revisa tu teléfono: usa solo números (mínimo 8 dígitos).' : '');
            const c = setError('type', !type ? 'Elige qué necesitas para orientarte mejor.' : '');
            return a && b && c;
        };

        Object.entries(fields).forEach(([key, f]) => {
            f.el.addEventListener('input', () => { if (f.el.getAttribute('aria-invalid') === 'true') validate(); });
            f.el.addEventListener('change', () => { if (f.el.getAttribute('aria-invalid') === 'true') validate(); });
        });

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            if (!validate()) {
                const first = form.querySelector('[aria-invalid="true"]');
                if (first) first.focus();
                return;
            }
            const name = fields.name.el.value.trim();
            const phone = fields.phone.el.value.trim();
            const type = fields.type.el.value;
            const detail = $('#f-msg').value.trim().slice(0, 600);

            const lines = [
                `Hola ${CONFIG.brand}, soy ${name}.`,
                `Me interesa: ${type}.`,
                detail ? `Detalles: ${detail}` : '',
                phone ? `Mi teléfono: ${phone}` : ''
            ].filter(Boolean);
            const url = waLink(lines.join('\n'));

            fallback.href = url;
            ok.hidden = false;
            window.open(url, '_blank', 'noopener');
        });
    }

    /* ───────── 16. BOTÓN FLOTANTE DE WHATSAPP ───────── */
    function showWhatsAppFloat() {
        const wa = $('.wa-float');
        if (!wa) return;
        wa.classList.add('is-ready');
        setTimeout(() => wa.classList.add('is-peek'), 2800);
        setTimeout(() => wa.classList.remove('is-peek'), 8200);

        // En móvil se oculta mientras el botón de envío del formulario o el CTA están a la vista, para no taparlos
        const small = window.matchMedia('(max-width: 899px)');
        const watched = new Set();
        const io = new IntersectionObserver((entries) => {
            entries.forEach((en) => (en.isIntersecting ? watched.add(en.target) : watched.delete(en.target)));
            wa.classList.toggle('is-away', small.matches && watched.size > 0);
        }, { threshold: 0.2 });
        $$('.form-card, .cta-card').forEach((el) => io.observe(el));
        small.addEventListener('change', () => wa.classList.toggle('is-away', small.matches && watched.size > 0));
    }

    /* ───────── 17. ARRANQUE ───────── */
    initSmoothScroll();
    initAnchors();
    initNav();
    prepareHero();
    initScrollAnimations();      // pins primero, luego el resto (ver comentario en la función)
    initHeroInteractions();
    tigField = new SparkField($('#fx-tig'), 'dark');
    initMarquee();
    initPointerEffects();
    initLightbox();
    initTabs();
    initForm();

    const refresh = () => { if (hasGsap) ScrollTrigger.refresh(); };
    window.addEventListener('load', refresh, { once: true });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(refresh);

    runLoader().then(() => {
        if (lenis) lenis.start();
        refresh();
        playHeroIntro();
        showWhatsAppFloat();
    });
})();
