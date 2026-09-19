/**
 * 換気設定最適化ツール
 * 実測 R・C・EtCO2 と Otis理論に基づく 適正分時換気量・Vt・呼吸回数の算出
 */

(function () {
  "use strict";

  // ===== DOM要素 =====
  const btnMale = document.getElementById("btnMale");
  const btnFemale = document.getElementById("btnFemale");
  const heightSlider = document.getElementById("heightSlider");
  const heightDisplay = document.getElementById("heightDisplay");
  const ibwDisplay = document.getElementById("ibwDisplay");
  const vdDisplay = document.getElementById("vdDisplay");

  const etco2Slider = document.getElementById("etco2Slider");
  const etco2Display = document.getElementById("etco2Display");
  const etco2Feedback = document.getElementById("etco2Feedback");

  const rSlider = document.getElementById("rSlider");
  const rDisplay = document.getElementById("rDisplay");
  const cSlider = document.getElementById("cSlider");
  const cDisplay = document.getElementById("cDisplay");

  const presetNorm = document.getElementById("presetNorm");
  const presetArds = document.getElementById("presetArds");
  const presetCopd = document.getElementById("presetCopd");

  const rcExpDisplay = document.getElementById("rcExpDisplay");
  const rcExpBadge = document.getElementById("rcExpBadge");

  const recMvL = document.getElementById("recMvL");
  const recMvMl = document.getElementById("recMvMl");
  const recVt = document.getElementById("recVt");
  const recVtPerKg = document.getElementById("recVtPerKg");
  const recRr = document.getElementById("recRr");
  const recCycleTime = document.getElementById("recCycleTime");

  const dpDisplay = document.getElementById("dpDisplay");
  const dpStatus = document.getElementById("dpStatus");

  const canvas = document.getElementById("asvCanvas");
  const ctx = canvas ? canvas.getContext("2d") : null;
  const graphTargetVal = document.getElementById("graphTargetVal");

  // ===== 状態 =====
  const state = {
    gender: "male",
    height: 170,
    ibw: 66.0,
    etco2: 38,     // mmHg (標準 38)
    r: 10,         // cmH2O/(L/s) (標準 10)
    c: 50          // mL/cmH2O (標準 50)
  };

  // ===== イベント設定 =====
  if (btnMale && btnFemale) {
    btnMale.addEventListener("click", () => setGender("male"));
    btnFemale.addEventListener("click", () => setGender("female"));
  }

  if (heightSlider) {
    heightSlider.addEventListener("input", (e) => {
      state.height = parseInt(e.target.value, 10);
      recalculate();
    });
  }

  if (etco2Slider) {
    etco2Slider.addEventListener("input", (e) => {
      state.etco2 = parseInt(e.target.value, 10);
      clearPresetHighlight();
      recalculate();
    });
  }

  if (rSlider) {
    rSlider.addEventListener("input", (e) => {
      state.r = parseInt(e.target.value, 10);
      clearPresetHighlight();
      recalculate();
    });
  }

  if (cSlider) {
    cSlider.addEventListener("input", (e) => {
      state.c = parseInt(e.target.value, 10);
      clearPresetHighlight();
      recalculate();
    });
  }

  if (presetNorm) {
    presetNorm.addEventListener("click", () => applyPreset("norm", 38, 10, 50));
  }
  if (presetArds) {
    presetArds.addEventListener("click", () => applyPreset("ards", 44, 12, 25));
  }
  if (presetCopd) {
    presetCopd.addEventListener("click", () => applyPreset("copd", 50, 22, 55));
  }

  function setGender(g) {
    state.gender = g;
    btnMale.classList.toggle("active", g === "male");
    btnFemale.classList.toggle("active", g === "female");
    recalculate();
  }

  function applyPreset(type, etco2, r, c) {
    state.etco2 = etco2;
    state.r = r;
    state.c = c;

    etco2Slider.value = etco2;
    rSlider.value = r;
    cSlider.value = c;

    [presetNorm, presetArds, presetCopd].forEach(btn => {
      if (btn) btn.classList.remove("active");
    });
    if (type === "norm" && presetNorm) presetNorm.classList.add("active");
    if (type === "ards" && presetArds) presetArds.classList.add("active");
    if (type === "copd" && presetCopd) presetCopd.classList.add("active");

    recalculate();
  }

  function clearPresetHighlight() {
    [presetNorm, presetArds, presetCopd].forEach(btn => {
      if (btn) btn.classList.remove("active");
    });
  }

  // ===== 計算コア =====
  function calcIBW(gender, heightCm) {
    const base = gender === "male" ? 50.0 : 45.5;
    const ibw = base + 0.91 * (heightCm - 152.4);
    return Math.round(ibw * 10) / 10;
  }

  function recalculate() {
    // 1. 患者基本パラメータ
    state.ibw = calcIBW(state.gender, state.height);
    const vdMl = Math.round(2.2 * state.ibw); // 解剖学的死腔量 [mL]
    const vdL = vdMl / 1000; // [L]
    const baseMvL = state.ibw * 0.1; // 基準換気量 (100%時: 0.1 L/kg)

    // 2. EtCO2 による適正分時換気量補正
    // 目標 EtCO2 を 38 mmHg とし、分時換気量とEtCO2の反比例平衡モデルを適用
    const targetEtCO2 = 38;
    const etco2Ratio = state.etco2 / targetEtCO2;
    // 極端な外れ値をクランプ (60% 〜 220%)
    const clampedRatio = Math.max(0.6, Math.min(2.2, etco2Ratio));
    const targetMvL = Math.round(baseMvL * clampedRatio * 10) / 10;
    const targetMvMl = Math.round(targetMvL * 1000);

    // 3. 呼気時定数 RCexp
    const rcExpSec = (state.r * (state.c / 1000)); // [秒]
    const rcExpRounded = Math.round(rcExpSec * 100) / 100;

    // 4. Otisの式による最適呼吸数 (f_opt) & 最適Vt
    const a = 0.33; // 正弦波呼吸パターン係数
    const num = Math.sqrt(1 + 4 * a * rcExpSec * (targetMvL / vdL)) - 1;
    const denom = 2 * a * (rcExpSec / 60);
    let optF = Math.round(num / (denom * 60));

    // 安全枠（セーフティーリミット）
    const minF = 5; // 下限
    const maxF = Math.min(48, Math.round(20 / rcExpSec)); // 上限 (Auto-PEEP防止)
    const minVt = Math.round(4.4 * state.ibw); // 死腔2倍
    const maxVt = Math.round(Math.min(15.4 * state.ibw, targetMvMl / 5));

    if (isNaN(optF) || optF < minF) optF = minF + 2;
    if (optF > maxF) optF = maxF - 1;

    let optVt = Math.round(targetMvMl / optF);
    if (optVt < minVt) optVt = minVt;
    if (optVt > maxVt) optVt = maxVt;

    const optVtPerKg = (optVt / state.ibw).toFixed(1);
    const cycleTime = (60 / optF).toFixed(1);

    // 5. 駆動圧 (Driving Pressure: ΔP = Vt / C)
    const drivingPressure = Math.round((optVt / state.c) * 10) / 10;

    // ===== UI更新 =====
    heightDisplay.textContent = state.height;
    ibwDisplay.textContent = state.ibw.toFixed(1);
    vdDisplay.textContent = vdMl;

    etco2Display.textContent = state.etco2;
    rDisplay.textContent = state.r;
    cDisplay.textContent = state.c;

    // EtCO2 フィードバックメッセージ
    if (state.etco2 > 45) {
      const pct = Math.round((clampedRatio - 1) * 100);
      etco2Feedback.textContent = `高炭酸ガス血症傾向（換気要求量: +${pct}% 補正）`;
      etco2Feedback.style.color = "#fbbf24";
    } else if (state.etco2 < 32) {
      const pct = Math.round((1 - clampedRatio) * 100);
      etco2Feedback.textContent = `過換気・低炭酸ガス傾向（換気要求量: -${pct}% 補正）`;
      etco2Feedback.style.color = "#38bdf8";
    } else {
      etco2Feedback.textContent = `EtCO2は適正範囲内です（換気要求比: ${Math.round(clampedRatio * 100)}%）`;
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

    // 推奨設定値 (メインカード)
    recMvL.textContent = targetMvL.toFixed(1);
    recMvMl.textContent = targetMvMl.toLocaleString();
    recVt.textContent = optVt;
    recVtPerKg.textContent = optVtPerKg;
    recRr.textContent = optF;
    recCycleTime.textContent = cycleTime;

    // Driving Pressure
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

    // グラフ目標値テキスト
    if (graphTargetVal) {
      graphTargetVal.textContent = `${optF} bpm / ${optVt} mL (${optVtPerKg} mL/kg)`;
    }

    // 6. Canvas描画
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

    // 十字ガイド線
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

  // 初期計算実行
  recalculate();
})();
