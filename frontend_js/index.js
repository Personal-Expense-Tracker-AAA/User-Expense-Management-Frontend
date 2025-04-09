document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("expense-form");
  const expenseList = document.getElementById("expense-list");
  const categorySummaryTable = document.getElementById("category-summary");
  const message = document.getElementById("message");
  const editForm = document.getElementById("edit-expense-form");
  const API_URL = "http://localhost:5000"; // Update with your actual backend URL

  let currentEditId = null; // To store the ID of the expense being edited

  // Fetch and display expenses & category summary on page load
  fetchExpenses();
  fetchCategorySummary();
  fetchTotalExpenses();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const description = document.getElementById("description").value.trim();
    const amount = document.getElementById("amount").value.trim();
    const category = document.getElementById("category").value;

    if (!description || !amount || isNaN(amount)) {
      showMessage("Please enter valid data!", "danger");
      return;
    }

    const expense = { description, amount: parseFloat(amount), category };

    try {
      if (currentEditId) {
        // If editing, send PUT request to update the expense
        const response = await fetch(`${API_URL}/expenses/${currentEditId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(expense),
        });

        if (!response.ok) throw new Error("Failed to update expense");

        showMessage("Expense updated successfully!", "success");
      } else {
        // If adding, send POST request to create a new expense

        const response = await fetch(`${API_URL}/expenses`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(expense),
        });

        if (!response.ok) throw new Error("Failed to add expense");

        showMessage("Expense added successfully!", "success");

        // Fetch and update expenses & category summary after adding new expense
        fetchExpenses();
        fetchCategorySummary();
        fetchTotalExpenses();
        fetchCategorySummary();

        form.reset();
        currentEditId = null; // Reset the edit ID after adding a new expense
      }
    } catch (error) {
      showMessage(error.message, "danger");
    }
  });

  // Fetch expenses and category-wise totals
  async function fetchExpenses() {
    try {
      const response = await fetch(`${API_URL}/expenses`);
      const expenses = await response.json();

      expenseList.innerHTML = ""; // Clear current list
      expenses.forEach((expense) => addExpenseToTable(expense));
    } catch (error) {
      console.error("Error fetching expenses:", error);
      showMessage("Failed to load expenses.", "danger"); // Fix #44
    }
  }

  // Fetch and display category-wise totals

  async function fetchCategorySummary() {
    try {
      const response = await fetch(`${API_URL}/expenses/category-summary`);
      if (!response.ok) throw new Error("Failed to fetch category summary");
      const categories = await response.json();

      const categorySummaryTable = document.getElementById("category-summary");
      categorySummaryTable.innerHTML = ""; // Clear previous data
      const labels = [];
      const data = [];

      categories.forEach((category) => {
        const row = document.createElement("tr");
        row.innerHTML = `<td>${category.category}</td><td>${parseFloat(
          category.total
        ).toFixed(2)}</td>`;
        categorySummaryTable.appendChild(row);

        labels.push(category.category);
        data.push(parseFloat(category.total));
      });

      renderCategoryChart(labels, data);
    } catch (error) {
      console.error("Error fetching category summary:", error);
      showMessage("Failed to load category summary.", "danger"); // Fix #44
    }
  }

  // Fetch and display total expenses
  async function fetchTotalExpenses() {
    try {
      const response = await fetch(`${API_URL}/expenses/total`);
      if (!response.ok) throw new Error("Failed to fetch total expenses");
      const data = await response.json();
      document.getElementById("total-amount").textContent = parseFloat(
        data.total
      ).toFixed(2);
    } catch (error) {
      console.error("Error fetching total expenses:", error);
      showMessage("Failed to load total expenses.", "danger"); // Fix #44
    }
  }

  function addExpenseToTable(expense) {
    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${expense.description}</td>
      <td>${parseFloat(expense.amount).toFixed(2)}</td>
      <td>${expense.category}</td>
      <td>
        <button class="btn btn-sm btn-warning edit-btn" data-id="${
          expense.id
        }">Edit</button>
      </td>
    `;
    expenseList.appendChild(row);
  }

  // Delegate clicks on Edit buttons using event delegation
  expenseList.addEventListener("click", (e) => {
    if (e.target.classList.contains("edit-btn")) {
      const expenseId = e.target.dataset.id;
      // Get the row the button is in
      const row = e.target.closest("tr");
      const description = row.children[0].textContent;
      const amount = row.children[1].textContent;
      const category = row.children[2].textContent;

      // Fill the form with the selected expense details
      document.getElementById("edit-description").value = description;
      document.getElementById("edit-amount").value = amount;
      document.getElementById("edit-category").value = category;

      currentEditId = expenseId;
      // Show the modal
      const editModal = new bootstrap.Modal(
        document.getElementById("editModal")
      );
      editModal.show();
    }
  });
  // Add edit form submission handler
  editForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const description = document
      .getElementById("edit-description")
      .value.trim();
    const amount = document.getElementById("edit-amount").value.trim();
    const category = document.getElementById("edit-category").value;

    if (!description || !amount || isNaN(amount)) {
      showMessage("Please enter valid data!", "danger");
      return;
    }

    const expense = { description, amount: parseFloat(amount), category };

    try {
      const response = await fetch(`${API_URL}/expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(expense),
      });

      if (!response.ok) throw new Error("Failed to update expense");

      showMessage("Expense updated successfully!", "success");

      // Refresh data
      fetchExpenses();
      fetchCategorySummary();
      fetchTotalExpenses();

      editForm.reset();
      currentEditId = null; // Ensure this is reset

      // Hide modal
      const editModal = bootstrap.Modal.getInstance(
        document.getElementById("editModal")
      );
      editModal.hide();
      currentEditId = null;
    } catch (error) {
      showMessage(error.message, "danger");
    }
  });

  // Remove the currentEditId logic from the original form submit handler
  // The original form should only handle POST requests now

  function showMessage(text, type) {
    message.textContent = text;
    message.className = `alert alert-${type}`;
    message.classList.remove("d-none");
    setTimeout(() => message.classList.add("d-none"), 3000);
  }
  let categoryChart; // Define globally

  function renderCategoryChart(labels, data) {
    const ctx = document.getElementById("categoryChart").getContext("2d");

    // Destroy the previous instance of the chart if it exists
    if (categoryChart) {
      categoryChart.destroy();
    }

    // Create the new chart
    categoryChart = new Chart(ctx, {
      type: "pie",
      data: {
        labels: labels,
        datasets: [
          {
            data: data,
            backgroundColor: [
              "#ff6384",
              "#36a2eb",
              "#ffce56",
              "#4bc0c0",
              "#9966ff",
            ],
          },
        ],
      },
      options: {
        responsive: true,
      },
    });
  }
});
