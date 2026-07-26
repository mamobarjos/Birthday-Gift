/**
 * =============================================================================
 *  MEMORY BOOK — Correct 3D Page-Flip Book (v11.0)
 *
 *  الهيكل الهندسي الصحيح:
 *  ────────────────────────
 *  - الكتاب مغلق: يظهر الغلاف (Cover.jpeg) فقط بعرض صفحة واحدة
 *  - عند الفتح: الغلاف ينقلب من اليمين لليسار فيظهر:
 *      · اليسار: ظهر الغلاف = 0.jpeg
 *      · اليمين: صفحة Leaf 1 الأمامية = 1.jpeg
 *  - عند تقليب الصفحة: Leaf 1 تنقلب من اليمين لليسار فيظهر:
 *      · اليسار: ظهر Leaf 1 = 2.jpeg
 *      · اليمين: Leaf 2 الأمامية = 3.jpeg (وعلى ظهرها Cover.jpeg)
 *  - عند الإغلاق: Leaf 2 تنقلب من اليمين لليسار → ظهرها (Cover.jpeg) يغطي كل شيء
 *
 *  إصلاح Z-index لمنع ظهور 3 ألواح:
 *  ─────────────────────────────────
 *  - cover-leaf (طبيعي z=30) → (مقلوب z=8)   ← يندس خلف Leaf1
 *  - leaf-1     (طبيعي z=20) → (مقلوب z=12)  ← يطغى على cover خلف لكن ليس على leaf2
 *  - leaf-2     (طبيعي z=10) → (مقلوب z=35)  ← يغطي كل شيء لإغلاق صحيح
 * =============================================================================
 */

"use strict";

class MemoryBook {
  constructor(opts = {}) {
    this.catGif      = opts.catGif      || "";
    this.coverImg    = opts.coverImg    || "";
    this.spreads     = opts.spreads     || [];
    this.onComplete  = opts.onComplete  || null;

    this.currentStep = 0; // 0=closed, 1=spread1, 2=spread2, 3=closing
    this.isAnimating = false;
    this.isDragging  = false;
    this.startX      = 0;
    this.dragDelta   = 0;

    this._timers     = [];
    this._bubbleInt  = null;
    this._typeTimer  = null;

    this._injectStyles();
    this._buildDOM();
  }

  // ─── STYLES ────────────────────────────────────────────────────────────────

