(function () {
  function obterElemento(id) {
    return document.getElementById(id);
  }

  function apiBase() {
    return String(window.LABLEAF_API_BASE || "").replace(/\/$/, "");
  }

  function isGitHubPagesWithoutApi() {
    return window.location.hostname.endsWith(".github.io") && !apiBase();
  }

  function getToken() {
    return localStorage.getItem("authToken") || "";
  }

  function setSession(data) {
    localStorage.setItem("authToken", data.token);
    localStorage.setItem("usuarioNome", data.user?.nome || "");
    localStorage.setItem("usuarioEmail", data.user?.email || "");
    localStorage.setItem("logado", "true");
  }

  function clearSession() {
    localStorage.removeItem("authToken");
    localStorage.removeItem("usuarioNome");
    localStorage.removeItem("usuarioEmail");
    localStorage.removeItem("usuarioSenha");
    localStorage.removeItem("logado");
  }

  async function request(path, options = {}) {
    if (path.startsWith("/api/") && isGitHubPagesWithoutApi()) {
      throw new Error(
        "O GitHub Pages abriu a tela, mas a API do LabLeaf ainda não está hospedada. Configure LABLEAF_API_BASE com a URL do backend."
      );
    }

    const headers = new Headers(options.headers || {});
    const token = getToken();
    const body = options.body;

    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    if (body && !(body instanceof FormData) && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    const response = await fetch(`${apiBase()}${path}`, {
      ...options,
      headers,
    });

    const text = await response.text();
    let data = {};

    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { detail: text };
      }
    }

    if (!response.ok) {
      if (response.status === 401) {
        clearSession();
      }

      const rawMessage = data.detail || data.message || "";
      const message = String(rawMessage).trim().startsWith("<")
        ? `Erro HTTP ${response.status}. Verifique se a URL do backend está configurada.`
        : rawMessage || `Erro HTTP ${response.status}`;

      throw new Error(message);
    }

    return data;
  }

  function mostrarErroSenha(mensagem = "") {
    const erroSenha = obterElemento("erroSenha");

    if (erroSenha) {
      erroSenha.textContent = mensagem;
    }
  }

  function toggleSubmit(form, loading) {
    const button = form?.querySelector('button[type="submit"]');

    if (!button) return;

    if (!button.dataset.defaultText) {
      button.dataset.defaultText = button.textContent;
    }

    button.disabled = loading;
    button.textContent = loading ? "Aguarde..." : button.dataset.defaultText;
  }

  async function cadastrar(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const nome = obterElemento("nome")?.value.trim();
    const email = obterElemento("email")?.value.trim().toLowerCase();
    const senha = obterElemento("senha")?.value || "";
    const confirmarSenha = obterElemento("confirmarSenha")?.value || "";

    mostrarErroSenha();

    if (!nome || !email || !senha || !confirmarSenha) {
      alert("Preencha todos os campos.");
      return;
    }

    if (senha.length < 8) {
      mostrarErroSenha("A senha deve ter no minimo 8 caracteres.");
      return;
    }

    if (senha !== confirmarSenha) {
      mostrarErroSenha("As senhas nao coincidem.");
      return;
    }

    toggleSubmit(form, true);

    try {
      const data = await request("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ nome, email, senha }),
      });

      setSession(data);
      window.location.href = "index.html";
    } catch (error) {
      mostrarErroSenha(error.message);
    } finally {
      toggleSubmit(form, false);
    }
  }

  async function entrar(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const email = obterElemento("email")?.value.trim().toLowerCase();
    const senha = obterElemento("senha")?.value || "";

    if (!email || !senha) {
      alert("Preencha e-mail e senha.");
      return;
    }

    toggleSubmit(form, true);

    try {
      const data = await request("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, senha }),
      });

      setSession(data);
      window.location.href = "index.html";
    } catch (error) {
      alert(error.message);
    } finally {
      toggleSubmit(form, false);
    }
  }

  async function sair() {
    try {
      await request("/api/auth/logout", { method: "POST" });
    } catch {
      // A sessao local deve ser limpa mesmo se a API estiver indisponivel.
    }

    clearSession();
    window.location.href = "login.html";
  }

  function configurarMenu() {
    const menuButton = obterElemento("menuButton");
    const dropdownMenu = obterElemento("dropdownMenu");

    if (!menuButton || !dropdownMenu) return;

    menuButton.addEventListener("click", function (event) {
      event.stopPropagation();
      dropdownMenu.classList.toggle("show");
      menuButton.setAttribute(
        "aria-expanded",
        String(dropdownMenu.classList.contains("show"))
      );
    });

    document.addEventListener("click", function () {
      dropdownMenu.classList.remove("show");
      menuButton.setAttribute("aria-expanded", "false");
    });

    dropdownMenu.addEventListener("click", function (event) {
      event.stopPropagation();
    });
  }

  function exigirAutenticacao() {
    const protectedPage = document.body?.dataset.authRequired === "true";

    if (protectedPage && !getToken()) {
      clearSession();
      window.location.href = "login.html";
    }
  }

  window.LabLeafApi = {
    baseUrl: apiBase(),
    getToken,
    request,
    clearSession,
  };

  window.cadastrar = cadastrar;
  window.entrar = entrar;
  window.sair = sair;

  document.addEventListener("DOMContentLoaded", () => {
    exigirAutenticacao();
    configurarMenu();

    const logoutBtn = obterElemento("logoutBtn");

    if (logoutBtn) {
      logoutBtn.addEventListener("click", (event) => {
        event.preventDefault();
        sair();
      });
    }
  });
})();
