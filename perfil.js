(function () {
  const profileForm = document.getElementById("profileForm");
  const passwordForm = document.getElementById("passwordForm");
  const profileStatus = document.getElementById("profileStatus");
  const passwordStatus = document.getElementById("passwordStatus");

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
    button.textContent = loading ? "Salvando..." : button.dataset.defaultText;
  }

  function formatDate(value) {
    if (!value) return "--";

    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(value));
  }

  function renderUser(user) {
    const nomeInput = document.getElementById("nome");
    const emailInput = document.getElementById("email");
    const summaryName = document.getElementById("summaryName");
    const summaryEmail = document.getElementById("summaryEmail");
    const summaryCreated = document.getElementById("summaryCreated");
    const profileInitial = document.getElementById("profileInitial");

    if (nomeInput) nomeInput.value = user.nome || "";
    if (emailInput) emailInput.value = user.email || "";
    if (summaryName) summaryName.textContent = user.nome || "Usuário LabLeaf";
    if (summaryEmail) summaryEmail.textContent = user.email || "";
    if (summaryCreated) summaryCreated.textContent = formatDate(user.created_at);
    if (profileInitial) {
      profileInitial.textContent = String(user.nome || "L").trim().charAt(0).toUpperCase();
    }

    localStorage.setItem("usuarioNome", user.nome || "");
    localStorage.setItem("usuarioEmail", user.email || "");
  }

  function renderSubscription(subscription) {
    const summaryPlan = document.getElementById("summaryPlan");
    const summaryTokens = document.getElementById("summaryTokens");
    const summaryRenewal = document.getElementById("summaryRenewal");

    if (!subscription?.active) {
      if (summaryPlan) summaryPlan.textContent = "Nenhum plano ativo";
      if (summaryTokens) summaryTokens.textContent = "0";
      if (summaryRenewal) summaryRenewal.textContent = "Escolha um plano";
      return;
    }

    const planName = subscription.plan?.name || "Plano ativo";

    if (summaryPlan) summaryPlan.textContent = planName;
    if (summaryTokens) {
      summaryTokens.textContent = `${subscription.tokens_remaining} de ${subscription.tokens_total}`;
    }
    if (summaryRenewal) {
      summaryRenewal.textContent = formatDate(subscription.expires_at);
    }
  }

  async function loadProfile() {
    try {
      const [profileData, subscriptionData] = await Promise.all([
        window.LabLeafApi.request("/api/me"),
        window.LabLeafApi.request("/api/subscription"),
      ]);
      renderUser(profileData.user);
      renderSubscription(subscriptionData.subscription);
    } catch (error) {
      setMessage(profileStatus, error.message, "error");
    }
  }

  async function saveProfile(event) {
    event.preventDefault();

    const nome = document.getElementById("nome")?.value.trim();
    const email = document.getElementById("email")?.value.trim().toLowerCase();

    if (!nome || !email) {
      setMessage(profileStatus, "Preencha nome e e-mail.", "error");
      return;
    }

    setLoading(profileForm, true);
    setMessage(profileStatus, "");

    try {
      const data = await window.LabLeafApi.request("/api/profile", {
        method: "PUT",
        body: JSON.stringify({ nome, email }),
      });

      renderUser(data.user);
      setMessage(profileStatus, "Perfil atualizado com sucesso.", "success");
    } catch (error) {
      setMessage(profileStatus, error.message, "error");
    } finally {
      setLoading(profileForm, false);
    }
  }

  async function changePassword(event) {
    event.preventDefault();

    const senhaAtual = document.getElementById("senhaAtual")?.value || "";
    const novaSenha = document.getElementById("novaSenha")?.value || "";
    const confirmarNovaSenha =
      document.getElementById("confirmarNovaSenha")?.value || "";

    if (novaSenha.length < 8) {
      setMessage(passwordStatus, "A nova senha deve ter no mínimo 8 caracteres.", "error");
      return;
    }

    if (novaSenha !== confirmarNovaSenha) {
      setMessage(passwordStatus, "As senhas não coincidem.", "error");
      return;
    }

    setLoading(passwordForm, true);
    setMessage(passwordStatus, "");

    try {
      const data = await window.LabLeafApi.request("/api/profile/password", {
        method: "PUT",
        body: JSON.stringify({
          senha_atual: senhaAtual,
          nova_senha: novaSenha,
          confirmar_senha: confirmarNovaSenha,
        }),
      });

      setMessage(passwordStatus, data.message, "success");
      window.LabLeafApi.clearSession();
      setTimeout(() => {
        window.location.href = "login.html";
      }, 1200);
    } catch (error) {
      setMessage(passwordStatus, error.message, "error");
    } finally {
      setLoading(passwordForm, false);
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    loadProfile();
    profileForm?.addEventListener("submit", saveProfile);
    passwordForm?.addEventListener("submit", changePassword);
  });
})();