  _injectStyles() {
    if (document.getElementById("mb-styles")) return;
    const s = document.createElement("style");
    s.id = "mb-styles";
    s.textContent = `
      /* ── حاوية الكتاب الرئيسية ── */
      #mb-container {
        position: fixed; inset: 0;
        z-index: 50000;
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        pointer-events: none; opacity: 0;
        transition: opacity 0.8s ease;
      }
      #mb-container.mb-visible { opacity: 1; pointer-events: all; }

      /* ── خلفية النجوم ── */
      #mb-star-bg {
        position: absolute; inset: 0;
        z-index: -1; opacity: 0;
        transition: opacity 1.2s ease;
        background: radial-gradient(ellipse at center, #181928 0%, #030308 100%);
        overflow: hidden;
      }
      #mb-star-bg.mb-active { opacity: 1; }
      .mb-star {
        position: absolute; background: #fff; border-radius: 50%;
        box-shadow: 0 0 6px rgba(255,255,255,0.8);
        animation: mb-twinkle var(--dur) infinite ease-in-out;
      }
      @keyframes mb-twinkle {
        0%, 100% { opacity: 0.2; transform: scale(0.8); }
        50%       { opacity: 1;   transform: scale(1.3); }
      }

      /* ── قلوب فقاعية (❤️ فقط — z أقل من القط!) ── */
      .mb-bubble-heart {
        position: fixed; bottom: -40px;
        font-size: var(--size);
        pointer-events: none;
        animation: mb-bubbleRise var(--dur) ease-in-out forwards;
        z-index: 60000;
        user-select: none; opacity: 0.65;
        filter: drop-shadow(0 0 5px rgba(255,45,117,0.4));
      }
      @keyframes mb-bubbleRise {
        0%   { transform: translateY(0) translateX(0) scale(0.7); opacity: 0; }
        20%  { opacity: 0.75; transform: translateY(-20vh) translateX(var(--sway)) scale(1.05); }
        50%  { transform: translateY(-50vh) translateX(calc(var(--sway) * -1)) scale(1); }
        80%  { opacity: 0.7;  transform: translateY(-80vh) translateX(var(--sway)) scale(1); }
        100% { transform: translateY(-105vh) translateX(0) scale(0.75); opacity: 0; }
      }

      /* ── مشهد القطة (z أعلى من القلوب لتمر من خلفها!) ── */
      #mb-cat-scene {
        position: absolute; inset: 0;
        display: flex; align-items: center; justify-content: center;
        opacity: 0; pointer-events: none;
        transition: opacity 0.8s ease;
        z-index: 65000;
      }
      #mb-cat-scene.mb-active { opacity: 1; pointer-events: all; }
      #mb-cat-img {
        width: min(280px, 58vw);
        animation: mb-catZoom 6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        filter: drop-shadow(0 0 25px rgba(255,120,180,0.4));
      }
      @keyframes mb-catZoom {
        0%   { transform: scale(0.4) translateY(40px); opacity: 0; }
        20%  { opacity: 1; }
        65%  { transform: scale(1.15) translateY(0); }
        85%  { transform: scale(1.1)  translateY(-4px); }
        100% { transform: scale(1.2)  translateY(0); opacity: 1; }
      }

      /* ── حاوية الكتاب ── */
      #mb-book-wrapper {
        position: absolute; inset: 0;
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        gap: 22px;
        opacity: 0; pointer-events: none;
        transition: opacity 0.8s ease, transform 0.8s ease;
        transform: translateY(30px);
      }
      #mb-book-wrapper.mb-active {
        opacity: 1; pointer-events: all; transform: translateY(0);
      }

      /* ── شريط الرسائل ── */
      #mb-msg-bar {
        background: #fff; border-radius: 18px;
        padding: 14px 24px;
        max-width: min(680px, 92vw); min-width: min(360px, 86vw);
        min-height: 76px;
        display: flex; align-items: center; justify-content: center;
        box-shadow: 0 10px 30px rgba(0,0,0,0.4);
        opacity: 0; transform: translateY(-20px);
        transition: opacity 0.5s ease, transform 0.5s ease;
        direction: rtl;
      }
      #mb-msg-bar.mb-show { opacity: 1; transform: translateY(0); }
      #mb-msg-text {
        font-family: 'Noto Kufi Arabic', Arial, sans-serif;
        font-size: clamp(13.5px, 3vw, 16px);
        color: #222; line-height: 1.65;
        direction: rtl; text-align: center; font-weight: 500;
        word-break: keep-all; overflow-wrap: break-word;
      }
      @media (max-width: 500px) {
        #mb-msg-bar { padding: 12px 16px; min-height: 78px; }
      }

      /* ══════════════════════════════════════════════════════
         BOOK 3D — الهيكل الهندسي الأساسي
         ══════════════════════════════════════════════════════ */

      /* حاوية الكتاب */
      #mb-book-3d {
        perspective: 2200px;
        -webkit-perspective: 2200px;
        position: relative;
        width: min(290px, 58vw);
        height: min(400px, 76vw);
        transition: width 0.7s cubic-bezier(0.4,0,0.2,1),
                    height 0.7s cubic-bezier(0.4,0,0.2,1);
        cursor: grab; user-select: none; touch-action: none;
        border-radius: 10px;
      }
      #mb-book-3d.mb-is-open {
        width: min(580px, 92vw);
        height: min(400px, 64vw);
      }
      #mb-book-3d:active { cursor: grabbing; }

      /* كعب الجلد (يتوسط الكتاب عند الفتح) */
      #mb-book-spine {
        position: absolute;
        top: 0; bottom: 0; left: 0;
        width: 12px; transform: translateX(-50%);
        background: linear-gradient(90deg, #111 0%, #3a3a3a 50%, #111 100%);
        z-index: 50; border-radius: 2px;
        box-shadow: 0 0 12px rgba(0,0,0,0.9);
        transition: left 0.7s cubic-bezier(0.4,0,0.2,1);
      }
      #mb-book-3d.mb-is-open #mb-book-spine { left: 50%; }

      /* الحاوية الداخلية — لا تستخدم preserve-3d لمنع تعارض z-index! */
      #mb-book-inner {
        width: 100%; height: 100%;
        position: relative;
      }

      /* ══ الأوراق 3D ══
         كل ورقة:
         - مغلق: تشغل 100% من عرض الكتاب المغلق، يمنة الكتاب
         - مفتوح: تشغل 50% (النصف الأيمن) من الكتاب الموسّع
         - محور الدوران: الحافة اليسرى (transform-origin: left center)
         - الانقلاب: rotateY(-180deg) → الورقة تنتقل لليسار
      */
      .mb-leaf {
        position: absolute;
        top: 0; bottom: 0; left: 0; right: 0;
        transform-origin: left center;
        transform-style: preserve-3d;
        -webkit-transform-style: preserve-3d;
        transition: transform 0.95s cubic-bezier(0.25,0.46,0.45,0.94),
                    left 0.7s cubic-bezier(0.4,0,0.2,1),
                    right 0.7s cubic-bezier(0.4,0,0.2,1);
        border-radius: 6px 12px 12px 6px;
        box-shadow: 0 8px 28px rgba(0,0,0,0.65);
        will-change: transform, left, right;
      }
      /* عند فتح الكتاب: كل الأوراق تصبح النصف الأيمن */
      #mb-book-3d.mb-is-open .mb-leaf {
        left: 50%; right: 0;
      }
      .mb-leaf.mb-dragging { transition: none !important; }

      /* الوجهان الأمامي والخلفي لكل ورقة */
      .mb-leaf-face {
        position: absolute; inset: 0;
        backface-visibility: hidden;
        -webkit-backface-visibility: hidden;
        overflow: hidden; background: #0a0a0a;
        border-radius: 6px 12px 12px 6px;
        transform-style: preserve-3d;
        -webkit-transform-style: preserve-3d;
        will-change: transform;
      }
      /* إعطاء عمق فيزيائي طفيف (2.5px) لمنع تداخل الوجوه واهتزاز الرمشات على شاشات الهاتف عالية الدقة (Retina Z-fighting Fix) */
      .mb-leaf-front {
        transform: rotateY(0deg) translateZ(2.5px);
        -webkit-transform: rotateY(0deg) translateZ(2.5px);
      }
      .mb-leaf-back {
        transform: rotateY(180deg) translateZ(2.5px);
        -webkit-transform: rotateY(180deg) translateZ(2.5px);
        border-radius: 12px 6px 6px 12px;
      }
      .mb-leaf-face img {
        width: 100%; height: 100%;
        object-fit: cover; display: block;
        backface-visibility: hidden;
        -webkit-backface-visibility: hidden;
        transform: translateZ(0);
        -webkit-transform: translateZ(0);
        pointer-events: none;
      }

      /* ── Z-index: الأوراق في وضعها الطبيعي (قبل الانقلاب) ── */
      #mb-cover-leaf { z-index: 30; }
      #mb-leaf-1      { z-index: 20; }
      #mb-leaf-2      { z-index: 10; }

      /* ── Z-index: بعد الانقلاب ──
         الورقة المقلوبة تنتقل لليسار، نخفض z-index لتُدفن خلف
         الأوراق التالية التي لم تُقلب بعد (على اليمين).
         استثناء: leaf-2 عند انقلابها تأخذ أعلى z-index لتغلق الكتاب نظيفاً.
      */
      #mb-cover-leaf.mb-flipped { z-index: 8;  }
      #mb-leaf-1.mb-flipped      { z-index: 12; }
      #mb-leaf-2.mb-flipped      { z-index: 35; }

      /* ── وضع الانقلاب ── */
      .mb-leaf.mb-flipped {
        transform: rotateY(-180deg);
        -webkit-transform: rotateY(-180deg);
      }
    `;
    document.head.appendChild(s);
  }

