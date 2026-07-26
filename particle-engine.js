/**
 * =============================================================================
 *  PARTICLE TEXT ENGINE — Vanilla JS
 *  فك تشفير وإعادة توثيق خوارزمية الجسيمات
 *  المصدر الأصلي: chunks_/0pmj6nfsi.wc3.js (دالة `g`)
 *
 *  تصحيح حاسم (v2):
 *  ─────────────────
 *  الكود الأصلي يستخدم || (falsy) وليس ?? (nullish) عند قراءة queue:
 *    e.t.x = t.x || e.p.x   ← 0 يعني "ابقَ في مكانك الحالي"
 *  استخدام ?? كان يُحرّك الجسيمات إلى (0,0) بدلاً من إبقائها في موضعها
 *  مما كان يُتلف تأثير الانفجار بالكامل.
 * =============================================================================
 */

"use strict";

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 1: تعريف الجسيم (Particle Definition)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @class Particle
 *
 * المقارنة مع الكود الأصلي المصغّر:
 *   v[f] = { p:{x,y,z,a,h}, t:{x,y,z,a,h}, e, s, q:[] }
 *   ─────────────────────────────────────────────────────
 *   p = current  (الموضع الحالي)
 *   t = target   (الموضع المستهدف)
 *   e = easing   (معامل الانجذاب / السرعة نحو الهدف)
 *   s = settled  (هل استقر الجسيم في هدف نصي؟)
 *   q = queue    (قائمة الأهداف المرحلية القادمة)
 *   z = radius   (نصف قطر دائرة الجسيم)
 *   a = alpha    (الشفافية: 0 شفاف — 1 معتم)
 *   h = hold     (عدد الفريمات للتوقف قبل التحرك للهدف التالي)
 *
 * قيم الـ easing الثلاث المستخدمة:
 *   0.11 → انتقال سريع نحو هدف النص
 *   0.07 → انتشار بطيء / تجوال
 *   0.04 → تشتت بطيء جداً للجسيمات الزائدة
 */
