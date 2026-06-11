const botao = document.getElementById("botaoUpload");
const input = document.getElementById("imagemInput");
const nomeArquivo = document.getElementById("nomeArquivo");
const previewImagem = document.getElementById("previewImagem");
const selectedFile = document.getElementById("selectedFile");
const statusAnalise = document.getElementById("statusAnalise");

const removerBtn = document.getElementById("removerImagem");

const resultadoModal = document.getElementById("resultadoModal");
const fecharModal = document.getElementById("fecharModal");
const modalImagem = document.getElementById("modalImagem");
const modalStatus = document.getElementById("modalStatus");
const resultadoClasse = document.getElementById("resultadoClasse");
const resultadoConfianca = document.getElementById("resultadoConfianca");
const resultadoRecomendacao = document.getElementById("resultadoRecomendacao");
const baixarImagem = document.getElementById("baixarImagem");
const baixarPdf = document.getElementById("baixarPdf");

const AI_API_URL = window.LABLEAF_AI_API_URL || "";
const EMPTY_RECOMMENDATION_MESSAGES = new Set([
  "nenhuma recomendacao retornada pela api",
  "sem recomendacao",
]);
const RECOMMENDATION_CATALOG = {
  "mosaic virus":
    "Doenca viral sem tratamento curativo. Use sementes certificadas, monitore e reduza insetos vetores, elimine plantas voluntarias e remova plantas muito afetadas quando houver foco localizado.",
  "mossaic virus":
    "Doenca viral sem tratamento curativo. Use sementes certificadas, monitore e reduza insetos vetores, elimine plantas voluntarias e remova plantas muito afetadas quando houver foco localizado.",
  "yellow mosaic":
    "Doenca viral sem tratamento curativo. Reforce o controle de insetos vetores, elimine plantas voluntarias e hospedeiras proximas e priorize sementes e cultivares sadias nos proximos plantios.",
  "bacterial blight":
    "Evite manejar a lavoura com folhas molhadas, use sementes sadias, faca rotacao de culturas e monitore a evolucao das manchas. Em alta severidade, confirme o diagnostico antes de qualquer intervencao.",
  "brown spot":
    "Maneje restos culturais, faca rotacao fora da soja e acompanhe a severidade no baixeiro. Fungicida registrado pode ser avaliado quando houver historico da area e condicoes favoraveis.",
  septoria:
    "Maneje restos culturais, faca rotacao fora da soja e acompanhe a severidade no baixeiro. Fungicida registrado pode ser avaliado quando houver historico da area e condicoes favoraveis.",
  crestamento:
    "Use sementes sadias, reduza a permanencia de palhada infectada e monitore folhas novas. Em areas com historico e clima favoravel, avalie fungicida registrado com orientacao tecnica.",
  ferrugen:
    "Suspeita de ferrugem exige monitoramento rapido. Confirme em campo, verifique alertas regionais, elimine plantas voluntarias e avalie fungicida registrado conforme recomendacao tecnica local.",
  ferrugem:
    "Suspeita de ferrugem exige monitoramento rapido. Confirme em campo, verifique alertas regionais, elimine plantas voluntarias e avalie fungicida registrado conforme recomendacao tecnica local.",
  "powdery mildew":
    "Monitore a disseminacao nas folhas, prefira cultivares menos suscetiveis e evite estresse da lavoura. Fungicida registrado pode ser considerado se a doenca avancar em fase sensivel.",
  "southern blight":
    "Melhore a drenagem, reduza excesso de residuos infectados e faca rotacao com culturas nao hospedeiras. Em areas recorrentes, planeje manejo de solo e cultivares com acompanhamento tecnico.",
  "sudden death syndrone":
    "Nao ha tratamento de resgate eficiente em plantas ja afetadas. Para proximos ciclos, use cultivares tolerantes, trate sementes, melhore drenagem e reduza compactacao e nematoides.",
  "sudden death syndrome":
    "Nao ha tratamento de resgate eficiente em plantas ja afetadas. Para proximos ciclos, use cultivares tolerantes, trate sementes, melhore drenagem e reduza compactacao e nematoides.",
  healthy:
    "Nao ha indicio relevante de doenca nesta imagem. Mantenha o monitoramento da area, registre novas amostras e acompanhe mudancas de cor, manchas ou queda precoce das folhas.",
  saudavel:
    "Nao ha indicio relevante de doenca nesta imagem. Mantenha o monitoramento da area, registre novas amostras e acompanhe mudancas de cor, manchas ou queda precoce das folhas.",
};

