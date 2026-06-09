(function () {
  const subscriptionStatus = document.getElementById("subscriptionStatus");
  const checkoutModal = document.getElementById("checkoutModal");
  const closeCheckout = document.getElementById("closeCheckout");
  const checkoutForm = document.getElementById("checkoutForm");
  const checkoutStatus = document.getElementById("checkoutStatus");
  const checkoutPlanId = document.getElementById("checkoutPlanId");
  const checkoutPlanTag = document.getElementById("checkoutPlanTag");
  const checkoutPlanName = document.getElementById("checkoutPlanName");
  const checkoutPlanDetails = document.getElementById("checkoutPlanDetails");

  const fallbackPlans = {
    essencial: {
      id: "essencial",
      name: "Essencial",
      tag: "Inicial",
      price_label: "R$ 49",
      billing_label: "/mês",
      tokens: 30,
    },
    pro: {
      id: "pro",
      name: "Pro",
      tag: "Profissional",
      price_label: "R$ 99",
      billing_label: "/mês",
      tokens: 120,
    },
    avancado: {
      id: "avancado",
      name: "Avançado",
      tag: "Institucional",
      price_label: "R$ 199",
      billing_label: "/mês",
      tokens: 500,
    },
  };

  let plans = { ...fallbackPlans };
  let currentSubscription = null;

  function formatDate(value) {
    if (!value) return "--";

    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
    }).format(new Date(value));
  }

  function setCheckoutMessage(message, type = "") {
    if (!checkoutStatus) return;

    checkoutStatus.textContent = message;
    checkoutStatus.className = "checkout-status";

    if (type) {
      checkoutStatus.classList.add(`is-${type}`);
    }
  }

  function setLoading(loading) {
    const button = checkoutForm?.querySelector('button[type="submit"]');
    if (!button) return;

    if (!button.dataset.defaultText) {
      button.dataset.defaultText = button.textContent;
    }

    button.disabled = loading;
    button.textContent = loading ? "Processando..." : button.dataset.defaultText;
  }

  function renderSubscription(subscription) {
    currentSubscription = subscription;

    document.querySelectorAll("[data-plan-card]").forEach((card) => {
      const isCurrent = Boolean(
        subscription?.active && card.dataset.planCard === subscription.plan_id
      );
      const button = card.querySelector(".plan-select");

      card.classList.toggle("is-current", isCurrent);

      if (button) {
        button.textContent = isCurrent ? "Renovar plano" : "Escolher plano";
      }
    });

    if (!subscriptionStatus) return;

    if (!subscription?.active) {
      subscriptionStatus.innerHTML = `
        <div>
          <span>Plano atual</span>
          <strong>Nenhum plano ativo</strong>
        </div>
        <p>Escolha um plano para liberar tokens de análise.</p>
      `;
      return;
    }

    const plan = subscription.plan || plans[subscription.plan_id] || {};
    subscriptionStatus.innerHTML = `
      <div>
        <span>Plano atual</span>
        <strong>${plan.name || "Plano ativo"}</strong>
      </div>
      <p>
        ${subscription.tokens_remaining} de ${subscription.tokens_total} tokens disponíveis.
        Renova em ${formatDate(subscription.expires_at)}.
      </p>
    `;
  }

  function openCheckout(planId) {
    const plan = plans[planId];
    if (!plan || !checkoutModal) {
      alert("Não foi possível abrir este plano. Recarregue a página e tente novamente.");
      return;
    }

    checkoutPlanId.value = plan.id;
    checkoutPlanTag.textContent = plan.tag || "Plano";
    checkoutPlanName.textContent = `${plan.name} - ${plan.price_label}${plan.billing_label}`;
    checkoutPlanDetails.textContent = `${plan.tokens} tokens por ciclo. Pagamento fictício para ativar o plano agora.`;
    setCheckoutMessage("");
    checkoutForm.reset();
    checkoutPlanId.value = plan.id;
    document.getElementById("cardName").value =
      localStorage.getItem("usuarioNome") || "Cliente LabLeaf";
    document.getElementById("cardNumber").value = "4242 4242 4242 4242";
    document.getElementById("cardExpiry").value = "12/30";
    document.getElementById("cardCvv").value = "123";
    checkoutModal.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function closeModal() {
    if (!checkoutModal) return;

    checkoutModal.hidden = true;
    document.body.style.overflow = "";
  }

  async function loadPlansAndSubscription() {
    try {
      const [plansData, subscriptionData] = await Promise.all([
        window.LabLeafApi.request("/api/plans"),
        window.LabLeafApi.request("/api/subscription"),
      ]);

      plans = {
        ...fallbackPlans,
        ...Object.fromEntries((plansData.items || []).map((plan) => [plan.id, plan])),
      };
      renderSubscription(subscriptionData.subscription);
    } catch (error) {
      if (subscriptionStatus) {
        subscriptionStatus.innerHTML = `
          <div>
            <span>Plano atual</span>
            <strong>Não foi possível carregar</strong>
          </div>
          <p>${error.message}</p>
        `;
      }
    }
  }

  async function submitCheckout(event) {
    event.preventDefault();

    const payload = {
      plan_id: checkoutPlanId.value,
      card_name: document.getElementById("cardName")?.value.trim() || "",
      card_number: document.getElementById("cardNumber")?.value.trim() || "",
      card_expiry: document.getElementById("cardExpiry")?.value.trim() || "",
      card_cvv: document.getElementById("cardCvv")?.value.trim() || "",
    };

    setLoading(true);
    setCheckoutMessage("");

    try {
      const data = await window.LabLeafApi.request("/api/subscription/checkout", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      renderSubscription(data.subscription);
      setCheckoutMessage(data.message, "success");

      setTimeout(() => {
        closeModal();
      }, 900);
    } catch (error) {
      setCheckoutMessage(error.message, "error");
    } finally {
      setLoading(false);
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    loadPlansAndSubscription();

    document.addEventListener("click", (event) => {
      const button = event.target.closest(".plan-select");

      if (!button) return;

      event.preventDefault();
      openCheckout(button.dataset.planId);
    });

    closeCheckout?.addEventListener("click", closeModal);
    checkoutForm?.addEventListener("submit", submitCheckout);

    checkoutModal?.addEventListener("click", (event) => {
      if (event.target === checkoutModal) {
        closeModal();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && checkoutModal && !checkoutModal.hidden) {
        closeModal();
      }
    });
  });
})();
