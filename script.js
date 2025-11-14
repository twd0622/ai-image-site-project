// Teachable Machine에서 Export한 모델이 들어있는 경로
const MODEL_FOLDER = "model/";

// Teachable Machine 이미지 모델의 입력 해상도
// 보통 224x224 or 192x192 등인데, TM 기본값이 224인 경우가 많음.
// 필요하면 metadata.json 참고해서 맞춰줘도 됨.
const IMAGE_SIZE = 224;

let model;
let isModelLoaded = false;

// 요소 참조
const imageInput = document.getElementById("image-input");
const previewImg = document.getElementById("preview");
const loadingEl = document.getElementById("loading");
const topResultEl = document.getElementById("top-result");
const probabilitiesEl = document.getElementById("probabilities");
const dropZone = document.getElementById("drop-zone");

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
 * 2. 로딩 UI 제어
 * ---------------------------*/
function showLoading(show) {
  loadingEl.style.display = show ? "flex" : "none";
}

/* -----------------------------
 * 3. 이미지 파일 처리 공통 함수
 * ---------------------------*/
function handleFile(file) {
  if (!file) return;

  // 미리보기용 URL 생성
  const imageURL = URL.createObjectURL(file);
  previewImg.src = imageURL;
  topResultEl.textContent = "이미지 로딩 중...";

  // 이미지가 실제로 <img>에 로드된 이후에 분석
  previewImg.onload = async () => {
    try {
      if (!isModelLoaded) {
        topResultEl.textContent = "모델이 아직 준비되지 않았습니다. 잠시 후 다시 시도해주세요.";
        return;
      }

      showLoading(true);

      // 1) 캔버스에 리사이즈해서 그리기
      const canvas = document.createElement("canvas");
      canvas.width = IMAGE_SIZE;
      canvas.height = IMAGE_SIZE;
      const ctx = canvas.getContext("2d");

      // 이미지 비율 유지하면서 중앙 맞추기 (간단 버전)
      const scale = Math.min(
        IMAGE_SIZE / previewImg.naturalWidth,
        IMAGE_SIZE / previewImg.naturalHeight
      );
      const newWidth = previewImg.naturalWidth * scale;
      const newHeight = previewImg.naturalHeight * scale;
      const dx = (IMAGE_SIZE - newWidth) / 2;
      const dy = (IMAGE_SIZE - newHeight) / 2;

      ctx.fillStyle = "#ffffff"; // 배경 흰색
      ctx.fillRect(0, 0, IMAGE_SIZE, IMAGE_SIZE);
      ctx.drawImage(previewImg, dx, dy, newWidth, newHeight);

      // 2) 모델 예측 (캔버스 전달)
      const prediction = await model.predict(canvas);

      // 3) 예측값 내림차순 정렬
      prediction.sort((a, b) => b.probability - a.probability);

      // 4) 상위 결과 텍스트 표시
      const best = prediction[0];
      topResultEl.textContent = `예측: ${best.className} (${(best.probability * 100).toFixed(1)}%)`;

      // 5) 전체 확률 막대 그래프 렌더링
      renderProbabilities(prediction);
    } catch (err) {
      console.error(err);
      topResultEl.textContent = "예측 중 오류가 발생했습니다. 콘솔을 확인해주세요.";
      probabilitiesEl.innerHTML = "";
    } finally {
      showLoading(false);
    }
  };
}

/* -----------------------------
 * 4. 전체 클래스 확률 막대 그래프 렌더링
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
  // 클릭하면 숨겨진 file input을 눌러줌
  dropZone.addEventListener("click", () => {
    imageInput.click();
  });

  // 드래그 관련 이벤트
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
    if (file && file.type.startsWith("image/")) {
      handleFile(file);
    } else {
      topResultEl.textContent = "이미지 파일만 업로드할 수 있습니다.";
    }
  });
}

/* -----------------------------
 * 7. 초기화
 * ---------------------------*/
window.addEventListener("load", async () => {
  topResultEl.textContent = "모델 로딩 중입니다...";
  setupFileInput();
  setupDragAndDrop();

  try {
    await loadModel();
  } catch (err) {
    console.error(err);
    topResultEl.textContent = "모델 로딩에 실패했습니다. 경로나 파일 구성을 확인해주세요.";
  }
});
