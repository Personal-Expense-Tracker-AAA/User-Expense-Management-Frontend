document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("expense-form");
  const expenseList = document.getElementById("expense-list");
  const message = document.getElementById("message");

  // Fetch and display expenses on page load
  fetchExpenses();

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
      const response = await fetch("http://localhost:5000/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(expense),
      });

      if (!response.ok) throw new Error("Failed to add expense");

      showMessage("Expense added successfully!", "success");

      // Fetch and update expense list after adding new expense
      fetchExpenses();

      form.reset();
    } catch (error) {
      showMessage(error.message, "danger");
    }
  });

  // Function to fetch expenses from backend
  async function fetchExpenses() {
    try {
      const response = await fetch("http://localhost:5000/expenses");
      const expenses = await response.json();

      expenseList.innerHTML = ""; // Clear current list
      expenses.forEach((expense) => addExpenseToTable(expense));
    } catch (error) {
      console.error("Error fetching expenses:", error);
    }
  }

  function addExpenseToTable(expense) {
    const row = document.createElement("tr");
    row.innerHTML = `
          <td>${expense.description}</td>
          <td>${expense.amount.toFixed(2)}</td>
          <td>${expense.category}</td>
      `;
    expenseList.appendChild(row);
  }

  function showMessage(text, type) {
    message.textContent = text;
    message.className = `alert alert-${type}`;
    message.classList.remove("d-none");
    setTimeout(() => message.classList.add("d-none"), 3000);
  }
});
