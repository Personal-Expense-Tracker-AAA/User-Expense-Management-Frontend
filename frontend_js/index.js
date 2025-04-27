document.addEventListener("DOMContentLoaded", () => {
  const API_URL = "http://localhost:5000";
  const mainContent = document.getElementById("mainContent");
  const authButtons = document.getElementById("authButtons");
  const expenseList = document.getElementById("expenseList");
  const totalDisplay = document.getElementById("totalDisplay");
  let currentUser = null;
  let categoryChart = null;
  let isLoading = false;
  let dataLoaded = false;
  let isSubmitting = false;

  // ------------------ AUTH HANDLERS ------------------
  async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById("loginEmail").value;
    const password = document.getElementById("loginPassword").value;

    // Clear previous error states
    document.getElementById("loginEmail").classList.remove("is-invalid");
    document.getElementById("loginPassword").classList.remove("is-invalid");
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      if (!response.ok) {
        // Highlight the problematic field based on error type
        if (data.message && data.message.includes("password")) {
          document.getElementById("loginPassword").classList.add("is-invalid");
        } else if (
          (data.message && data.message.includes("email")) ||
          (data.message && data.message.includes("account"))
        ) {
          document.getElementById("loginEmail").classList.add("is-invalid");
        }

        showMessage(
          data.message || data.error || "Invalid email or password",
          "danger"
        );
        return;
      }

      // Login successful
      localStorage.setItem("token", data.token);
      setTimeout(checkAuthState, 0);
      showMessage("Login successful!", "success");
      document.getElementById("loginForm").reset();

      const modal = bootstrap.Modal.getInstance(
        document.getElementById("loginModal")
      );
      if (modal) modal.hide();

      const mainContent = document.getElementById("chartCanvas");
      if (mainContent) mainContent.focus();
    } catch (error) {
      showMessage("Network error - please try again later", "danger");
    }
  }

  async function handleSignup(e) {
    e.preventDefault();
    const email = document.getElementById("signupEmail").value;
    const password = document.getElementById("signupPassword").value;

    // Clear previous errors
    document.getElementById("signupEmail").classList.remove("is-invalid");

    try {
      const response = await fetch(`${API_URL}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      if (!response.ok) {
        // Highlight email field if email exists
        if (data.error && data.error.includes("Email")) {
          document.getElementById("signupEmail").classList.add("is-invalid");
        }
        showMessage(data.error || "Signup failed", "danger");
        return;
      }

      // Success handling
      localStorage.setItem("token", data.token);
      checkAuthState();
      showMessage("Signup successful!", "success");
      document.getElementById("signupForm").reset();
      bootstrap.Modal.getInstance(
        document.getElementById("signupModal")
      ).hide();
    } catch (error) {
      showMessage("Network error - please try again later", "danger");
    }
  }

  // ------------------ AUTH STATE MGMT ------------------

  // Update your checkAuthState function
  function checkAuthState() {
    const token = localStorage.getItem("token");
    const heroSection = document.getElementById("heroSection");

    if (!token) {
      dataLoaded = false;
      updateUIForUnauthenticated();
      document.body.classList.remove("authenticated");
      if (heroSection) heroSection.style.display = "flex";
      return;
    }

    try {
      const [header, payloadPart, signature] = token.split(".");
      if (!header || !payloadPart || !signature) {
        throw new Error("Invalid token format");
      }
      const payload = JSON.parse(atob(payloadPart));
      if (payload.exp * 1000 < Date.now()) {
        throw new Error("Token expired");
      }
      currentUser = payload;
      updateUIForAuthenticated();
      document.body.classList.add("authenticated");
      if (heroSection) heroSection.style.display = "none";

      if (!dataLoaded) {
        dataLoaded = true;
        loadData();
      }
    } catch (error) {
      console.error("Auth error:", error);
      showMessage(`Session expired: ${error.message}`, "warning");
      localStorage.removeItem("token");
      updateUIForUnauthenticated();
      document.body.classList.remove("authenticated");
      if (heroSection) heroSection.style.display = "flex";
    }
  }

  // Add password strength indicator
  document
    .getElementById("signupPassword")
    ?.addEventListener("input", function () {
      const password = this.value;
      const strengthBar = document.querySelector(
        ".password-strength .progress-bar"
      );
      const strengthText = document.getElementById("strengthText");

      let strength = 0;

      // Length check
      if (password.length > 7) strength += 25;
      if (password.length > 11) strength += 25;

      // Complexity checks
      if (/[A-Z]/.test(password)) strength += 15;
      if (/[0-9]/.test(password)) strength += 15;
      if (/[^A-Za-z0-9]/.test(password)) strength += 20;

      strength = Math.min(strength, 100);
      strengthBar.style.width = strength + "%";

      // Update text and color
      if (strength < 40) {
        strengthBar.className = "progress-bar bg-danger";
        strengthText.textContent = "Weak";
      } else if (strength < 70) {
        strengthBar.className = "progress-bar bg-warning";
        strengthText.textContent = "Moderate";
      } else {
        strengthBar.className = "progress-bar bg-success";
        strengthText.textContent = "Strong";
      }
    });

  function updateUIForAuthenticated() {
    mainContent.classList.remove("d-none");
    document.getElementById("userEmailDisplay").textContent = currentUser.email;

    authButtons.innerHTML = `
        <button class="btn btn-sm btn-outline-danger" id="logoutBtn">
          <i class="fas fa-sign-out-alt me-1"></i>Logout
        </button>
      `;

    document.getElementById("logoutBtn").addEventListener("click", () => {
      localStorage.removeItem("token");
      currentUser = null;
      dataLoaded = false;
      checkAuthState();
      showMessage("Logged out successfully", "success");
    });
  }

  function updateUIForUnauthenticated() {
    mainContent.classList.add("d-none");
    authButtons.innerHTML = `
      <button class="btn btn-outline-primary me-2" 
              data-bs-toggle="modal" 
              data-bs-target="#loginModal">Login</button>
      <button class="btn btn-primary" 
              data-bs-toggle="modal" 
              data-bs-target="#signupModal">Sign Up</button>
    `;
  }

  // ------------------ FETCH FUNCTIONS ------------------
  async function fetchExpenses(filters = {}) {
    const token = localStorage.getItem("token");
    try {
      // Build query string if filters are provided
      const query = new URLSearchParams();
      if (filters.category) query.append("category", filters.category);
      if (filters.startDate) query.append("startDate", filters.startDate);
      if (filters.endDate) query.append("endDate", filters.endDate);

      const endpoint = query.toString() ? "/expenses/filter" : "/expenses";
      const url = `${API_URL}${endpoint}?${query.toString()}`;

      const res = await fetch(url, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to fetch expenses");
      }

      return data; // Return data for potential use elsewhere
    } catch (error) {
      showMessage("Network error - please check connection", "danger");
      console.error("Fetch error:", error);
      throw error; // Keep this to propagate error for loadData's Promise.all
    }
  }
  //-------rendering function for expenses---
  function renderExpenses(expenses) {
    const expenseList = document.getElementById("expenseList");
    expenseList.innerHTML = expenses
      .map(
        (expense) => `
       <tr>
          <td>${expense.description}</td>
          <td>€${Number(expense.amount).toFixed(2)}</td>
          <td>${expense.category}</td>
          <td>
            <button class="btn btn-sm btn-warning me-2 edit-btn" data-id="${
              expense.id
            }">Edit</button>
            <button class="btn btn-sm btn-danger delete-btn" data-id="${
              expense.id
            }">Delete</button>
          </td>
        </tr>
        `
      )
      .join("");

    // Reattach event listeners
    document.querySelectorAll(".delete-btn").forEach((btn) => {
      btn.addEventListener("click", () => handleDeleteExpense(btn.dataset.id));
    });

    document.querySelectorAll(".edit-btn").forEach((btn) => {
      btn.addEventListener("click", () =>
        handleEditExpense(btn.dataset.id, expenses)
      );
    });
  }
  // ------------------ FILTERING FUNCTIONS -------
  function fetchFilteredExpenses() {
    const category = document.getElementById("filter-category").value;
    const startDate = document.getElementById("filter-start-date").value;
    const endDate = document.getElementById("filter-end-date").value;

    // Validate dates if both are provided
    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      showMessage("End date cannot be before start date", "danger");
      return;
    }
    // Fetch filtered expenses
    fetchExpenses({
      category: category || undefined,
      startDate,
      endDate,
    })
      .then((data) => {
        renderExpenses(data); // <-- render the filtered data
        showMessage(`Showing ${data.length} expenses`, "success");
      })
      .catch((err) => {
        console.error("Filtering failed:", err);
        showMessage("Failed to apply filters", "danger");
      });
  }
  // ------------------ DELETE & EDIT FUNCTIONS ------------------
  function showConfirmBootstrap(expenseId) {
    return new Promise((resolve) => {
      const deleteModal = new bootstrap.Modal(
        document.getElementById("deleteModal")
      );
      const confirmBtn = document.getElementById("confirmDeleteBtn");
      const cancelBtns = document.querySelectorAll('[data-bs-dismiss="modal"]');

      // Store expenseId in hidden input
      document.getElementById("delete-expense-id").value = expenseId;

      const onConfirm = () => {
        confirmBtn.removeEventListener("click", onConfirm);
        resolve(true);
      };

      // If user cancels
      cancelBtns.forEach((btn) => {
        btn.addEventListener("click", () => resolve(false), { once: true });
      });

      confirmBtn.addEventListener("click", onConfirm, { once: true });

      deleteModal.show();
    });
  }

  function showConfirmBootstrap(expenseId) {
    return new Promise((resolve) => {
      // Get the modal instance
      const deleteModal = new bootstrap.Modal(
        document.getElementById("deleteModal")
      );

      // Set the expense ID in the hidden field
      document.getElementById("delete-expense-id").value = expenseId;

      // Create temporary click handler for confirm button
      const handleConfirm = () => {
        // Clean up event listeners
        confirmBtn.removeEventListener("click", handleConfirm);
        deleteModal._element.removeEventListener(
          "hidden.bs.modal",
          handleCancel
        );

        // Hide the modal
        deleteModal.hide();

        // Resolve the promise with true (confirmed)
        resolve(true);
      };

      // Create cancel handler
      const handleCancel = () => {
        // Clean up event listeners
        confirmBtn.removeEventListener("click", handleConfirm);
        deleteModal._element.removeEventListener(
          "hidden.bs.modal",
          handleCancel
        );

        // Resolve the promise with false (cancelled)
        resolve(false);
      };

      // Get the confirm button
      const confirmBtn = document.getElementById("confirmDeleteBtn");

      // Add event listeners
      confirmBtn.addEventListener("click", handleConfirm);
      deleteModal._element.addEventListener("hidden.bs.modal", handleCancel);

      // Show the modal
      deleteModal.show();
    });
  }

  async function handleDeleteExpense(expenseId) {
    try {
      const confirm = await showConfirmBootstrap(expenseId);
      if (!confirm) return;

      const token = localStorage.getItem("token");

      const res = await fetch(`${API_URL}/expenses/${expenseId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");

      // Close the modal before showing success message
      const deleteModal = bootstrap.Modal.getInstance(
        document.getElementById("deleteModal")
      );
      if (deleteModal) {
        deleteModal.hide();
      }
      showMessage("Expense deleted", "success");
      const [updatedExpenses] = await Promise.all([
        fetchExpenses(),
        fetchCategorySummary(),
        fetchTotalExpenses(),
      ]);
      renderExpenses(updatedExpenses);
    } catch (error) {
      showMessage("Delete failed", "danger");
      console.error("Delete error:", error);
    }
  }

  function handleEditExpense(id, data) {
    const expense = data.find((e) => e.id == id);
    if (!expense) return;

    document.getElementById("edit-expense-id").value = id;
    document.getElementById("edit-description").value = expense.description;
    document.getElementById("edit-amount").value = expense.amount;
    document.getElementById("edit-category").value = expense.category;

    // Show modal (using Bootstrap)
    const modal = new bootstrap.Modal(
      document.getElementById("editExpenseModal")
    );
    modal.show();
  }

  document
    .getElementById("editExpenseForm")
    .addEventListener("submit", async (e) => {
      e.preventDefault();
      const id = document.getElementById("edit-expense-id").value;
      const description = document.getElementById("edit-description").value;
      const amount = parseFloat(document.getElementById("edit-amount").value);
      const category = document.getElementById("edit-category").value;

      const token = localStorage.getItem("token");

      try {
        const res = await fetch(`${API_URL}/expenses/${id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ description, amount, category }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Edit failed");

        showMessage("Expense updated", "success");
        bootstrap.Modal.getInstance(
          document.getElementById("editExpenseModal")
        ).hide();
        const [updatedExpenses] = await Promise.all([
          fetchExpenses(),
          fetchCategorySummary(),
          fetchTotalExpenses(),
        ]);
        renderExpenses(updatedExpenses);
      } catch (error) {
        showMessage("Edit failed", "danger");
        console.error("Edit error:", error);
      }
    });
  // ------------------ CATEGORY SUMMARY ------------------
  async function fetchCategorySummary() {
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`${API_URL}/expenses/category-summary`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to fetch category summary");
      }

      console.log("Category summary:", data);

      // Extract labels and values
      const labels = data.map((item) => item.category);
      const values = data.map((item) => parseFloat(item.total));
      const total = values.reduce((sum, value) => sum + value, 0);

      // Generate a more sophisticated color palette
      const generateColors = (count) => {
        const colors = [];
        const hueStep = 360 / count;
        for (let i = 0; i < count; i++) {
          const hue = i * hueStep;
          colors.push(`hsl(${hue}, 70%, 60%)`);
        }
        return colors;
      };

      const chartColors = generateColors(labels.length);
      const borderColor = window.matchMedia("(prefers-color-scheme: dark)")
        .matches
        ? "#2c2c2c"
        : "#ffffff";

      // Destroy old charts if they exist
      if (window.pieChart) window.pieChart.destroy();
      if (window.doughnutChart) window.doughnutChart.destroy();
      if (window.barChart) window.barChart.destroy();
      if (window.polarAreaChart) window.polarAreaChart.destroy();

      // 1. Enhanced Pie Chart
      const pieCtx = document.getElementById("pieChartCanvas").getContext("2d");
      window.pieChart = new Chart(pieCtx, {
        type: "pie",
        data: {
          labels,
          datasets: [
            {
              data: values,
              backgroundColor: chartColors,
              borderColor: borderColor,
              borderWidth: 2,
              hoverOffset: 15,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: "right",
              labels: {
                color: "#333",
                font: {
                  size: 12,
                  weight: "bold",
                },
                padding: 20,
              },
            },
            tooltip: {
              callbacks: {
                label: function (context) {
                  const percentage = ((context.raw / total) * 100).toFixed(1);
                  return `${context.label}: €${context.raw.toFixed(
                    2
                  )} (${percentage}%)`;
                },
              },
            },
            title: {
              display: true,
              text: "Expense Distribution",
              font: {
                size: 16,
                weight: "bold",
              },
            },
          },
          animation: {
            animateScale: true,
            animateRotate: true,
          },
        },
      });

      // 2. Doughnut Chart
      const doughnutCtx = document
        .getElementById("doughnutChartCanvas")
        .getContext("2d");
      window.doughnutChart = new Chart(doughnutCtx, {
        type: "doughnut",
        data: {
          labels,
          datasets: [
            {
              data: values,
              backgroundColor: chartColors,
              borderColor: borderColor,
              borderWidth: 2,
              hoverOffset: 15,
              cutout: "65%",
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: "right",
              labels: {
                color: "#333",
                font: {
                  size: 12,
                  weight: "bold",
                },
                padding: 20,
              },
            },
            tooltip: {
              callbacks: {
                label: function (context) {
                  const percentage = ((context.raw / total) * 100).toFixed(1);
                  return `${context.label}: €${context.raw.toFixed(
                    2
                  )} (${percentage}%)`;
                },
              },
            },
            title: {
              display: true,
              text: "Expense Breakdown",
              font: {
                size: 16,
                weight: "bold",
              },
            },
          },
          animation: {
            animateScale: true,
            animateRotate: true,
          },
        },
      });

      // 3. Bar Chart
      const barCtx = document.getElementById("barChartCanvas").getContext("2d");
      window.barChart = new Chart(barCtx, {
        type: "bar",
        data: {
          labels,
          datasets: [
            {
              label: "Expenses (€)",
              data: values,
              backgroundColor: chartColors.map((color) =>
                color.replace("60%)", "70%)")
              ),
              borderColor: borderColor,
              borderWidth: 1,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                callback: function (value) {
                  return "€" + value;
                },
              },
            },
          },
          plugins: {
            legend: {
              display: false,
            },
            tooltip: {
              callbacks: {
                label: function (context) {
                  return `€${context.raw.toFixed(2)}`;
                },
              },
            },
            title: {
              display: true,
              text: "Expense by Category",
              font: {
                size: 16,
                weight: "bold",
              },
            },
          },
        },
      });

      // 4. Polar Area Chart
      const polarCtx = document
        .getElementById("polarAreaChartCanvas")
        .getContext("2d");
      window.polarAreaChart = new Chart(polarCtx, {
        type: "polarArea",
        data: {
          labels,
          datasets: [
            {
              data: values,
              backgroundColor: chartColors.map((color) =>
                color.replace("60%)", "80%)")
              ),
              borderColor: borderColor,
              borderWidth: 1,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: "right",
              labels: {
                color: "#333",
                font: {
                  size: 12,
                  weight: "bold",
                },
                padding: 20,
              },
            },
            tooltip: {
              callbacks: {
                label: function (context) {
                  const percentage = ((context.raw / total) * 100).toFixed(1);
                  return `${context.label}: €${context.raw.toFixed(
                    2
                  )} (${percentage}%)`;
                },
              },
            },
            title: {
              display: true,
              text: "Category Comparison",
              font: {
                size: 16,
                weight: "bold",
              },
            },
          },
          scales: {
            r: {
              ticks: {
                display: false,
              },
            },
          },
          animation: {
            animateRotate: true,
            animateScale: true,
          },
        },
      });

      // Update the category summary table with percentages
      const categorySummaryTable = document.getElementById("category-summary");
      if (categorySummaryTable) {
        categorySummaryTable.innerHTML = data
          .map((item) => {
            const percentage = (parseFloat(item.total) / total) * 100;
            return `
            <tr>
              <td><span class="badge" style="background-color: ${
                chartColors[data.indexOf(item)]
              }">${item.category}</span></td>
              <td><strong>€${Number(item.total).toFixed(2)}</strong></td>
              <td>${percentage.toFixed(1)}%</td>
            </tr>
          `;
          })
          .join("");
      }
    } catch (error) {
      showMessage("Network error - please check connection", "danger");
      console.error("Fetch error:", error);
      throw error;
    }
  }

  // ------------------ TOTAL EXPENSES ------------------
  async function fetchTotalExpenses() {
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`${API_URL}/expenses/total`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      // First check if response is OK
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      // Try to parse JSON
      let data;
      try {
        data = await res.json();
      } catch (e) {
        throw new Error("Invalid JSON response");
      }

      // Safely extract total amount
      const totalAmount = parseFloat(data?.total) || 0;

      // Update UI
      const totalExpenseValue = document.getElementById("total-expense-value");
      if (totalExpenseValue) {
        totalExpenseValue.textContent = `€${totalAmount.toFixed(2)}`;
      }

      // Update budget progress if elements exist
      const budgetProgress = document.getElementById("budgetProgress");
      const budgetText = document.getElementById("budgetText");
      if (budgetProgress && budgetText) {
        const budget = 300; // Your budget value
        const percentage = Math.min((totalAmount / budget) * 100, 100);
        budgetProgress.style.width = `${percentage}%`;
        budgetText.textContent = `€${totalAmount.toFixed(
          2
        )} of €${budget.toFixed(2)} budget`;
      }

      return totalAmount;
    } catch (error) {
      console.error("Failed to fetch total expenses:", error);
      showMessage("Error loading expense data", "danger");
      return 0; // Return default value
    }
  }
  // ------------------ ADD EXPENSE ------------------
  async function handleAddExpense(e) {
    e.preventDefault();

    if (isSubmitting) return;
    isSubmitting = true;

    const token = localStorage.getItem("token");
    const descriptionInput = document.getElementById("expenseDescription");
    const amountInput = document.getElementById("expenseAmount");
    const categoryInput = document.getElementById("expenseCategory");

    if (!descriptionInput || !amountInput || !categoryInput) {
      showMessage("Form elements missing!", "danger");
      isSubmitting = false;
      return;
    }

    const description = descriptionInput.value;
    const amount = parseFloat(amountInput.value);
    const category = categoryInput.value;

    if (isNaN(amount) || amount <= 0) {
      showMessage("Please enter a valid amount", "danger");
      isSubmitting = false;
      return;
    }

    if (!description || !category) {
      showMessage("Please fill in all fields", "danger");
      isSubmitting = false;
      return;
    }

    try {
      const res = await fetch(`${API_URL}/expenses`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ description, amount, category }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to add expense");
      }

      showMessage("Expense added!", "success");
      document.getElementById("expenseForm").reset();
      loadData();
    } catch (err) {
      console.error(err);
      showMessage("Could not add expense", "danger");
    } finally {
      isSubmitting = false;
    }
  }

  // ------------------ INIT ------------------
  async function loadData() {
    if (!currentUser || isLoading) return;

    isLoading = true;
    showLoading(true);

    try {
      await Promise.all([
        fetchExpenses(),
        fetchCategorySummary(),
        fetchTotalExpenses(),
      ]);
    } catch (error) {
      showMessage("Failed to load data", "danger");
    } finally {
      isLoading = false;
      showLoading(false);
    }
  }

  function initializeApplication() {
    checkAuthState();
  }

  function clearUI() {
    expenseList.innerHTML = "";
    totalDisplay.textContent = "";
  }

  // ------------------ EVENTS ------------------
  const loginForm = document.getElementById("loginForm"); //Safer Event Listeners
  if (loginForm) loginForm.addEventListener("submit", handleLogin);

  const signupForm = document.getElementById("signupForm");
  if (signupForm) signupForm.addEventListener("submit", handleSignup);

  const expenseForm = document.getElementById("expenseForm");
  if (expenseForm) expenseForm.addEventListener("submit", handleAddExpense);

  // Add the filter button event listener here
  const applyFiltersBtn = document.getElementById("apply-filters");
  if (applyFiltersBtn) {
    applyFiltersBtn.addEventListener("click", (e) => {
      e.preventDefault();
      fetchFilteredExpenses();
    });
  }

  // Add reset filters functionality if needed
  const resetFiltersBtn = document.getElementById("reset-filters"); // Add this button to your HTML
  if (resetFiltersBtn) {
    resetFiltersBtn.addEventListener("click", (e) => {
      e.preventDefault();
      document.getElementById("filter-category").value = "";
      document.getElementById("filter-start-date").value = "";
      document.getElementById("filter-end-date").value = "";
      fetchExpenses().then(renderExpenses);
    });
  }
  // ------------------ START ------------------
  initializeApplication();
});

// ------------------ GLOBAL ------------------
window.logout = () => {
  localStorage.removeItem("token");
  // Instead of triggering DOMContentLoaded:
  currentUser = null;
  dataLoaded = false;
  checkAuthState(); // This will properly update the UI
  showMessage("Logged out successfully", "success");
};
function showMessage(text, type) {
  const toastContainer = document.getElementById("toastContainer");

  // Create toast element
  const toastEl = document.createElement("div");
  toastEl.className = `toast show align-items-center text-white bg-${type} border-0`;
  toastEl.setAttribute("role", "alert");
  toastEl.setAttribute("aria-live", "assertive");
  toastEl.setAttribute("aria-atomic", "true");

  // Toast content
  toastEl.innerHTML = `
    <div class="d-flex">
      <div class="toast-body">
        <i class="fas ${
          type === "success"
            ? "fa-check-circle"
            : type === "danger"
            ? "fa-exclamation-circle"
            : "fa-info-circle"
        } me-2"></i>
        ${text}
      </div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
    </div>
  `;

  // Add to container
  toastContainer.appendChild(toastEl);

  // Initialize Bootstrap toast
  const toast = new bootstrap.Toast(toastEl, {
    autohide: true,
    delay: 3000,
  });
  toast.show();

  // Remove after hide
  toastEl.addEventListener("hidden.bs.toast", () => {
    toastEl.remove();
  });
}
function showLoading(show = true) {
  const loader = document.getElementById("loader");
  if (loader) loader.classList.toggle("d-none", !show);
}
