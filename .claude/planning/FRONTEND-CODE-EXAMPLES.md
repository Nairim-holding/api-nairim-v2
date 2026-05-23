# Frontend Code Examples - Copy & Paste Ready

## 1️⃣ POST /planning - Create/Update FIXED Type

```javascript
async function createFixedPlanning() {
  const payload = {
    category_id: "550e8400-e29b-41d4-a716-446655440000", // Required
    subcategory_id: null,                                  // Optional
    year: 2026,                                            // Required: 2000-2100
    type: "FIXED",                                         // Required: FIXED or VARIABLE
    default_amount: 5000                                   // Required for FIXED
  };

  try {
    const response = await fetch("http://localhost:5000/planning", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${localStorage.getItem("token")}`
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (!response.ok) {
      console.error("Validation errors:", result.errors);
      // Show errors to user
      return;
    }

    console.log("✅ Planning created:", result.data);
    // Use result.data.id for further operations
  } catch (error) {
    console.error("❌ Request failed:", error);
  }
}
```

---

## 2️⃣ POST /planning - Create/Update VARIABLE Type

```javascript
async function createVariablePlanning() {
  const payload = {
    category_id: "550e8400-e29b-41d4-a716-446655440000",  // Required
    subcategory_id: "660e8400-e29b-41d4-a716-446655440001", // Optional
    year: 2026,                                             // Required: 2000-2100
    type: "VARIABLE",                                       // Required: FIXED or VARIABLE
    monthly_values: [                                       // Required for VARIABLE
      { month: 1, amount: 1500 },
      { month: 2, amount: 1600 },
      { month: 3, amount: 1550 },
      { month: 4, amount: 1700 },
      { month: 5, amount: 1650 },
      { month: 6, amount: 1800 },
      { month: 7, amount: 1750 },
      { month: 8, amount: 1900 },
      { month: 9, amount: 1850 },
      { month: 10, amount: 2000 },
      { month: 11, amount: 1950 },
      { month: 12, amount: 2100 }
      // ⚠️ MUST have all 12 months, no duplicates
    ]
  };

  try {
    const response = await fetch("http://localhost:5000/planning", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${localStorage.getItem("token")}`
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (!response.ok) {
      console.error("❌ Validation errors:");
      result.errors.forEach(error => console.error(`  - ${error}`));
      return;
    }

    console.log("✅ Planning created/updated:", result.data);
    console.log(`MIN: ${result.data.min_recommended}, MAX: ${result.data.max_recommended}`);
  } catch (error) {
    console.error("❌ Request failed:", error);
  }
}
```

---

## 3️⃣ GET /planning - List by Year

```javascript
async function getPlanningsByYear(year) {
  // Validation
  if (!year || year < 2000 || year > 2100) {
    console.error("❌ Year must be between 2000 and 2100");
    return;
  }

  try {
    const response = await fetch(
      `http://localhost:5000/planning?year=${year}`,
      {
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("token")}`
        }
      }
    );

    const result = await response.json();

    if (!response.ok) {
      console.error("❌ Error:", result.errors);
      return;
    }

    console.log("✅ Plannings fetched:");
    result.data.forEach(category => {
      console.log(`📁 ${category.name} (${category.type})`);
      
      if (category.planning) {
        console.log(
          `  Planning: type=${category.planning.type}, ` +
          `min=${category.planning.min_recommended}, ` +
          `max=${category.planning.max_recommended}`
        );
      }

      category.subcategories.forEach(sub => {
        if (sub.planning) {
          console.log(`  └─ ${sub.name}: ${sub.planning.monthly_values.length} meses`);
        }
      });
    });

    return result.data;
  } catch (error) {
    console.error("❌ Request failed:", error);
  }
}

// Usage
getPlanningsByYear(2026);
```

---

## 4️⃣ GET /planning/:id - Get Single Planning

```javascript
async function getPlanningById(planningId) {
  // Validation
  if (!planningId || typeof planningId !== "string") {
    console.error("❌ planningId must be a non-empty string");
    return;
  }

  try {
    const response = await fetch(
      `http://localhost:5000/planning/${planningId}`,
      {
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("token")}`
        }
      }
    );

    const result = await response.json();

    if (response.status === 404) {
      console.error("❌ Planning not found");
      return;
    }

    if (!response.ok) {
      console.error("❌ Error:", result.message);
      return;
    }

    console.log("✅ Planning details:");
    console.log(`Category: ${result.data.category.name}`);
    console.log(`Type: ${result.data.type}`);
    console.log(`Year: ${result.data.year}`);
    console.log(`Min Recommended: ${result.data.min_recommended}`);
    console.log(`Max Recommended: ${result.data.max_recommended}`);
    console.log(`Months:`, result.data.monthly_values);

    return result.data;
  } catch (error) {
    console.error("❌ Request failed:", error);
  }
}

// Usage
getPlanningById("550e8400-e29b-41d4-a716-446655440000");
```

---

## 5️⃣ DELETE /planning/:id

```javascript
async function deletePlanning(planningId) {
  // Validation
  if (!planningId) {
    console.error("❌ planningId is required");
    return;
  }

  // Ask for confirmation
  if (!confirm("⚠️ Delete this planning? This cannot be undone.")) {
    console.log("❌ Cancelled");
    return;
  }

  try {
    const response = await fetch(
      `http://localhost:5000/planning/${planningId}`,
      {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("token")}`
        }
      }
    );

    const result = await response.json();

    if (response.status === 404) {
      console.error("❌ Planning not found");
      return;
    }

    if (!response.ok) {
      console.error("❌ Error:", result.message);
      return;
    }

    console.log("✅ Planning deleted successfully");
    return true;
  } catch (error) {
    console.error("❌ Request failed:", error);
  }
}

// Usage
deletePlanning("550e8400-e29b-41d4-a716-446655440000");
```

---

## 6️⃣ GET /planning/dashboard - Dashboard

```javascript
async function getDashboard(startDate, endDate) {
  // Validation
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  
  if (!dateRegex.test(startDate)) {
    console.error("❌ startDate must be YYYY-MM-DD format");
    return;
  }

  if (!dateRegex.test(endDate)) {
    console.error("❌ endDate must be YYYY-MM-DD format");
    return;
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  
  if (start > end) {
    console.error("❌ startDate cannot be greater than endDate");
    return;
  }

  try {
    const url = new URL("http://localhost:5000/planning/dashboard");
    url.searchParams.append("startDate", startDate);
    url.searchParams.append("endDate", endDate);

    const response = await fetch(url.toString(), {
      headers: {
        "Authorization": `Bearer ${localStorage.getItem("token")}`
      }
    });

    const result = await response.json();

    if (!response.ok) {
      console.error("❌ Validation errors:", result.errors);
      return;
    }

    console.log("✅ Dashboard fetched:");
    console.log(`Period: ${result.data.start_date} to ${result.data.end_date}`);

    // Incomes
    console.log("\n💰 INCOMES:");
    result.data.incomes.forEach(income => {
      console.log(
        `${income.name}: ` +
        `Planned=$${income.planned_amount} | ` +
        `Realized=$${income.realized_amount} | ` +
        `${income.percentage}% | ` +
        `(Min=$${income.min}, Med=$${income.med}, Max=$${income.max})`
      );
    });

    // Expenses
    console.log("\n💸 EXPENSES:");
    result.data.expenses.forEach(expense => {
      console.log(
        `${expense.name}: ` +
        `Planned=$${expense.planned_amount} | ` +
        `Realized=$${expense.realized_amount} | ` +
        `${expense.percentage}% | ` +
        `(Min=$${expense.min}, Med=$${expense.med}, Max=$${expense.max})`
      );
    });

    // Monthly balances
    console.log("\n📊 MONTHLY BALANCES:");
    result.data.balances.monthly.forEach(m => {
      console.log(`${m.year}-${String(m.month).padStart(2, "0")}: $${m.realized_amount}`);
    });

    return result.data;
  } catch (error) {
    console.error("❌ Request failed:", error);
  }
}

// Usage
getDashboard("2026-01-01", "2026-12-31");
```

---

## 🔒 Token Management

```javascript
// Get token from localStorage
const token = localStorage.getItem("token");

// Check if token exists
if (!token) {
  console.error("❌ No authentication token found. Please login first.");
  // Redirect to login page
  window.location.href = "/login";
}

// Use in all requests
const headers = {
  "Content-Type": "application/json",
  "Authorization": `Bearer ${token}`
};
```

---

## ✅ Error Handling Pattern

```javascript
async function handlePlanningRequest(url, options = {}) {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${localStorage.getItem("token")}`,
        ...options.headers
      }
    });

    const result = await response.json();

    // Validation error (400)
    if (response.status === 400) {
      console.error("❌ Validation Error:");
      result.errors?.forEach(error => console.error(`  - ${error}`));
      return { success: false, errors: result.errors };
    }

    // Not found (404)
    if (response.status === 404) {
      console.error("❌ Not Found:", result.message);
      return { success: false, message: result.message };
    }

    // Server error (500)
    if (response.status >= 500) {
      console.error("❌ Server Error:", result.message);
      return { success: false, message: "Server error. Please try again later." };
    }

    // Success (200)
    if (response.ok) {
      console.log("✅ Success:", result.message);
      return { success: true, data: result.data };
    }

  } catch (error) {
    console.error("❌ Network Error:", error.message);
    return { success: false, message: "Network error. Check your connection." };
  }
}

// Usage
const result = await handlePlanningRequest("http://localhost:5000/planning?year=2026");
if (result.success) {
  console.log("Data:", result.data);
} else {
  console.log("Errors:", result.errors || result.message);
}
```

---

## 🧪 Testing Checklist

```javascript
// Test 1: Create FIXED planning
await createFixedPlanning();

// Test 2: Create VARIABLE planning
await createVariablePlanning();

// Test 3: List all plannings for 2026
await getPlanningsByYear(2026);

// Test 4: Get single planning
const planning = await getPlanningById("PLANNING_ID");

// Test 5: Dashboard
await getDashboard("2026-01-01", "2026-12-31");

// Test 6: Delete planning
await deletePlanning("PLANNING_ID");

// Expected: All operations complete without 400/404/500 errors
```
