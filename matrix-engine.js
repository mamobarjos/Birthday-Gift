/**
 * =============================================================================
 *  MATRIX GRID ENGINE - Vanilla JS
 *  محرك الخلفية - مطر الأحرف (Matrix Rain)
 *  مُعاد بناؤه بمطابقة كاملة لأسلوب وألوان المشروع الأصلي
 *
 *  المصدر الأصلي: chunks_/0pmj6nfsi.wc3.js (دالة `x`)
 * =============================================================================
 *
 *  الخوارزمية الأصلية (فُكَّ تشفيرها من الكود المصغّر):
 *  ─────────────────────────────────────────────────────
 *  1. عدد الأعمدة = Math.floor(width / 25)
 *  2. لكل عمود: لون متبادل بين themeColor و themeColor2
 *  3. كل 50ms (setInterval):
 *     أ. fillRect بـ rgba(0,0,0,0.05) → يخفّت الإطار السابق (تأثير الذيل)
 *     ب. لكل عمود نشط: اختر حرفاً عشوائياً من النص، ارسمه مع shadowBlur=8
 *     ج. زد عداد الصف (y)
 *     د. عند الوصول لنهاية الشاشة: أعد تهيئة العمود بتأخير عشوائي
 *  4. الخط: bold 25px Menlo, Consolas, Liberation Mono, Courier New
 *  5. الألوان: themeColor (#ff2d75) و themeColor2 (~#ff77a5)
 *
 *  ملاحظة: الكود الأصلي يستخدم setInterval(50ms) + getContext({alpha:false}).
 *  هذا الإصدار يستخدم requestAnimationFrame مع timestamp-based throttle للحصول
 *  على نفس النتيجة مع أداء أفضل.
 *
 * =============================================================================
 */

"use strict";

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 0: الثوابت (Constants)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * نص المصفوفة الأصلي من الكود المصغّر.
 * الكود الأصلي: matrixText = "HAPPYBIRTHDAY"
 * مقسوم إلى مصفوفة: ["H","A","P","P","Y","B","I","R","T","H","D","A","Y"]
 */
const DEFAULT_MATRIX_TEXT = "HAPPYBIRTHDAY";

/**
 * الحجم الثابت لكل خلية (عرض + ارتفاع كل حرف).
 * الكود الأصلي: 25px لكل من العرض والارتفاع.
 * الخط: bold 25px
 */
const CELL_SIZE = 25;


// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 1: كلاس عمود المصفوفة (MatrixColumn)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @class MatrixColumn
 *
 * يمثّل عموداً واحداً في مطر المصفوفة.
 *
 * مقارنة مع الكود الأصلي:
 *   c[r] = 0           → this.row (عداد الصف الحالي)
 *   u[r] = color       → this.color (اللون المحدد عشوائياً عند التهيئة)
 *   h[r] = 2000*rand   → this.delayMs (تأخير البداية بـ ms)
 *   d[r] = false       → this.active (هل العمود نشط؟)
 *   f    = maxRows     → this.maxRows (أقصى عدد صفوف)
 *
 * الخوارزمية في كل خطوة:
 *   if (!active && now - startTime >= delayMs) → active = true
 *   if (active && row < maxRows):
 *     ارسم حرفاً عشوائياً عند (x, row*25)
 *     row++
 *   if (row >= maxRows):
 *     أعد التهيئة بتأخير جديد (0-1000ms)
 */
class MatrixColumn {
  /**
   * @param {number} colIndex   - رقم العمود (0, 1, 2, ...)
   * @param {number} maxRows    - أقصى عدد صفوف (ارتفاع الشاشة / CELL_SIZE + 2)
   * @param {string} colorA     - لون الأعمدة الفردية (themeColor)
   * @param {string} colorB     - لون الأعمدة الزوجية (themeColor2)
   * @param {number} startTime  - وقت بدء المشهد (Date.now())
   */
  constructor(colIndex, maxRows, colorA, colorB, startTime) {
    this.colIndex = colIndex;
    this.x        = colIndex * CELL_SIZE; // الموضع الأفقي بالبكسل
    this.maxRows  = maxRows;

    // الكود الأصلي: u[r] = r%2==0 ? themeColor : themeColor2
    this.color = colIndex % 2 === 0 ? colorA : colorB;

    // الكود الأصلي: h[r] = 2000 * Math.random()
    this.delayMs   = 2000 * Math.random();
    this.startTime = startTime;
    this.active    = false;
    this.row       = 0;
  }

