(function () {
  const requestForm = document.getElementById("requestResetForm");
  const resetForm = document.getElementById("resetPasswordForm");
  const requestStatus = document.getElementById("requestStatus");
  const resetStatus = document.getElementById("resetStatus");
  const devResetLink = document.getElementById("devResetLink");
  const subtitle = document.getElementById("recoverSubtitle");
  const tokenInput = document.getElementById("token");

  function setMessage(element, message, type = "") {
    if (!element) return;

    element.textContent = message;
    element.className = "form-message";

    if (type) {
      element.classList.add(`is-${type}`);
    }
  }

  function setLoading(form, loading) {
    const button = form?.querySelector('button[type="submit"]');
    if (!button) return;

    if (!button.dataset.defaultText) {
      button.dataset.defaultText = button.textContent;
    }

    button.disabled = loading;
    button.textContent = loading ? "Aguarde..." : button.dataset.defaultText;
  }

  function showResetForm(token) {
    if (!token) return;

    tokenInput.value = token;
    requestForm.hidden = true;
    resetForm.hidden = false;

    if (subtitle) {
      subtitle.textContent = "Digite uma nova senha para concluir a redefinição.";
    }
  }

  async function requestReset(event) {
    event.preventDefault();

    const email = document.getElementById("email")?.value.trim().toLowerCase();

    if (!email) {
      setMessage(requestStatus, "Informe seu e-mail.", "error");
      return;
    }

    setLoading(requestForm, true);
    setMessage(requestStatus, "");

    try {
      const data = await window.LabLeafApi.request("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      });

      setMessage(requestStatus, data.message, "success");

      if (data.reset_url && devResetLink) {
        const url = new URL(data.reset_url, window.location.href);
        devResetLink.hidden = false;
        devResetLink.innerHTML = `
          <strong>Ambiente de desenvolvimento</strong>
          <span>Enquanto o envio de e-mail não estiver configurado, use este link:</span>
          <a href="${url.href}">${url.href}</a>
        `;
      }
    } catch (error) {
      setMessage(requestStatus, error.message, "error");
    } finally {
      setLoading(requestForm, false);
    }
  }

  async function resetPassword(event) {
    event.preventDefault();

    const token = tokenInput.value;
    const senha = document.getElementById("senha")?.value || "";
    const confirmarSenha = document.getElementById("confirmarSenha")?.value || "";

    if (senha.length < 8) {
      setMessage(resetStatus, "A senha deve ter no mínimo 8 caracteres.", "error");
      return;
    }

    if (senha !== confirmarSenha) {
      setMessage(resetStatus, "As senhas não coincidem.", "error");
      return;
    }

    setLoading(resetForm, true);
    setMessage(resetStatus, "");

    try {
      const data = await window.LabLeafApi.request("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({
          token,
          senha,
          confirmar_senha: confirmarSenha,
        }),
      });

      setMessage(resetStatus, data.message, "success");
      setTimeout(() => {
        window.location.href = "login.html";
      }, 1200);
    } catch (error) {
      setMessage(resetStatus, error.message, "error");
    } finally {
      setLoading(resetForm, false);
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    const params = new URLSearchParams(window.location.search);
    showResetForm(params.get("token"));

    requestForm?.addEventListener("submit", requestReset);
    resetForm?.addEventListener("submit", resetPassword);
  });
})();