let selectedImageDataUrl = "";
let lastAnalysis = null;
let requestId = 0;
let activeController = null;

if (!localStorage.getItem("authToken")) {
  window.location.href = "login.html";
}

function setPageStatus(message, type = "") {
  if (!statusAnalise) return;

  statusAnalise.textContent = message;
  statusAnalise.className = "status-line";

  if (type) {
    statusAnalise.classList.add(`is-${type}`);
  }
}

function setLoadingState(isLoading) {
  if (!botao) return;

  const title = botao.querySelector(".dropzone-title");
  const subtitle = botao.querySelector(".dropzone-subtitle");

  botao.disabled = isLoading;

  if (title) {
    title.textContent = isLoading
      ? "Analisando imagem..."
      : "Selecionar foto da folha";
  }

  if (subtitle) {
    subtitle.textContent = isLoading
      ? "Processando no modelo de IA"
      : "JPG, PNG ou WEBP";
  }
}

function setDownloadButtons(enabled) {
  if (baixarImagem) baixarImagem.disabled = !enabled;
  if (baixarPdf) baixarPdf.disabled = !enabled;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Não foi possível ler a imagem."));
    reader.readAsDataURL(file);
  });
}

function formatConfidence(value) {
  if (value === undefined || value === null || value === "") {
    return "Não informado";
  }

  if (typeof value === "string" && value.includes("%")) {
    return value;
  }

  const numberValue = Number(value);

  if (Number.isNaN(numberValue)) {
    return String(value);
  }

  const normalized = numberValue <= 1 ? numberValue * 100 : numberValue;

  return `${normalized.toLocaleString("pt-BR", {
    maximumFractionDigits: 2,
  })}%`;
}

function getConfidenceNumber(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const normalizedValue =
    typeof value === "string" ? value.replace("%", "").replace(",", ".") : value;
  const numberValue = Number(normalizedValue);

  if (Number.isNaN(numberValue)) {
    return null;
  }

  return numberValue <= 1 ? numberValue * 100 : numberValue;
}

function firstPresent(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== "");
}

