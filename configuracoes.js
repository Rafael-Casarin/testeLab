(function () {
  const settingsForm = document.getElementById("settingsForm");
  const settingsStatus = document.getElementById("settingsStatus");

  function setMessage(message, type = "") {
    if (!settingsStatus) return;

    settingsStatus.textContent = message;
    settingsStatus.className = "form-message";

    if (type) {
      settingsStatus.classList.add(`is-${type}`);
    }
  }

  function setLoading(loading) {
    const button = settingsForm?.querySelector('button[type="submit"]');
    if (!button) return;

    if (!button.dataset.defaultText) {
      button.dataset.defaultText = button.textContent;
    }

    button.disabled = loading;
    button.textContent = loading ? "Salvando..." : button.dataset.defaultText;
  }

  function getField(id) {
    return document.getElementById(id);
  }

  function renderSettings(settings) {
    const defaultReportPeriod = getField("defaultReportPeriod");
    const emailNotifications = getField("emailNotifications");
    const saveUploadedImages = getField("saveUploadedImages");
    const compactDashboard = getField("compactDashboard");

    if (defaultReportPeriod) {
      defaultReportPeriod.value = settings.default_report_period || "7";
    }

    if (emailNotifications) {
      emailNotifications.checked = Boolean(settings.email_notifications);
    }

    if (saveUploadedImages) {
      saveUploadedImages.checked = settings.save_uploaded_images !== false;
    }

    if (compactDashboard) {
      compactDashboard.checked = Boolean(settings.compact_dashboard);
    }
  }

  function readSettings() {
    return {
      default_report_period: getField("defaultReportPeriod")?.value || "7",
      email_notifications: Boolean(getField("emailNotifications")?.checked),
      save_uploaded_images: Boolean(getField("saveUploadedImages")?.checked),
      compact_dashboard: Boolean(getField("compactDashboard")?.checked),
    };
  }

  async function loadSettings() {
    try {
      const data = await window.LabLeafApi.request("/api/settings");
      renderSettings(data.settings);
    } catch (error) {
      setMessage(error.message, "error");
    }
  }

  async function saveSettings(event) {
    event.preventDefault();

    setLoading(true);
    setMessage("");

    try {
      const data = await window.LabLeafApi.request("/api/settings", {
        method: "PUT",
        body: JSON.stringify(readSettings()),
      });

      renderSettings(data.settings);
      localStorage.setItem(
        "defaultReportPeriod",
        data.settings.default_report_period || "7"
      );
      setMessage("Configurações salvas com sucesso.", "success");
    } catch (error) {
      setMessage(error.message, "error");
    } finally {
      setLoading(false);
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    loadSettings();
    settingsForm?.addEventListener("submit", saveSettings);
  });
})();
