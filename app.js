/**
 * 人工呼吸設定アシスタント
 * 基本モード (IBW & %MV計算) ＆ ASV力学最適化モード (インタラクティブ手動連動シミュレーション)
 */

(function () {
  "use strict";

  // ===== 状態管理 =====
  const state = {
    currentMode: "asv", // "basic" | "asv"
    gender: "male",
    height: 170,
    ibw: 66.0,

    // 基本モード用
    basicPercent: 100,

    // ASVモード 生体入力値
    etco2: 38,
    r: 10,
    c: 50,

    // ASVモード 推奨値 (Otis理論計算値)
    recMv: 6.6,
    recVt: 470,
    recRr: 14,
    recTi: 1.00,

    // ASVモード 現在設定値 (手動連動スライダー値)
    setMv: 6.6,
    setVt: 470,
    setRr: 14,
    setTi: 1.00
  };

  function calcIBW(gender, heightCm) {
    const base = gender === "male" ? 50.0 : 45.5;
    const ibw = base + 0.91 * (heightCm - 152.4);
    return Math.round(ibw * 10) / 10;
  }

  // ===== タブ切り替え =====
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

    syncInputs();
    if (mode === "basic") {
      updateBasic();
    } else {
      recomputeAsvRecommendation(true);
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
  // 1. 基本モード (viewBasic)
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

    const tvMin = Math.round(state.ibw * 6);
    const tvMax = Math.round(state.ibw * 8);
    bTvMin.textContent = tvMin;
    bTvMax.textContent = tvMax;

    const mvBaseL = Math.round(state.ibw * 0.1 * 10) / 10;
    const mvBaseMl = Math.round(mvBaseL * 1000);
    bMvBaseL.textContent = mvBaseL.toFixed(1);
    bMvBaseMl.textContent = mvBaseMl.toLocaleString();

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
  // 2. ASV・力学最適化モード (viewAsv)
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

  // 推奨値ピル
  const pillRecMv = document.getElementById("pillRecMv");
  const pillRecVt = document.getElementById("pillRecVt");
  const pillRecRr = document.getElementById("pillRecRr");
  const pillRecTi = document.getElementById("pillRecTi");
  const btnResetToRec = document.getElementById("btnResetToRec");

  // 手動操作スライダー
  const setMvSlider = document.getElementById("setMvSlider");
  const setVtSlider = document.getElementById("setVtSlider");
  const setRrSlider = document.getElementById("setRrSlider");
  const setTiSlider = document.getElementById("setTiSlider");

  // 表示フィールド
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
  const graphRecVal = document.getElementById("graphRecVal");

  // イベント登録: 入力値変更
  aBtnMale.addEventListener("click", () => {
    state.gender = "male";
    syncInputs();
    recomputeAsvRecommendation(true);
  });
  aBtnFemale.addEventListener("click", () => {
    state.gender = "female";
    syncInputs();
    recomputeAsvRecommendation(true);
  });
  aHeightSlider.addEventListener("input", (e) => {
    state.height = parseInt(e.target.value, 10);
    syncInputs();
    recomputeAsvRecommendation(true);
  });

  etco2Slider.addEventListener("input", (e) => {
    state.etco2 = parseInt(e.target.value, 10);
    clearPresets();
    recomputeAsvRecommendation(true);
  });
  rSlider.addEventListener("input", (e) => {
    state.r = parseInt(e.target.value, 10);
    clearPresets();
    recomputeAsvRecommendation(true);
  });
  cSlider.addEventListener("input", (e) => {
    state.c = parseInt(e.target.value, 10);
    clearPresets();
    recomputeAsvRecommendation(true);
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

    recomputeAsvRecommendation(true);
  }

  function clearPresets() {
    [presetNorm, presetArds, presetCopd].forEach(btn => btn.classList.remove("active"));
  }

  // 「🔄 推奨値にリセット」ボタン
  btnResetToRec.addEventListener("click", () => {
    state.setMv = state.recMv;
    state.setVt = state.recVt;
    state.setRr = state.recRr;
    state.setTi = state.recTi;
    syncSlidersToState();
    renderAsvView();
  });

  // ==========================================
  // 【最重要】手動スライダー相互連動ロジック
  // ==========================================

  // ① 分時換気量 (setMvSlider) を動かしたとき:
  // -> Otis式により Vt, RR, Ti を自動追従再計算！
  setMvSlider.addEventListener("input", (e) => {
    state.setMv = parseFloat(e.target.value);

    // 新しいsetMvに対してOtis最適解を算出
    const rcExpSec = (state.r * (state.c / 1000));
    const vdMl = Math.round(2.2 * state.ibw);
    const vdL = vdMl / 1000;
    const a = 0.33;

    const num = Math.sqrt(1 + 4 * a * rcExpSec * (state.setMv / vdL)) - 1;
    const denom = 2 * a * (rcExpSec / 60);
    let optF = Math.round(num / (denom * 60));

    const minF = 5;
    const maxF = Math.min(48, Math.round(20 / rcExpSec));
    if (isNaN(optF) || optF < minF) optF = minF + 2;
    if (optF > maxF) optF = maxF - 1;

    state.setRr = optF;
    state.setVt = Math.round((state.setMv * 1000) / state.setRr);

    // Tiの自動連動
    state.setTi = calcRecommendedTi(state.setRr, rcExpSec);

    syncSlidersToState();
    renderAsvView();
  });

  // ② 一回換気量 (setVtSlider) を動かしたとき:
  // -> 現在の分時換気量 (setMv) を維持し、呼吸回数 RR を自動連動 (RR = MV / Vt)！ Tiも連動！
  setVtSlider.addEventListener("input", (e) => {
    state.setVt = parseInt(e.target.value, 10);
    if (state.setVt <= 0) return;

    // RR = (setMv * 1000) / setVt
    let newRr = Math.round((state.setMv * 1000) / state.setVt);
    if (newRr < 5) newRr = 5;
    if (newRr > 50) newRr = 50;
    state.setRr = newRr;

    const rcExpSec = (state.r * (state.c / 1000));
    state.setTi = calcRecommendedTi(state.setRr, rcExpSec);

    syncSlidersToState();
    renderAsvView();
  });

  // ③ 呼吸回数 (setRrSlider) を動かしたとき:
  // -> 現在の分時換気量 (setMv) を維持し、一回換気量 Vt を自動連動 (Vt = MV / RR)！ Tiも連動！
  setRrSlider.addEventListener("input", (e) => {
    state.setRr = parseInt(e.target.value, 10);
    if (state.setRr <= 0) return;

    // Vt = (setMv * 1000) / setRr
    let newVt = Math.round((state.setMv * 1000) / state.setRr);
    if (newVt < 150) newVt = 150;
    if (newVt > 1200) newVt = 1200;
    state.setVt = newVt;

    const rcExpSec = (state.r * (state.c / 1000));
    state.setTi = calcRecommendedTi(state.setRr, rcExpSec);

    syncSlidersToState();
    renderAsvView();
  });

  // ④ 吸気時間 (setTiSlider) を動かしたとき:
  // -> I:E比や呼気時間Teが追従！
  setTiSlider.addEventListener("input", (e) => {
    state.setTi = parseFloat(e.target.value);
    renderAsvView();
  });

  function syncSlidersToState() {
    setMvSlider.value = state.setMv.toFixed(1);
    setVtSlider.value = state.setVt;
    setRrSlider.value = state.setRr;
    setTiSlider.value = state.setTi.toFixed(2);
  }

  // 呼吸回数と時定数に応じた推奨Ti算出関数
  function calcRecommendedTi(rr, rcExpSec) {
    const tTotal = 60 / rr;
    let tiRatio;
    if (rcExpSec < 0.50) {
      tiRatio = 1 / 2.5; // ARDS
    } else if (rcExpSec > 0.85) {
      tiRatio = 1 / 4.5; // COPD
    } else {
      tiRatio = 1 / 3.0; // 正常
    }
    let ti = tTotal * tiRatio;
    if (ti < rcExpSec) ti = rcExpSec;
    if (ti > 1.5) ti = 1.5;
    if (ti < 0.6) ti = 0.6;
    return Math.round(ti * 20) / 20; // 0.05刻み
  }

  // ==========================================
  // 推奨値の計算 & 全体レンダリング
  // ==========================================
  function recomputeAsvRecommendation(applyToSet = false) {
    state.ibw = calcIBW(state.gender, state.height);
    const vdMl = Math.round(2.2 * state.ibw);
    const vdL = vdMl / 1000;
    const baseMvL = state.ibw * 0.1;

    // EtCO2 補正 (目標 38)
    const etRatio = state.etco2 / 38;
    const clampedRatio = Math.max(0.6, Math.min(2.2, etRatio));
    state.recMv = Math.round(baseMvL * clampedRatio * 10) / 10;

    // 呼気時定数 RCexp
    const rcExpSec = (state.r * (state.c / 1000));

    // Otis式 最適呼吸数
    const a = 0.33;
    const num = Math.sqrt(1 + 4 * a * rcExpSec * (state.recMv / vdL)) - 1;
    const denom = 2 * a * (rcExpSec / 60);
    let optF = Math.round(num / (denom * 60));

    const minF = 5;
    const maxF = Math.min(48, Math.round(20 / rcExpSec));
    if (isNaN(optF) || optF < minF) optF = minF + 2;
    if (optF > maxF) optF = maxF - 1;
    state.recRr = optF;

    // 推奨Vt
    state.recVt = Math.round((state.recMv * 1000) / state.recRr);

    // 推奨Ti
    state.recTi = calcRecommendedTi(state.recRr, rcExpSec);

    // 初回またはパラメータ変更時に手動設定値へ適用
    if (applyToSet) {
      state.setMv = state.recMv;
      state.setVt = state.recVt;
      state.setRr = state.recRr;
      state.setTi = state.recTi;
      syncSlidersToState();
    }

    renderAsvView();
  }

  function renderAsvView() {
    const rcExpSec = (state.r * (state.c / 1000));
    const rcExpRounded = Math.round(rcExpSec * 100) / 100;

    // TV基準値 (IBW × 6〜8)
    const stdTvMin = Math.round(state.ibw * 6);
    const stdTvMax = Math.round(state.ibw * 8);

    aIbwDisplay.textContent = state.ibw.toFixed(1);
    aTvRangeDisplay.textContent = `${stdTvMin} 〜 ${stdTvMax}`;
    recTvStdNote.textContent = `${stdTvMin}〜${stdTvMax}`;

    // EtCO2 フィードバック
    etco2Display.textContent = state.etco2;
    rDisplay.textContent = state.r;
    cDisplay.textContent = state.c;

    if (state.etco2 > 45) {
      etco2Feedback.textContent = `高炭酸ガス血症傾向（要求換気量: 増量補正中）`;
      etco2Feedback.style.color = "#fbbf24";
    } else if (state.etco2 < 32) {
      etco2Feedback.textContent = `低炭酸ガス・過換気傾向（要求換気量: 減量補正中）`;
      etco2Feedback.style.color = "#38bdf8";
    } else {
      etco2Feedback.textContent = `EtCO2は適正範囲内です（基準目標 38 mmHg）`;
      etco2Feedback.style.color = "var(--text-dim)";
    }

    // RCexp バッジ
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

    // 推奨値ピルバッジの更新 (常に保持表示)
    pillRecMv.textContent = `推奨 ${state.recMv.toFixed(1)}`;
    pillRecVt.textContent = `推奨 ${state.recVt}`;
    pillRecRr.textContent = `推奨 ${state.recRr}`;
    pillRecTi.textContent = `推奨 ${state.recTi.toFixed(2)}s`;

    // 現在設定値の表示更新
    recMvL.textContent = state.setMv.toFixed(1);
    recMvMl.textContent = Math.round(state.setMv * 1000).toLocaleString();

    recVt.textContent = state.setVt;
    recVtPerKg.textContent = (state.setVt / state.ibw).toFixed(1);

    recRr.textContent = state.setRr;
    const tTotal = 60 / state.setRr;
    recCycleTime.textContent = tTotal.toFixed(1);

    recTi.textContent = state.setTi.toFixed(2);
    const te = tTotal - state.setTi;
    const ieVal = te > 0 ? (te / state.setTi).toFixed(1) : "0.0";
    recIeRatio.textContent = `1 : ${ieVal}`;

    // 呼気時間の安全性判定 (Te >= 2 * RCexp)
    const minTeRequired = 2 * rcExpSec;
    if (te < minTeRequired) {
      recTiNote.textContent = `⚠️呼気 Te: ${te.toFixed(2)}s (Auto-PEEP警告 < ${(minTeRequired).toFixed(2)}s)`;
      recTiNote.style.color = "#f87171";
    } else {
      recTiNote.textContent = `呼気 Te: ${te.toFixed(2)}s (安全 ≥ ${(minTeRequired).toFixed(2)}s)`;
      recTiNote.style.color = "var(--text-dim)";
    }

    // 駆動圧 (Driving Pressure: ΔP = setVt / C)
    const dp = Math.round((state.setVt / state.c) * 10) / 10;
    dpDisplay.textContent = dp.toFixed(1);
    if (dp <= 14.0) {
      dpStatus.textContent = "良好 (≤ 14 cmH2O)";
      dpStatus.className = "safety-status status-good";
    } else if (dp <= 17.0) {
      dpStatus.textContent = "注意 (15〜17 cmH2O)";
      dpStatus.className = "safety-status status-warn";
    } else {
      dpStatus.textContent = "過高警告 (> 17 cmH2O)";
      dpStatus.className = "safety-status status-danger";
    }

    // グラフ凡例テキスト
    if (graphTargetVal) {
      graphTargetVal.textContent = `${state.setRr} bpm / ${state.setVt} mL`;
    }
    if (graphRecVal) {
      graphRecVal.textContent = `${state.recRr} bpm / ${state.recVt} mL`;
    }

    // Canvasグラフィック描画
    if (ctx) {
      drawInteractiveGraph(rcExpSec);
    }
  }

  // ===== Canvasグラフィックリアルタイム描画 =====
  function drawInteractiveGraph(rcExpSec) {
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

    // セーフティーフレーム (安全枠)
    const minF = 5;
    const maxF = Math.min(48, Math.round(20 / rcExpSec));
    const minVt = Math.round(4.4 * state.ibw);
    const maxVt = Math.round(Math.min(15.4 * state.ibw, (state.setMv * 1000) / 5));

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

    // 等分時換気量曲線 (現在設定 setMv に追従)
    const currentMvMl = state.setMv * 1000;
    ctx.beginPath();
    ctx.strokeStyle = "rgba(251, 191, 36, 0.6)";
    ctx.lineWidth = 2.5;
    let started = false;
    for (let f = 4; f <= axisMaxF; f += 0.5) {
      const vt = currentMvMl / f;
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

    // 1. Otis推奨点 (破線サークル)
    const recX = toX(state.recRr);
    const recY = toY(state.recVt);
    ctx.strokeStyle = "rgba(148, 163, 184, 0.8)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.arc(recX, recY, 9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // 2. 現在設定点 (ユーザー操作点: 黄色の二重円＆グロウ)
    const setX = toX(state.setRr);
    const setY = toY(state.setVt);

    // 十字破線ガイド
    ctx.strokeStyle = "rgba(251, 191, 36, 0.35)";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(padL, setY);
    ctx.lineTo(setX, setY);
    ctx.moveTo(setX, padT + plotH);
    ctx.lineTo(setX, setY);
    ctx.stroke();
    ctx.setLineDash([]);

    // 外側グロウ
    ctx.shadowColor = "rgba(251, 191, 36, 0.9)";
    ctx.shadowBlur = 14;
    ctx.fillStyle = "#fbbf24";
    ctx.beginPath();
    ctx.arc(setX, setY, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // 白枠リング
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(setX, setY, 7, 0, Math.PI * 2);
    ctx.stroke();
  }

  // 初期化実行
  updateBasic();
  recomputeAsvRecommendation(true);
})();