function normalizeClassKey(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function isEmptyRecommendation(value) {
  if (!value) return true;

  return EMPTY_RECOMMENDATION_MESSAGES.has(
    normalizeClassKey(value).replace(/[.!?]+$/, "")
  );
}

function recommendationForClass(className) {
  return RECOMMENDATION_CATALOG[normalizeClassKey(className)] || "";
}

function getAnalysisFromResponse(data) {
  const mainPrediction = Array.isArray(data.top_k) ? data.top_k[0] : null;
  const className = firstPresent(
    data.classe,
    data.doenca,
    data.resultado,
    data.class_name,
    data.predicted_class,
    data.classe_predita,
    mainPrediction?.classe
  );
  const confidence = firstPresent(
    data.confianca,
    data.confidence,
    data.confidence_percent,
    data.confianca_percentual,
    data.percentual_confianca,
    data.probabilidade,
    mainPrediction?.percentual,
    mainPrediction?.probabilidade
  );
  const apiRecommendation = firstPresent(data.recomendacao, data.recommendation);
  const recommendation = isEmptyRecommendation(apiRecommendation)
    ? recommendationForClass(className)
    : apiRecommendation;

  return {
    classe: className || "Não informado",
    confianca: formatConfidence(confidence),
    recomendacao:
      recommendation ||
      "Confirme o diagnostico em campo e procure orientacao tecnica para definir o manejo mais adequado.",
    data: new Date(),
  };
}

async function saveAnalysis(file, rawData, analysis) {
  const formData = new FormData();
  const mainPrediction = Array.isArray(rawData.top_k) ? rawData.top_k[0] : null;
  const rawConfidence = firstPresent(
    rawData.confianca,
    rawData.confidence,
    rawData.confidence_percent,
    rawData.confianca_percentual,
    rawData.percentual_confianca,
    rawData.probabilidade,
    mainPrediction?.percentual,
    mainPrediction?.probabilidade
  );
  const confidenceNumber = getConfidenceNumber(rawConfidence || analysis.confianca);
  const resultImage = rawData.imagem_resultado || rawData.result_image;

  if (file) {
    formData.append("file", file);
  }

  formData.append("classe", analysis.classe);

  if (confidenceNumber !== null) {
    formData.append("confianca", String(confidenceNumber));
  }

  if (analysis.recomendacao) {
    formData.append("recomendacao", analysis.recomendacao);
  }

  if (resultImage) {
    formData.append("imagem_resultado", resultImage);
  }

  return window.LabLeafApi.request("/api/analyses", {
    method: "POST",
    body: formData,
  });
}

async function ensureAnalysisTokens() {
  const data = await window.LabLeafApi.request("/api/subscription");
  const subscription = data.subscription;

  if (!subscription?.active) {
    throw new Error("Escolha um plano para liberar análises.");
  }

  if (Number(subscription.tokens_remaining || 0) <= 0) {
    throw new Error("Os tokens do seu plano acabaram. Renove ou escolha outro plano.");
  }

  return subscription;
}

function updateModal(state, analysis = {}) {
  if (!modalStatus || !resultadoClasse || !resultadoConfianca) return;

  const statusMap = {
    loading: "Analisando imagem",
    success: "Análise concluída",
    error: "Não foi possível analisar",
  };

  modalStatus.textContent = statusMap[state] || "Resultado";
  modalStatus.className = "modal-kicker";

  if (state === "loading") {
    modalStatus.classList.add("is-loading");
  }

  if (state === "error") {
    modalStatus.classList.add("is-error");
  }

  if (modalImagem && selectedImageDataUrl) {
    modalImagem.src = selectedImageDataUrl;
  }

  resultadoClasse.textContent = analysis.classe || "Processando...";
  resultadoConfianca.textContent = analysis.confianca || "--";

  if (resultadoRecomendacao) {
    resultadoRecomendacao.textContent =
      analysis.recomendacao || "Aguardando retorno do modelo.";
  }

  setDownloadButtons(state === "success" && Boolean(lastAnalysis));
}

function openModal(state, analysis = {}) {
  if (!resultadoModal) return;

  resultadoModal.hidden = false;
  document.body.classList.add("modal-open");
  updateModal(state, analysis);
}

function closeModal() {
  if (!resultadoModal) return;

  resultadoModal.hidden = true;
  document.body.classList.remove("modal-open");
}

function resetSelection() {
  requestId += 1;

  if (activeController) {
    activeController.abort();
    activeController = null;
  }

  if (input) input.value = "";
  if (previewImagem) previewImagem.removeAttribute("src");
  if (nomeArquivo) nomeArquivo.textContent = "";
  if (selectedFile) selectedFile.hidden = true;

  selectedImageDataUrl = "";
  lastAnalysis = null;

  setLoadingState(false);
  setDownloadButtons(false);
  setPageStatus("Aguardando imagem.");
  closeModal();
}

async function analyzeImage(file, currentRequestId) {
  if (!AI_API_URL) {
    throw new Error("Configure a URL da API de IA no arquivo config.js.");
  }

  const formData = new FormData();
  formData.append("file", file);

  const controller = new AbortController();
  activeController = controller;

  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 45000);

  try {
    const response = await fetch(AI_API_URL, {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const textoResposta = await response.text();

    let data;
    try {
      data = textoResposta ? JSON.parse(textoResposta) : {};
    } catch {
      throw new Error(
        "A API respondeu, mas não retornou JSON válido: " + textoResposta
      );
    }

    if (!response.ok) {
      throw new Error(
        data.erro ||
          data.detail ||
          data.message ||
          `Erro HTTP ${response.status}`
      );
    }

    if (currentRequestId !== requestId) return;

    lastAnalysis = getAnalysisFromResponse(data);

    try {
      const savedAnalysis = await saveAnalysis(file, data, lastAnalysis);
      lastAnalysis.id = savedAnalysis.id || savedAnalysis.analysis_id;
      setPageStatus("Resultado salvo no histórico.", "success");
    } catch (saveError) {
      console.warn("Não foi possível salvar a análise:", saveError);
      setPageStatus(
        "Resultado pronto, mas não foi possível salvar no histórico.",
        "error"
      );
    }

    openModal("success", lastAnalysis);
  } catch (error) {
    clearTimeout(timeout);

    if (currentRequestId !== requestId) return;

    const message = timedOut
      ? "A análise demorou mais que o esperado. Tente novamente com outra imagem."
      : error.message;

    lastAnalysis = null;
    setPageStatus(message, "error");
    openModal("error", {
      classe: "Falha na análise",
      confianca: "--",
      recomendacao: message,
    });
  } finally {
    if (activeController === controller) {
      activeController = null;
    }

    if (currentRequestId === requestId) {
      setLoadingState(false);
    }
  }
}

async function handleFile(file) {
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    setPageStatus("Selecione um arquivo de imagem válido.", "error");
    return;
  }

  requestId += 1;
  const currentRequestId = requestId;

  if (activeController) {
    activeController.abort();
    activeController = null;
  }

  lastAnalysis = null;
  setDownloadButtons(false);
  setLoadingState(true);
  setPageStatus("Verificando saldo do plano...", "loading");

  try {
    await ensureAnalysisTokens();
    setPageStatus("Enviando imagem para análise...", "loading");
    selectedImageDataUrl = await readFileAsDataUrl(file);

    if (currentRequestId !== requestId) return;

    if (previewImagem) {
      previewImagem.src = selectedImageDataUrl;
    }

    if (nomeArquivo) {
      nomeArquivo.textContent = file.name;
    }

    if (selectedFile) {
      selectedFile.hidden = false;
    }

    openModal("loading", {
      classe: "Processando...",
      confianca: "--",
      recomendacao: "Aguardando retorno do modelo.",
    });

    await analyzeImage(file, currentRequestId);
  } catch (error) {
    if (currentRequestId !== requestId) return;

    setLoadingState(false);
    setPageStatus(error.message, "error");
    openModal("error", {
      classe: "Falha ao carregar imagem",
      confianca: "--",
      recomendacao: error.message,
    });
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDate(date) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date || new Date());
}

function downloadFile(url, filename) {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
  const words = String(text).split(/\s+/);
  let line = "";
  let lines = 0;

  for (let index = 0; index < words.length; index += 1) {
    const testLine = line ? `${line} ${words[index]}` : words[index];
    const metrics = ctx.measureText(testLine);

    if (metrics.width > maxWidth && line) {
      lines += 1;

      if (maxLines && lines >= maxLines) {
        ctx.fillText(`${line}...`, x, y);
        return y + lineHeight;
      }

      ctx.fillText(line, x, y);
      line = words[index];
      y += lineHeight;
    } else {
      line = testLine;
    }
  }

  if (line) {
    ctx.fillText(line, x, y);
    y += lineHeight;
  }

  return y;
}

function drawContainedImage(ctx, image, x, y, width, height) {
  const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
  const renderedWidth = image.naturalWidth * scale;
  const renderedHeight = image.naturalHeight * scale;
  const offsetX = x + (width - renderedWidth) / 2;
  const offsetY = y + (height - renderedHeight) / 2;

  ctx.drawImage(image, offsetX, offsetY, renderedWidth, renderedHeight);
}

function loadImage(dataUrl) {
  return new Promise((resolve) => {
    if (!dataUrl) {
      resolve(null);
      return;
    }

    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = dataUrl;
  });
}

async function baixarResultadoComoImagem() {
  if (!lastAnalysis) return;

  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 1600;

  const ctx = canvas.getContext("2d");
  const image = await loadImage(selectedImageDataUrl);

  ctx.fillStyle = "#f5f7f2";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#123f7a";
  ctx.fillRect(0, 0, canvas.width, 220);

  ctx.fillStyle = "#ffffff";
  ctx.font = "700 54px Arial";
  ctx.fillText("LabLeaf", 76, 92);

  ctx.font = "400 30px Arial";
  ctx.fillText("Resultado da análise agrícola", 76, 148);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(76, 282, 1048, 470);

  if (image) {
    drawContainedImage(ctx, image, 106, 312, 988, 410);
  }

  ctx.fillStyle = "#1f2933";
  ctx.font = "700 38px Arial";
  ctx.fillText("Diagnóstico", 76, 840);

  ctx.font = "700 28px Arial";
  ctx.fillStyle = "#667085";
  ctx.fillText("Doença identificada", 76, 904);

  ctx.fillStyle = "#1f2933";
  ctx.font = "700 42px Arial";
  wrapCanvasText(ctx, lastAnalysis.classe, 76, 958, 1000, 50, 2);

  ctx.font = "700 28px Arial";
  ctx.fillStyle = "#667085";
  ctx.fillText("Confiança", 76, 1080);

  ctx.fillStyle = "#177245";
  ctx.font = "700 48px Arial";
  ctx.fillText(lastAnalysis.confianca, 76, 1140);

  ctx.font = "700 28px Arial";
  ctx.fillStyle = "#667085";
  ctx.fillText("Recomendação inicial", 76, 1240);

  ctx.fillStyle = "#1f2933";
  ctx.font = "400 32px Arial";
  wrapCanvasText(ctx, lastAnalysis.recomendacao, 76, 1295, 1048, 44, 4);

  ctx.fillStyle = "#667085";
  ctx.font = "400 24px Arial";
  ctx.fillText(`Gerado em ${formatDate(lastAnalysis.data)}`, 76, 1510);

  canvas.toBlob((blob) => {
    if (!blob) return;

    const url = URL.createObjectURL(blob);
    downloadFile(url, "resultado-lableaf.png");
    URL.revokeObjectURL(url);
  }, "image/png");
}

function baixarResultadoComoPdf() {
  if (!lastAnalysis) return;

  const printWindow = window.open("", "_blank", "width=900,height=700");

  if (!printWindow) {
    alert("Não foi possível abrir a janela de impressão.");
    return;
  }

  const html = `
    <!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="UTF-8" />
        <title>Resultado LabLeaf</title>
        <style>
          body {
            margin: 0;
            padding: 32px;
            color: #1f2933;
            font-family: Arial, Helvetica, sans-serif;
            background: #f5f7f2;
          }
          .report {
            max-width: 760px;
            margin: 0 auto;
            overflow: hidden;
            border: 1px solid #d8e0dc;
            border-radius: 8px;
            background: #ffffff;
          }
          .header {
            padding: 28px 32px;
            background: #123f7a;
            color: #ffffff;
          }
          .header h1 {
            margin: 0 0 8px;
            font-size: 30px;
          }
          .header p {
            margin: 0;
            color: rgba(255, 255, 255, 0.78);
          }
          img {
            width: 100%;
            max-height: 360px;
            display: block;
            object-fit: contain;
            background: #e7ece8;
          }
          .content {
            padding: 30px 32px;
          }
          .label {
            margin: 22px 0 6px;
            color: #667085;
            font-size: 12px;
            font-weight: 800;
            text-transform: uppercase;
          }
          .value {
            margin: 0;
            font-size: 22px;
            line-height: 1.45;
          }
          .confidence {
            color: #177245;
            font-size: 30px;
            font-weight: 800;
          }
          .note {
            margin-top: 28px;
            color: #667085;
            font-size: 13px;
            line-height: 1.6;
          }
          @media print {
            body {
              padding: 0;
              background: #ffffff;
            }
            .report {
              border: 0;
            }
          }
        </style>
      </head>
      <body>
        <article class="report">
          <header class="header">
            <h1>LabLeaf</h1>
            <p>Resultado da análise agrícola - ${escapeHtml(formatDate(lastAnalysis.data))}</p>
          </header>
          <img src="${selectedImageDataUrl}" alt="Imagem analisada" />
          <section class="content">
            <p class="label">Doença identificada</p>
            <p class="value">${escapeHtml(lastAnalysis.classe)}</p>

            <p class="label">Confiança</p>
            <p class="value confidence">${escapeHtml(lastAnalysis.confianca)}</p>

            <p class="label">Recomendação inicial</p>
            <p class="value">${escapeHtml(lastAnalysis.recomendacao)}</p>

            <p class="note">
              O diagnóstico é uma triagem por IA e não substitui a avaliação de um profissional da área.
            </p>
          </section>
        </article>
      </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => printWindow.print(), 350);
}

if (removerBtn) {
  removerBtn.addEventListener("click", resetSelection);
}

if (botao && input) {
  botao.addEventListener("click", function () {
    input.click();
  });

  input.addEventListener("change", function () {
    handleFile(input.files[0]);
  });

  ["dragenter", "dragover"].forEach((eventName) => {
    botao.addEventListener(eventName, function (event) {
      event.preventDefault();
      botao.classList.add("is-dragover");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    botao.addEventListener(eventName, function (event) {
      event.preventDefault();
      botao.classList.remove("is-dragover");
    });
  });

  botao.addEventListener("drop", function (event) {
    const file = Array.from(event.dataTransfer.files).find((item) =>
      item.type.startsWith("image/")
    );

    handleFile(file);
  });
}

if (fecharModal) {
  fecharModal.addEventListener("click", closeModal);
}

if (resultadoModal) {
  resultadoModal.addEventListener("click", function (event) {
    if (event.target === resultadoModal) {
      closeModal();
    }
  });
}

document.addEventListener("keydown", function (event) {
  if (event.key === "Escape" && resultadoModal && !resultadoModal.hidden) {
    closeModal();
  }
});

if (baixarImagem) {
  baixarImagem.addEventListener("click", baixarResultadoComoImagem);
}

if (baixarPdf) {
  baixarPdf.addEventListener("click", baixarResultadoComoPdf);
}