  /**
   * تحديث حالة العمود (يُستدعى كل 50ms).
   * @param {number} now     - الوقت الحالي (ms)
   * @param {string[]} chars - مصفوفة الأحرف المتاحة
   * @param {CanvasRenderingContext2D} ctx
   */
  step(now, chars, ctx) {
    // ── تفعيل العمود بعد انتهاء التأخير ──
    if (!this.active && now - this.startTime >= this.delayMs) {
      this.active = true;
    }

    // ── رسم الحرف إذا كان العمود نشطاً ولم يتجاوز الشاشة ──
    if (this.active && this.row < this.maxRows) {
      const char  = chars[Math.floor(Math.random() * chars.length)];
      const drawX = this.x;
      const drawY = CELL_SIZE * this.row;

      ctx.fillStyle   = this.color;
      ctx.shadowColor = this.color;
      ctx.shadowBlur  = 8;
      ctx.fillText(char, drawX, drawY);
      ctx.shadowBlur  = 0;
    }

    // ── زيادة العداد إذا كان نشطاً ──
    if (this.active) this.row++;

    // ── إعادة التهيئة عند الوصول لنهاية الشاشة ──
    // الكود الأصلي: c[t]>=f && (c[t]=0, h[t]=1000*Math.random(), d[t]=false)
    if (this.row >= this.maxRows) {
      this.row       = 0;
      this.delayMs   = 1000 * Math.random(); // تأخير أقصر عند الإعادة
      this.startTime = now;
      this.active    = false;
    }
  }
}


// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 2: الكلاس الرئيسي (MatrixGridEngine)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @class MatrixGridEngine
 *
 * يُدير حلقة مطر المصفوفة الكاملة.
 * يعمل كطبقة خلفية (z-index منخفض) أسفل ParticleTextEngine.
 *
 * الخيارات القابلة للتخصيص:
 *   themeColor   - اللون الرئيسي (الأعمدة الزوجية)    الافتراضي: "#ff2d75"
 *   themeColor2  - اللون الثانوي (الأعمدة الفردية)    الافتراضي: "#ff77a5"
 *   matrixText   - نص المصفوفة                        الافتراضي: "HAPPYBIRTHDAY"
 *   updateMs     - دورة التحديث بالـ ms               الافتراضي: 50
 *
 * مثال الاستخدام:
 *   <canvas id="bgCanvas"></canvas>
 *   <script src="matrix-engine.js"></script>
 *   <script>
 *     const bg = new MatrixGridEngine("bgCanvas", {
 *       themeColor:  "#ff2d75",
 *       themeColor2: "#ff77a5",
 *       matrixText:  "HAPPYBIRTHDAY",
 *     });
 *   </script>
 */
class MatrixGridEngine {
  /**
   * @param {string} canvasId  - معرّف عنصر الـ Canvas في DOM
   * @param {object} [opts]    - خيارات اختيارية
   * @param {string} [opts.themeColor="#ff2d75"]   - اللون الرئيسي
   * @param {string} [opts.themeColor2="#ff77a5"]  - اللون الثانوي
   * @param {string} [opts.matrixText="HAPPYBIRTHDAY"] - نص المصفوفة
   * @param {number} [opts.updateMs=50]            - دورة التحديث (ms)
   */
  constructor(canvasId, opts = {}) {
    this.canvas = document.getElementById(canvasId);

    // الكود الأصلي يستخدم {alpha: false} لتحسين الأداء وتمكين الخلفية الداكنة
    this.ctx    = this.canvas.getContext("2d", { alpha: false });

    // الإعدادات
    this.themeColor  = opts.themeColor  ?? "#ff2d75";
    this.themeColor2 = opts.themeColor2 ?? "#ff77a5";
    this.matrixText  = opts.matrixText  ?? DEFAULT_MATRIX_TEXT;
    this.updateMs    = opts.updateMs    ?? 90;

    // مصفوفة الأحرف (الكود الأصلي: a.split(""))
    this.chars = this.matrixText.split("");

    /** @type {MatrixColumn[]} */
    this.columns      = [];
    this.rafId        = null;
    this.lastStepTime = 0; // آخر وقت تم فيه تحديث الأعمدة

    this._init();
    this._resizeHandler = () => this._onResize();
    window.addEventListener("resize", this._resizeHandler);
  }