  // ─── DOM BUILD ──────────────────────────────────────────────────────────────

  _buildDOM() {
    this.$el = document.createElement("div");
    this.$el.id = "mb-container";

    // خلفية النجوم
    this.$starBg = document.createElement("div");
    this.$starBg.id = "mb-star-bg";
    this._generateStars(70);
    this.$el.appendChild(this.$starBg);

    // مشهد القطة
    this.$cat = document.createElement("div");
    this.$cat.id = "mb-cat-scene";
    this.$cat.innerHTML = `<img id="mb-cat-img" src="${this.catGif}" alt="Cat" />`;
    this.$el.appendChild(this.$cat);

    const s0 = this.spreads[0] || {};
    const s1 = this.spreads[1] || {};

    this.$bookWrap = document.createElement("div");
    this.$bookWrap.id = "mb-book-wrapper";
    this.$bookWrap.innerHTML = `
      <div id="mb-msg-bar">
        <span id="mb-msg-text"></span>
      </div>

      <div id="mb-book-3d">
        <div id="mb-book-spine"></div>
        <div id="mb-book-inner">

          <!--
            Leaf 2 (القاعدة / الورقة الأخيرة)
            الأمام: 3.jpeg  |  الخلف: Cover.jpeg (لإغلاق الكتاب بتتابع)
            z=10 طبيعي → z=35 مقلوب (يغطي كل شيء عند الإغلاق)
          -->
          <div class="mb-leaf" id="mb-leaf-2">
            <div class="mb-leaf-face mb-leaf-front">
              <img src="${s1.right || ''}" alt="Photo 3" />
            </div>
            <div class="mb-leaf-face mb-leaf-back">
              <img src="${this.coverImg}" alt="Back Cover (same as front)" />
            </div>
          </div>

          <!--
            Leaf 1 (الورقة الوسطى)
            الأمام: 1.jpeg  |  الخلف: 2.jpeg
            z=20 طبيعي → z=12 مقلوب
          -->
          <div class="mb-leaf" id="mb-leaf-1">
            <div class="mb-leaf-face mb-leaf-front">
              <img src="${s0.right || ''}" alt="Photo 1" />
            </div>
            <div class="mb-leaf-face mb-leaf-back">
              <img src="${s1.left || ''}" alt="Photo 2" />
            </div>
          </div>

          <!--
            Cover Leaf (الغلاف — أعلى ورقة)
            الأمام: Cover.jpeg  |  الخلف: 0.jpeg (مطبوع على ظهر الغلاف)
            z=30 طبيعي → z=8 مقلوب (يذهب خلف كل شيء)
          -->
          <div class="mb-leaf" id="mb-cover-leaf">
            <div class="mb-leaf-face mb-leaf-front">
              <img src="${this.coverImg}" alt="Cover" />
            </div>
            <div class="mb-leaf-face mb-leaf-back">
              <img src="${s0.left || ''}" alt="Photo 0" />
            </div>
          </div>

        </div><!-- /mb-book-inner -->
      </div><!-- /mb-book-3d -->
    `;
    this.$el.appendChild(this.$bookWrap);
    document.body.appendChild(this.$el);

    // مراجع العناصر
    this.$msgBar    = document.getElementById("mb-msg-bar");
    this.$msgText   = document.getElementById("mb-msg-text");
    this.$book3d    = document.getElementById("mb-book-3d");
    this.$coverLeaf = document.getElementById("mb-cover-leaf");
    this.$leaf1     = document.getElementById("mb-leaf-1");
    this.$leaf2     = document.getElementById("mb-leaf-2");

    this._setupDragEvents();
  }

