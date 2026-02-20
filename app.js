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
    const btnMale = document.getElementById("btnMale");
    const btnFemale = document.getElementById("btnFemale");
    const heightInput = document.getElementById("heightInput");
    const placeholder = document.getElementById("placeholder");
    const resultsGrid = document.getElementById("resultsGrid");

    const ibwValue = document.getElementById("ibwValue");
    const tvMin = document.getElementById("tvMin");
    const tvMax = document.getElementById("tvMax");
    const tvBarFill = document.getElementById("tvBarFill");
    const tvBarMin = document.getElementById("tvBarMin");
    const tvBarMax = document.getElementById("tvBarMax");
    const mvValue = document.getElementById("mvValue");
    const mvLiter = document.getElementById("mvLiter");
    const sliderValue = document.getElementById("sliderValue");

    // MV%調整スライダー
    const mvPercentSlider = document.getElementById("mvPercentSlider");
    const mvPercentDisplay = document.getElementById("mvPercentDisplay");
    const mvAdjusted = document.getElementById("mvAdjusted");
    const mvAdjustedValue = document.getElementById("mvAdjustedValue");
    const mvAdjustedLiter = document.getElementById("mvAdjustedLiter");

    // ===== 状態 =====
    let selectedGender = null; // "male" or "female"

    // ===== イベント登録 =====
    btnMale.addEventListener("click", function () {
        selectGender("male");
    });

    btnFemale.addEventListener("click", function () {
        selectGender("female");
    });

    heightInput.addEventListener("input", function () {
        // スライダー値表示を更新
        sliderValue.textContent = heightInput.value;
        calculate();
    });

    mvPercentSlider.addEventListener("input", function () {
        updateMvAdjustment();
    });

    // ===== 性別選択 =====
    function selectGender(gender) {
        selectedGender = gender;

        // ボタンのアクティブ状態を更新
        btnMale.classList.toggle("active", gender === "male");
        btnFemale.classList.toggle("active", gender === "female");

        calculate();
    }

    // ===== 計算処理 =====
    function calculate() {
        const heightCm = parseFloat(heightInput.value);

        // 性別が未選択の場合はプレースホルダーを表示
        if (!selectedGender) {
            showPlaceholder();
            return;
        }

        // 適正体重 (IBW)
        // 男性: 50 + 0.91 × (身長cm - 152.4)
        // 女性: 45.5 + 0.91 × (身長cm - 152.4)
        const baseWeight = selectedGender === "male" ? 50 : 45.5;
        const ibw = Math.round((baseWeight + 0.91 * (heightCm - 152.4)) * 10) / 10;

        // 一回換気量 (TV)
        const tvMinVal = Math.round(ibw * 6);
        const tvMaxVal = Math.round(ibw * 8);

        // 分時換気量 (MV)
        const mvVal = Math.round(ibw * 100);
        const mvLiterVal = Math.round((mvVal / 1000) * 10) / 10;

        // 結果を表示
        showResults();

        // 値をアニメーション付きで更新
        animateValue(ibwValue, ibw.toFixed(1));
        animateValue(tvMin, tvMinVal.toLocaleString());
        animateValue(tvMax, tvMaxVal.toLocaleString());
        animateValue(mvValue, mvVal.toLocaleString());
        mvLiter.textContent = mvLiterVal.toFixed(1);

        // バーのラベルを更新
        tvBarMin.textContent = tvMinVal.toLocaleString() + " mL";
        tvBarMax.textContent = tvMaxVal.toLocaleString() + " mL";

        // MV%調整を更新
        updateMvAdjustment();
    }

    // ===== MV%調整 =====
    function updateMvAdjustment() {
        const percent = parseInt(mvPercentSlider.value);
        mvPercentDisplay.textContent = percent + "%";

        // 100%以外の場合はハイライト
        mvPercentDisplay.classList.toggle("adjusted", percent !== 100);

        if (!selectedGender) return;

        const heightCm = parseFloat(heightInput.value);
        const baseWeight = selectedGender === "male" ? 50 : 45.5;
        const ibw = baseWeight + 0.91 * (heightCm - 152.4);
        const mvBase = ibw * 100;

        const mvAdj = Math.round(mvBase * percent / 100);
        const mvAdjL = Math.round((mvAdj / 1000) * 10) / 10;

        if (percent !== 100) {
            mvAdjusted.classList.add("visible");
            animateValue(mvAdjustedValue, mvAdj.toLocaleString());
            mvAdjustedLiter.textContent = mvAdjL.toFixed(1);
        } else {
            mvAdjusted.classList.remove("visible");
        }
    }

    // ===== 表示切替 =====
    function showPlaceholder() {
        placeholder.classList.remove("hidden");
        resultsGrid.classList.add("hidden");
    }

    function showResults() {
        placeholder.classList.add("hidden");
        resultsGrid.classList.remove("hidden");
    }

    // ===== 値アニメーション =====
    function animateValue(element, newValue) {
        if (element.textContent === newValue) return;

        element.style.transition = "none";
        element.style.opacity = "0.4";
        element.style.transform = "translateY(4px)";

        requestAnimationFrame(function () {
            element.textContent = newValue;
            element.style.transition = "all 0.3s ease";
            element.style.opacity = "1";
            element.style.transform = "translateY(0)";
        });
    }
})();
