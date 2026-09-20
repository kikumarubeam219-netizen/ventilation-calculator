/**
 * 換気量計算ツール (力学最適化対応) コントローラー
 * 高コントラスト・医療現場操作性最適化版
 */
(function () {
  "use strict";

  // ==========================================
  // アプリケーション状態 (State)
  // ==========================================
  const state = {
    activeMode: "opt",

    // 基本モード
    bGender: "male",
    bHeight: 170,
    bMvPct: 100,

    // 力学最適化モード
    gender: "male",
    height: 170,
    etco2: 38,
    r: 10,
    c: 50,
    pbw: 66.0,

    // Otis理論推奨値
    recMv: 6.6,
    recVt: 470,
    recRr: 14,
    recTi: 1.00,

    // ユーザー手動設定値
    setMv: 6.6,
    setVt: 470,
    setRr: 14,
    setTi: 1.00,

    // グラフ選択情報
    selectedInfo: null
  };

  // ==========================================
  // DOM要素の参照取得
  // ==========================================
  // タブ
  const tabBasic = document.getElementById("tabBasic");
  const tabOpt = document.getElementById("tabOpt");
  const viewBasic = document.getElementById("viewBasic");
  const viewOpt = document.getElementById("viewOpt");

  // 基本モード要素
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

  // 力学最適化モード要素
  const aBtnMale = document.getElementById("aBtnMale");
  const aBtnFemale = document.getElementById("aBtnFemale");
  const aHeightInput = document.getElementById("aHeightInput");
  const aHeightSlider = document.getElementById("aHeightSlider");
  const aPbwDisplay = document.getElementById("aPbwDisplay");
  const aTvRangeDisplay = document.getElementById("aTvRangeDisplay");

  // プリセット
  const presetNorm = document.getElementById("presetNorm");
  const presetArds = document.getElementById("presetArds");
  const presetCopd = document.getElementById("presetCopd");

  // パラメータカード（発光アニメーション用）
  const cardEtco2 = document.getElementById("cardEtco2");
  const cardR = document.getElementById("cardR");
  const cardC = document.getElementById("cardC");

  // パラメータ入力
  const etco2Input = document.getElementById("etco2Input");
  const etco2Slider = document.getElementById("etco2Slider");
  const rInput = document.getElementById("rInput");
  const rSlider = document.getElementById("rSlider");
  const cInput = document.getElementById("cInput");
  const cSlider = document.getElementById("cSlider");

  const rcExpDisplay = document.getElementById("rcExpDisplay");
  const rcExpBadge = document.getElementById("rcExpBadge");

  // 4連コントロール
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

  // 安全指標
  const dpDisplay = document.getElementById("dpDisplay");
  const dpStatus = document.getElementById("dpStatus");

  // グラフ & インフォバナー
  const optCanvas = document.getElementById("optCanvas");
  const graphActiveInfo = document.getElementById("graphActiveInfo");
  const graphTargetVal = document.getElementById("graphTargetVal");
  const graphRecVal = document.getElementById("graphRecVal");

  // ==========================================
  // 計算ユーティリティ (Devine式)
  // ==========================================
  function calcPBW(gender, heightCm) {
    if (gender === "male") {
      return 50.0 + 0.91 * (heightCm - 152.4);
    } else {
      return 45.5 + 0.91 * (heightCm - 152.4);
    }
  }

  // ==========================================
  // タブ切り替えロジック
  // ==========================================
  tabBasic.addEventListener("click", () => switchTab("basic"));
  tabOpt.addEventListener("click", () => switchTab("opt"));

  function switchTab(mode) {
    state.activeMode = mode;
    if (mode === "basic") {
      tabBasic.classList.add("active");
      tabOpt.classList.remove("active");
      viewBasic.style.display = "block";
      viewOpt.style.display = "none";
      updateBasic();
    } else {
      tabOpt.classList.add("active");
      tabBasic.classList.remove("active");
      viewOpt.style.display = "block";
      viewBasic.style.display = "none";
      recomputeRecommendation(false);
    }
  }

  // ==========================================
  // 基本モード (PBW換気量計算) ロジック
  // ==========================================
  bBtnMale.addEventListener("click", () => {
    state.bGender = "male";
    bBtnMale.classList.add("active");
    bBtnFemale.classList.remove("active");
    updateBasic();
  });

  bBtnFemale.addEventListener("click", () => {
    state.bGender = "female";
    bBtnFemale.classList.add("active");
    bBtnMale.classList.remove("active");
    updateBasic();
  });

  function updateBasic() {
    const pbw = calcPBW(state.bGender, state.bHeight);
    const tvMin = Math.round(pbw * 6);
    const tvMax = Math.round(pbw * 8);

    const baseMvL = pbw * 0.1;
    const baseMvMl = Math.round(baseMvL * 1000);

    const targetMvL = baseMvL * (state.bMvPct / 100);
    const targetMvMl = Math.round(targetMvL * 1000);

    bPbwDisplay.textContent = pbw.toFixed(1);
    bTvMin.textContent = tvMin;
    bTvMax.textContent = tvMax;

    bMvBaseL.textContent = baseMvL.toFixed(1);
    bMvBaseMl.textContent = baseMvMl.toLocaleString();

    bMvTargetL.textContent = targetMvL.toFixed(1);
    bMvTargetMl.textContent = targetMvMl.toLocaleString();

    bHeightInput.value = state.bHeight;
    bHeightSlider.value = state.bHeight;
    bMvPctInput.value = state.bMvPct;
    bMvPctSlider.value = state.bMvPct;
  }

  // ==========================================
  // 力学最適化モード イベントハンドラ
  // ==========================================
  aBtnMale.addEventListener("click", () => {
    state.gender = "male";
    aBtnMale.classList.add("active");
    aBtnFemale.classList.remove("active");
    recomputeRecommendation(true);
  });

  aBtnFemale.addEventListener("click", () => {
    state.gender = "female";
    aBtnFemale.classList.add("active");
    aBtnMale.classList.remove("active");
    recomputeRecommendation(true);
  });

  // プリセットボタン
  presetNorm.addEventListener("click", () => applyPreset("norm", 38, 10, 50));
  presetArds.addEventListener("click", () => applyPreset("ards", 44, 12, 25));
  presetCopd.addEventListener("click", () => applyPreset("copd", 50, 22, 55));

  function applyPreset(type, et, r, c) {
    state.etco2 = et;
    state.r = r;
    state.c = c;

    clearPresets();
    if (type === "norm") presetNorm.classList.add("active");
    if (type === "ards") presetArds.classList.add("active");
    if (type === "copd") presetCopd.classList.add("active");

    // 視覚フィードバック（パルス発光）
    triggerHighlight([cardEtco2, cardR, cardC]);

    syncInputsToState();
    recomputeRecommendation(true);
  }

  function clearPresets() {
    presetNorm.classList.remove("active");
    presetArds.classList.remove("active");
    presetCopd.classList.remove("active");
  }

  function triggerHighlight(elements) {
    elements.forEach((el) => {
      if (!el) return;
      el.classList.remove("pulse-highlight");
      void el.offsetWidth;
      el.classList.add("pulse-highlight");
    });
  }

  // 推奨値リセットボタン
  btnResetToRec.addEventListener("click", () => {
    state.setMv = state.recMv;
    state.setVt = state.recVt;
    state.setRr = state.recRr;
    state.setTi = state.recTi;
    syncInputsToState();
    renderOptView();
  });

  // ==========================================
  // ステッパー（＋/－）＆ 数値直接入力 統合管理
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
    setTi: { min: 0.40, max: 2.20, step: 0.05, decimals: 2 }
  };

  // 全ステッパーボタンのクリックリスナー登録
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
      case "bHeight": return state.bHeight;
      case "bMvPct": return state.bMvPct;
      case "aHeight": return state.height;
      case "etco2": return state.etco2;
      case "r": return state.r;
      case "c": return state.c;
      case "setMv": return state.setMv;
      case "setVt": return state.setVt;
      case "setRr": return state.setRr;
      case "setTi": return state.setTi;
      default: return 0;
    }
  }

  function setParamValue(target, val) {
    switch (target) {
      case "bHeight":
        state.bHeight = Math.round(val);
        updateBasic();
        break;
      case "bMvPct":
        state.bMvPct = Math.round(val);
        updateBasic();
        break;
      case "aHeight":
        state.height = Math.round(val);
        syncInputsToState();
        recomputeRecommendation(true);
        break;
      case "etco2":
        state.etco2 = Math.round(val);
        clearPresets();
        syncInputsToState();
        recomputeRecommendation(true);
        break;
      case "r":
        state.r = Math.round(val);
        clearPresets();
        syncInputsToState();
        recomputeRecommendation(true);
        break;
      case "c":
        state.c = Math.round(val);
        clearPresets();
        syncInputsToState();
        recomputeRecommendation(true);
        break;
      case "setMv":
        handleMvChange(val);
        break;
      case "setVt":
        handleVtChange(val);
        break;
      case "setRr":
        handleRrChange(val);
        break;
      case "setTi":
        handleTiChange(val);
        break;
    }
  }

  // 直接入力欄（input type=number）のイベントリスナー設定
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
      if (e.key === "Enter") {
        inputElem.blur();
      }
    });
  }

  // スライダーのイベントリスナー設定
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

  // ==========================================
  // 手動スライダー／ステッパー相互連動ロジック
  // ==========================================
  function handleMvChange(newMv) {
    state.setMv = parseFloat(newMv.toFixed(1));
    const rcExpSec = (state.r * (state.c / 1000));
    const vdMl = Math.round(2.2 * state.pbw);
    const vdL = vdMl / 1000;
    const a = 0.33;

    const term1 = 1 + 2 * a * rcExpSec * (state.setMv / vdL);
    let optF = (Math.sqrt(Math.max(0.1, term1)) - 1) / (a * rcExpSec);
    optF = Math.round(optF);
    if (optF < 6) optF = 6;
    if (optF > 40) optF = 40;

    state.setRr = optF;
    state.setVt = Math.round((state.setMv * 1000) / state.setRr);
    state.setTi = calcRecommendedTi(state.setRr, rcExpSec);

    syncInputsToState();
    renderOptView();
  }

  function handleVtChange(newVt) {
    state.setVt = Math.round(newVt);
    if (state.setVt <= 0) return;

    let newRr = Math.round((state.setMv * 1000) / state.setVt);
    if (newRr < 5) newRr = 5;
    if (newRr > 50) newRr = 50;

    state.setRr = newRr;
    const rcExpSec = (state.r * (state.c / 1000));
    state.setTi = calcRecommendedTi(state.setRr, rcExpSec);

    syncInputsToState();
    renderOptView();
  }

  function handleRrChange(newRr) {
    state.setRr = Math.round(newRr);
    if (state.setRr <= 0) return;

    let newVt = Math.round((state.setMv * 1000) / state.setRr);
    if (newVt < 150) newVt = 150;
    if (newVt > 1200) newVt = 1200;

    state.setVt = newVt;
    const rcExpSec = (state.r * (state.c / 1000));
    state.setTi = calcRecommendedTi(state.setRr, rcExpSec);

    syncInputsToState();
    renderOptView();
  }

  function handleTiChange(newTi) {
    state.setTi = parseFloat(newTi.toFixed(2));
    syncInputsToState();
    renderOptView();
  }

  function syncInputsToState() {
    aHeightInput.value = state.height;
    aHeightSlider.value = state.height;

    etco2Input.value = state.etco2;
    etco2Slider.value = state.etco2;

    rInput.value = state.r;
    rSlider.value = state.r;

    cInput.value = state.c;
    cSlider.value = state.c;

    setMvInput.value = state.setMv.toFixed(1);
    setMvSlider.value = state.setMv.toFixed(1);

    setVtInput.value = state.setVt;
    setVtSlider.value = state.setVt;

    setRrInput.value = state.setRr;
    setRrSlider.value = state.setRr;

    setTiInput.value = state.setTi.toFixed(2);
    setTiSlider.value = state.setTi.toFixed(2);
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
  // 推奨値の計算 & 全体レンダリング
  // ==========================================
  function recomputeRecommendation(applyToSet = false) {
    state.pbw = calcPBW(state.gender, state.height);
    const vdMl = Math.round(2.2 * state.pbw);
    const vdL = vdMl / 1000;
    const baseMvL = state.pbw * 0.1;

    // EtCO2 補正 (目標 38)
    const etRatio = state.etco2 / 38;
    let targetMvL = baseMvL * etRatio;
    targetMvL = Math.round(targetMvL * 10) / 10;
    if (targetMvL < 2.0) targetMvL = 2.0;
    if (targetMvL > 22.0) targetMvL = 22.0;
    state.recMv = targetMvL;

    // 呼気時定数 (秒)
    const rcExpSec = (state.r * (state.c / 1000));

    // Otisの最小呼吸仕事率 最適呼吸回数
    const a = 0.33;
    const term1 = 1 + 2 * a * rcExpSec * (state.recMv / vdL);
    let optF = (Math.sqrt(Math.max(0.1, term1)) - 1) / (a * rcExpSec);
    optF = Math.round(optF);
    if (optF < 8) optF = 8;
    if (optF > 36) optF = 36;
    state.recRr = optF;

    // 推奨一回換気量
    state.recVt = Math.round((state.recMv * 1000) / state.recRr);

    // 推奨Ti
    state.recTi = calcRecommendedTi(state.recRr, rcExpSec);

    if (applyToSet) {
      state.setMv = state.recMv;
      state.setVt = state.recVt;
      state.setRr = state.recRr;
      state.setTi = state.recTi;
      syncInputsToState();
    }

    renderOptView();
  }

  function renderOptView() {
    const rcExpSec = (state.r * (state.c / 1000));
    const rcExpRounded = Math.round(rcExpSec * 100) / 100;

    // TV基準値 (PBW × 6〜8)
    const stdTvMin = Math.round(state.pbw * 6);
    const stdTvMax = Math.round(state.pbw * 8);

    aPbwDisplay.textContent = state.pbw.toFixed(1);
    aTvRangeDisplay.textContent = stdTvMin + " 〜 " + stdTvMax;
    recTvStdNote.textContent = stdTvMin + "〜" + stdTvMax;

    // RCexp
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

    // 推奨値ピルバッジ (常に保持表示)
    pillRecMv.textContent = "推奨 " + state.recMv.toFixed(1);
    pillRecVt.textContent = "推奨 " + state.recVt;
    pillRecRr.textContent = "推奨 " + state.recRr;
    pillRecTi.textContent = "推奨 " + state.recTi.toFixed(2);

    // 4連コントロールカード表示更新
    recMvMl.textContent = Math.round(state.setMv * 1000).toLocaleString();
    recVtPerKg.textContent = (state.setVt / state.pbw).toFixed(1);

    const tTotal = 60 / state.setRr;
    recCycleTime.textContent = tTotal.toFixed(1);

    const te = Math.max(0.1, tTotal - state.setTi);
    const ieRatioVal = Math.round((te / state.setTi) * 10) / 10;
    recIeRatio.textContent = "1 : " + ieRatioVal.toFixed(1);

    const safeTe = 2 * rcExpSec;
    if (te >= safeTe) {
      recTiNote.textContent = "呼気 Te: " + te.toFixed(1) + "s (≧ 2×RCexp: 充足)";
      recTiNote.style.color = "var(--color-emerald)";
    } else {
      recTiNote.textContent = "呼気 Te: " + te.toFixed(1) + "s (呼気不足・AutoPEEP注意)";
      recTiNote.style.color = "var(--color-rose)";
    }

    // 駆動圧 (ΔP = Vt / C)
    const dp = Math.round((state.setVt / state.c) * 10) / 10;
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

    // 凡例テキスト
    if (graphTargetVal) {
      graphTargetVal.textContent = state.setRr + " bpm / " + state.setVt + " mL";
    }
    if (graphRecVal) {
      graphRecVal.textContent = state.recRr + " bpm / " + state.recVt + " mL";
    }

    // インフォバナー
    updateGraphBanner();

    // Canvas描画
    drawSafetyGraphic();
  }

  function updateGraphBanner(customText) {
    if (!graphActiveInfo) return;
    if (customText) {
      graphActiveInfo.textContent = customText;
    } else {
      const dp = ((state.setVt / state.c)).toFixed(1);
      graphActiveInfo.textContent = "現在設定点: RR " + state.setRr + " 回/分 / Vt " + state.setVt + " mL (MV " + state.setMv.toFixed(1) + " L/min, 推定ΔP " + dp + " cmH2O)";
    }
  }

  // ==========================================
  // 換気特性グラフィック (Canvas) 描画
  // ==========================================
  function drawSafetyGraphic() {
    if (!optCanvas) return;
    const ctx = optCanvas.getContext("2d");
    const w = optCanvas.width;
    const h = optCanvas.height;

    ctx.clearRect(0, 0, w, h);

    const padL = 50;
    const padR = 25;
    const padT = 20;
    const padB = 40;

    const plotW = w - padL - padR;
    const plotH = h - padT - padB;

    const axisMinF = 0;
    const axisMaxF = 45;
    const axisMinVt = 0;
    const axisMaxVt = 1000;

    function toX(f) {
      return padL + ((f - axisMinF) / (axisMaxF - axisMinF)) * plotW;
    }
    function toY(vt) {
      return padT + plotH - ((vt - axisMinVt) / (axisMaxVt - axisMinVt)) * plotH;
    }

    // グリッド線
    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = 1;

    for (let f = 10; f <= 40; f += 10) {
      const x = toX(f);
      ctx.beginPath();
      ctx.moveTo(x, padT);
      ctx.lineTo(x, padT + plotH);
      ctx.stroke();

      ctx.fillStyle = "#cbd5e1";
      ctx.font = "11px 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillText(f.toString(), x, padT + plotH + 16);
    }

    for (let vt = 200; vt <= 800; vt += 200) {
      const y = toY(vt);
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(padL + plotW, y);
      ctx.stroke();

      ctx.fillStyle = "#cbd5e1";
      ctx.font = "11px 'JetBrains Mono', monospace";
      ctx.textAlign = "right";
      ctx.fillText(vt.toString(), padL - 8, y + 4);
    }

    // 軸ラベル
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 11px 'Noto Sans JP', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("呼吸回数 f (回/分)", padL + plotW / 2, padT + plotH + 34);

    ctx.save();
    ctx.translate(14, padT + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = "center";
    ctx.fillText("一回換気量 Vt (mL)", 0, 0);
    ctx.restore();

    // セーフティーフレーム (安全枠)
    const rcExpSec = (state.r * (state.c / 1000));
    const minF = 5;
    const maxF = Math.min(48, Math.round(20 / rcExpSec));
    const minVt = Math.round(4.4 * state.pbw);
    const maxVt = Math.round(Math.min(15.4 * state.pbw, (state.setMv * 1000) / 5));

    const sfL = toX(minF);
    const sfR = toX(Math.min(axisMaxF - 2, maxF));
    const sfT = toY(Math.min(axisMaxVt - 50, maxVt));
    const sfB = toY(minVt);

    // 安全枠内塗り
    ctx.fillStyle = "rgba(56, 189, 248, 0.07)";
    ctx.fillRect(sfL, sfT, sfR - sfL, sfB - sfT);

    // 安全枠線
    ctx.strokeStyle = "rgba(56, 189, 248, 0.75)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]);
    ctx.strokeRect(sfL, sfT, sfR - sfL, sfB - sfT);
    ctx.setLineDash([]);

    // 等換気量双曲線 (MV = Vt * f)
    ctx.strokeStyle = "rgba(251, 191, 36, 0.5)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    let started = false;
    for (let f = 5; f <= 44; f += 0.5) {
      const vt = (state.setMv * 1000) / f;
      if (vt < axisMinVt || vt > axisMaxVt) continue;
      const x = toX(f);
      const y = toY(vt);
      if (!started) {
        ctx.moveTo(x, y);
        started = true;
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    // 1. Otis理論推奨点 (◆ ひし形: シアン色)
    const recX = toX(state.recRr);
    const recY = toY(state.recVt);

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

    // 2. 現在設定点 (● 二重円リング: ゴールド色)
    const setX = toX(state.setRr);
    const setY = toY(state.setVt);

    // 十字破線ガイド
    ctx.strokeStyle = "rgba(251, 191, 36, 0.4)";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(setX, padT);
    ctx.lineTo(setX, padT + plotH);
    ctx.moveTo(padL, setY);
    ctx.lineTo(padL + plotW, setY);
    ctx.stroke();
    ctx.setLineDash([]);

    // 外側グロウ
    ctx.shadowColor = "rgba(251, 191, 36, 0.95)";
    ctx.shadowBlur = 14;
    ctx.fillStyle = "#fbbf24";
    ctx.beginPath();
    ctx.arc(setX, setY, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // 白枠リング
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(setX, setY, 8, 0, Math.PI * 2);
    ctx.stroke();

    // 中心ドット
    ctx.fillStyle = "#090d16";
    ctx.beginPath();
    ctx.arc(setX, setY, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Canvasのクリック／タップイベント（インタラクティブ情報表示）
  if (optCanvas) {
    function handleCanvasInteraction(e) {
      const rect = optCanvas.getBoundingClientRect();
      const scaleX = optCanvas.width / rect.width;
      const scaleY = optCanvas.height / rect.height;

      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;

      const canvasX = (clientX - rect.left) * scaleX;
      const canvasY = (clientY - rect.top) * scaleY;

      const padL = 50;
      const padR = 25;
      const padT = 20;
      const padB = 40;
      const plotW = optCanvas.width - padL - padR;
      const plotH = optCanvas.height - padT - padB;

      const f = 0 + ((canvasX - padL) / plotW) * 45;
      const vt = 0 + ((padT + plotH - canvasY) / plotH) * 1000;

      if (f >= 5 && f <= 44 && vt >= 100 && vt <= 950) {
        const mv = (f * vt) / 1000;
        const dp = (vt / state.c).toFixed(1);

        const distRec = Math.hypot(f - state.recRr, (vt - state.recVt) / 20);
        const distSet = Math.hypot(f - state.setRr, (vt - state.setVt) / 20);

        if (distRec < 2.5) {
          updateGraphBanner("◆ Otis推奨点: RR " + state.recRr + " 回/分 / Vt " + state.recVt + " mL (MV " + state.recMv.toFixed(1) + " L/min, 推定ΔP " + (state.recVt / state.c).toFixed(1) + " cmH2O)");
        } else if (distSet < 2.5) {
          updateGraphBanner("● 現在設定点: RR " + state.setRr + " 回/分 / Vt " + state.setVt + " mL (MV " + state.setMv.toFixed(1) + " L/min, 推定ΔP " + (state.setVt / state.c).toFixed(1) + " cmH2O)");
        } else {
          updateGraphBanner("タップ位置: RR " + Math.round(f) + " 回/分 / Vt " + Math.round(vt) + " mL (換気量 " + mv.toFixed(1) + " L/min, 推定ΔP " + dp + " cmH2O)");
        }
      }
    }

    optCanvas.addEventListener("click", handleCanvasInteraction);
    optCanvas.addEventListener("touchstart", (e) => {
      handleCanvasInteraction(e);
    }, { passive: true });
  }

  // 初期化実行
  updateBasic();
  recomputeRecommendation(true);
})();