class Particle {
  constructor(startX, startY) {
    // الجسيم يبدأ شفافاً (a:0) لمنع ظهوره كنقطة مضيئة في المركز بينما ينتظر
    this.current = { x: startX, y: startY, z: 4, a: 0, h: 0 };
    this.target  = { x: startX, y: startY, z: 4, a: 0, h: 0 };
    this.easing  = 0.07;
    this.settled = false;
    this.queue   = [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 2: استخراج بكسلات النص (Text → Particle Targets)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ترسم النص على Canvas مخفي وتعيد إحداثيات البكسلات المرئية.
 *
 * الكود الأصلي (دالة y(e) الداخلية):
 *   g.font = `bold ${fontSize}px ${fontFamily}`
 *   g.clearRect(0, 0, width, height)
 *   g.fillText(text, width/2, height/2)
 *   data = g.getImageData(0, 0, w, h).data
 *   ← data[row*rowWidth + col*4 + 3] > 0  بكسل مرئي
 *   step (p): 4px موبايل / 6px تابلت / 8px سطح المكتب
 *
 * @param {string} text       - النص المراد تحويله
 * @param {number} canvasW    - عرض Canvas الرئيسي
 * @param {number} canvasH    - ارتفاع Canvas الرئيسي
 * @param {number} step       - الخطوة بالبكسل (تحدد كثافة الجسيمات)
 * @param {string} fontFamily - الخط المستخدم
 * @returns {{ x: number, y: number }[]}
 */
function textToParticleTargets(text, canvasW, canvasH, step = 6, fontFamily = "Arial") {
  const offscreen = document.createElement("canvas");
  const offCtx    = offscreen.getContext("2d");

  offscreen.width  = Math.floor(canvasW / step) * step;
  offscreen.height = Math.floor(canvasH / step) * step;

  // ── حساب وتجهيز الخط ──
  const isNumber       = !isNaN(parseFloat(text)) && isFinite(Number(text));
  const isMobile       = canvasW < 640;
  // تصغير واضح: الأرقام أصغر والكلمات أوضح
  const maxHeightRatio = isNumber ? 0.30 : (isMobile ? 0.24 : 0.20);
  const fontSpec       = isNumber 
    ? `900 500px 'Arial Black', 'Impact', ${fontFamily}, sans-serif` 
    : `bold 500px ${fontFamily}`;

  offCtx.font = fontSpec;
  const lines = text.split("\n");
  let maxLineWidth = 0;
  for (const line of lines) {
    const w = offCtx.measureText(line).width;
    if (w > maxLineWidth) maxLineWidth = w;
  }

  const scaleX   = (offscreen.width  / maxLineWidth) * (isMobile ? 0.58 : 0.50) * 500;
  const scaleY   = (offscreen.height / (500 * lines.length)) * maxHeightRatio * 500;
  const fontSize = Math.min(500, scaleX, scaleY);

  const finalFont = isNumber 
    ? `900 ${fontSize}px 'Arial Black', 'Impact', ${fontFamily}, sans-serif`
    : `bold ${fontSize}px ${fontFamily}`;

  // ── رسم النص (مع دعم الأسطر المتعددة لتوضيح الحروف مثل i) ──
  offCtx.font         = finalFont;
  offCtx.fillStyle    = "red";
  offCtx.textBaseline = "middle";
  offCtx.textAlign    = "center";
  offCtx.clearRect(0, 0, offscreen.width, offscreen.height);

  const lineHeight  = fontSize * 1.25;
  const totalHeight = (lines.length - 1) * lineHeight;
  const startY      = (offscreen.height / 2) - (totalHeight / 2);

  lines.forEach((line, index) => {
    offCtx.fillText(line, offscreen.width / 2, startY + (index * lineHeight));
  });

  // ── استخراج البكسلات المرئية بـ getImageData ──
  // كل بكسل = 4 bytes [R, G, B, A]
  // موقع Alpha للبكسل (col, row) = row * rowWidth + col * 4 + 3
  const imageData = offCtx.getImageData(0, 0, offscreen.width, offscreen.height);
  const data      = imageData.data;
  const rowWidth  = 4 * offscreen.width;

  const targets = [];
  for (let row = 0; row < offscreen.height; row += step) {
    for (let col = 0; col < offscreen.width; col += step) {
      if (data[row * rowWidth + col * 4 + 3] > 0) {
        targets.push({ x: col, y: row });
      }
    }
  }
  return targets;
}

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 3: التحديث الفيزيائي (Physics Update)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * تحرّك الجسيم خطوة واحدة نحو هدفه.
 *
 * الرياضيات (Spring Easing):
 *   dx = cur.x - tgt.x           ← الفرق الأفقي
 *   dy = cur.y - tgt.y           ← الفرق الرأسي
 *   d  = √(dx²+dy²)              ← المسافة الكلية (فيثاغورس)
 *   speed = easing × d           ← السرعة ∝ المسافة (يتباطأ تلقائياً)
 *   cur.x -= (dx/d) × speed      ← تحرك نحو الهدف بمقدار speed
 *
 * @param {Particle} p
 * @returns {boolean} true إذا وصل الجسيم لهدفه
 */
function moveTowardsTarget(p) {
  const cur = p.current;
  const tgt = p.target;

  // h=-1: انتقل فوريًا (Teleport)
  if (cur.h === -1) {
    cur.x = tgt.x;
    cur.y = tgt.y;
    return true;
  }

  const dx = cur.x - tgt.x;
  const dy = cur.y - tgt.y;
  const d  = Math.sqrt(dx * dx + dy * dy);

  if (d > 1) {
    const speed = p.easing * d;
    cur.x -= (dx / d) * speed;
    cur.y -= (dy / d) * speed;
    return false;
  }

  if (cur.h > 0) { cur.h--; return false; }
  return true; // وصل
}

/**
 * يُحدّث موضع جسيم واحد لكل فريم رسم.
 *
 * ⚠️  تصحيح حاسم (v2):
 * ─────────────────────
 * الكود الأصلي يستخدم || وليس ?? عند قراءة خصائص queue:
 *   e.t.x = t.x || e.p.x   ← إذا كان t.x == 0 (falsy)، ابقَ في موضعك الحالي
 *   e.t.y = t.y || e.p.y
 *   e.t.z = t.z || e.p.z
 *   e.t.a = t.a || e.p.a
 *   e.p.h = t.h || 0        ← h=0 معناه "لا انتظار" (صحيح بكلا الطريقتين)
 *
 * لماذا يهم هذا؟
 *   عند تعيين {x:0, y:0} في queue، المعنى هو "ابقَ في موضعك الحالي".
 *   استخدام ?? كان يُحرّك الجسيم إلى (0,0) وهو الزاوية العلوية اليسرى!
 *   → تأثير الانفجار يُتلف كليًا.
 *
 * @param {Particle} particle
 */
function updateParticle(particle) {
  const cur = particle.current;
  const tgt = particle.target;

  const reached = moveTowardsTarget(particle);

  if (reached) {
    const next = particle.queue.shift();

    if (next) {
      // ── تصحيح: استخدام || مطابقاً للكود الأصلي ──
      // القيمة 0 تعني "ابقَ في موضعك الحالي" (falsy = keep current)
      particle.target.x  = next.x || cur.x;
      particle.target.y  = next.y || cur.y;
      particle.target.z  = next.z || cur.z;
      particle.target.a  = next.a || cur.a;
      particle.current.h = next.h || 0;  // h=0 = لا انتظار (مناسب لكلا الطريقتين)

    } else if (particle.settled) {
      // مستقر بلا هدف قادم → اهتزاز خفيف (Idle Jitter)
      // الكود الأصلي: e.p.x -= Math.sin(π * Math.random())
      cur.x -= Math.sin(Math.PI * Math.random());
      cur.y -= Math.sin(Math.PI * Math.random());

    } else {
      // يتجول بلا هدف → أضف هدف عشوائي قريب
      particle.queue.push({
        x: cur.x + (Math.random() * 100 - 50),
        y: cur.y + (Math.random() * 100 - 50),
        z: cur.z,
        a: cur.a,
        h: 0,
      });
    }
  }

  // ── Lerp للشفافية: 5% من الفرق كل فريم ──
  // الكود الأصلي: let t = e.p.a - e.t.a; e.p.a = max(0.1, e.p.a - 0.05*t)
  const dAlpha = cur.a - tgt.a;
  cur.a = Math.max(0.1, cur.a - 0.05 * dAlpha);

  // ── Lerp للحجم: نفس المبدأ ──
  const dSize = cur.z - tgt.z;
  cur.z = Math.max(1, cur.z - 0.05 * dSize);
}

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 4: توزيع الجسيمات (Particle Pool Assignment)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * يوزع الجسيمات على أهداف النص الجديد.
 *
 * الكود الأصلي (دالة S(dots, isCountdown)):
 * ────────────────────────────────────────
 *
 *  كيف يعمل تأثير الانفجار؟
 *  ─────────────────────────
 *  عند الانتقال من "3" → "2" مثلاً:
 *
 *  الجسيمات المُعاد تعيينها (settled → new target):
 *    Queue: [{x:0,y:0, z:big, a:rand, h:18}, {x:newX, y:newY, z:4, a:1, h:0}]
 *    → تبقى في موضع "3" وتتوهج (18 فريم) ← تأثير الوميض
 *    → تطير إلى موضعها الجديد في "2"       ← تأثير إعادة التشكّل
 *
 *  الجسيمات الزائدة (عدد جسيمات "3" > عدد جسيمات "2"):
 *    Queue: [{x:0,y:0, z:big, a:rand, h:20}, {x:rand, y:rand, z:4, a:0.3, h:0}]
 *    → تبقى في موضعها وتتوهج (20 فريم)   ← تأثير الوميض
 *    → تطير إلى موضع عشوائي (بطيئة)       ← تأثير الانفجار الحقيقي
 *
 *  الجسيمات الجديدة (عدد جسيمات "2" > عدد جسيمات "1"):
 *    تُنشأ في مركز الشاشة وتطير إلى مواضعها في النص الجديد
 *
 * @param {Particle[]}     particles
 * @param {{ x,y }[]}      newTargets  - من textToParticleTargets()
 * @param {number}         canvasW
 * @param {number}         canvasH
 * @param {boolean}        isCountdown - وضع العداد (تأخير أقصر)
 */
function assignTargets(particles, newTargets, canvasW, canvasH, isCountdown = false) {
  // ── حساب حدود النص لتمركزه في الشاشة ──
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;

  for (const d of newTargets) {
    if (d.x < minX) minX = d.x;
    if (d.x > maxX) maxX = d.x;
    if (d.y < minY) minY = d.y;
    if (d.y > maxY) maxY = d.y;
  }

  // الكود الأصلي: r.w = maxX+minX; r.h = maxY+minY
  const textW   = maxX + minX;
  const textH   = maxY + minY;
  const offsetX = canvasW / 2 - textW / 2;
  const offsetY = canvasH / 2 - textH / 2;

  // ── فرغ قوائم الانتظار لجميع الجسيمات (إعادة ضبط نظيفة) ──
  for (const p of particles) p.queue = [];

  // ── أنشئ جسيمات إضافية إذا كان النص الجديد يحتاج أكثر ──
  const extra = newTargets.length - particles.length;
  for (let i = 0; i < extra; i++) {
    particles.push(new Particle(canvasW / 2, canvasH / 2));
  }

  // ── توزيع الأهداف عشوائياً (Fisher-Yates style) ──
  const pool     = [...newTargets];
  let   assigned = 0;

  while (pool.length > 0) {
    const ri  = Math.floor(Math.random() * pool.length);
    const dot = pool.splice(ri, 1)[0];
    const p   = particles[assigned];

    // تسريع انفجار الكلمات دون اهتزاز
    p.easing = isCountdown ? 0.11 : 0.16;

    if (p.settled) {
      // الجسيم مستقر: تخفيف الانتفاخ الزائد (z من 4 إلى 7 فقط بدل 15)
      p.queue.push({
        x: 0, y: 0,
        z: 3 * Math.random() + 4,
        a: Math.random() * 0.5 + 0.5,
        h: isCountdown ? 25 : 16,
      });
    } else {
      // جسيم جديد: ينتظر في المركز شفافاً ثم يطير
      p.queue.push({
        x: 0, y: 0,
        z: 2 * Math.random() + 3,
        a: 0,
        h: isCountdown ? 10 : 12,
      });
    }

    p.settled = true;

    // الطيران إلى الهدف النصي بشكل سريع وواضح
    p.queue.push({
      x: dot.x + offsetX,
      y: dot.y + offsetY,
      a: 1,
      z: 4,
      h: 0,
    });

    assigned++;
  }

  // ── الجسيمات الزائدة: توهج ثم تتلاشى للخفاء ──
  for (let i = assigned; i < particles.length; i++) {
    const p = particles[i];

    if (p.settled) {
      // تخفيف الانتفاخ الزائد للجسيمات غير المستخدمة
      p.queue.push({
        x: 0, y: 0,
        z: 3 * Math.random() + 4,
        a: 0.8 * Math.random() + 0.2,
        h: isCountdown ? 18 : 12,
      });

      p.settled = false;
      p.easing  = 0.05;

      // تطير لموضع عشوائي ثم تختفي —
      // ملاحظة: a:0 فالسي = 0 || cur.a = cur.a ← لن تنجحت!
      // استخدم a:0.02 بدلاً (شبه شفاف تماماً)
      p.queue.push({
        x: Math.random() * canvasW,
        y: Math.random() * canvasH,
        a: 0.02,
        z: 1,
        h: 0,
      });
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 5: استخراج نقاط شكل القلب (Heart → Particle Targets)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * يولّد إحداثيات الجسيمات لتشكيل قلب مملوء.
 *
 * المعادلة الباراميترية للقلب (من الكود الأصلي — دالة `y`):
 *   x(t) = 16 × sin³(t)
 *   y(t) = 13cos(t) − 5cos(2t) − 2cos(3t) − cos(4t)
 *   حيث t ∈ [0, 2π]
 *
 * الطريقة:
 *   1. يُرسم القلب على Canvas مخفي باستخدام Path2D
 *   2. يُملأ بلون صلب
 *   3. يُستخرج كل بكسل مرئي (alpha > 0) كهدف لجسيم
 *
 * @param {number} canvasW  - عرض Canvas الرئيسي
 * @param {number} canvasH  - ارتفاع Canvas الرئيسي
 * @param {number} step     - الخطوة بالبكسل (تحدد كثافة الجسيمات)
 * @returns {{ x: number, y: number }[]}
 */
function heartToParticleTargets(canvasW, canvasH, step = 6) {
  const offscreen = document.createElement("canvas");
  const offCtx    = offscreen.getContext("2d");

  offscreen.width  = Math.floor(canvasW / step) * step;
  offscreen.height = Math.floor(canvasH / step) * step;

  const cx = offscreen.width  / 2;
  const cy = offscreen.height / 2;

  // حجم القلب بالنسبة للشاشة (مطابق لحجم الأرقام تقريباً)
  // المعادلة تعطي: x ∈ [-16, 16], y ∈ [-13, ~14]
  // نُقيّس بحيث يشغل القلب ~60% من ارتفاع الشاشة
  // حجم القلب بالنسبة للشاشة (مضغوط ليكون أصغر وأنيق)
  const scale = (Math.min(offscreen.width, offscreen.height) * 0.22) / 16;

  // ── رسم مسار القلب ──
  offCtx.fillStyle = "red";
  offCtx.beginPath();

  const steps = 500; // دقة المسار
  for (let i = 0; i <= steps; i++) {
    const t  = (i / steps) * Math.PI * 2;
    // المعادلة الباراميترية للقلب (من الكود الأصلي)
    const hx = 16 * Math.pow(Math.sin(t), 3);
    const hy = 13 * Math.cos(t)
             -  5 * Math.cos(2 * t)
             -  2 * Math.cos(3 * t)
             -      Math.cos(4 * t);

    const px = cx + hx * scale;
    const py = cy - hy * scale; // ← عكس y لأن المحور الرسومي مقلوب

    if (i === 0) offCtx.moveTo(px, py);
    else         offCtx.lineTo(px, py);
  }

  offCtx.closePath();
  offCtx.fill();

  // ── استخراج البكسلات المرئية ──
  const imageData = offCtx.getImageData(0, 0, offscreen.width, offscreen.height);
  const data      = imageData.data;
  const rowWidth  = 4 * offscreen.width;

  const targets = [];
  for (let row = 0; row < offscreen.height; row += step) {
    for (let col = 0; col < offscreen.width; col += step) {
      if (data[row * rowWidth + col * 4 + 3] > 0) {
        targets.push({ x: col, y: row });
      }
    }
  }
  return targets;
}


// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 6: الرسم (Draw)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * يرسم جميع الجسيمات على الـ Canvas.
 *
 * الكود الأصلي:
 *   ctx.fillStyle = `rgba(${r},${g},${b},${p.a})`
 *   ctx.beginPath()
 *   ctx.arc(x, y, z, 0, 2π, true)
 *   ctx.closePath()
 *   ctx.fill()
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Particle[]}               particles
 * @param {{ r, g, b }}              color      - لون RGB
 * @param {number}                   width
 * @param {number}                   height
 */
function drawParticles(ctx, particles, color, width, height) {
  ctx.clearRect(0, 0, width, height);

  for (const p of particles) {
    const { x, y, z, a } = p.current;

    ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${a})`;
    ctx.beginPath();
    ctx.arc(x, y, Math.max(0.5, z), 0, 2 * Math.PI, true);
    ctx.closePath();
    ctx.fill();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 6: الكلاس الرئيسي (ParticleTextEngine)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @class ParticleTextEngine
 *
 * مثال الاستخدام:
 *   <canvas id="fgCanvas"></canvas>
 *   <script src="particle-engine.js"></script>
 *   <script>
 *     const engine = new ParticleTextEngine("fgCanvas", "#ff2d75", "Arial");
 *
 *     // عرض العد التنازلي:
 *     engine.displayText("3", true);
 *     setTimeout(() => engine.displayText("2", true), 1400);
 *     setTimeout(() => engine.displayText("1", true), 2800);
 *
 *     // عرض النص:
 *     setTimeout(() => engine.displayText("عيد ميلاد"), 4200);
 *
 *     // إيقاف:
 *     setTimeout(() => engine.destroy(), 10000);
 *   </script>
 */
class ParticleTextEngine {
  /**
   * @param {string} canvasId   - معرّف عنصر الـ Canvas
   * @param {string} themeColor - لون الجسيمات HEX (مثال: "#ff2d75")
   * @param {string} fontFamily - الخط المستخدم لرسم النص
   */
  constructor(canvasId, themeColor = "#ff2d75", fontFamily = "Arial") {
    this.canvas     = document.getElementById(canvasId);
    this.ctx        = this.canvas.getContext("2d");
    this.color      = this._hexToRgb(themeColor);
    this.fontFamily = fontFamily;

    /** @type {Particle[]} */
    this.particles  = [];
    this.rafId      = null;

    this._resize();
    this._resizeHandler = () => this._resize();
    window.addEventListener("resize", this._resizeHandler);
    this._loop();
  }

  // ── ضبط الحجم مع مراعاة devicePixelRatio ──
  _resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w   = window.innerWidth;
    const h   = window.innerHeight;

    this.canvas.width        = w * dpr;
    this.canvas.height       = h * dpr;
    this.canvas.style.width  = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.ctx.scale(dpr, dpr);

    this.width  = w;
    this.height = h;
    // خطوة صغيرة = جسيمات متلاصقة = نص متصل وممتلىء قبل الانفجار
    this.step   = w < 640 ? 4 : w < 1024 ? 5 : 6;
  }

  // ── تحويل HEX إلى RGB ──
  _hexToRgb(hex) {
    const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return r
      ? { r: parseInt(r[1], 16), g: parseInt(r[2], 16), b: parseInt(r[3], 16) }
      : { r: 255, g: 45, b: 117 };
  }

  /**
   * عرض نص جديد بتأثير الجسيمات.
   * يُعيد توزيع الجسيمات على البكسلات المرئية في النص.
   *
   * @param {string}  text        - النص أو الرقم المراد عرضه
   * @param {boolean} isCountdown - هل هو رقم عداد تنازلي؟
   */
  displayText(text, isCountdown = false) {
    // assignTargets يُفرّغ p.queue لجميع الجسيمات داخلياً — لا حاجة لـ clear() مسبقاً
    const targets = textToParticleTargets(
      text,
      this.width,
      this.height,
      this.step,
      this.fontFamily
    );
    assignTargets(this.particles, targets, this.width, this.height, isCountdown);
  }

  displayHeart() {
    // assignTargets يُفرّغ p.queue لجميع الجسيمات داخلياً — لا حاجة لـ clear() مسبقاً
    const targets = heartToParticleTargets(this.width, this.height, this.step);
    assignTargets(this.particles, targets, this.width, this.height, false);
  }

  // ── حلقة الرسم الرئيسية ──
  _loop() {
    this.rafId = requestAnimationFrame(() => this._loop());

    for (const p of this.particles) {
      updateParticle(p);
    }

    drawParticles(this.ctx, this.particles, this.color, this.width, this.height);
  }

  /**
   * إيقاف المحرك وتحرير الموارد.
   */
  destroy() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    window.removeEventListener("resize", this._resizeHandler);
  }
}

// ES Modules export
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    Particle,
    textToParticleTargets,
    heartToParticleTargets,
    moveTowardsTarget,
    updateParticle,
    assignTargets,
    drawParticles,
    ParticleTextEngine,
  };
}
