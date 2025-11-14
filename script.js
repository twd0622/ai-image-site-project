// ===== 설정 =====
const MODEL_FOLDER = "model/";
const IMAGE_SIZE = 224;
const HISTORY_KEY = "tm-image-history-v1";
const MAX_HISTORY = 10;

// ===== 상태 =====
let model;
let isModelLoaded = false;
let lastPrediction = null; // 복사/다운로드에 사용할 마지막 예측 결과

// ===== 요소 참조 =====
const imageInput = document.getElementById("image-input");
const previewImg = document.getElementById("preview");
const loadingEl = document.getElementById("loading");
const topResultEl = document.getElementById("top-result");
const probabilitiesEl = document.getElementById("probabilities");
const dropZone = document.getElementById("drop-zone");
const historyListEl = document.getElementById("history-list");
const clearHistoryBtn = document.getElementById("clear-history-btn");
const copyResultBtn = document.getElementById("copy-result-btn");
const downloadResultBtn = document.getElementById("download-result-btn");

// ===== 히스토리 상태 =====
let historyItems = [];

/* -----------------------------
 * 1. 모델 로딩
 * ---------------------------*/
async function loadModel() {
  const modelURL = MODEL_FOLDER + "model.json";
  const metadataURL = MODEL_FOLDER + "metadata.json";

  model = await tmImage.load(modelURL, metadataURL);
  isModelLoaded = true;
  console.log("모델 로딩 완료");
  topResultEl.textContent = "모델 로딩 완료! 이미지를 업로드해보세요.";
}

/* -----------------------------
 * 2. 로딩 UI
 * ---------------------------*/
function showLoading(show) {
  loadingEl.style.display = show ? "flex" : "none";
}

/* -----------------------------
 * 3. 파일 처리 공통 함수
 *    - FileReader로 dataURL 읽어서
 *      미리보기 + 예측 + 히스토리 저장까지 처리
 * ---------------------------*/
function handleFile(file) {
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    topResultEl.textContent = "이미지 파일만 업로드할 수 있습니다.";
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    const dataUrl = reader.result; // base64 data URL
    previewImg.src = dataUrl;
    topResultEl.textContent = "이미지 로딩 중...";

    previewImg.onload = async () => {
      if (!isModelLoaded) {
        topResultEl.textContent = "모델이 아직 준비되지 않았습니다. 잠시 후 다시 시도해주세요.";
        return;
      }

      try {
        showLoading(true);

        // 캔버스에 리사이즈해서 그리기
        const canvas = document.createElement("canvas");
        canvas.width = IMAGE_SIZE;
        canvas.height = IMAGE_SIZE;
        const ctx = canvas.getContext("2d");

        const scale = Math.min(
          IMAGE_SIZE / previewImg.naturalWidth,
          IMAGE_SIZE / previewImg.naturalHeight
        );
        const newWidth = previewImg.naturalWidth * scale;
        const newHeight = previewImg.naturalHeight * scale;
        const dx = (IMAGE_SIZE - newWidth) / 2;
        const dy = (IMAGE_SIZE - newHeight) / 2;

        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, IMAGE_SIZE, IMAGE_SIZE);
        ctx.drawImage(previewImg, dx, dy, newWidth, newHeight);

        // 모델 예측
        let prediction = await model.predict(canvas);
        prediction.sort((a, b) => b.probability - a.probability);

        const best = prediction[0];
        topResultEl.textContent = `예측: ${best.className} (${(best.probability * 100).toFixed(1)}%)`;

        // 전체 확률 표시
        renderProbabilities(prediction);

        // 마지막 예측 결과 저장 (복사/다운로드용)
        lastPrediction = {
          bestClass: best.className,
          bestProb: best.probability,
          predictions: prediction.map((p) => ({
            className: p.className,
            probability: p.probability,
          })),
          timestamp: new Date().toISOString(),
        };

        // 히스토리에 추가
        addToHistory(dataUrl, lastPrediction);
      } catch (err) {
        console.error(err);
        topResultEl.textContent = "예측 중 오류가 발생했습니다. 콘솔을 확인해주세요.";
        probabilitiesEl.innerHTML = "";
      } finally {
        showLoading(false);
      }
    };
  };

  reader.onerror = () => {
    console.error("이미지 파일을 읽는 중 오류 발생");
    topResultEl.textContent = "이미지 파일을 읽는 중 오류가 발생했습니다.";
  };

  reader.readAsDataURL(file);
}