  _generateStars(count) {
    for (let i = 0; i < count; i++) {
      const el = document.createElement("div");
      el.className = "mb-star";
      const size = Math.random() * 3 + 1;
      el.style.cssText = `
        width: ${size}px; height: ${size}px;
        left: ${Math.random() * 100}%;
        top:  ${Math.random() * 100}%;
        --dur: ${Math.random() * 3 + 2}s;
      `;
      this.$starBg.appendChild(el);
    }
  }

  // ─── PUBLIC START ───────────────────────────────────────────────────────────

  start() {
    requestAnimationFrame(() => {
      this.$el.classList.add("mb-visible");
      this.$starBg.classList.add("mb-active");
      this.$cat.classList.add("mb-active");
    });

    this._startRedHearts();

    // انتقل تلقائياً للكتاب بعد مشهد القطة
    this._timers.push(setTimeout(() => this._showBook(), 4600));
  }

  _startRedHearts() {
    const spawn = () => {
      const el = document.createElement("div");
      el.className = "mb-bubble-heart";
      el.textContent = "❤️"; // ❤️ فقط

      const left = 20 + Math.random() * 60;
      const dur  = 5500 + Math.random() * 2000;
      const size = (18 + Math.random() * 10) + "px";
      const sway = (Math.random() * 24 - 12) + "px";

      el.style.left = `${left}vw`;
      el.style.setProperty("--dur",  `${dur}ms`);
      el.style.setProperty("--size", size);
      el.style.setProperty("--sway", sway);

      // إلحاق بالحاوية لتمر الجسيمات خلف القطة (z-index: 65000 أعلى من 60000)
      if (this.$el) {
        this.$el.appendChild(el);
      }
      setTimeout(() => el.remove(), dur);
    };

    spawn();
    this._bubbleInt = setInterval(spawn, 5500);
  }

  _showBook() {
    this.$cat.style.transition = "opacity 0.8s ease";
    this.$cat.style.opacity = "0";

    this._timers.push(setTimeout(() => {
      this.$cat.classList.remove("mb-active");
      this.$bookWrap.classList.add("mb-active");
    }, 800));
  }

