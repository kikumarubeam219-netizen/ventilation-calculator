/**
 * 換気量計算ツール (力学最適化 & 高度臨床対応) コントローラー
 * 3モード統合版 (基本モード / 力学最適化モード / 高度臨床モード)
 */
(function () {
  "use strict";

  // ==========================================
  // ユーティリティ (Devine予測体重式)
  // ==========================================
  function calcPBW(gender, heightCm) {
    if (gender === "male") {
      return 50.0 + 0.91 * (heightCm - 152.4);
    } else {
      return 45.5 + 0.91 * (heightCm - 152.4);
    }
  }

  function calcRecommendedTi(rr, rcExpSec) {
    const tTotal = 60 / rr;
    let tiRatio;
    if (rcExpSec > 0.8) {
      tiRatio = 0.22;
    } else if (rcExpSec < 0.45) {
      tiRatio = 0.35;
    } else {
      tiRatio = 0.28;
    }
    let ti = tTotal * tiRatio;
    if (ti < rcExpSec) ti = rcExpSec;
    if (ti > 1.5) ti = 1.5;
    if (ti < 0.6) ti = 0.6;
    return Math.round(ti * 20) / 20;
  }

  // ==========================================
  // モードタブ管理
  // ==========================================
  const tabBasic = document.getElementById("tabBasic");
  const tabOpt = document.getElementById("tabOpt");
  const tabAdv = document.getElementById("tabAdv");

  const viewBasic = document.getElementById("viewBasic");
  const viewOpt = document.getElementById("viewOpt");
  const viewAdv = document.getElementById("viewAdv");

  let activeMode = "opt";

  tabBasic.addEventListener("click", () => switchTab("basic"));
  tabOpt.addEventListener("click", () => switchTab("opt"));
  tabAdv.addEventListener("click", () => switchTab("adv"));

  function switchTab(mode) {
    activeMode = mode;
    tabBasic.classList.toggle("active", mode === "basic");
    tabOpt.classList.toggle("active", mode === "opt");
    tabAdv.classList.toggle("active", mode === "adv");

    viewBasic.style.display = mode === "basic" ? "block" : "none";
    viewOpt.style.display = mode === "opt" ? "block" : "none";
    viewAdv.style.display = mode === "adv" ? "block" : "none";

    if (mode === "basic") {
      updateBasic();
    } else if (mode === "opt") {
      renderOptView();
    } else if (mode === "adv") {
      renderAdvView();
    }
  }

  // ==========================================
  // モード 1: 基本モード
  // ==========================================
  const bState = {
    gender: "male",
    height: 170,
    mvPct: 100
  };

  const bBtnMale = document.getElementById("bBtnMale");
  const bBtnFemale = document.getElementById("bBtnFemale");
  const bHeightInput = document.getElementById("bHeightInput");
  const bHeightSlider = document.getElementById("bHeightSlider");
  const bPbwDisplay = document.getElementById("bPbwDisplay");
  const bTvMin = document.getElementById("bTvMin");
  const bTvMax = document.getElementById("bTvMax");
  const bMvBaseL = document.getElementById("bMvBaseL");
  const bMvBaseMl = document.getElementById("bMvBaseMl");
  const bMvPctInput = document.getElementById("bMvPctInput");
  const bMvPctSlider = document.getElementById("bMvPctSlider");
  const bMvTargetL = document.getElementById("bMvTargetL");
  const bMvTargetMl = document.getElementById("bMvTargetMl");

  bBtnMale.addEventListener("click", () => {
    bState.gender = "male";
    bBtnMale.classList.add("active");
    bBtnFemale.classList.remove("active");
    updateBasic();
  });

  bBtnFemale.addEventListener("click", () => {
    bState.gender = "female";
    bBtnFemale.classList.add("active");
    bBtnMale.classList.remove("active");
    updateBasic();
  });

  function updateBasic() {
    const pbw = calcPBW(bState.gender, bState.height);
    const tvMin = Math.round(pbw * 6);
    const tvMax = Math.round(pbw * 8);

    const baseMvL = pbw * 0.1;
    const baseMvMl = Math.round(baseMvL * 1000);

    const targetMvL = baseMvL * (bState.mvPct / 100);
    const targetMvMl = Math.round(targetMvL * 1000);

    bPbwDisplay.textContent = pbw.toFixed(1);
    bTvMin.textContent = tvMin;
    bTvMax.textContent = tvMax;

    bMvBaseL.textContent = baseMvL.toFixed(1);
    bMvBaseMl.textContent = baseMvMl.toLocaleString();

    bMvTargetL.textContent = targetMvL.toFixed(1);
    bMvTargetMl.textContent = targetMvMl.toLocaleString();

    bHeightInput.value = bState.height;
    bHeightSlider.value = bState.height;
    bMvPctInput.value = bState.mvPct;
    bMvPctSlider.value = bState.mvPct;
  }

  // ==========================================
  // モード 2: 力学最適化モード
  // ==========================================
  const optState = {
    gender: "male",
    height: 170,
    etco2: 38,
    r: 10,
    c: 50,
    pbw: 66.0,

    recMv: 6.6,
    recVt: 470,
    recRr: 14,
    recTi: 1.00,

    setMv: 6.6,
    setVt: 470,
    setRr: 14,
    setTi: 1.00
  };

  const aBtnMale = document.getElementById("aBtnMale");
  const aBtnFemale = document.getElementById("aBtnFemale");
  const aHeightInput = document.getElementById("aHeightInput");
  const aHeightSlider = document.getElementById("aHeightSlider");
  const aPbwDisplay = document.getElementById("aPbwDisplay");
  const aTvRangeDisplay = document.getElementById("aTvRangeDisplay");

  const presetNorm = document.getElementById("presetNorm");
  const presetArds = document.getElementById("presetArds");
  const presetCopd = document.getElementById("presetCopd");

  const cardEtco2 = document.getElementById("cardEtco2");
  const cardR = document.getElementById("cardR");
  const cardC = document.getElementById("cardC");

  const etco2Input = document.getElementById("etco2Input");
  const etco2Slider = document.getElementById("etco2Slider");
  const rInput = document.getElementById("rInput");
  const rSlider = document.getElementById("rSlider");
  const cInput = document.getElementById("cInput");
  const cSlider = document.getElementById("cSlider");

  const rcExpDisplay = document.getElementById("rcExpDisplay");
  const rcExpBadge = document.getElementById("rcExpBadge");

  const setMvInput = document.getElementById("setMvInput");
  const setMvSlider = document.getElementById("setMvSlider");
  const pillRecMv = document.getElementById("pillRecMv");
  const recMvMl = document.getElementById("recMvMl");

  const setVtInput = document.getElementById("setVtInput");
  const setVtSlider = document.getElementById("setVtSlider");
  const pillRecVt = document.getElementById("pillRecVt");
  const recVtPerKg = document.getElementById("recVtPerKg");
  const recTvStdNote = document.getElementById("recTvStdNote");

  const setRrInput = document.getElementById("setRrInput");
  const setRrSlider = document.getElementById("setRrSlider");
  const pillRecRr = document.getElementById("pillRecRr");
  const recCycleTime = document.getElementById("recCycleTime");

  const setTiInput = document.getElementById("setTiInput");
  const setTiSlider = document.getElementById("setTiSlider");
  const pillRecTi = document.getElementById("pillRecTi");
  const recIeRatio = document.getElementById("recIeRatio");
  const recTiNote = document.getElementById("recTiNote");

  const btnResetToRec = document.getElementById("btnResetToRec");
  const dpDisplay = document.getElementById("dpDisplay");
  const dpStatus = document.getElementById("dpStatus");

  const optCanvas = document.getElementById("optCanvas");
  const graphActiveInfo = document.getElementById("graphActiveInfo");
  const graphTargetVal = document.getElementById("graphTargetVal");
  const graphRecVal = document.getElementById("graphRecVal");

  aBtnMale.addEventListener("click", () => {
    optState.gender = "male";
    aBtnMale.classList.add("active");
    aBtnFemale.classList.remove("active");
    recomputeRecommendation(true);
  });

  aBtnFemale.addEventListener("click", () => {
    optState.gender = "female";
    aBtnFemale.classList.add("active");
    aBtnMale.classList.remove("active");
    recomputeRecommendation(true);
  });

  presetNorm.addEventListener("click", () => applyPreset("norm", 38, 10, 50));
  presetArds.addEventListener("click", () => applyPreset("ards", 44, 12, 25));
  presetCopd.addEventListener("click", () => applyPreset("copd", 50, 22, 55));

  function applyPreset(type, et, r, c) {
    optState.etco2 = et;
    optState.r = r;
    optState.c = c;

    presetNorm.classList.toggle("active", type === "norm");
    presetArds.classList.toggle("active", type === "ards");
    presetCopd.classList.toggle("active", type === "copd");

    triggerHighlight([cardEtco2, cardR, cardC]);
    syncInputsToOptState();
    recomputeRecommendation(true);
  }

  function triggerHighlight(elements) {
    elements.forEach((el) => {
      if (!el) return;
      el.classList.remove("pulse-highlight");
      void el.offsetWidth;
      el.classList.add("pulse-highlight");
    });
  }

  btnResetToRec.addEventListener("click", () => {
    optState.setMv = optState.recMv;
    optState.setVt = optState.recVt;
    optState.setRr = optState.recRr;
    optState.setTi = optState.recTi;
    syncInputsToOptState();
    renderOptView();
  });

  function handleMvChange(newMv) {
    optState.setMv = parseFloat(newMv.toFixed(1));
    const rcExpSec = (optState.r * (optState.c / 1000));
    const vdMl = Math.round(2.2 * optState.pbw);
    const vdL = vdMl / 1000;
    const a = 0.33;

    const term1 = 1 + 2 * a * rcExpSec * (optState.setMv / vdL);
    let optF = (Math.sqrt(Math.max(0.1, term1)) - 1) / (a * rcExpSec);
    optF = Math.round(optF);
    if (optF < 6) optF = 6;
    if (optF > 40) optF = 40;

    optState.setRr = optF;
    optState.setVt = Math.round((optState.setMv * 1000) / optState.setRr);
    optState.setTi = calcRecommendedTi(optState.setRr, rcExpSec);

    syncInputsToOptState();
    renderOptView();
  }

  function handleVtChange(newVt) {
    optState.setVt = Math.round(newVt);
    if (optState.setVt <= 0) return;

    let newRr = Math.round((optState.setMv * 1000) / optState.setVt);
    if (newRr < 5) newRr = 5;
    if (newRr > 50) newRr = 50;

    optState.setRr = newRr;
    const rcExpSec = (optState.r * (optState.c / 1000));
    optState.setTi = calcRecommendedTi(optState.setRr, rcExpSec);

    syncInputsToOptState();
    renderOptView();
  }

  function handleRrChange(newRr) {
    optState.setRr = Math.round(newRr);
    if (optState.setRr <= 0) return;

    let newVt = Math.round((optState.setMv * 1000) / optState.setRr);
    if (newVt < 150) newVt = 150;
    if (newVt > 1200) newVt = 1200;

    optState.setVt = newVt;
    const rcExpSec = (optState.r * (optState.c / 1000));
    optState.setTi = calcRecommendedTi(optState.setRr, rcExpSec);

    syncInputsToOptState();
    renderOptView();
  }

  function handleTiChange(newTi) {
    optState.setTi = parseFloat(newTi.toFixed(2));
    syncInputsToOptState();
    renderOptView();
  }

  function syncInputsToOptState() {
    aHeightInput.value = optState.height;
    aHeightSlider.value = optState.height;
    etco2Input.value = optState.etco2;
    etco2Slider.value = optState.etco2;
    rInput.value = optState.r;
    rSlider.value = optState.r;
    cInput.value = optState.c;
    cSlider.value = optState.c;

    setMvInput.value = optState.setMv.toFixed(1);
    setMvSlider.value = optState.setMv.toFixed(1);
    setVtInput.value = optState.setVt;
    setVtSlider.value = optState.setVt;
    setRrInput.value = optState.setRr;
    setRrSlider.value = optState.setRr;
    setTiInput.value = optState.setTi.toFixed(2);
    setTiSlider.value = optState.setTi.toFixed(2);
  }

  function recomputeRecommendation(applyToSet = false) {
    optState.pbw = calcPBW(optState.gender, optState.height);
    const vdMl = Math.round(2.2 * optState.pbw);
    const vdL = vdMl / 1000;
    const baseMvL = optState.pbw * 0.1;

    const etRatio = optState.etco2 / 38;
    let targetMvL = baseMvL * etRatio;
    targetMvL = Math.round(targetMvL * 10) / 10;
    if (targetMvL < 2.0) targetMvL = 2.0;
    if (targetMvL > 22.0) targetMvL = 22.0;
    optState.recMv = targetMvL;

    const rcExpSec = (optState.r * (optState.c / 1000));
    const a = 0.33;
    const term1 = 1 + 2 * a * rcExpSec * (optState.recMv / vdL);
    let optF = (Math.sqrt(Math.max(0.1, term1)) - 1) / (a * rcExpSec);
    optF = Math.round(optF);
    if (optF < 8) optF = 8;
    if (optF > 36) optF = 36;
    optState.recRr = optF;

    optState.recVt = Math.round((optState.recMv * 1000) / optState.recRr);
    optState.recTi = calcRecommendedTi(optState.recRr, rcExpSec);

    if (applyToSet) {
      optState.setMv = optState.recMv;
      optState.setVt = optState.recVt;
      optState.setRr = optState.recRr;
      optState.setTi = optState.recTi;
      syncInputsToOptState();
    }

    renderOptView();
  }

  function renderOptView() {
    const rcExpSec = (optState.r * (optState.c / 1000));
    const rcExpRounded = Math.round(rcExpSec * 100) / 100;

    const stdTvMin = Math.round(optState.pbw * 6);
    const stdTvMax = Math.round(optState.pbw * 8);

    aPbwDisplay.textContent = optState.pbw.toFixed(1);
    aTvRangeDisplay.textContent = stdTvMin + " 〜 " + stdTvMax;
    recTvStdNote.textContent = stdTvMin + "〜" + stdTvMax;

    rcExpDisplay.textContent = rcExpRounded.toFixed(2);
    if (rcExpRounded < 0.5) {
      rcExpBadge.textContent = "拘束性パターン (短時定数)";
      rcExpBadge.style.color = "#38bdf8";
      rcExpBadge.style.borderColor = "rgba(56, 189, 248, 0.4)";
      rcExpBadge.style.background = "rgba(56, 189, 248, 0.15)";
    } else if (rcExpRounded > 0.85) {
      rcExpBadge.textContent = "閉塞性パターン (長時定数)";
      rcExpBadge.style.color = "#fbbf24";
      rcExpBadge.style.borderColor = "rgba(251, 191, 36, 0.4)";
      rcExpBadge.style.background = "rgba(251, 191, 36, 0.15)";
    } else {
      rcExpBadge.textContent = "正常 (0.50〜0.85s)";
      rcExpBadge.style.color = "#2dd4bf";
      rcExpBadge.style.borderColor = "rgba(45, 212, 191, 0.4)";
      rcExpBadge.style.background = "rgba(45, 212, 191, 0.15)";
    }

    pillRecMv.textContent = "推奨 " + optState.recMv.toFixed(1);
    pillRecVt.textContent = "推奨 " + optState.recVt;
    pillRecRr.textContent = "推奨 " + optState.recRr;
    pillRecTi.textContent = "推奨 " + optState.recTi.toFixed(2);

    recMvMl.textContent = Math.round(optState.setMv * 1000).toLocaleString();
    recVtPerKg.textContent = (optState.setVt / optState.pbw).toFixed(1);

    const tTotal = 60 / optState.setRr;
    recCycleTime.textContent = tTotal.toFixed(1);

    const te = Math.max(0.1, tTotal - optState.setTi);
    const ieRatioVal = Math.round((te / optState.setTi) * 10) / 10;
    recIeRatio.textContent = "1 : " + ieRatioVal.toFixed(1);

    const safeTe = 2 * rcExpSec;
    if (te >= safeTe) {
      recTiNote.textContent = "呼気 Te: " + te.toFixed(1) + "s (≧ 2×RCexp: 充足)";
      recTiNote.style.color = "var(--color-emerald)";
    } else {
      recTiNote.textContent = "呼気 Te: " + te.toFixed(1) + "s (呼気不足・AutoPEEP注意)";
      recTiNote.style.color = "var(--color-rose)";
    }

    const dp = Math.round((optState.setVt / optState.c) * 10) / 10;
    dpDisplay.textContent = dp.toFixed(1);

    if (dp <= 14.0) {
      dpStatus.textContent = "良好 (≦ 14 cmH2O)";
      dpStatus.className = "safety-status status-good";
    } else if (dp <= 18.0) {
      dpStatus.textContent = "注意 (14〜18 cmH2O)";
      dpStatus.className = "safety-status status-warn";
    } else {
      dpStatus.textContent = "危険高圧 (> 18 cmH2O)";
      dpStatus.className = "safety-status status-danger";
    }

    if (graphTargetVal) graphTargetVal.textContent = optState.setRr + " bpm / " + optState.setVt + " mL";
    if (graphRecVal) graphRecVal.textContent = optState.recRr + " bpm / " + optState.recVt + " mL";

    if (graphActiveInfo) {
      graphActiveInfo.textContent = "設定点: RR " + optState.setRr + " 回/分 / Vt " + optState.setVt + " mL (MV " + optState.setMv.toFixed(1) + " L/min, 推定ΔP " + dp.toFixed(1) + " cmH2O)";
    }

    drawSafetyGraphic();
  }

  function drawSafetyGraphic() {
    if (!optCanvas) return;
    const ctx = optCanvas.getContext("2d");
    const w = optCanvas.width;
    const h = optCanvas.height;

    ctx.clearRect(0, 0, w, h);

    const padL = 50, padR = 25, padT = 20, padB = 40;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;

    function toX(f) { return padL + (f / 45) * plotW; }
    function toY(vt) { return padT + plotH - (vt / 1000) * plotH; }

    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = 1;

    for (let f = 10; f <= 40; f += 10) {
      const x = toX(f);
      ctx.beginPath(); ctx.moveTo(x, padT); ctx.lineTo(x, padT + plotH); ctx.stroke();
      ctx.fillStyle = "#cbd5e1"; ctx.font = "11px 'JetBrains Mono', monospace"; ctx.textAlign = "center";
      ctx.fillText(f.toString(), x, padT + plotH + 16);
    }
    for (let vt = 200; vt <= 800; vt += 200) {
      const y = toY(vt);
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + plotW, y); ctx.stroke();
      ctx.fillStyle = "#cbd5e1"; ctx.font = "11px 'JetBrains Mono', monospace"; ctx.textAlign = "right";
      ctx.fillText(vt.toString(), padL - 8, y + 4);
    }

    ctx.fillStyle = "#e2e8f0"; ctx.font = "bold 11px 'Noto Sans JP', sans-serif"; ctx.textAlign = "center";
    ctx.fillText("呼吸回数 f (回/分)", padL + plotW / 2, padT + plotH + 34);

    const rcExpSec = (optState.r * (optState.c / 1000));
    const minF = 5;
    const maxF = Math.min(48, Math.round(20 / rcExpSec));
    const minVt = Math.round(4.4 * optState.pbw);
    const maxVt = Math.round(Math.min(15.4 * optState.pbw, (optState.setMv * 1000) / 5));

    const sfL = toX(minF);
    const sfR = toX(Math.min(43, maxF));
    const sfT = toY(Math.min(950, maxVt));
    const sfB = toY(minVt);

    ctx.fillStyle = "rgba(56, 189, 248, 0.07)";
    ctx.fillRect(sfL, sfT, sfR - sfL, sfB - sfT);
    ctx.strokeStyle = "rgba(56, 189, 248, 0.75)";
    ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]);
    ctx.strokeRect(sfL, sfT, sfR - sfL, sfB - sfT);
    ctx.setLineDash([]);

    ctx.strokeStyle = "rgba(251, 191, 36, 0.5)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    let started = false;
    for (let f = 5; f <= 44; f += 0.5) {
      const vt = (optState.setMv * 1000) / f;
      if (vt < 0 || vt > 1000) continue;
      const x = toX(f), y = toY(vt);
      if (!started) { ctx.moveTo(x, y); started = true; } else { ctx.lineTo(x, y); }
    }
    ctx.stroke();

    // 推奨点 (ひし形)
    const recX = toX(optState.recRr), recY = toY(optState.recVt);
    ctx.save();
    ctx.translate(recX, recY);
    ctx.rotate(Math.PI / 4);
    ctx.shadowColor = "rgba(56, 189, 248, 0.9)";
    ctx.shadowBlur = 12;
    ctx.fillStyle = "#38bdf8";
    ctx.fillRect(-7, -7, 14, 14);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.strokeRect(-7, -7, 14, 14);
    ctx.restore();

    // 設定点 (円)
    const setX = toX(optState.setRr), setY = toY(optState.setVt);
    ctx.strokeStyle = "rgba(251, 191, 36, 0.4)";
    ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(setX, padT); ctx.lineTo(setX, padT + plotH);
    ctx.moveTo(padL, setY); ctx.lineTo(padL + plotW, setY);
    ctx.stroke(); ctx.setLineDash([]);

    ctx.shadowColor = "rgba(251, 191, 36, 0.95)";
    ctx.shadowBlur = 14;
    ctx.fillStyle = "#fbbf24";
    ctx.beginPath(); ctx.arc(setX, setY, 8, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(setX, setY, 8, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = "#090d16";
    ctx.beginPath(); ctx.arc(setX, setY, 2.5, 0, Math.PI * 2); ctx.fill();
  }

  // ==========================================
  // モード 3: 高度臨床モード (新設)
  // ==========================================
  const advState = {
    gender: "male",
    height: 170,
    pbw: 66.0,

    etco2: 38,
    r: 10,
    c: 50,

    // ABGパラメータ
    paco2: 48,
    ph: 7.32,
    targetPaco2: 40,

    // 気道内圧パラメータ
    peep: 8,
    flowWave: "decel", // "decel" | "square"

    recMv: 6.6,
    recVt: 470,
    recRr: 14,
    recTi: 1.00,

    setMv: 6.6,
    setVt: 470,
    setRr: 14,
    setTi: 1.00
  };

  const advBtnMale = document.getElementById("advBtnMale");
  const advBtnFemale = document.getElementById("advBtnFemale");
  const advHeightInput = document.getElementById("advHeightInput");
  const advHeightSlider = document.getElementById("advHeightSlider");
  const advPbwDisplay = document.getElementById("advPbwDisplay");
  const advTvRangeDisplay = document.getElementById("advTvRangeDisplay");

  const advPresetNorm = document.getElementById("advPresetNorm");
  const advPresetArds = document.getElementById("advPresetArds");
  const advPresetCopd = document.getElementById("advPresetCopd");

  const cardAdvEtco2 = document.getElementById("cardAdvEtco2");
  const cardAdvR = document.getElementById("cardAdvR");
  const cardAdvC = document.getElementById("cardAdvC");

  const advEtco2Input = document.getElementById("advEtco2Input");
  const advEtco2Slider = document.getElementById("advEtco2Slider");
  const advRInput = document.getElementById("advRInput");
  const advRSlider = document.getElementById("advRSlider");
  const advCInput = document.getElementById("advCInput");
  const advCSlider = document.getElementById("advCSlider");

  const advRcExpDisplay = document.getElementById("advRcExpDisplay");
  const advRcExpBadge = document.getElementById("advRcExpBadge");

  const advPaco2Input = document.getElementById("advPaco2Input");
  const advPaco2Slider = document.getElementById("advPaco2Slider");
  const advPhInput = document.getElementById("advPhInput");
  const advPhSlider = document.getElementById("advPhSlider");
  const advTargetPaco2Input = document.getElementById("advTargetPaco2Input");
  const advTargetPaco2Slider = document.getElementById("advTargetPaco2Slider");

  const btnPaco2Norm = document.getElementById("btnPaco2Norm");
  const btnPaco2Perm = document.getElementById("btnPaco2Perm");
  const btnPaco2Hyper = document.getElementById("btnPaco2Hyper");

  const advPaEtDiffDisplay = document.getElementById("advPaEtDiffDisplay");
  const advVdVtDisplay = document.getElementById("advVdVtDisplay");
  const advVdVtBadge = document.getElementById("advVdVtBadge");
  const advAbgTargetMvDisplay = document.getElementById("advAbgTargetMvDisplay");
  const btnApplyAbgMv = document.getElementById("btnApplyAbgMv");

  const advBtnResetToRec = document.getElementById("advBtnResetToRec");

  const advSetMvInput = document.getElementById("advSetMvInput");
  const advSetMvSlider = document.getElementById("advSetMvSlider");
  const advPillRecMv = document.getElementById("advPillRecMv");
  const advRecMvMl = document.getElementById("advRecMvMl");

  const advSetVtInput = document.getElementById("advSetVtInput");
  const advSetVtSlider = document.getElementById("advSetVtSlider");
  const advPillRecVt = document.getElementById("advPillRecVt");
  const advRecVtPerKg = document.getElementById("advRecVtPerKg");
  const advRecTvStdNote = document.getElementById("advRecTvStdNote");

  const advSetRrInput = document.getElementById("advSetRrInput");
  const advSetRrSlider = document.getElementById("advSetRrSlider");
  const advPillRecRr = document.getElementById("advPillRecRr");
  const advRecCycleTime = document.getElementById("advRecCycleTime");

  const advSetTiInput = document.getElementById("advSetTiInput");
  const advSetTiSlider = document.getElementById("advSetTiSlider");
  const advPillRecTi = document.getElementById("advPillRecTi");
  const advRecIeRatio = document.getElementById("advRecIeRatio");
  const advRecTiNote = document.getElementById("advRecTiNote");

  const advPeepInput = document.getElementById("advPeepInput");
  const advBtnFlowDecel = document.getElementById("advBtnFlowDecel");
  const advBtnFlowSquare = document.getElementById("advBtnFlowSquare");

  const advDpDisplay = document.getElementById("advDpDisplay");
  const advDpStatus = document.getElementById("advDpStatus");
  const advPplatDisplay = document.getElementById("advPplatDisplay");
  const advPplatStatus = document.getElementById("advPplatStatus");
  const advPpeakDisplay = document.getElementById("advPpeakDisplay");
  const advPpeakNote = document.getElementById("advPpeakNote");

  const advTeVal = document.getElementById("advTeVal");
  const advTeNeedVal = document.getElementById("advTeNeedVal");
  const advAutoPeepStatus = document.getElementById("advAutoPeepStatus");

  const advCanvas = document.getElementById("advCanvas");
  const advGraphActiveInfo = document.getElementById("advGraphActiveInfo");
  const advGraphTargetVal = document.getElementById("advGraphTargetVal");
  const advGraphRecVal = document.getElementById("advGraphRecVal");

  advBtnMale.addEventListener("click", () => {
    advState.gender = "male";
    advBtnMale.classList.add("active");
    advBtnFemale.classList.remove("active");
    recomputeAdvRecommendation(true);
  });

  advBtnFemale.addEventListener("click", () => {
    advState.gender = "female";
    advBtnFemale.classList.add("active");
    advBtnMale.classList.remove("active");
    recomputeAdvRecommendation(true);
  });

  advPresetNorm.addEventListener("click", () => applyAdvPreset("norm", 38, 10, 50, 40));
  advPresetArds.addEventListener("click", () => applyAdvPreset("ards", 44, 12, 25, 52));
  advPresetCopd.addEventListener("click", () => applyAdvPreset("copd", 50, 22, 55, 58));

  function applyAdvPreset(type, et, r, c, paco2) {
    advState.etco2 = et;
    advState.r = r;
    advState.c = c;
    advState.paco2 = paco2;

    advPresetNorm.classList.toggle("active", type === "norm");
    advPresetArds.classList.toggle("active", type === "ards");
    advPresetCopd.classList.toggle("active", type === "copd");

    triggerHighlight([cardAdvEtco2, cardAdvR, cardAdvC]);
    syncInputsToAdvState();
    recomputeAdvRecommendation(true);
  }

  btnPaco2Norm.addEventListener("click", () => setTargetPaco2(40, btnPaco2Norm));
  btnPaco2Perm.addEventListener("click", () => setTargetPaco2(50, btnPaco2Perm));
  btnPaco2Hyper.addEventListener("click", () => setTargetPaco2(35, btnPaco2Hyper));

  function setTargetPaco2(val, activeBtn) {
    advState.targetPaco2 = val;
    advTargetPaco2Input.value = val;
    advTargetPaco2Slider.value = val;
    btnPaco2Norm.classList.toggle("active", activeBtn === btnPaco2Norm);
    btnPaco2Perm.classList.toggle("active", activeBtn === btnPaco2Perm);
    btnPaco2Hyper.classList.toggle("active", activeBtn === btnPaco2Hyper);
    renderAdvView();
  }

  // ABG目標MV反映ボタン
  btnApplyAbgMv.addEventListener("click", () => {
    const abgTargetMv = parseFloat(advAbgTargetMvDisplay.textContent);
    if (!isNaN(abgTargetMv) && abgTargetMv >= 2.0 && abgTargetMv <= 22.0) {
      handleAdvMvChange(abgTargetMv);
    }
  });

  advBtnFlowDecel.addEventListener("click", () => {
    advState.flowWave = "decel";
    advBtnFlowDecel.classList.add("active");
    advBtnFlowSquare.classList.remove("active");
    renderAdvView();
  });

  advBtnFlowSquare.addEventListener("click", () => {
    advState.flowWave = "square";
    advBtnFlowSquare.classList.add("active");
    advBtnFlowDecel.classList.remove("active");
    renderAdvView();
  });

  advBtnResetToRec.addEventListener("click", () => {
    advState.setMv = advState.recMv;
    advState.setVt = advState.recVt;
    advState.setRr = advState.recRr;
    advState.setTi = advState.recTi;
    syncInputsToAdvState();
    renderAdvView();
  });

  function handleAdvMvChange(newMv) {
    advState.setMv = parseFloat(newMv.toFixed(1));
    const rcExpSec = (advState.r * (advState.c / 1000));
    const vdMl = Math.round(2.2 * advState.pbw);
    const vdL = vdMl / 1000;
    const a = 0.33;

    const term1 = 1 + 2 * a * rcExpSec * (advState.setMv / vdL);
    let optF = (Math.sqrt(Math.max(0.1, term1)) - 1) / (a * rcExpSec);
    optF = Math.round(optF);
    if (optF < 6) optF = 6;
    if (optF > 40) optF = 40;

    advState.setRr = optF;
    advState.setVt = Math.round((advState.setMv * 1000) / advState.setRr);
    advState.setTi = calcRecommendedTi(advState.setRr, rcExpSec);

    syncInputsToAdvState();
    renderAdvView();
  }

  function handleAdvVtChange(newVt) {
    advState.setVt = Math.round(newVt);
    if (advState.setVt <= 0) return;

    let newRr = Math.round((advState.setMv * 1000) / advState.setVt);
    if (newRr < 5) newRr = 5;
    if (newRr > 50) newRr = 50;

    advState.setRr = newRr;
    const rcExpSec = (advState.r * (advState.c / 1000));
    advState.setTi = calcRecommendedTi(advState.setRr, rcExpSec);

    syncInputsToAdvState();
    renderAdvView();
  }

  function handleAdvRrChange(newRr) {
    advState.setRr = Math.round(newRr);
    if (advState.setRr <= 0) return;

    let newVt = Math.round((advState.setMv * 1000) / advState.setRr);
    if (newVt < 150) newVt = 150;
    if (newVt > 1200) newVt = 1200;

    advState.setVt = newVt;
    const rcExpSec = (advState.r * (advState.c / 1000));
    advState.setTi = calcRecommendedTi(advState.setRr, rcExpSec);

    syncInputsToAdvState();
    renderAdvView();
  }

  function handleAdvTiChange(newTi) {
    advState.setTi = parseFloat(newTi.toFixed(2));
    syncInputsToAdvState();
    renderAdvView();
  }

  function syncInputsToAdvState() {
    advHeightInput.value = advState.height;
    advHeightSlider.value = advState.height;
    advEtco2Input.value = advState.etco2;
    advEtco2Slider.value = advState.etco2;
    advRInput.value = advState.r;
    advRSlider.value = advState.r;
    advCInput.value = advState.c;
    advCSlider.value = advState.c;

    advPaco2Input.value = advState.paco2;
    advPaco2Slider.value = advState.paco2;
    advPhInput.value = advState.ph.toFixed(2);
    advPhSlider.value = advState.ph.toFixed(2);
    advTargetPaco2Input.value = advState.targetPaco2;
    advTargetPaco2Slider.value = advState.targetPaco2;

    advSetMvInput.value = advState.setMv.toFixed(1);
    advSetMvSlider.value = advState.setMv.toFixed(1);
    advSetVtInput.value = advState.setVt;
    advSetVtSlider.value = advState.setVt;
    advSetRrInput.value = advState.setRr;
    advSetRrSlider.value = advState.setRr;
    advSetTiInput.value = advState.setTi.toFixed(2);
    advSetTiSlider.value = advState.setTi.toFixed(2);
    advPeepInput.value = advState.peep;
  }

  function recomputeAdvRecommendation(applyToSet = false) {
    advState.pbw = calcPBW(advState.gender, advState.height);
    const vdMl = Math.round(2.2 * advState.pbw);
    const vdL = vdMl / 1000;
    const baseMvL = advState.pbw * 0.1;

    const etRatio = advState.etco2 / 38;
    let targetMvL = baseMvL * etRatio;
    targetMvL = Math.round(targetMvL * 10) / 10;
    if (targetMvL < 2.0) targetMvL = 2.0;
    if (targetMvL > 22.0) targetMvL = 22.0;
    advState.recMv = targetMvL;

    const rcExpSec = (advState.r * (advState.c / 1000));
    const a = 0.33;
    const term1 = 1 + 2 * a * rcExpSec * (advState.recMv / vdL);
    let optF = (Math.sqrt(Math.max(0.1, term1)) - 1) / (a * rcExpSec);
    optF = Math.round(optF);
    if (optF < 8) optF = 8;
    if (optF > 36) optF = 36;
    advState.recRr = optF;

    advState.recVt = Math.round((advState.recMv * 1000) / advState.recRr);
    advState.recTi = calcRecommendedTi(advState.recRr, rcExpSec);

    if (applyToSet) {
      advState.setMv = advState.recMv;
      advState.setVt = advState.recVt;
      advState.setRr = advState.recRr;
      advState.setTi = advState.recTi;
      syncInputsToAdvState();
    }

    renderAdvView();
  }

  function renderAdvView() {
    const rcExpSec = (advState.r * (advState.c / 1000));
    const rcExpRounded = Math.round(rcExpSec * 100) / 100;

    const stdTvMin = Math.round(advState.pbw * 6);
    const stdTvMax = Math.round(advState.pbw * 8);

    advPbwDisplay.textContent = advState.pbw.toFixed(1);
    advTvRangeDisplay.textContent = stdTvMin + " 〜 " + stdTvMax;
    advRecTvStdNote.textContent = stdTvMin + "〜" + stdTvMax;

    advRcExpDisplay.textContent = rcExpRounded.toFixed(2);
    if (rcExpRounded < 0.5) {
      advRcExpBadge.textContent = "拘束性 (短時定数)";
      advRcExpBadge.style.color = "#38bdf8";
    } else if (rcExpRounded > 0.85) {
      advRcExpBadge.textContent = "閉塞性 (長時定数)";
      advRcExpBadge.style.color = "#fbbf24";
    } else {
      advRcExpBadge.textContent = "正常 (0.50〜0.85s)";
      advRcExpBadge.style.color = "#2dd4bf";
    }

    // 1. ABG較差 & 死腔率推計
    const paEtDiff = Math.max(0, advState.paco2 - advState.etco2);
    advPaEtDiffDisplay.textContent = paEtDiff;

    let vdVtRatio = (advState.paco2 - advState.etco2) / advState.paco2;
    if (vdVtRatio < 0.15) vdVtRatio = 0.15;
    if (vdVtRatio > 0.85) vdVtRatio = 0.85;
    const vdVtPct = Math.round(vdVtRatio * 100);
    advVdVtDisplay.textContent = vdVtPct;

    if (vdVtPct <= 35) {
      advVdVtBadge.textContent = "正常 (≦35%)";
      advVdVtBadge.className = "vdvt-badge status-good";
    } else if (vdVtPct <= 55) {
      advVdVtBadge.textContent = "中等度死腔 (35〜55%)";
      advVdVtBadge.className = "vdvt-badge status-warn";
    } else {
      advVdVtBadge.textContent = "重度死腔増大 (>55%)";
      advVdVtBadge.className = "vdvt-badge status-danger";
    }

    // ABG必要換気量
    const abgTargetMv = Math.round((advState.setMv * (advState.paco2 / advState.targetPaco2)) * 10) / 10;
    advAbgTargetMvDisplay.textContent = abgTargetMv.toFixed(1);

    // 4連コントロールカード
    advPillRecMv.textContent = "推奨 " + advState.recMv.toFixed(1);
    advPillRecVt.textContent = "推奨 " + advState.recVt;
    advPillRecRr.textContent = "推奨 " + advState.recRr;
    advPillRecTi.textContent = "推奨 " + advState.recTi.toFixed(2);

    advRecMvMl.textContent = Math.round(advState.setMv * 1000).toLocaleString();
    advRecVtPerKg.textContent = (advState.setVt / advState.pbw).toFixed(1);

    const tTotal = 60 / advState.setRr;
    advRecCycleTime.textContent = tTotal.toFixed(1);

    const te = Math.max(0.1, tTotal - advState.setTi);
    const ieRatioVal = Math.round((te / advState.setTi) * 10) / 10;
    advRecIeRatio.textContent = "1 : " + ieRatioVal.toFixed(1);

    // 2. 気道内圧推計
    const dp = Math.round((advState.setVt / advState.c) * 10) / 10;
    advDpDisplay.textContent = dp.toFixed(1);
    if (dp <= 14.0) {
      advDpStatus.textContent = "良好 (≦14)";
      advDpStatus.className = "safety-status status-good";
    } else if (dp <= 18.0) {
      advDpStatus.textContent = "注意 (14〜18)";
      advDpStatus.className = "safety-status status-warn";
    } else {
      advDpStatus.textContent = "危険高圧 (>18)";
      advDpStatus.className = "safety-status status-danger";
    }

    const pplat = Math.round((advState.peep + dp) * 10) / 10;
    advPplatDisplay.textContent = pplat.toFixed(1);

    if (pplat <= 30.0) {
      advPplatStatus.textContent = "安全 (≦30 cmH2O)";
      advPplatStatus.className = "safety-status status-good";
    } else {
      advPplatStatus.textContent = "危険気圧外傷 (>30 cmH2O)";
      advPplatStatus.className = "safety-status status-danger";
    }

    // Ppeak
    if (advState.flowWave === "square") {
      const flowLps = (advState.setVt / 1000) / advState.setTi;
      const resDrop = flowLps * advState.r;
      const ppeak = Math.round((pplat + resDrop) * 10) / 10;
      advPpeakDisplay.textContent = ppeak.toFixed(1);
      advPpeakNote.textContent = "矩形波流速圧損 +" + resDrop.toFixed(1) + "cmH2O";
    } else {
      advPpeakDisplay.textContent = (pplat + 0.8).toFixed(1);
      advPpeakNote.textContent = "漸減波終了時流速圧損ほぼゼロ";
    }

    // 3. 呼気時間 & Auto-PEEP判定
    const teNeed3Rc = Math.round((3 * rcExpSec) * 10) / 10;
    advTeVal.textContent = te.toFixed(1);
    advTeNeedVal.textContent = teNeed3Rc.toFixed(1);

    if (te >= teNeed3Rc) {
      advAutoPeepStatus.textContent = "呼気充足 (Auto-PEEP極小)";
      advAutoPeepStatus.className = "safety-status status-good";
      advRecTiNote.textContent = "呼気 Te: " + te.toFixed(1) + "s (充足)";
      advRecTiNote.style.color = "var(--color-emerald)";
    } else if (te >= 2 * rcExpSec) {
      advAutoPeepStatus.textContent = "呼気不足気味 (95%未呼出)";
      advAutoPeepStatus.className = "safety-status status-warn";
      advRecTiNote.textContent = "呼気 Te: " + te.toFixed(1) + "s (やや不足)";
      advRecTiNote.style.color = "var(--color-amber)";
    } else {
      advAutoPeepStatus.textContent = "危険：Auto-PEEP/エアトラッピング";
      advAutoPeepStatus.className = "safety-status status-danger";
      advRecTiNote.textContent = "呼気 Te: " + te.toFixed(1) + "s (Auto-PEEP警告)";
      advRecTiNote.style.color = "var(--color-rose)";
    }

    if (advGraphTargetVal) advGraphTargetVal.textContent = advState.setRr + " bpm / " + advState.setVt + " mL";
    if (advGraphRecVal) advGraphRecVal.textContent = advState.recRr + " bpm / " + advState.recVt + " mL";

    if (advGraphActiveInfo) {
      advGraphActiveInfo.textContent = "設定点: RR " + advState.setRr + " 回/分 / Vt " + advState.setVt + " mL (Pplat " + pplat.toFixed(1) + " cmH2O, Te " + te.toFixed(1) + "s)";
    }

    drawAdvSafetyGraphic();
  }

  function drawAdvSafetyGraphic() {
    if (!advCanvas) return;
    const ctx = advCanvas.getContext("2d");
    const w = advCanvas.width;
    const h = advCanvas.height;

    ctx.clearRect(0, 0, w, h);

    const padL = 50, padR = 25, padT = 20, padB = 40;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;

    function toX(f) { return padL + (f / 45) * plotW; }
    function toY(vt) { return padT + plotH - (vt / 1000) * plotH; }

    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = 1;

    for (let f = 10; f <= 40; f += 10) {
      const x = toX(f);
      ctx.beginPath(); ctx.moveTo(x, padT); ctx.lineTo(x, padT + plotH); ctx.stroke();
      ctx.fillStyle = "#cbd5e1"; ctx.font = "11px 'JetBrains Mono', monospace"; ctx.textAlign = "center";
      ctx.fillText(f.toString(), x, padT + plotH + 16);
    }
    for (let vt = 200; vt <= 800; vt += 200) {
      const y = toY(vt);
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + plotW, y); ctx.stroke();
      ctx.fillStyle = "#cbd5e1"; ctx.font = "11px 'JetBrains Mono', monospace"; ctx.textAlign = "right";
      ctx.fillText(vt.toString(), padL - 8, y + 4);
    }

    ctx.fillStyle = "#e2e8f0"; ctx.font = "bold 11px 'Noto Sans JP', sans-serif"; ctx.textAlign = "center";
    ctx.fillText("呼吸回数 f (回/分)", padL + plotW / 2, padT + plotH + 34);

    // 【動的安全枠】Auto-PEEP境界：Te >= 3*RCexp を満たす最大呼吸回数
    const rcExpSec = (advState.r * (advState.c / 1000));
    const autoPeepMaxF = Math.round(60 / (advState.setTi + 3 * rcExpSec));
    const minF = 5;
    const maxF = Math.min(43, autoPeepMaxF);
    const minVt = Math.round(4.4 * advState.pbw);
    const maxVt = Math.round(Math.min(15.4 * advState.pbw, (advState.setMv * 1000) / 5));

    const sfL = toX(minF);
    const sfR = toX(maxF);
    const sfT = toY(Math.min(950, maxVt));
    const sfB = toY(minVt);

    // 安全枠
    ctx.fillStyle = "rgba(192, 132, 252, 0.08)";
    ctx.fillRect(sfL, sfT, sfR - sfL, sfB - sfT);
    ctx.strokeStyle = "rgba(192, 132, 252, 0.8)";
    ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]);
    ctx.strokeRect(sfL, sfT, sfR - sfL, sfB - sfT);
    ctx.setLineDash([]);

    // 等換気量線
    ctx.strokeStyle = "rgba(251, 191, 36, 0.5)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    let started = false;
    for (let f = 5; f <= 44; f += 0.5) {
      const vt = (advState.setMv * 1000) / f;
      if (vt < 0 || vt > 1000) continue;
      const x = toX(f), y = toY(vt);
      if (!started) { ctx.moveTo(x, y); started = true; } else { ctx.lineTo(x, y); }
    }
    ctx.stroke();

    // 推奨点 (ひし形)
    const recX = toX(advState.recRr), recY = toY(advState.recVt);
    ctx.save();
    ctx.translate(recX, recY);
    ctx.rotate(Math.PI / 4);
    ctx.shadowColor = "rgba(56, 189, 248, 0.9)";
    ctx.shadowBlur = 12;
    ctx.fillStyle = "#38bdf8";
    ctx.fillRect(-7, -7, 14, 14);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.strokeRect(-7, -7, 14, 14);
    ctx.restore();

    // 設定点 (二重円)
    const setX = toX(advState.setRr), setY = toY(advState.setVt);
    ctx.strokeStyle = "rgba(251, 191, 36, 0.4)";
    ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(setX, padT); ctx.lineTo(setX, padT + plotH);
    ctx.moveTo(padL, setY); ctx.lineTo(padL + plotW, setY);
    ctx.stroke(); ctx.setLineDash([]);

    ctx.shadowColor = "rgba(251, 191, 36, 0.95)";
    ctx.shadowBlur = 14;
    ctx.fillStyle = "#fbbf24";
    ctx.beginPath(); ctx.arc(setX, setY, 8, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(setX, setY, 8, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = "#090d16";
    ctx.beginPath(); ctx.arc(setX, setY, 2.5, 0, Math.PI * 2); ctx.fill();
  }

  // ==========================================
  // 全ステッパー ＆ 直接入力 統合管理
  // ==========================================
  const paramConfig = {
    bHeight: { min: 130, max: 200, step: 1, decimals: 0 },
    bMvPct: { min: 25, max: 350, step: 5, decimals: 0 },

    aHeight: { min: 130, max: 200, step: 1, decimals: 0 },
    etco2: { min: 20, max: 70, step: 1, decimals: 0 },
    r: { min: 3, max: 35, step: 1, decimals: 0 },
    c: { min: 10, max: 120, step: 1, decimals: 0 },
    setMv: { min: 2.0, max: 22.0, step: 0.1, decimals: 1 },
    setVt: { min: 200, max: 950, step: 10, decimals: 0 },
    setRr: { min: 6, max: 42, step: 1, decimals: 0 },
    setTi: { min: 0.40, max: 2.20, step: 0.05, decimals: 2 },

    advHeight: { min: 130, max: 200, step: 1, decimals: 0 },
    advEtco2: { min: 20, max: 70, step: 1, decimals: 0 },
    advR: { min: 3, max: 35, step: 1, decimals: 0 },
    advC: { min: 10, max: 120, step: 1, decimals: 0 },
    advPaco2: { min: 20, max: 95, step: 1, decimals: 0 },
    advPh: { min: 7.00, max: 7.65, step: 0.01, decimals: 2 },
    advTargetPaco2: { min: 25, max: 65, step: 1, decimals: 0 },
    advSetMv: { min: 2.0, max: 22.0, step: 0.1, decimals: 1 },
    advSetVt: { min: 200, max: 950, step: 10, decimals: 0 },
    advSetRr: { min: 6, max: 42, step: 1, decimals: 0 },
    advSetTi: { min: 0.40, max: 2.20, step: 0.05, decimals: 2 },
    advPeep: { min: 3, max: 22, step: 1, decimals: 0 }
  };

  document.querySelectorAll(".btn-step").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.target;
      const action = btn.dataset.action;
      if (!target || !action || !paramConfig[target]) return;

      const conf = paramConfig[target];
      let currentVal = getParamValue(target);
      let newVal = action === "inc" ? currentVal + conf.step : currentVal - conf.step;

      newVal = parseFloat(newVal.toFixed(conf.decimals));
      if (newVal < conf.min) newVal = conf.min;
      if (newVal > conf.max) newVal = conf.max;

      setParamValue(target, newVal);
    });
  });

  function getParamValue(target) {
    switch (target) {
      case "bHeight": return bState.height;
      case "bMvPct": return bState.mvPct;
      case "aHeight": return optState.height;
      case "etco2": return optState.etco2;
      case "r": return optState.r;
      case "c": return optState.c;
      case "setMv": return optState.setMv;
      case "setVt": return optState.setVt;
      case "setRr": return optState.setRr;
      case "setTi": return optState.setTi;

      case "advHeight": return advState.height;
      case "advEtco2": return advState.etco2;
      case "advR": return advState.r;
      case "advC": return advState.c;
      case "advPaco2": return advState.paco2;
      case "advPh": return advState.ph;
      case "advTargetPaco2": return advState.targetPaco2;
      case "advSetMv": return advState.setMv;
      case "advSetVt": return advState.setVt;
      case "advSetRr": return advState.setRr;
      case "advSetTi": return advState.setTi;
      case "advPeep": return advState.peep;
      default: return 0;
    }
  }

  function setParamValue(target, val) {
    switch (target) {
      case "bHeight": bState.height = Math.round(val); updateBasic(); break;
      case "bMvPct": bState.mvPct = Math.round(val); updateBasic(); break;
      case "aHeight": optState.height = Math.round(val); syncInputsToOptState(); recomputeRecommendation(true); break;
      case "etco2": optState.etco2 = Math.round(val); syncInputsToOptState(); recomputeRecommendation(true); break;
      case "r": optState.r = Math.round(val); syncInputsToOptState(); recomputeRecommendation(true); break;
      case "c": optState.c = Math.round(val); syncInputsToOptState(); recomputeRecommendation(true); break;
      case "setMv": handleMvChange(val); break;
      case "setVt": handleVtChange(val); break;
      case "setRr": handleRrChange(val); break;
      case "setTi": handleTiChange(val); break;

      case "advHeight": advState.height = Math.round(val); syncInputsToAdvState(); recomputeAdvRecommendation(true); break;
      case "advEtco2": advState.etco2 = Math.round(val); syncInputsToAdvState(); recomputeAdvRecommendation(true); break;
      case "advR": advState.r = Math.round(val); syncInputsToAdvState(); recomputeAdvRecommendation(true); break;
      case "advC": advState.c = Math.round(val); syncInputsToAdvState(); recomputeAdvRecommendation(true); break;
      case "advPaco2": advState.paco2 = Math.round(val); syncInputsToAdvState(); renderAdvView(); break;
      case "advPh": advState.ph = parseFloat(val.toFixed(2)); syncInputsToAdvState(); renderAdvView(); break;
      case "advTargetPaco2": advState.targetPaco2 = Math.round(val); syncInputsToAdvState(); renderAdvView(); break;
      case "advSetMv": handleAdvMvChange(val); break;
      case "advSetVt": handleAdvVtChange(val); break;
      case "advSetRr": handleAdvRrChange(val); break;
      case "advSetTi": handleAdvTiChange(val); break;
      case "advPeep": advState.peep = Math.round(val); syncInputsToAdvState(); renderAdvView(); break;
    }
  }

  function setupDirectInput(inputElem, target) {
    if (!inputElem) return;
    const conf = paramConfig[target];

    function commit() {
      let val = parseFloat(inputElem.value);
      if (isNaN(val)) {
        inputElem.value = getParamValue(target);
        return;
      }
      val = parseFloat(val.toFixed(conf.decimals));
      if (val < conf.min) val = conf.min;
      if (val > conf.max) val = conf.max;
      setParamValue(target, val);
    }

    inputElem.addEventListener("change", commit);
    inputElem.addEventListener("keydown", (e) => {
      if (e.key === "Enter") inputElem.blur();
    });
  }

  // 直接入力バインド
  setupDirectInput(bHeightInput, "bHeight");
  setupDirectInput(bMvPctInput, "bMvPct");
  setupDirectInput(aHeightInput, "aHeight");
  setupDirectInput(etco2Input, "etco2");
  setupDirectInput(rInput, "r");
  setupDirectInput(cInput, "c");
  setupDirectInput(setMvInput, "setMv");
  setupDirectInput(setVtInput, "setVt");
  setupDirectInput(setRrInput, "setRr");
  setupDirectInput(setTiInput, "setTi");

  setupDirectInput(advHeightInput, "advHeight");
  setupDirectInput(advEtco2Input, "advEtco2");
  setupDirectInput(advRInput, "advR");
  setupDirectInput(advCInput, "advC");
  setupDirectInput(advPaco2Input, "advPaco2");
  setupDirectInput(advPhInput, "advPh");
  setupDirectInput(advTargetPaco2Input, "advTargetPaco2");
  setupDirectInput(advSetMvInput, "advSetMv");
  setupDirectInput(advSetVtInput, "advSetVt");
  setupDirectInput(advSetRrInput, "advSetRr");
  setupDirectInput(advSetTiInput, "advSetTi");
  setupDirectInput(advPeepInput, "advPeep");

  // スライダーバインド
  bHeightSlider.addEventListener("input", (e) => setParamValue("bHeight", parseFloat(e.target.value)));
  bMvPctSlider.addEventListener("input", (e) => setParamValue("bMvPct", parseFloat(e.target.value)));
  aHeightSlider.addEventListener("input", (e) => setParamValue("aHeight", parseFloat(e.target.value)));
  etco2Slider.addEventListener("input", (e) => setParamValue("etco2", parseFloat(e.target.value)));
  rSlider.addEventListener("input", (e) => setParamValue("r", parseFloat(e.target.value)));
  cSlider.addEventListener("input", (e) => setParamValue("c", parseFloat(e.target.value)));
  setMvSlider.addEventListener("input", (e) => handleMvChange(parseFloat(e.target.value)));
  setVtSlider.addEventListener("input", (e) => handleVtChange(parseInt(e.target.value, 10)));
  setRrSlider.addEventListener("input", (e) => handleRrChange(parseInt(e.target.value, 10)));
  setTiSlider.addEventListener("input", (e) => handleTiChange(parseFloat(e.target.value)));

  advHeightSlider.addEventListener("input", (e) => setParamValue("advHeight", parseFloat(e.target.value)));
  advEtco2Slider.addEventListener("input", (e) => setParamValue("advEtco2", parseFloat(e.target.value)));
  advRSlider.addEventListener("input", (e) => setParamValue("advR", parseFloat(e.target.value)));
  advCSlider.addEventListener("input", (e) => setParamValue("advC", parseFloat(e.target.value)));
  advPaco2Slider.addEventListener("input", (e) => setParamValue("advPaco2", parseFloat(e.target.value)));
  advPhSlider.addEventListener("input", (e) => setParamValue("advPh", parseFloat(e.target.value)));
  advTargetPaco2Slider.addEventListener("input", (e) => setParamValue("advTargetPaco2", parseFloat(e.target.value)));
  advSetMvSlider.addEventListener("input", (e) => handleAdvMvChange(parseFloat(e.target.value)));
  advSetVtSlider.addEventListener("input", (e) => handleAdvVtChange(parseInt(e.target.value, 10)));
  advSetRrSlider.addEventListener("input", (e) => handleAdvRrChange(parseInt(e.target.value, 10)));
  advSetTiSlider.addEventListener("input", (e) => handleAdvTiChange(parseFloat(e.target.value)));

  // 取扱説明書 ＆ 初心者向け呼吸療法解説書 モーダル制御
  function openManualModal() {
    var modal = document.getElementById("manualModal");
    if (modal) {
      modal.classList.remove("hidden");
      document.body.style.overflow = "hidden";
    }
  }

  function closeManualModal() {
    var modal = document.getElementById("manualModal");
    if (modal) {
      modal.classList.add("hidden");
      document.body.style.overflow = "";
    }
  }

  window.openManualModal = openManualModal;
  window.closeManualModal = closeManualModal;

  function initManualModal() {
    function getEls() {
      return {
        modal: document.getElementById("manualModal"),
        btnOpen: document.getElementById("btnOpenManual"),
        btnClose: document.getElementById("btnCloseManual"),
        btnBottomClose: document.getElementById("btnBottomCloseManual"),
        overlay: document.getElementById("manualOverlay"),
        btnTabApp: document.getElementById("btnTabManualApp"),
        btnTabEdu: document.getElementById("btnTabManualEdu"),
        contentApp: document.getElementById("manualTabApp"),
        contentEdu: document.getElementById("manualTabEdu")
      };
    }

    var openModal = openManualModal;

    var closeModal = closeManualModal;

    const els = getEls();
    if (els.btnOpen) els.btnOpen.addEventListener("click", openModal);
    if (els.btnClose) els.btnClose.addEventListener("click", closeModal);
    if (els.btnBottomClose) els.btnBottomClose.addEventListener("click", closeModal);
    if (els.overlay) els.overlay.addEventListener("click", closeModal);

    // Escキーで閉じる
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        const m = document.getElementById("manualModal");
        if (m && !m.classList.contains("hidden")) {
          closeModal();
        }
      }
    });

    // タブ切り替え
    if (els.btnTabApp && els.btnTabEdu && els.contentApp && els.contentEdu) {
      els.btnTabApp.addEventListener("click", () => {
        els.btnTabApp.classList.add("active");
        els.btnTabEdu.classList.remove("active");
        els.contentApp.style.display = "flex";
        els.contentEdu.style.display = "none";
      });

      els.btnTabEdu.addEventListener("click", () => {
        els.btnTabEdu.classList.add("active");
        els.btnTabApp.classList.remove("active");
        els.contentApp.style.display = "none";
        els.contentEdu.style.display = "flex";
      });
    }
  }