/* -----------------------------
 * 4. 확률 막대 그래프 렌더링
 * ---------------------------*/
function renderProbabilities(predictionArray) {
  probabilitiesEl.innerHTML = "";

  if (!predictionArray || predictionArray.length === 0) {
    const msg = document.createElement("div");
    msg.className = "empty-message";
    msg.textContent = "예측 결과가 없습니다.";
    probabilitiesEl.appendChild(msg);
    return;
  }

  predictionArray.forEach((p) => {
    const row = document.createElement("div");
    row.className = "prediction-row";

    const label = document.createElement("div");
    label.className = "prediction-label";
    label.textContent = p.className;

    const barBg = document.createElement("div");
    barBg.className = "bar-bg";

    const barFill = document.createElement("div");
    barFill.className = "bar-fill";
    const percent = (p.probability * 100).toFixed(1);
    barFill.style.width = `${percent}%`;

    barBg.appendChild(barFill);

    const percentText = document.createElement("div");
    percentText.className = "prediction-percent";
    percentText.textContent = `${percent}%`;

    row.appendChild(label);
    row.appendChild(barBg);
    row.appendChild(percentText);

    probabilitiesEl.appendChild(row);
  });
}

/* -----------------------------
 * 5. 파일 input 이벤트
 * ---------------------------*/
function setupFileInput() {
  imageInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    handleFile(file);
  });
}

/* -----------------------------
 * 6. 드래그 & 드롭 설정
 * ---------------------------*/
function setupDragAndDrop() {
  dropZone.addEventListener("click", () => {
    imageInput.click();
  });

  ["dragenter", "dragover"].forEach((eventName) => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add("highlight");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove("highlight");
    });
  });

  dropZone.addEventListener("drop", (e) => {
    const dt = e.dataTransfer;
    const file = dt.files[0];
    handleFile(file);
  });
}

/* -----------------------------
 * 7. 히스토리: 로드/저장/렌더/추가/초기화
 * ---------------------------*/
function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) {
      historyItems = [];
      renderHistory();
      return;
    }
    historyItems = JSON.parse(raw);
    renderHistory();
  } catch (err) {
    console.error("히스토리를 불러오는 중 오류:", err);
    historyItems = [];
    renderHistory();
  }
}

function saveHistory() {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(historyItems));
  } catch (err) {
    console.error("히스토리를 저장하는 중 오류:", err);
  }
}

function addToHistory(imageDataUrl, predictionData) {
  const entry = {
    id: Date.now() + "-" + Math.random().toString(16).slice(2),
    image: imageDataUrl,
    bestClass: predictionData.bestClass,
    bestProb: predictionData.bestProb,
    timestamp: predictionData.timestamp,
  };

  historyItems.unshift(entry);
  if (historyItems.length > MAX_HISTORY) {
    historyItems = historyItems.slice(0, MAX_HISTORY);
  }

  saveHistory();
  renderHistory();
}

function clearHistory() {
  if (!window.confirm("히스토리를 모두 삭제할까요?")) return;
  historyItems = [];
  saveHistory();
  renderHistory();
}

