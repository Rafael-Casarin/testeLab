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
  "mosaico amarelo":
    "Doenca viral sem tratamento curativo. Reforce o controle de insetos vetores, elimine plantas voluntarias e hospedeiras proximas e priorize sementes e cultivares sadias nos proximos plantios.",
  "bacterial blight":
    "Evite manejar a lavoura com folhas molhadas, use sementes sadias, faca rotacao de culturas e monitore a evolucao das manchas. Em alta severidade, confirme o diagnostico antes de qualquer intervencao.",
  "mancha bacteriana":
    "Evite manejar a lavoura com folhas molhadas, use sementes sadias, faca rotacao de culturas e monitore a evolucao das manchas. Em alta severidade, confirme o diagnostico antes de qualquer intervencao.",
  "brown spot":
    "Maneje restos culturais, faca rotacao fora da soja e acompanhe a severidade no baixeiro. Fungicida registrado pode ser avaliado quando houver historico da area e condicoes favoraveis.",
  "mancha marrom":
    "Maneje restos culturais, faca rotacao fora da soja e acompanhe a severidade no baixeiro. Fungicida registrado pode ser avaliado quando houver historico da area e condicoes favoraveis.",
  septoria:
    "Maneje restos culturais, faca rotacao fora da soja e acompanhe a severidade no baixeiro. Fungicida registrado pode ser avaliado quando houver historico da area e condicoes favoraveis.",
  septoriose:
    "Maneje restos culturais, faca rotacao fora da soja e acompanhe a severidade no baixeiro. Fungicida registrado pode ser avaliado quando houver historico da area e condicoes favoraveis.",
  "cercospora leaf blight":
    "Use sementes sadias, reduza a permanencia de palhada infectada e monitore folhas novas. Em areas com historico e clima favoravel, avalie fungicida registrado com orientacao tecnica.",
  "crestamento foliar por cercospora":
    "Use sementes sadias, reduza a permanencia de palhada infectada e monitore folhas novas. Em areas com historico e clima favoravel, avalie fungicida registrado com orientacao tecnica.",
  crestamento:
    "Use sementes sadias, reduza a permanencia de palhada infectada e monitore folhas novas. Em areas com historico e clima favoravel, avalie fungicida registrado com orientacao tecnica.",
  ferrugen:
    "Suspeita de ferrugem exige monitoramento rapido. Confirme em campo, verifique alertas regionais, elimine plantas voluntarias e avalie fungicida registrado conforme recomendacao tecnica local.",
  ferrugem:
    "Suspeita de ferrugem exige monitoramento rapido. Confirme em campo, verifique alertas regionais, elimine plantas voluntarias e avalie fungicida registrado conforme recomendacao tecnica local.",
  "soybean rust":
    "Suspeita de ferrugem exige monitoramento rapido. Confirme em campo, verifique alertas regionais, elimine plantas voluntarias e avalie fungicida registrado conforme recomendacao tecnica local.",
  "ferrugem asiatica":
    "Suspeita de ferrugem exige monitoramento rapido. Confirme em campo, verifique alertas regionais, elimine plantas voluntarias e avalie fungicida registrado conforme recomendacao tecnica local.",
  "powdery mildew":
    "Monitore a disseminacao nas folhas, prefira cultivares menos suscetiveis e evite estresse da lavoura. Fungicida registrado pode ser considerado se a doenca avancar em fase sensivel.",
  oidio:
    "Monitore a disseminacao nas folhas, prefira cultivares menos suscetiveis e evite estresse da lavoura. Fungicida registrado pode ser considerado se a doenca avancar em fase sensivel.",
  "downey mildew":
    "Evite excesso de umidade no dossel, monitore a disseminacao em folhas novas e priorize cultivares menos suscetiveis. Em areas recorrentes, avalie manejo preventivo com orientacao tecnica.",
  mildio:
    "Evite excesso de umidade no dossel, monitore a disseminacao em folhas novas e priorize cultivares menos suscetiveis. Em areas recorrentes, avalie manejo preventivo com orientacao tecnica.",
  "southern blight":
    "Melhore a drenagem, reduza excesso de residuos infectados e faca rotacao com culturas nao hospedeiras. Em areas recorrentes, planeje manejo de solo e cultivares com acompanhamento tecnico.",
  "murcha de sclerotium":
    "Melhore a drenagem, reduza excesso de residuos infectados e faca rotacao com culturas nao hospedeiras. Em areas recorrentes, planeje manejo de solo e cultivares com acompanhamento tecnico.",
  "sudden death syndrone":
    "Nao ha tratamento de resgate eficiente em plantas ja afetadas. Para proximos ciclos, use cultivares tolerantes, trate sementes, melhore drenagem e reduza compactacao e nematoides.",
  "sudden death syndrome":
    "Nao ha tratamento de resgate eficiente em plantas ja afetadas. Para proximos ciclos, use cultivares tolerantes, trate sementes, melhore drenagem e reduza compactacao e nematoides.",
  "sindrome da morte subita":
    "Nao ha tratamento de resgate eficiente em plantas ja afetadas. Para proximos ciclos, use cultivares tolerantes, trate sementes, melhore drenagem e reduza compactacao e nematoides.",
  frogeye:
    "Monitore a evolucao das lesoes, reduza restos culturais infectados e use rotacao de culturas. Em areas com historico, avalie cultivares tolerantes e fungicida registrado com orientacao tecnica.",
  "olho de ra":
    "Monitore a evolucao das lesoes, reduza restos culturais infectados e use rotacao de culturas. Em areas com historico, avalie cultivares tolerantes e fungicida registrado com orientacao tecnica.",
  "target spot":
    "Acompanhe a severidade no baixeiro, reduza estresse da lavoura e maneje restos culturais. Se a doenca avancar em fase reprodutiva, avalie fungicida registrado com orientacao tecnica.",
  "mancha alvo":
    "Acompanhe a severidade no baixeiro, reduza estresse da lavoura e maneje restos culturais. Se a doenca avancar em fase reprodutiva, avalie fungicida registrado com orientacao tecnica.",
  "potassium deficiency":
    "Indicio de deficiencia nutricional. Confirme com analise de solo ou foliar, revise adubacao potassica e corrija compactacao, umidade ou pH que possam limitar a absorcao.",
  "deficiencia de potassio":
    "Indicio de deficiencia nutricional. Confirme com analise de solo ou foliar, revise adubacao potassica e corrija compactacao, umidade ou pH que possam limitar a absorcao.",
  healthy:
    "Nao ha indicio relevante de doenca nesta imagem. Mantenha o monitoramento da area, registre novas amostras e acompanhe mudancas de cor, manchas ou queda precoce das folhas.",
  "folha saudavel":
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

