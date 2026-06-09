(function () {
  const periodFilter = document.getElementById("periodFilter");
  const diseaseFilter = document.getElementById("diseaseFilter");
  const filterButton = document.getElementById("filterButton");
  const exportReport = document.getElementById("exportReport");
  const periodChart = document.getElementById("periodChart");
  const diseaseList = document.getElementById("diseaseList");
  const historyBody = document.getElementById("historyBody");

  let currentReport = null;

  function setText(id, value) {
    const element = document.getElementById(id);

    if (element) {
      element.textContent = value;
    }
  }

  function formatPercent(value) {
    return `${Number(value || 0).toLocaleString("pt-BR", {
      maximumFractionDigits: 1,
    })}%`;
  }

  function formatConfidence(value) {
    if (value === undefined || value === null || value === "") {
      return "--";
    }

    return formatPercent(value);
  }

  function formatDate(value) {
    if (!value) return "--";

    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(value));
  }

  function isHealthy(classe) {
    const value = String(classe || "").toLowerCase();
    return value.includes("saudavel") || value.includes("healthy");
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function updateMetrics(report) {
    setText("metricTotal", report.total || 0);
    setText("metricTotalHint", `${report.historico?.length || 0} registros recentes`);
    setText("metricDoentes", report.doentes || 0);
    setText("metricDoentesHint", `${formatPercent(report.percentual_doentes)} das amostras`);
    setText("metricSaudaveis", report.saudaveis || 0);
    setText(
      "metricSaudaveisHint",
      `${formatPercent(report.percentual_saudaveis)} das amostras`
    );
    setText("metricMaisComum", report.doenca_mais_comum?.classe || "Nenhuma");
    setText(
      "metricMaisComumHint",
      `${report.doenca_mais_comum?.quantidade || 0} ocorrências`
    );
  }

  function updatePeriodChart(report) {
    if (!periodChart) return;

    const series = report.periodo || [];
    const max = Math.max(...series.map((item) => item.total), 1);

    periodChart.innerHTML = series
      .map((item) => {
        const value = Math.max(12, Math.round((item.total / max) * 100));

        return `
          <div style="--value: ${value}%">
            <span>${escapeHtml(item.label)}</span>
            <strong>${item.total}</strong>
          </div>
        `;
      })
      .join("");
  }

  function updateDistribution(report) {
    if (!diseaseList) return;

    const items = report.distribuicao || [];

    if (!items.length) {
      diseaseList.innerHTML = `
        <div>
          <span>Nenhum diagnóstico registrado</span>
          <strong>0%</strong>
          <i style="--value: 0%"></i>
        </div>
      `;
      return;
    }

    diseaseList.innerHTML = items
      .map(
        (item) => `
          <div>
            <span>${escapeHtml(item.classe)}</span>
            <strong>${formatPercent(item.percentual)}</strong>
            <i style="--value: ${Number(item.percentual || 0)}%"></i>
          </div>
        `
      )
      .join("");
  }

  function updateDiseaseOptions(report) {
    if (!diseaseFilter) return;

    const selected = diseaseFilter.value;
    const diseases = report.doencas_disponiveis || [];

    diseaseFilter.innerHTML = '<option value="all">Todas as doenças</option>';

    diseases.forEach((disease) => {
      const option = document.createElement("option");
      option.value = disease;
      option.textContent = disease;
      diseaseFilter.appendChild(option);
    });

    if (selected && diseases.includes(selected)) {
      diseaseFilter.value = selected;
    }
  }

  function updateHistory(report) {
    if (!historyBody) return;

    const records = report.historico || [];

    if (!records.length) {
      historyBody.innerHTML = `
        <tr>
          <td colspan="6">Nenhuma análise registrada ainda.</td>
        </tr>
      `;
      return;
    }

    historyBody.innerHTML = records
      .map((record) => {
        const healthy = isHealthy(record.classe);
        const statusClass = healthy ? "status-success" : "status-danger";
        const statusText = healthy ? "Saudável" : "Doente";
        const thumbnailStyle = record.imagem
          ? ` style="background-image: linear-gradient(rgba(31, 111, 80, 0.14), rgba(31, 111, 80, 0.14)), url('${escapeHtml(record.imagem)}')"`
          : "";

        return `
          <tr>
            <td><div class="miniatura"${thumbnailStyle}></div></td>
            <td>${formatDate(record.created_at)}</td>
            <td>${escapeHtml(record.classe || "Não informado")}</td>
            <td>${formatConfidence(record.confianca)}</td>
            <td><span class="status ${statusClass}">${statusText}</span></td>
            <td><button class="btn-table" type="button" data-id="${record.id}">Ver</button></td>
          </tr>
        `;
      })
      .join("");
  }

  async function loadReport() {
    const period = periodFilter?.value || "7";
    const disease = diseaseFilter?.value || "all";
    const params = new URLSearchParams({ period, disease });

    if (filterButton) {
      filterButton.disabled = true;
      filterButton.textContent = "Carregando...";
    }

    try {
      currentReport = await window.LabLeafApi.request(
        `/api/reports/summary?${params.toString()}`
      );

      updateMetrics(currentReport);
      updatePeriodChart(currentReport);
      updateDistribution(currentReport);
      updateDiseaseOptions(currentReport);
      updateHistory(currentReport);
    } catch (error) {
      if (historyBody) {
        historyBody.innerHTML = `
          <tr>
            <td colspan="6">${escapeHtml(error.message)}</td>
          </tr>
        `;
      }
    } finally {
      if (filterButton) {
        filterButton.disabled = false;
        filterButton.textContent = "Filtrar";
      }
    }
  }

  async function applyDefaultPeriod() {
    if (!periodFilter) return;

    try {
      const data = await window.LabLeafApi.request("/api/settings");
      const period = data.settings?.default_report_period || "7";
      periodFilter.value = period;
      localStorage.setItem("defaultReportPeriod", period);
    } catch {
      periodFilter.value = localStorage.getItem("defaultReportPeriod") || "7";
    }
  }

  function exportCsv() {
    const records = currentReport?.historico || [];

    if (!records.length) {
      alert("Nenhum registro para exportar.");
      return;
    }

    const rows = [
      ["Data", "Diagnostico", "Confianca", "Status", "Recomendacao"],
      ...records.map((record) => [
        formatDate(record.created_at),
        record.classe || "",
        formatConfidence(record.confianca),
        isHealthy(record.classe) ? "Saudavel" : "Doente",
        record.recomendacao || "",
      ]),
    ];
    const csv = rows
      .map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "relatorio-lableaf.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  if (filterButton) {
    filterButton.addEventListener("click", loadReport);
  }

  if (exportReport) {
    exportReport.addEventListener("click", exportCsv);
  }

  if (historyBody) {
    historyBody.addEventListener("click", (event) => {
      const button = event.target.closest("[data-id]");
      if (!button || !currentReport) return;

      const record = currentReport.historico.find(
        (item) => String(item.id) === button.dataset.id
      );

      if (!record) return;

      alert(
        [
          `Diagnóstico: ${record.classe || "Não informado"}`,
          `Confiança: ${formatConfidence(record.confianca)}`,
          `Recomendação: ${record.recomendacao || "Sem recomendação"}`,
        ].join("\n")
      );
    });
  }

  document.addEventListener("DOMContentLoaded", async () => {
    await applyDefaultPeriod();
    loadReport();
  });
})();
