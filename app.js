/**
 * 換気量計算ツール - メインロジック
 *
 * 計算式:
 * - 適正体重 (IBW)
 *     男性: 50 + 0.91 × (身長cm - 152.4)
 *     女性: 45.5 + 0.91 × (身長cm - 152.4)
 * - 一回換気量 (TV) = IBW × 6 〜 IBW × 8 (mL)
 * - 分時換気量 (MV) = IBW × 100 (mL/min)
 */

(function () {
    "use strict";

    // ===== DOM要素 =====
    var btnMale = document.getElementById("btnMale");
    var btnFemale = document.getElementById("btnFemale");
    var heightInput = document.getElementById("heightInput");
    var placeholder = document.getElementById("placeholder");
    var resultsGrid = document.getElementById("resultsGrid");

    var ibwValueEl = document.getElementById("ibwValue");
    var tvMinEl = document.getElementById("tvMin");
    var tvMaxEl = document.getElementById("tvMax");
    var tvBarMin = document.getElementById("tvBarMin");
    var tvBarMax = document.getElementById("tvBarMax");
    var mvValueEl = document.getElementById("mvValue");
    var mvLiterEl = document.getElementById("mvLiter");
    var sliderValueEl = document.getElementById("sliderValue");

    // MV%調整スライダー
    var mvPercentSlider = document.getElementById("mvPercentSlider");
    var mvPercentDisplay = document.getElementById("mvPercentDisplay");
    var mvAdjustedEl = document.getElementById("mvAdjusted");
    var mvAdjustedValueEl = document.getElementById("mvAdjustedValue");
    var mvAdjustedLiterEl = document.getElementById("mvAdjustedLiter");

    // ===== 状態 =====
    var selectedGender = null;
    var currentIBW = 0;

    // ===== イベント登録 =====
    btnMale.addEventListener("click", function () {
        selectGender("male");
    });

    btnFemale.addEventListener("click", function () {
        selectGender("female");
    });

    heightInput.addEventListener("input", function () {
        sliderValueEl.textContent = heightInput.value;
        calculate();
    });

    mvPercentSlider.addEventListener("input", function () {
        updateMvAdjustment();
    });

    // ===== 性別選択 =====
    function selectGender(gender) {
        selectedGender = gender;
        btnMale.classList.toggle("active", gender === "male");
        btnFemale.classList.toggle("active", gender === "female");
        calculate();
    }

    // ===== 計算処理 =====
    function calculate() {
        var heightCm = parseFloat(heightInput.value);

        if (!selectedGender) {
            placeholder.style.display = "";
            resultsGrid.style.display = "none";
            return;
        }

        // 適正体重 (IBW)
        var baseWeight = selectedGender === "male" ? 50 : 45.5;
        currentIBW = Math.round((baseWeight + 0.91 * (heightCm - 152.4)) * 10) / 10;

        // 一回換気量 (TV)
        var tvMinVal = Math.round(currentIBW * 6);
        var tvMaxVal = Math.round(currentIBW * 8);

        // 分時換気量 (MV)
        var mvVal = Math.round(currentIBW * 100);
        var mvLiterVal = Math.round((mvVal / 1000) * 10) / 10;

        // 結果を表示
        placeholder.style.display = "none";
        resultsGrid.style.display = "";

        // 値を更新
        ibwValueEl.textContent = currentIBW.toFixed(1);
        tvMinEl.textContent = tvMinVal.toLocaleString();
        tvMaxEl.textContent = tvMaxVal.toLocaleString();
        mvValueEl.textContent = mvVal.toLocaleString();
        mvLiterEl.textContent = mvLiterVal.toFixed(1);

        // バーのラベルを更新
        tvBarMin.textContent = tvMinVal.toLocaleString() + " mL";
        tvBarMax.textContent = tvMaxVal.toLocaleString() + " mL";

        // MV%調整を更新
        updateMvAdjustment();
    }

    // ===== MV%調整 =====
    function updateMvAdjustment() {
        var percent = parseInt(mvPercentSlider.value);
        mvPercentDisplay.textContent = percent + "%";

        // 100%以外の場合はハイライト
        if (percent !== 100) {
            mvPercentDisplay.style.color = "#f59e0b";
            mvPercentDisplay.style.textShadow = "0 0 12px rgba(245, 158, 11, 0.4)";
        } else {
            mvPercentDisplay.style.color = "";
            mvPercentDisplay.style.textShadow = "";
        }

        if (!selectedGender || currentIBW <= 0) {
            mvAdjustedEl.style.display = "none";
            return;
        }

        var mvBase = currentIBW * 100;
        var mvAdj = Math.round(mvBase * percent / 100);
        var mvAdjL = Math.round((mvAdj / 1000) * 10) / 10;

        if (percent !== 100) {
            mvAdjustedEl.style.display = "block";
            mvAdjustedValueEl.textContent = mvAdj.toLocaleString();
            mvAdjustedLiterEl.textContent = mvAdjL.toFixed(1);
        } else {
            mvAdjustedEl.style.display = "none";
        }
    }
})();