  // ─── DRAG EVENTS ────────────────────────────────────────────────────────────

  _setupDragEvents() {
    const el = this.$book3d;
    let dragLeaf = null; // الورقة التي يتم سحبها حالياً

    const onStart = (clientX) => {
      if (this.isAnimating) return;
      this.isDragging  = true;
      this.startX      = clientX;
      this.dragDelta   = 0;
      dragLeaf         = null;
    };

    const onMove = (clientX) => {
      if (!this.isDragging || this.isAnimating) return;
      this.dragDelta = clientX - this.startX;

      const bookW = el.getBoundingClientRect().width || 400;
      const ratio = Math.max(-1, Math.min(1, this.dragDelta / (bookW * 0.6)));

      // اختر الورقة المناسبة للسحب بناءً على الخطوة الحالية والاتجاه
      if (this.currentStep === 0 && this.dragDelta < 0) {
        if (!dragLeaf) {
          dragLeaf = this.$coverLeaf;
          this.$book3d.classList.add("mb-is-open");
          dragLeaf.classList.add("mb-dragging");
        }
        const deg = Math.max(-180, ratio * 180);
        dragLeaf.style.transform = `rotateY(${deg}deg)`;

      } else if (this.currentStep === 1) {
        if (this.dragDelta < 0) {
          if (!dragLeaf) { dragLeaf = this.$leaf1; dragLeaf.classList.add("mb-dragging"); }
          const deg = Math.max(-180, ratio * 180);
          dragLeaf.style.transform = `rotateY(${deg}deg)`;
        } else if (this.dragDelta > 0) {
          if (!dragLeaf) { dragLeaf = this.$coverLeaf; dragLeaf.classList.add("mb-dragging"); }
          // عكس: من -180 للعودة نحو 0
          const deg = Math.min(0, -180 + Math.abs(ratio) * 180);
          dragLeaf.style.transform = `rotateY(${deg}deg)`;
        }

      } else if (this.currentStep === 2) {
        if (this.dragDelta < 0) {
          if (!dragLeaf) { dragLeaf = this.$leaf2; dragLeaf.classList.add("mb-dragging"); }
          const deg = Math.max(-180, ratio * 180);
          dragLeaf.style.transform = `rotateY(${deg}deg)`;
        } else if (this.dragDelta > 0) {
          if (!dragLeaf) { dragLeaf = this.$leaf1; dragLeaf.classList.add("mb-dragging"); }
          const deg = Math.min(0, -180 + Math.abs(ratio) * 180);
          dragLeaf.style.transform = `rotateY(${deg}deg)`;
        }
      }
    };

    const onEnd = () => {
      if (!this.isDragging) return;
      this.isDragging = false;

      // أعد الأوراق لوضع CSS (أزل التحويل اليدوي)
      [this.$coverLeaf, this.$leaf1, this.$leaf2].forEach(l => {
        l.classList.remove("mb-dragging");
        l.style.transform = "";
      });

      const bookW     = el.getBoundingClientRect().width || 400;
      const threshold = bookW * 0.15;

      if (Math.abs(this.dragDelta) < 12) {
        // نقرة: تقدم للأمام
        this._stepForward();
      } else if (this.dragDelta < -threshold) {
        this._stepForward();
      } else if (this.dragDelta > threshold) {
        this._stepBackward();
      } else if (this.currentStep === 0) {
        // لم يكتمل السحب: أغلق من جديد
        this.$book3d.classList.remove("mb-is-open");
      }

      dragLeaf = null;
    };

    // أحداث الفأرة
    el.addEventListener("pointerdown",  e => { e.preventDefault(); onStart(e.clientX); });
    window.addEventListener("pointermove", e => onMove(e.clientX));
    window.addEventListener("pointerup",   () => onEnd());

    // أحداث اللمس
    el.addEventListener("touchstart", e => onStart(e.touches[0].clientX), { passive: true });
    window.addEventListener("touchmove",  e => onMove(e.touches[0].clientX), { passive: true });
    window.addEventListener("touchend",   () => onEnd());
  }

  // ─── STEP CONTROLLER ────────────────────────────────────────────────────────

  _stepForward() {
    if (this.isAnimating) return;

    if (this.currentStep === 0) {
      // 0 → 1: فتح الغلاف
      this._doOpen();

    } else if (this.currentStep === 1) {
      // 1 → 2: تقليب Leaf 1
      this._doTurnPage();

    } else if (this.currentStep === 2) {
      // 2 → إغلاق
      this._doClose();
    }
  }