// ==========================================================================
  // データ保存 (エクスポート) ＆ データ読込 (インポート) 機構
  // ==========================================================================

  let toastTimer = null;
  function showToast(message, isError) {
    var toast = document.getElementById("toastNotification");
    if (!toast) return;
    if (toastTimer) clearTimeout(toastTimer);

    toast.textContent = message;
    if (isError) {
      toast.classList.add("error");
    } else {
      toast.classList.remove("error");
    }
    toast.classList.remove("hidden");

    toastTimer = setTimeout(function() {
      toast.classList.add("hidden");
    }, 3500);
  }

  function getActiveMode() {
    var tabBasic = document.getElementById("tabBasic");
    var tabAdv = document.getElementById("tabAdv");
    if (tabBasic && tabBasic.classList.contains("active")) return "basic";
    if (tabAdv && tabAdv.classList.contains("active")) return "adv";
    return "opt";
  }

  function formatDateTime(d) {
    function pad(n) { return String(n).padStart(2, "0"); }
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + " " + pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds());
  }

  function exportVentilationData() {
    var mode = getActiveMode();
    var now = new Date();
    var timeStr = formatDateTime(now);

    var bPbwDisplay = document.getElementById("bPbwDisplay");
    var bTvMin = document.getElementById("bTvMin");
    var bTvMax = document.getElementById("bTvMax");
    var bMvTargetL = document.getElementById("bMvTargetL");

    var pbwValue = document.getElementById("pbwValue");
    var graphRecVal = document.getElementById("graphRecVal");

    var advPbwValue = document.getElementById("advPbwValue");
    var advVdRatio = document.getElementById("advVdRatio");
    var advPplatVal = document.getElementById("advPplatVal");
    var advDpVal = document.getElementById("advDpVal");
    var advGraphRecVal = document.getElementById("advGraphRecVal");

    var systemData = {
      appName: "VentilationCalculator",
      version: 1,
      savedAt: now.toISOString(),
      activeMode: mode,
      params: {
        basic: {
          gender: bState.gender,
          height: bState.height,
          mvPct: bState.mvPct
        },
        opt: {
          gender: optState.gender,
          height: optState.height,
          etco2: optState.etco2,
          r: optState.r,
          c: optState.c,
          setMv: optState.setMv,
          setVt: optState.setVt,
          setRr: optState.setRr,
          setTi: optState.setTi
        },
        adv: {
          gender: advState.gender,
          height: advState.height,
          etco2: advState.etco2,
          r: advState.r,
          c: advState.c,
          paco2: advState.paco2,
          ph: advState.ph,
          targetPaco2: advState.targetPaco2,
          peep: advState.peep,
          setMv: advState.setMv,
          setVt: advState.setVt,
          setRr: advState.setRr,
          setTi: advState.setTi
        }
      }
    };

    var modeTitle = "力学最適化モード";
    if (mode === "basic") modeTitle = "基本モード";
    if (mode === "adv") modeTitle = "高度臨床 (ABG & 圧) モード";

    var lines = [];
    lines.push("=======================================================");
    lines.push("【換気量シミュレーター 設定記録データ】");
    lines.push("記録日時: " + timeStr);
    lines.push("対象モード: " + modeTitle);
    lines.push("=======================================================");
    lines.push("");

    if (mode === "basic") {
      var g = bState.gender === "male" ? "男性" : "女性";
      var tvMinVal = bTvMin ? bTvMin.textContent : Math.round(calcPBW(bState.gender, bState.height) * 6);
      var tvMaxVal = bTvMax ? bTvMax.textContent : Math.round(calcPBW(bState.gender, bState.height) * 8);
      var mvTargetVal = bMvTargetL ? bMvTargetL.textContent : "--";

      lines.push("【1. 患者基本情報】");
      lines.push("・性別: " + g);
      lines.push("・身長: " + bState.height + " cm");
      lines.push("・予測体重 (PBW): " + (bPbwDisplay ? bPbwDisplay.textContent : calcPBW(bState.gender, bState.height).toFixed(1)) + " kg");
      lines.push("");
      lines.push("【2. 標準換気目安】");
      lines.push("・推奨一回換気量 (6〜8 mL/kg): " + tvMinVal + " 〜 " + tvMaxVal + " mL");
      lines.push("・目標分時換気量 (" + bState.mvPct + "%): " + mvTargetVal + " L/min");
    } else if (mode === "opt") {
      var g = optState.gender === "male" ? "男性" : "女性";
      var rcExp = (optState.r * optState.c) / 1000;
      var te = Math.max(0.1, (60 / optState.setRr) - optState.setTi);
      var ieRatio = (te / optState.setTi).toFixed(1);
      var pbwNum = calcPBW(optState.gender, optState.height);

      lines.push("【1. 患者基本情報】");
      lines.push("・性別: " + g);
      lines.push("・身長: " + optState.height + " cm");
      lines.push("・予測体重 (PBW): " + pbwNum.toFixed(1) + " kg");
      lines.push("");
      lines.push("【2. 呼吸力学測定値】");
      lines.push("・呼気終末二酸化炭素 (EtCO2): " + optState.etco2 + " mmHg");
      lines.push("・気道抵抗 (R): " + optState.r + " cmH2O/(L/s)");
      lines.push("・静肺コンプライアンス (C): " + optState.c + " mL/cmH2O");
      lines.push("・呼気時定数 (RCexp): " + rcExp.toFixed(2) + " 秒 (推奨呼気時間 ≧ " + (rcExp * 3).toFixed(2) + " 秒)");
      lines.push("");
      lines.push("【3. 換気設定値】");
      lines.push("・分時換気量 (MV): " + optState.setMv.toFixed(1) + " L/min");
      lines.push("・一回換気量 (Vt): " + optState.setVt + " mL (" + (optState.setVt / pbwNum).toFixed(1) + " mL/kg PBW)");
      lines.push("・呼吸回数 (RR): " + optState.setRr + " bpm");
      lines.push("・吸気時間 (Ti): " + optState.setTi.toFixed(2) + " 秒 (呼気時間 Te: " + te.toFixed(2) + " 秒, I:E = 1:" + ieRatio + ")");
      lines.push("");
      lines.push("【4. Otis力学推奨】");
      lines.push("・最小呼吸仕事推奨点: " + (graphRecVal ? graphRecVal.textContent : "--"));
    } else {
      var g = advState.gender === "male" ? "男性" : "女性";
      var rcExp = (advState.r * advState.c) / 1000;
      var te = Math.max(0.1, (60 / advState.setRr) - advState.setTi);
      var ieRatio = (te / advState.setTi).toFixed(1);
      var pbwNum = calcPBW(advState.gender, advState.height);

      lines.push("【1. 患者基本情報】");
      lines.push("・性別: " + g);
      lines.push("・身長: " + advState.height + " cm");
      lines.push("・予測体重 (PBW): " + pbwNum.toFixed(1) + " kg");
      lines.push("");
      lines.push("【2. 呼吸力学・血液ガス測定値】");
      lines.push("・気道抵抗 (R): " + advState.r + " cmH2O/(L/s)");
      lines.push("・静肺コンプライアンス (C): " + advState.c + " mL/cmH2O");
      lines.push("・呼気時定数 (RCexp): " + rcExp.toFixed(2) + " 秒 (推奨呼気時間 ≧ " + (rcExp * 3).toFixed(2) + " 秒)");
      lines.push("・動脈血二酸化炭素分圧 (PaCO2): " + advState.paco2 + " mmHg (目標: " + advState.targetPaco2 + " mmHg)");
      lines.push("・呼気終末二酸化炭素 (EtCO2): " + advState.etco2 + " mmHg");
      lines.push("・推定死腔率 (Vd/Vt): " + (advVdRatio ? advVdRatio.textContent : "--"));
      lines.push("・動脈血 pH: " + advState.ph.toFixed(2));
      lines.push("・設定 PEEP: " + advState.peep + " cmH2O");
      lines.push("");
      lines.push("【3. 換気設定値】");
      lines.push("・分時換気量 (MV): " + advState.setMv.toFixed(1) + " L/min");
      lines.push("・一回換気量 (Vt): " + advState.setVt + " mL (" + (advState.setVt / pbwNum).toFixed(1) + " mL/kg PBW)");
      lines.push("・呼吸回数 (RR): " + advState.setRr + " bpm");
      lines.push("・吸気時間 (Ti): " + advState.setTi.toFixed(2) + " 秒 (呼気時間 Te: " + te.toFixed(2) + " 秒, I:E = 1:" + ieRatio + ")");
      lines.push("");
      lines.push("【4. 安全性・力学評価】");
      lines.push("・プラトー圧 (Pplat): " + (advPplatVal ? advPplatVal.textContent : "--"));
      lines.push("・駆動圧 (ΔP): " + (advDpVal ? advDpVal.textContent : "--"));
      lines.push("・Otis最小呼吸仕事推奨点: " + (advGraphRecVal ? advGraphRecVal.textContent : "--"));
    }

    lines.push("");
    lines.push("=======================================================");
    lines.push("※ 下記のコードはアプリ自動読込用のシステムデータです。編集しないでください。");
    lines.push("<<<VENT_CALC_DATA:" + JSON.stringify(systemData) + ">>>");

    var text = lines.join("\n");

    var blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    function pad(n) { return String(n).padStart(2, "0"); }
    var filename = "換気設定記録_" + now.getFullYear() + pad(now.getMonth() + 1) + pad(now.getDate()) + "_" + pad(now.getHours()) + pad(now.getMinutes()) + pad(now.getSeconds()) + ".txt";

    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);

    showToast("💾 換気設定データをテキストファイルに保存しました");
  }

  function importVentilationData(file) {
    if (!file) return;

    var reader = new FileReader();
    reader.onload = function(e) {
      try {
        var text = e.target.result;
        var data = null;

        var match = text.match(/<<<VENT_CALC_DATA:(.*?)>>>/);
        if (match && match[1]) {
          data = JSON.parse(match[1]);
        } else {
          try {
            data = JSON.parse(text);
          } catch(err) {}
        }

        if (!data || !data.params) {
          showToast("⚠️ 有効な換気記録データが見つかりませんでした", true);
          return;
        }

        // 基本モードの復元
        if (data.params.basic) {
          var bp = data.params.basic;
          if (bp.gender === "female") {
            var bBtnFemale = document.getElementById("bBtnFemale");
            if (bBtnFemale) bBtnFemale.click();
          } else {
            var bBtnMale = document.getElementById("bBtnMale");
            if (bBtnMale) bBtnMale.click();
          }
          if (bp.height) setParamValue("bHeight", bp.height);
          if (bp.mvPct !== undefined) setParamValue("bMvPct", bp.mvPct);
        }

        // 力学最適化モードの復元
        if (data.params.opt) {
          var op = data.params.opt;
          if (op.gender === "female") {
            var btnFemale = document.getElementById("btnFemale");
            if (btnFemale) btnFemale.click();
          } else {
            var btnMale = document.getElementById("btnMale");
            if (btnMale) btnMale.click();
          }
          if (op.height) setParamValue("aHeight", op.height);
          if (op.etco2 !== undefined) setParamValue("etco2", op.etco2);
          if (op.r !== undefined) setParamValue("r", op.r);
          if (op.c !== undefined) setParamValue("c", op.c);
          if (op.setMv !== undefined) setParamValue("setMv", op.setMv);
          if (op.setVt !== undefined) setParamValue("setVt", op.setVt);
          if (op.setRr !== undefined) setParamValue("setRr", op.setRr);
          if (op.setTi !== undefined) setParamValue("setTi", op.setTi);
        }

        // 高度臨床モードの復元
        if (data.params.adv) {
          var ap = data.params.adv;
          if (ap.gender === "female") {
            var advBtnFemale = document.getElementById("advBtnFemale");
            if (advBtnFemale) advBtnFemale.click();
          } else {
            var advBtnMale = document.getElementById("advBtnMale");
            if (advBtnMale) advBtnMale.click();
          }
          if (ap.height) setParamValue("advHeight", ap.height);
          if (ap.etco2 !== undefined) setParamValue("advEtco2", ap.etco2);
          if (ap.r !== undefined) setParamValue("advR", ap.r);
          if (ap.c !== undefined) setParamValue("advC", ap.c);
          if (ap.paco2 !== undefined) setParamValue("advPaco2", ap.paco2);
          if (ap.ph !== undefined) setParamValue("advPh", ap.ph);
          if (ap.targetPaco2 !== undefined) setParamValue("advTargetPaco2", ap.targetPaco2);
          if (ap.peep !== undefined) setParamValue("advPeep", ap.peep);
          if (ap.setMv !== undefined) setParamValue("advSetMv", ap.setMv);
          if (ap.setVt !== undefined) setParamValue("advSetVt", ap.setVt);
          if (ap.setRr !== undefined) setParamValue("advSetRr", ap.setRr);
          if (ap.setTi !== undefined) setParamValue("advSetTi", ap.setTi);
        }

        // モード切り替え
        var tabBasic = document.getElementById("tabBasic");
        var tabOpt = document.getElementById("tabOpt");
        var tabAdv = document.getElementById("tabAdv");

        if (data.activeMode === "basic" && tabBasic) {
          tabBasic.click();
        } else if (data.activeMode === "adv" && tabAdv) {
          tabAdv.click();
        } else if (tabOpt) {
          tabOpt.click();
        }

        updateBasic();
        recomputeRecommendation(false);
        recomputeAdvRecommendation(false);

        var timeLabel = "";
        if (data.savedAt) {
          var d = new Date(data.savedAt);
          if (!isNaN(d.getTime())) {
            timeLabel = " (" + formatDateTime(d) + ")";
          }
        }
        showToast("✅ 換気設定データを復元しました" + timeLabel);
      } catch (err) {
        console.error("Import error:", err);
        showToast("⚠️ データの解析に失敗しました", true);
      }
    };
    reader.onerror = function() {
      showToast("⚠️ ファイルの読み込みに失敗しました", true);
    };
    reader.readAsText(file);
  }

  function initExportImport() {
    var btnExport = document.getElementById("btnExportData");
    var btnImport = document.getElementById("btnImportData");
    var fileInput = document.getElementById("fileInputData");

    if (btnExport) btnExport.addEventListener("click", exportVentilationData);
    if (btnImport && fileInput) {
      btnImport.addEventListener("click", function() { fileInput.click(); });
      fileInput.addEventListener("change", function(e) {
        if (e.target.files && e.target.files[0]) {
          importVentilationData(e.target.files[0]);
        }
        fileInput.value = "";
      });
    }
  }

  initManualModal();
  initExportImport();
  updateBasic();
  recomputeRecommendation(true);
  recomputeAdvRecommendation(true);
})();