  // ─── التهيئة ──────────────────────────────────────────────────────────────

  _init() {
    this._setCanvasSize();
    this._buildColumns();

    // رسم الخلفية السوداء الأولية (مهم مع alpha:false)
    this.ctx.fillStyle = "#000000";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this._loop();
  }

  /**
   * ضبط أبعاد Canvas مع مراعاة devicePixelRatio.
   * الكود الأصلي: r.width = window.innerWidth; r.height = window.innerHeight
   * (لا يستخدم DPR — نحن نضيف DPR لجودة أعلى على شاشات Retina)
   */
  _setCanvasSize() {
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

    // الكود الأصلي: f = Math.floor(r.height / 25) + 2
    this.maxRows = Math.floor(h / CELL_SIZE) + 2;
  }

  _onResize() {
    // إعادة ضبط التحويل قبل إعادة الضبط
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this._setCanvasSize();
    this._buildColumns();

    // إعادة رسم الخلفية الأولية بعد تغيير الحجم
    this.ctx.fillStyle = "#000000";
    this.ctx.fillRect(0, 0, this.width, this.height);
  }

  // ─── بناء الأعمدة ─────────────────────────────────────────────────────────

  /**
   * ينشئ مصفوفة الأعمدة.
   * الكود الأصلي: s = Math.floor(r.width / 25)  → عدد الأعمدة
   */
  _buildColumns() {
    this.columns = [];
    // الكود الأصلي: s = Math.floor(width / 25)
    const colCount  = Math.floor(this.width / CELL_SIZE);
    const startTime = Date.now();

    for (let i = 0; i < colCount; i++) {
      this.columns.push(
        new MatrixColumn(i, this.maxRows, this.themeColor, this.themeColor2, startTime)
      );
    }
  }

  // ─── حلقة الرسم ───────────────────────────────────────────────────────────

  /**
   * حلقة requestAnimationFrame الرئيسية.
   *
   * التحديث الفعلي للأعمدة يحدث كل updateMs ms فقط (افتراضياً 50ms = 20fps).
   * هذا يُطابق سلوك setInterval(50) في الكود الأصلي.
   *
   * في كل تحديث:
   *   1. fillRect بـ rgba(0,0,0,0.05) → يُخفّت الإطار السابق (تأثير الذيل)
   *   2. ضبط الخط: bold 25px Menlo, Consolas, ...
   *   3. لكل عمود: استدعاء step() الذي يرسم الحرف ويُحدّث الحالة
   */
  _loop() {
    this.rafId = requestAnimationFrame(() => this._loop());

    const now = Date.now();

    // تحقق إذا حان وقت التحديث
    if (now - this.lastStepTime < this.updateMs) return;
    this.lastStepTime = now;

    const ctx = this.ctx;

    // ── الخطوة 1: تخفيت الإطار السابق (الكود الأصلي بالضبط) ──
    // rgba(0,0,0,0.05) يُقلل إضاءة كل نقطة بمقدار 5% في كل فريم
    // النتيجة: ذيل الأحرف يختفي تدريجياً على مدى ~20 فريم (1 ثانية)
    ctx.fillStyle = "rgba(0, 0, 0, 0.05)";
    ctx.fillRect(0, 0, this.width, this.height);

    // ── الخطوة 2: ضبط الخط (الكود الأصلي بالضبط) ──
    ctx.font = `bold ${CELL_SIZE}px Menlo, Consolas, 'Liberation Mono', 'Courier New', monospace`;

    // ── الخطوة 3: تحديث ورسم كل عمود ──
    for (const col of this.columns) {
      col.step(now, this.chars, ctx);
    }
  }

  // ─── API عام ──────────────────────────────────────────────────────────────

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

  /**
   * تغيير لون الثيم ديناميكياً (يُطبَّق عند التحديث التالي).
   * @param {string} colorA - اللون الرئيسي (HEX)
   * @param {string} colorB - اللون الثانوي (HEX)
   */
  setColors(colorA, colorB) {
    this.themeColor  = colorA;
    this.themeColor2 = colorB ?? colorA;
    // إعادة بناء الأعمدة بالألوان الجديدة
    this._buildColumns();
  }
}

// ES Modules export
if (typeof module !== "undefined" && module.exports) {
  module.exports = { MatrixGridEngine, MatrixColumn };
}
