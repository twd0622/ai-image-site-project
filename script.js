let model; // Teachable Machine 모델
const modelFolder = "model/"; // 모델 파일이 들어 있는 폴더 경로

async function loadModel() {
  const modelURL = modelFolder + "model.json";
  const metadataURL = modelFolder + "metadata.json";

  // tmImage는 teachablemachine-image 스크립트에서 제공
  model = await tmImage.load(modelURL, metadataURL);
  console.log("모델 로드 완료");
}

// 이미지 업로드 → 미리보기 + 예측
function setupImageInput() {
  const input = document.getElementById("image-input");
  const preview = document.getElementById("preview");
  const resultElement = document.getElementById("result");

  input.addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) {
      return;
    }

    // 업로드된 파일을 브라우저에서 볼 수 있게 URL 생성
    const imageURL = URL.createObjectURL(file);
    preview.src = imageURL;
    resultElement.textContent = "이미지 로딩 중...";

    // 이미지가 실제로 <img>에 로드된 다음에 예측해야 함
    preview.onload = async () => {
      if (!model) {
        resultElement.textContent = "모델을 아직 로드 중입니다. 잠시 후 다시 시도해주세요.";
        return;
      }

      // 모델 예측
      const prediction = await model.predict(preview); // <img> 태그 그대로 넣어도 됨

      // 가장 확률이 높은 클래스 찾기
      let best = prediction[0];
      for (let i = 1; i < prediction.length; i++) {
        if (prediction[i].probability > best.probability) {
          best = prediction[i];
        }
      }

      // 결과 출력
      resultElement.textContent =
        `예측: ${best.className} (${(best.probability * 100).toFixed(1)}%)`;
    };
  });
}

// 페이지 로드 시 모델과 이벤트 초기화
window.addEventListener("load", async () => {
  const resultElement = document.getElementById("result");
  try {
    resultElement.textContent = "모델 로딩 중...";
    await loadModel();
    resultElement.textContent = "모델 로딩 완료! 이미지를 업로드해보세요.";
  } catch (e) {
    console.error(e);
    resultElement.textContent = "모델 로딩에 실패했습니다. 콘솔을 확인해주세요.";
  }

  setupImageInput();
});
