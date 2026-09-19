/**
 * 人工呼吸設定アシスタント
 * 基本モード (IBW & %MV計算) ＆ ASV力学最適化モード (実測R・C・EtCO2・吸気時間Ti算出)
 */

(function () {
  "use strict";

  // ===== 共通状態 =====
  const state = {
    currentMode: "asv", // "basic" | "asv"
    gender: "male",
    height: 170,
    ibw: 66.0,

    // 基本モード用
    basicPercent: 100,

    // ASVモード用
    etco2: 38,
    r: 10,
    c: 50
  };

  function calcIBW(gender, heightCm) {
    const base = gender === "male" ? 50.0 : 45.5;
    const ibw = base + 0.91 * (heightCm - 152.4);
    return Math.round(ibw * 10) / 10;
  }

  // ===== タブ要素 =====
  const tabBasic = document.getElementById("tabBasic");
  const tabAsv = document.getElementById("tabAsv");
  const viewBasic = document.getElementById("viewBasic");
  const viewAsv = document.getElementById("viewAsv");

  if (tabBasic && tabAsv) {
    tabBasic.addEventListener("click", () => switchMode("basic"));
    tabAsv.addEventListener("click", () => switchMode("asv"));
  }

  function switchMode(mode) {
    state.currentMode = mode;
    tabBasic.classList.toggle("active", mode === "basic");
    tabAsv.classList.toggle("active", mode === "asv");

    viewBasic.style.display = mode === "basic" ? "block" : "none";
    viewAsv.style.display = mode === "asv" ? "block" : "none";

    // 共通パラメータ同期
    syncInputs();
    if (mode === "basic") {
      updateBasic();
    } else {
      updateAsv();
    }
  }

  function syncInputs() {
    bHeightSlider.value = state.height;
    aHeightSlider.value = state.height;
    bHeightDisplay.textContent = state.height;
    aHeightDisplay.textContent = state.height;

    bBtnMale.classList.toggle("active", state.gender === "male");
    bBtnFemale.classList.toggle("active", state.gender === "female");
    aBtnMale.classList.toggle("active", state.gender === "male");
    aBtnFemale.classList.toggle("active", state.gender === "female");
  }

  // ==========================================
  // 1. 基本モード (viewBasic) のロジック
  // ==========================================
  const bBtnMale = document.getElementById("bBtnMale");
  const bBtnFemale = document.getElementById("bBtnFemale");
  const bHeightSlider = document.getElementById("bHeightSlider");
  const bHeightDisplay = document.getElementById("bHeightDisplay");
  const bIbwDisplay = document.getElementById("bIbwDisplay");
  const bTvMin = document.getElementById("bTvMin");
  const bTvMax = document.getElementById("bTvMax");
  const bMvBaseL = document.getElementById("bMvBaseL");
  const bMvBaseMl = document.getElementById("bMvBaseMl");
  const bPercentSlider = document.getElementById("bPercentSlider");
  const bPercentDisplay = document.getElementById("bPercentDisplay");
  const bAdjustedBox = document.getElementById("bAdjustedBox");
  const bAdjustedL = document.getElementById("bAdjustedL");
  const bAdjustedMl = document.getElementById("bAdjustedMl");

  bBtnMale.addEventListener("click", () => {
    state.gender = "male";
    syncInputs();
    updateBasic();
  });
  bBtnFemale.addEventListener("click", () => {
    state.gender = "female";
    syncInputs();
    updateBasic();
  });
  bHeightSlider.addEventListener("input", (e) => {
    state.height = parseInt(e.target.value, 10);
    syncInputs();
    updateBasic();
  });
  bPercentSlider.addEventListener("input", (e) => {
    state.basicPercent = parseInt(e.target.value, 10);
    updateBasic();
  });

  function updateBasic() {
    state.ibw = calcIBW(state.gender, state.height);
    bIbwDisplay.textContent = state.ibw.toFixed(1);

    // TV: IBW × 6 〜 8 mL
    const tvMin = Math.round(state.ibw * 6);
    const tvMax = Math.round(state.ibw * 8);
    bTvMin.textContent = tvMin;
    bTvMax.textContent = tvMax;

    // MV基準 (100%): IBW × 100 mL = 0.1 L/kg
    const mvBaseL = Math.round(state.ibw * 0.1 * 10) / 10;
    const mvBaseMl = Math.round(mvBaseL * 1000);
    bMvBaseL.textContent = mvBaseL.toFixed(1);
    bMvBaseMl.textContent = mvBaseMl.toLocaleString();

    // %スライダー
    bPercentDisplay.textContent = state.basicPercent + "%";
    if (state.basicPercent !== 100) {
      bAdjustedBox.style.display = "block";
      const adjL = Math.round((mvBaseL * state.basicPercent / 100) * 10) / 10;
      const adjMl = Math.round(adjL * 1000);
      bAdjustedL.textContent = adjL.toFixed(1);
      bAdjustedMl.textContent = adjMl.toLocaleString();
    } else {
      bAdjustedBox.style.display = "none";
    }
  }

  // ==========================================
  // 2. ASV・力学最適化モード (viewAsv) のロジック
  // ==========================================
  const aBtnMale = document.getElementById("aBtnMale");
  const aBtnFemale = document.getElementById("aBtnFemale");
  const aHeightSlider = document.getElementById("aHeightSlider");
  const aHeightDisplay = document.getElementById("aHeightDisplay");
  const aIbwDisplay = document.getElementById("aIbwDisplay");
  const aTvRangeDisplay = document.getElementById("aTvRangeDisplay");

  const presetNorm = document.getElementById("presetNorm");
  const presetArds = document.getElementById("presetArds");
  const presetCopd = document.getElementById("presetCopd");

  const etco2Slider = document.getElementById("etco2Slider");
  const etco2Display = document.getElementById("etco2Display");
  const etco2Feedback = document.getElementById("etco2Feedback");

  const rSlider = document.getElementById("rSlider");
  const rDisplay = document.getElementById("rDisplay");
  const cSlider = document.getElementById("cSlider");
  const cDisplay = document.getElementById("cDisplay");

  const rcExpDisplay = document.getElementById("rcExpDisplay");
  const rcExpBadge = document.getElementById("rcExpBadge");

  const recMvL = document.getElementById("recMvL");
  const recMvMl = document.getElementById("recMvMl");
  const recVt = document.getElementById("recVt");
  const recVtPerKg = document.getElementById("recVtPerKg");
  const recTvStdNote = document.getElementById("recTvStdNote");
  const recRr = document.getElementById("recRr");
  const recCycleTime = document.getElementById("recCycleTime");

  const recTi = document.getElementById("recTi");
  const recIeRatio = document.getElementById("recIeRatio");
  const recTiNote = document.getElementById("recTiNote");

  const dpDisplay = document.getElementById("dpDisplay");
  const dpStatus = document.getElementById("dpStatus");

  const canvas = document.getElementById("asvCanvas");
  const ctx = canvas ? canvas.getContext("2d") : null;
  const graphTargetVal = document.getElementById("graphTargetVal");

  aBtnMale.addEventListener("click", () => {
    state.gender = "male";
    syncInputs();
    updateAsv();
  });
  aBtnFemale.addEventListener("click", () => {
    state.gender = "female";
    syncInputs();
    updateAsv();
  });
  aHeightSlider.addEventListener("input", (e) => {
    state.height = parseInt(e.target.value, 10);
    syncInputs();
    updateAsv();
  });

  etco2Slider.addEventListener("input", (e) => {
    state.etco2 = parseInt(e.target.value, 10);
    clearPresets();
    updateAsv();
  });
  rSlider.addEventListener("input", (e) => {
    state.r = parseInt(e.target.value, 10);
    clearPresets();
    updateAsv();
  });
  cSlider.addEventListener("input", (e) => {
    state.c = parseInt(e.target.value, 10);
    clearPresets();
    updateAsv();
  });

  presetNorm.addEventListener("click", () => applyAsvPreset("norm", 38, 10, 50));
  presetArds.addEventListener("click", () => applyAsvPreset("ards", 44, 12, 25));
  presetCopd.addEventListener("click", () => applyAsvPreset("copd", 50, 22, 55));

  function applyAsvPreset(type, et, r, c) {
    state.etco2 = et;
    state.r = r;
    state.c = c;
    etco2Slider.value = et;
    rSlider.value = r;
    cSlider.value = c;

    [presetNorm, presetArds, presetCopd].forEach(btn => btn.classList.remove("active"));
    if (type === "norm") presetNorm.classList.add("active");
    if (type === "ards") presetArds.classList.add("active");
    if (type === "copd") presetCopd.classList.add("active");

    updateAsv();
  }

  function clearPresets() {
    [presetNorm, presetArds, presetCopd].forEach(btn => btn.classList.remove("active"));
  }

  function updateAsv() {
    state.ibw = calcIBW(state.gender, state.height);
    const vdMl = Math.round(2.2 * state.ibw);
    const vdL = vdMl / 1000;
    const baseMvL = state.ibw * 0.1;

    // 理想体重 × 6〜8 mL
    const stdTvMin = Math.round(state.ibw * 6);
    const stdTvMax = Math.round(state.ibw * 8);

    aIbwDisplay.textContent = state.ibw.toFixed(1);
    aTvRangeDisplay.textContent = `${stdTvMin} 〜 ${stdTvMax}`;
    recTvStdNote.textContent = `${stdTvMin}〜${stdTvMax}`;

    // EtCO2 補正 (目標 38)
    const targetEt = 38;
    const etRatio = state.etco2 / targetEt;
    const clampedRatio = Math.max(0.6, Math.min(2.2, etRatio));
    const targetMvL = Math.round(baseMvL * clampedRatio * 10) / 10;
    const targetMvMl = Math.round(targetMvL * 1000);

    // 呼気時定数 RCexp
    const rcExpSec = (state.r * (state.c / 1000));
    const rcExpRounded = Math.round(rcExpSec * 100) / 100;

    // Otis式による最適呼吸数
    const a = 0.33;
    const num = Math.sqrt(1 + 4 * a * rcExpSec * (targetMvL / vdL)) - 1;
    const denom = 2 * a * (rcExpSec / 60);
    let optF = Math.round(num / (denom * 60));

    // 安全枠
    const minF = 5;
    const maxF = Math.min(48, Math.round(20 / rcExpSec));
    const minVt = Math.round(4.4 * state.ibw);
    const maxVt = Math.round(Math.min(15.4 * state.ibw, targetMvMl / 5));

    if (isNaN(optF) || optF < minF) optF = minF + 2;
    if (optF > maxF) optF = maxF - 1;

    let optVt = Math.round(targetMvMl / optF);
    if (optVt < minVt) optVt = minVt;
    if (optVt > maxVt) optVt = maxVt;

    const optVtPerKg = (optVt / state.ibw).toFixed(1);
    const tTotal = 60 / optF; // 1呼吸の全周期 [秒]

    // ==========================================
    // 吸気時間 (Ti) & 呼気時間 (Te) の決定ロジック
    // ==========================================
    // 呼気時間はエアートラッピング防止のため Te >= 2.0 * RCexp が必要
    // 病態ごとの時間配分比率:
    let tiRatio;
    if (rcExpRounded < 0.50) {
      // ARDS・硬い肺: 時定数が短く酸素化重視 -> I:E ≈ 1:1.5
      tiRatio = 1 / 2.5; // 40%
    } else if (rcExpRounded > 0.85) {
      // COPD・閉塞性: 呼気時間を最長化 -> I:E ≈ 1:3.5
      tiRatio = 1 / 4.5; // 22%
    } else {
      // 正常肺: 標準 I:E ≈ 1:2.0
      tiRatio = 1 / 3.0; // 33%
    }

    let calcTi = tTotal * tiRatio;
    // 最小吸気時間は 1 * RCexp を担保
    if (calcTi < rcExpSec) calcTi = rcExpSec;
    // 最大吸気時間ガード (成人では通常 1.5s 以下)
    if (calcTi > 1.5) calcTi = 1.5;
    if (calcTi < 0.6) calcTi = 0.6;

    const calcTe = tTotal - calcTi;
    const ieRatioVal = (calcTe / calcTi).toFixed(1);

    // 駆動圧 (Driving Pressure)
    const drivingPressure = Math.round((optVt / state.c) * 10) / 10;

    // 表示更新
    etco2Display.textContent = state.etco2;
    rDisplay.textContent = state.r;
    cDisplay.textContent = state.c;

    if (state.etco2 > 45) {
      const pct = Math.round((clampedRatio - 1) * 100);
      etco2Feedback.textContent = `高炭酸ガス血症傾向（換気要求量: +${pct}% 補正）`;
      etco2Feedback.style.color = "#fbbf24";
    } else if (state.etco2 < 32) {
      const pct = Math.round((1 - clampedRatio) * 100);
      etco2Feedback.textContent = `過換気傾向（換気要求量: -${pct}% 補正）`;
      etco2Feedback.style.color = "#38bdf8";
    } else {
      etco2Feedback.textContent = `EtCO2は適正範囲内です（換気要求比: ${Math.round(clampedRatio * 100)}%）`;
      etco2Feedback.style.color = "var(--text-dim)";
    }

    rcExpDisplay.textContent = rcExpRounded.toFixed(2);
    if (rcExpRounded < 0.50) {
      rcExpBadge.textContent = "拘束性・硬い肺 (ARDS等)";
      rcExpBadge.style.color = "#f87171";
      rcExpBadge.style.borderColor = "rgba(248, 113, 113, 0.3)";
      rcExpBadge.style.background = "rgba(248, 113, 113, 0.12)";
    } else if (rcExpRounded > 0.85) {
      rcExpBadge.textContent = "閉塞性・呼気遅延 (COPD等)";
      rcExpBadge.style.color = "#fbbf24";
      rcExpBadge.style.borderColor = "rgba(251, 191, 36, 0.3)";
      rcExpBadge.style.background = "rgba(251, 191, 36, 0.12)";
    } else {
      rcExpBadge.textContent = "正常肺 (0.50〜0.85s)";
      rcExpBadge.style.color = "var(--color-teal)";
      rcExpBadge.style.borderColor = "rgba(45, 212, 191, 0.3)";
      rcExpBadge.style.background = "rgba(45, 212, 191, 0.12)";
    }

    // 4連推奨カード
    recMvL.textContent = targetMvL.toFixed(1);
    recMvMl.textContent = targetMvMl.toLocaleString();
    recVt.textContent = optVt;
    recVtPerKg.textContent = optVtPerKg;
    recRr.textContent = optF;
    recCycleTime.textContent = tTotal.toFixed(1);

    recTi.textContent = calcTi.toFixed(2);
    recIeRatio.textContent = `1 : ${ieRatioVal}`;
    recTiNote.textContent = `呼気 Te: ${calcTe.toFixed(2)}s (≥ ${(2 * rcExpSec).toFixed(2)}s)`;

    // 駆動圧
    dpDisplay.textContent = drivingPressure.toFixed(1);
    if (drivingPressure <= 14.0) {
      dpStatus.textContent = "良好 (≤ 14 cmH2O)";
      dpStatus.className = "safety-status status-good";
    } else if (drivingPressure <= 17.0) {
      dpStatus.textContent = "注意 (15〜17 cmH2O)";
      dpStatus.className = "safety-status status-warn";
    } else {
      dpStatus.textContent = "過高警告 (> 17 cmH2O)";
      dpStatus.className = "safety-status status-danger";
    }

    if (graphTargetVal) {
      graphTargetVal.textContent = `${optF} bpm / ${optVt} mL (${optVtPerKg} mL/kg)`;
    }

    // Canvas描画
    if (ctx) {
      drawASVGraph(minF, maxF, minVt, maxVt, targetMvMl, optF, optVt);
    }
  }

  // ===== Canvas描画 =====
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

    const axisMaxF = 50;
    const axisMaxVt = 1100;

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

    // セーフティーフレーム
    const sfL = toX(minF);
    const sfR = toX(Math.min(axisMaxF - 2, maxF));
    const sfT = toY(Math.min(axisMaxVt, maxVt));
    const sfB = toY(Math.max(0, minVt));

    const frameGrad = ctx.createLinearGradient(0, sfT, 0, sfB);
    frameGrad.addColorStop(0, "rgba(56, 189, 248, 0.08)");
    frameGrad.addColorStop(1, "rgba(56, 189, 248, 0.02)");
    ctx.fillStyle = frameGrad;
    ctx.fillRect(sfL, sfT, sfR - sfL, sfB - sfT);

    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]);
    ctx.strokeRect(sfL, sfT, sfR - sfL, sfB - sfT);
    ctx.setLineDash([]);

    // 等分時換気量曲線
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

    // 最適目標点
    const ptX = toX(optF);
    const ptY = toY(optVt);

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

    ctx.shadowColor = "rgba(251, 191, 36, 0.9)";
    ctx.shadowBlur = 14;
    ctx.fillStyle = "#fbbf24";
    ctx.beginPath();
    ctx.arc(ptX, ptY, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ptX, ptY, 7, 0, Math.PI * 2);
    ctx.stroke();
  }

  // 初期化実行
  updateBasic();
  updateAsv();
})();