  _stepBackward() {
    if (this.isAnimating) return;

    if (this.currentStep === 2) {
      // 2 → 1: إعادة Leaf 1
      this.isAnimating = true;
      this.currentStep = 1;

      this.$leaf1.classList.remove("mb-flipped");

      this._timers.push(setTimeout(() => {
        const s0 = this.spreads[0] || {};
        this._typeMessage(s0.message || "");
      }, 50));

      this._timers.push(setTimeout(() => { this.isAnimating = false; }, 960));

    } else if (this.currentStep === 1) {
      // 1 → 0: إعادة الغلاف
      this.isAnimating = true;
      this.currentStep = 0;

      this.$msgBar.classList.remove("mb-show");
      this.$coverLeaf.classList.remove("mb-flipped");

      this._timers.push(setTimeout(() => {
        this.$book3d.classList.remove("mb-is-open");
        this.isAnimating = false;
      }, 960));
    }
  }

  _doOpen() {
    this.isAnimating = true;
    this.currentStep = 1;

    // وسّع الكتاب ثم اقلب الغلاف
    this.$book3d.classList.add("mb-is-open");

    // اقلب الغلاف بعد بدء اتساع الكتاب (تأخير بسيط للانسيابية)
    this._timers.push(setTimeout(() => {
      this.$coverLeaf.classList.add("mb-flipped");
    }, 25));

    const s0 = this.spreads[0] || {};
    this._typeMessage(s0.message || "");
    this.$msgBar.classList.add("mb-show");

    this._timers.push(setTimeout(() => { this.isAnimating = false; }, 960));
  }

  _doTurnPage() {
    this.isAnimating = true;
    this.currentStep = 2;

    this.$leaf1.classList.add("mb-flipped");

    // تأخير طفيف 50ms لرسالة النص حتى تبدأ حركة الدوران في المعالج الرسومي أولاً دون تعارض (Anti-Flicker)
    this._timers.push(setTimeout(() => {
      const s1 = this.spreads[1] || {};
      this._typeMessage(s1.message || "");
    }, 50));

    this._timers.push(setTimeout(() => { this.isAnimating = false; }, 960));
  }

  _doClose() {
    this.isAnimating = true;
    this.currentStep = 3;

    // اقلب Leaf 2 لإظهار ظهر الغلاف فورا في المعالج الرسومي
    this.$leaf2.classList.add("mb-flipped");

    // تأخير إزالة العناصر وإخفاء شريط الرسائل 50ms لمنع تقطيع الإطارات والرمشة على الهاتف
    this._timers.push(setTimeout(() => {
      if (this._bubbleInt) {
        clearInterval(this._bubbleInt);
        this._bubbleInt = null;
      }
      document.querySelectorAll(".mb-bubble-heart").forEach(el => el.remove());
      this.$msgBar.classList.remove("mb-show");
    }, 50));

    this._timers.push(setTimeout(() => {
      // بعد انتهاء قلب Leaf 2: أغلق عرض الكتاب ليعود لعرض صفحة واحدة
      this.$book3d.classList.remove("mb-is-open");

      this._timers.push(setTimeout(() => {
        // بعد انتهاء انكماش الكتاب: تلاشٍ نهائي
        this.$bookWrap.style.transition = "opacity 0.9s ease";
        this.$bookWrap.style.opacity    = "0";

        this._timers.push(setTimeout(() => {
          this.$el.classList.remove("mb-visible");
          this.destroy();
          if (this.onComplete) this.onComplete();
        }, 900));
      }, 720));
    }, 960));
  }

  // ─── HELPERS ────────────────────────────────────────────────────────────────

  _typeMessage(text, speed = 110) {
    if (this._typeTimer) clearTimeout(this._typeTimer);
    this.$msgText.textContent = "";
    const words = text.trim().split(/\s+/);
    let i = 0;

    const tick = () => {
      if (i >= words.length) return;
      this.$msgText.textContent += (i === 0 ? "" : " ") + words[i++];
      this._typeTimer = setTimeout(tick, speed);
    };
    this._typeTimer = setTimeout(tick, 180);
  }

  destroy() {
    if (this._bubbleInt) clearInterval(this._bubbleInt);
    this._timers.forEach(clearTimeout);
    if (this._typeTimer) clearTimeout(this._typeTimer);
    if (this.$el && this.$el.parentNode) this.$el.parentNode.removeChild(this.$el);
  }
}