function firstArrayItem(...values) {
  for (const value of values) {
    if (Array.isArray(value) && value.length > 0) {
      return value[0];
    }
  }

  return null;
}

function getAnalysisFromResponse(data) {
  const resultPrediction =
    data.result && typeof data.result === "object" && !Array.isArray(data.result)
      ? data.result
      : null;
  const mainPrediction = firstArrayItem(
    data.top_k,
    data.predictions,
    data.detections,
    data.results
  );
  const className = firstPresent(
    data.classe,
    data.doenca,
    data.resultado,
    data.class_name,
    data.predicted_class,
    data.classe_predita,
    data.prediction,
    data.predicao,
    data.label,
    data.name,
    data.class,
    resultPrediction?.label,
    resultPrediction?.class,
    resultPrediction?.classe,
    resultPrediction?.class_name,
    resultPrediction?.name,
    mainPrediction?.classe,
    mainPrediction?.class_name,
    mainPrediction?.class,
    mainPrediction?.name,
    mainPrediction?.label
  );
  const confidence = firstPresent(
    data.confianca,
    data.confidence,
    data.confidence_percent,
    data.confianca_percentual,
    data.percentual_confianca,
    data.probabilidade,
    data.probability,
    data.score,
    resultPrediction?.percentual,
    resultPrediction?.probabilidade,
    resultPrediction?.probability,
    resultPrediction?.confidence,
    resultPrediction?.score,
    mainPrediction?.percentual,
    mainPrediction?.probabilidade,
    mainPrediction?.probability,
    mainPrediction?.confidence,
    mainPrediction?.score
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
  const resultPrediction =
    rawData.result && typeof rawData.result === "object" && !Array.isArray(rawData.result)
      ? rawData.result
      : null;
  const mainPrediction = firstArrayItem(
    rawData.top_k,
    rawData.predictions,
    rawData.detections,
    rawData.results
  );
  const rawConfidence = firstPresent(
    rawData.confianca,
    rawData.confidence,
    rawData.confidence_percent,
    rawData.confianca_percentual,
    rawData.percentual_confianca,
    rawData.probabilidade,
    rawData.probability,
    rawData.score,
    resultPrediction?.percentual,
    resultPrediction?.probabilidade,
    resultPrediction?.probability,
    resultPrediction?.confidence,
    resultPrediction?.score,
    mainPrediction?.percentual,
    mainPrediction?.probabilidade,
    mainPrediction?.probability,
    mainPrediction?.confidence,
    mainPrediction?.score
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

if (baixarPdf) {
  baixarPdf.addEventListener("click", baixarResultadoComoPdf);
}
