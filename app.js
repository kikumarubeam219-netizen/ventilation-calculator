/**
 * ASV 換気設定シミュレーター
 * Hamilton Medical ASV（Adaptive Support Ventilation）アルゴリズム準拠
 */

(function () {
  "use strict";

  // ===== DOM要素 =====
  const btnMale = document.getElementById("btnMale");
  const btnFemale = document.getElementById("btnFemale");
  const heightSlider = document.getElementById("heightSlider");
  const heightDisplay = document.getElementById("heightDisplay");
  const ibwDisplay = document.getElementById("ibwDisplay");
  const baseMvDisplay = document.getElementById("baseMvDisplay");

  const minVolSlider = document.getElementById("minVolSlider");
  const minVolDisplay = document.getElementById("minVolDisplay");
  const targetMvDisplay = document.getElementById("targetMvDisplay");
  const targetMvMlDisplay = document.getElementById("targetMvMlDisplay");

  const presetBtns = document.querySelectorAll(".preset-btn[data-mv]");
  const addBtns = document.querySelectorAll(".preset-btn[data-add]");

  const mechBtns = {
    normal: document.getElementById("mechNormal"),
    ards: document.getElementById("mechArds"),
    copd: document.getElementById("mechCopd")
  };

  const canvas = document.getElementById("asvCanvas");
  const ctx = canvas.getContext("2d");

  const graphTargetVal = document.getElementById("graphTargetVal");
  const limitMinVt = document.getElementById("limitMinVt");
  const limitMaxVt = document.getElementById("limitMaxVt");
  const limitMinF = document.getElementById("limitMinF");
  const limitMaxF = document.getElementById("limitMaxF");

  // ===== 状態 =====
  const state = {
    gender: "male",      // "male" | "female"
    height: 170,         // cm
    ibw: 66.0,           // kg
    minVolPct: 100,      // %
    mech: "normal",      // "normal" | "ards" | "copd"
    rcExp: 0.60          // 秒
  };

  // ===== 初期イベント登録 =====
  btnMale.addEventListener("click", () => setGender("male"));
  btnFemale.addEventListener("click", () => setGender("female"));

  heightSlider.addEventListener("input", (e) => {
    state.height = parseInt(e.target.value, 10);
    recalculate();
  });

  minVolSlider.addEventListener("input", (e) => {
    state.minVolPct = parseInt(e.target.value, 10);
    updatePresetHighlight();
    recalculate();
  });

  presetBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const mv = parseInt(btn.getAttribute("data-mv"), 10);
      minVolSlider.value = mv;
      state.minVolPct = mv;
      updatePresetHighlight();
      recalculate();
    });
  });

  addBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const add = parseInt(btn.getAttribute("data-add"), 10);
      let next = state.minVolPct + add;
      if (next > 350) next = 350;
      minVolSlider.value = next;
      state.minVolPct = next;
      updatePresetHighlight();
      recalculate();
    });
  });

  mechBtns.normal.addEventListener("click", () => setMechanics("normal", 0.60));
  mechBtns.ards.addEventListener("click", () => setMechanics("ards", 0.30));
  mechBtns.copd.addEventListener("click", () => setMechanics("copd", 1.20));

  function setGender(g) {
    state.gender = g;
    btnMale.classList.toggle("active", g === "male");
    btnFemale.classList.toggle("active", g === "female");
    recalculate();
  }

  function setMechanics(type, rc) {
    state.mech = type;
    state.rcExp = rc;
    Object.keys(mechBtns).forEach((k) => {
      mechBtns[k].classList.toggle("active", k === type);
    });
    recalculate();
  }

  function updatePresetHighlight() {
    presetBtns.forEach((btn) => {
      const val = parseInt(btn.getAttribute("data-mv"), 10);
      btn.classList.toggle("active", val === state.minVolPct);
    });
  }

  // ===== 計算コア =====
  function calcIBW(gender, heightCm) {
    // Devine式
    const base = gender === "male" ? 50.0 : 45.5;
    const ibw = base + 0.91 * (heightCm - 152.4);
    return Math.round(ibw * 10) / 10;
  }

  function recalculate() {
    // 1. IBW
    state.ibw = calcIBW(state.gender, state.height);
    const baseMv = Math.round(state.ibw * 0.1 * 10) / 10; // L/min (0.1 L/kg)

    // 2. 目標分時換気量
    const targetMvL = (state.ibw * 0.1 * (state.minVolPct / 100)); // L/min
    const targetMvMl = Math.round(targetMvL * 1000); // mL/min

    // 画面表示更新
    heightDisplay.textContent = state.height;
    ibwDisplay.textContent = state.ibw.toFixed(1);
    baseMvDisplay.textContent = baseMv.toFixed(1);

    minVolDisplay.textContent = state.minVolPct;
    targetMvDisplay.textContent = targetMvL.toFixed(1);
    targetMvMlDisplay.textContent = targetMvMl.toLocaleString();

    // 3. セーフティーフレーム計算 (Hamilton ASV規則)
    // 最小Vt: 4.4 mL/kg (死腔2.2mL/kgの2倍)
    const minVt = Math.round(4.4 * state.ibw);
    // 最大Vt: 15.4 mL/kg (または目標MinVolの1/5)
    const maxVt = Math.round(Math.min(15.4 * state.ibw, targetMvMl / 5));

    // 最小呼吸数: 成人は 5 回/分
    const minF = 5;
    // 最大呼吸数: 60, 20/RCexp, 22*(%MinVol/100) の最小値
    const maxF_calculated = Math.min(
      60,
      Math.round(20 / state.rcExp),
      Math.round(22 * (state.minVolPct / 100))
    );
    const maxF = Math.max(minF + 3, maxF_calculated);

    limitMinVt.textContent = minVt;
    limitMaxVt.textContent = maxVt;
    limitMinF.textContent = minF;
    limitMaxF.textContent = maxF;

    // 4. Otisの式による最適呼吸数 (f_opt) の理論計算
    // Otis minimal work:
    // a: 呼吸流速波形係数 (正弦波近似: a = π^2 / 4 ≈ 2.46 または 2*pi^2/4 等、実効係数 a_eff ≈ 0.33)
    const a = 0.33;
    const Vd = (2.2 * state.ibw) / 1000; // 死腔 [L]
    const Ve = targetMvL; // 目標分時換気量 [L/min]
    const rc = state.rcExp; // [s]

    // 連立方程式の解析解:
    // f_opt = [ -1 + sqrt(1 + 2 * a * rc * 60 * (Ve / Vd)) ] / (a * rc * 60) ... 秒/分単位換算
    // 臨床的近似式:
    const num = Math.sqrt(1 + 4 * a * rc * (Ve / Vd) * (60 / 60)) - 1;
    const denom = 2 * a * (rc / 60);
    let optF = Math.round(num / (denom * 60));

    // 病態ごとの臨床補正 & 安全枠内クランプ
    if (isNaN(optF) || optF < minF) optF = minF + 2;
    if (optF > maxF) optF = maxF - 1;

    // 目標一回換気量: Target Vt = Target MV / f_opt
    let optVt = Math.round(targetMvMl / optF);
    // Vt上下限にクランプ
    if (optVt < minVt) optVt = minVt;
    if (optVt > maxVt) optVt = maxVt;

    const optVtPerKg = (optVt / state.ibw).toFixed(1);
    graphTargetVal.textContent = `${optF} bpm / ${optVt} mL (${optVtPerKg} mL/kg)`;

    // 5. グラフィック描画
    drawASVGraph(minF, maxF, minVt, maxVt, targetMvMl, optF, optVt);
  }

  // ===== Canvasグラフィック描画 =====
  function drawASVGraph(minF, maxF, minVt, maxVt, targetMvMl, optF, optVt) {
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const padL = 50;
    const padR = 20;
    const padT = 25;
    const padB = 35;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;

    const axisMaxF = 50;   // bpm
    const axisMaxVt = 1100; // mL

    function toX(f) { return padL + (f / axisMaxF) * plotW; }
    function toY(vt) { return padT + plotH - (vt / axisMaxVt) * plotH; }

    // 背景グリッド
    ctx.strokeStyle = "rgba(148, 163, 184, 0.08)";
    ctx.lineWidth = 1;
    for (let f = 10; f <= 40; f += 10) {
      ctx.beginPath();
      ctx.moveTo(toX(f), padT);
      ctx.lineTo(toX(f), padT + plotH);
      ctx.stroke();
    }
    for (let vt = 200; vt <= 1000; vt += 200) {
      ctx.beginPath();
      ctx.moveTo(padL, toY(vt));
      ctx.lineTo(padL + plotW, toY(vt));
      ctx.stroke();
    }

    // 軸ラベル
    ctx.fillStyle = "#64748b";
    ctx.font = "11px 'JetBrains Mono', monospace";
    ctx.textAlign = "center";
    for (let f = 10; f <= 40; f += 10) {
      ctx.fillText(f, toX(f), padT + plotH + 16);
    }
    ctx.font = "11px 'Noto Sans JP', sans-serif";
    ctx.fillText("呼吸回数 f (回/分)", padL + plotW / 2, h - 5);

    ctx.font = "11px 'JetBrains Mono', monospace";
    ctx.textAlign = "right";
    for (let vt = 200; vt <= 1000; vt += 200) {
      ctx.fillText(vt, padL - 8, toY(vt) + 4);
    }
    ctx.save();
    ctx.translate(14, padT + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = "center";
    ctx.font = "11px 'Noto Sans JP', sans-serif";
    ctx.fillText("一回換気量 Vt (mL)", 0, 0);
    ctx.restore();

    // セーフティーフレーム (安全枠) 描画
    const sfL = toX(minF);
    const sfR = toX(Math.min(axisMaxF - 2, maxF));
    const sfT = toY(Math.min(axisMaxVt, maxVt));
    const sfB = toY(Math.max(0, minVt));

    // フレーム内部ハイライト
    const frameGrad = ctx.createLinearGradient(0, sfT, 0, sfB);
    frameGrad.addColorStop(0, "rgba(56, 189, 248, 0.08)");
    frameGrad.addColorStop(1, "rgba(56, 189, 248, 0.02)");
    ctx.fillStyle = frameGrad;
    ctx.fillRect(sfL, sfT, sfR - sfL, sfB - sfT);

    // フレーム枠線（破線）
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]);
    ctx.strokeRect(sfL, sfT, sfR - sfL, sfB - sfT);
    ctx.setLineDash([]);

    // 等分時換気量曲線 (Vt * f = Target MinVol)
    ctx.beginPath();
    ctx.strokeStyle = "rgba(251, 191, 36, 0.6)";
    ctx.lineWidth = 2.5;
    let started = false;
    for (let f = 4; f <= axisMaxF; f += 0.5) {
      const vt = targetMvMl / f;
      if (vt <= axisMaxVt && vt >= 50) {
        const x = toX(f);
        const y = toY(vt);
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      }
    }
    ctx.stroke();

    // 最適目標点（黄色のグロウ円）
    const ptX = toX(optF);
    const ptY = toY(optVt);

    // 十字破線ガイド
    ctx.strokeStyle = "rgba(251, 191, 36, 0.35)";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(padL, ptY);
    ctx.lineTo(ptX, ptY);
    ctx.moveTo(ptX, padT + plotH);
    ctx.lineTo(ptX, ptY);
    ctx.stroke();
    ctx.setLineDash([]);

    // 外側グロウ
    ctx.shadowColor = "rgba(251, 191, 36, 0.9)";
    ctx.shadowBlur = 14;
    ctx.fillStyle = "#fbbf24";
    ctx.beginPath();
    ctx.arc(ptX, ptY, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // 白枠リング
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ptX, ptY, 7, 0, Math.PI * 2);
    ctx.stroke();
  }

  // 初回計算実行
  recalculate();
})();