function formatDate(isoString) {
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return "";
  // 간단한 포맷: YYYY-MM-DD HH:MM
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hour = String(d.getHours()).padStart(2, "0");
  const minute = String(d.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

function renderHistory() {
  historyListEl.innerHTML = "";

  if (!historyItems || historyItems.length === 0) {
    const msg = document.createElement("p");
    msg.className = "empty-history";
    msg.textContent = "아직 기록이 없습니다. 이미지를 업로드하면 여기에 기록이 쌓입니다.";
    historyListEl.appendChild(msg);
    return;
  }

  historyItems.forEach((item) => {
    const wrap = document.createElement("div");
    wrap.className = "history-item";

    const thumbWrapper = document.createElement("div");
    thumbWrapper.className = "history-thumb-wrapper";

    const img = document.createElement("img");
    img.className = "history-thumb";
    img.src = item.image;
    img.alt = item.bestClass;

    thumbWrapper.appendChild(img);

    const info = document.createElement("div");
    info.className = "history-info";

    const label = document.createElement("div");
    label.className = "history-label";
    label.textContent = item.bestClass;

    const prob = document.createElement("div");
    prob.className = "history-prob";
    const percent = (item.bestProb * 100).toFixed(1);
    prob.textContent = `최고 확률: ${percent}%`;

    const meta = document.createElement("div");
    meta.className = "history-meta";
    meta.textContent = formatDate(item.timestamp);

    info.appendChild(label);
    info.appendChild(prob);
    info.appendChild(meta);

    wrap.appendChild(thumbWrapper);
    wrap.appendChild(info);

    historyListEl.appendChild(wrap);
  });
}

/* -----------------------------
 * 8. 결과 복사 / 다운로드
 * ---------------------------*/
function buildResultText(predictionData) {
  if (!predictionData) {
    return "아직 예측 결과가 없습니다.";
  }

  let lines = [];
  lines.push("[이미지 분류 결과]");
  lines.push(`최상위: ${predictionData.bestClass} (${(predictionData.bestProb * 100).toFixed(1)}%)`);
  lines.push("");
  lines.push("[전체 클래스 확률]");
  predictionData.predictions.forEach((p) => {
    lines.push(`- ${p.className}: ${(p.probability * 100).toFixed(1)}%`);
  });
  lines.push("");
  lines.push(`분석 시각: ${formatDate(predictionData.timestamp)}`);

  return lines.join("\n");
}

async function copyResultToClipboard() {
  if (!lastPrediction) {
    alert("복사할 예측 결과가 없습니다. 먼저 이미지를 업로드해서 분석해주세요.");
    return;
  }

  const text = buildResultText(lastPrediction);

  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      alert("예측 결과를 클립보드에 복사했습니다.");
    } else {
      // fallback
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      alert("예측 결과를 클립보드에 복사했습니다.");
    }
  } catch (err) {
    console.error("클립보드 복사 중 오류:", err);
    alert("클립보드 복사에 실패했습니다.");
  }
}

function downloadResultAsText() {
  if (!lastPrediction) {
    alert("다운로드할 예측 결과가 없습니다. 먼저 이미지를 업로드해서 분석해주세요.");
    return;
  }

  const text = buildResultText(lastPrediction);
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  a.download = `tm-result-${yyyy}${mm}${dd}-${hh}${min}.txt`;
  a.href = url;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  URL.revokeObjectURL(url);
}

/* -----------------------------
 * 9. 초기화
 * ---------------------------*/
window.addEventListener("load", async () => {
  topResultEl.textContent = "모델 로딩 중입니다...";

  setupFileInput();
  setupDragAndDrop();

  // 히스토리 로드
  loadHistory();

  // 히스토리 초기화 버튼
  clearHistoryBtn.addEventListener("click", clearHistory);

  // 복사/다운로드 버튼
  copyResultBtn.addEventListener("click", () => {
    copyResultToClipboard();
  });
  downloadResultBtn.addEventListener("click", () => {
    downloadResultAsText();
  });

  // 모델 로딩
  try {
    await loadModel();
  } catch (err) {
    console.error(err);
    topResultEl.textContent = "모델 로딩에 실패했습니다. 경로나 파일 구성을 확인해주세요.";
  }
});
