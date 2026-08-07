// DOM Elements for KPIs
const todaysSalesEl = document.getElementById("todaysSales");
const todaysSalesTrendEl = document.getElementById("todaysSalesTrend");
const todaysRevenueEl = document.getElementById("todaysRevenue");
const todaysRevenueTrendEl = document.getElementById("todaysRevenueTrend");
const mtdSalesEl = document.getElementById("mtdSales");
const mtdSalesTrendEl = document.getElementById("mtdSalesTrend");
const mtdRevenueEl = document.getElementById("mtdRevenue");
const mtdRevenueTrendEl = document.getElementById("mtdRevenueTrend");

// Hardcoded Default Configurations
// To set the key permanently, paste your default Supabase API key here:
const DEFAULT_API_KEY = ""; 
const DEFAULT_API_URL = "https://picpwddoywtufoxoiyzq.supabase.co/rest/v1/rpc/get_sale_dashboard";

// Leaderboard and Charts
const leaderboardBodyEl = document.getElementById("leaderboardBody");
const leaderboardTableContainer = document.getElementById("leaderboardTableContainer");
const leaderboardChartContainer = document.getElementById("leaderboardChartContainer");
const viewTableBtn = document.getElementById("viewTableBtn");
const viewChartBtn = document.getElementById("viewChartBtn");

// Daily/Weekly Trend toggles
const viewDailyBtn = document.getElementById("viewDailyBtn");
const viewWeeklyBtn = document.getElementById("viewWeeklyBtn");

// Canvas elements
const monthlyTrendCanvas = document.getElementById("monthlyTrendChartCanvas");
const dailyTrendCanvas = document.getElementById("dailyTrendChartCanvas");
const leaderboardCanvas = document.getElementById("leaderboardChartCanvas");

// Global chart instances to prevent canvas hover/reuse glitches
let monthlyChartInstance = null;
let dailyChartInstance = null;
let leaderboardChartInstance = null;

// Cache for daily data and filter state
let cachedDailyMetrics = [];
let currentTrendMode = 'daily'; // 'daily' or 'weekly'

// Configure global Chart.js defaults
if (typeof Chart !== 'undefined') {
  Chart.defaults.font.family = "'Outfit', sans-serif";
  Chart.defaults.color = '#9ca3af'; // var(--text-secondary)
}

// Date Picker
const reportDateInput = document.getElementById("reportDate");

// Modal Elements
const configModal = document.getElementById("configModal");
const openConfigBtn = document.getElementById("openConfigBtn");
const settingsBtn = document.getElementById("settingsBtn");
const closeConfigBtn = document.getElementById("closeConfigBtn");
const cancelConfigBtn = document.getElementById("cancelConfigBtn");
const saveConfigBtn = document.getElementById("saveConfigBtn");
const resetConfigBtn = document.getElementById("resetConfigBtn");
const apiKeyInput = document.getElementById("apiKeyInput");
const apiUrlInput = document.getElementById("apiUrlInput");
const apiStatusMessage = document.getElementById("apiStatusMessage");
const refreshBtn = document.getElementById("refreshBtn");

// Initialize application
document.addEventListener("DOMContentLoaded", () => {
  // Load saved API URL if any, or default
  const savedUrl = localStorage.getItem("supabase_api_url");
  apiUrlInput.value = savedUrl || DEFAULT_API_URL;

  // Load saved API key from localStorage
  const savedKey = localStorage.getItem("supabase_anon_key");
  
  // Use user override saved key if present; otherwise fall back to default hardcoded key
  const activeKey = savedKey || DEFAULT_API_KEY;
  
  if (activeKey) {
    apiKeyInput.value = activeKey;
    fetchDashboardData(activeKey, reportDateInput.value);
  } else {
    // Show settings modal automatically if no key exists
    openModal();
  }

  // Setup Event Listeners
  openConfigBtn.addEventListener("click", openModal);
  settingsBtn.addEventListener("click", (e) => {
    e.preventDefault();
    openModal();
  });
  
  closeConfigBtn.addEventListener("click", closeModal);
  cancelConfigBtn.addEventListener("click", closeModal);
  
  reportDateInput.addEventListener("change", () => {
    const key = localStorage.getItem("supabase_anon_key") || DEFAULT_API_KEY;
    if (key) {
      fetchDashboardData(key, reportDateInput.value);
    } else {
      openModal();
    }
  });

  refreshBtn.addEventListener("click", () => {
    const key = localStorage.getItem("supabase_anon_key") || DEFAULT_API_KEY;
    if (key) {
      fetchDashboardData(key, reportDateInput.value);
    } else {
      openModal();
    }
  });

  saveConfigBtn.addEventListener("click", () => {
    const key = apiKeyInput.value.trim();
    const urlVal = apiUrlInput.value.trim();
    if (!key) {
      showStatusError("API Key cannot be empty.");
      return;
    }
    
    localStorage.setItem("supabase_anon_key", key);
    localStorage.setItem("supabase_api_url", urlVal);
    closeModal();
    fetchDashboardData(key, reportDateInput.value);
  });

  if (resetConfigBtn) {
    resetConfigBtn.addEventListener("click", () => {
      // Clear overrides
      localStorage.removeItem("supabase_anon_key");
      localStorage.removeItem("supabase_api_url");
      
      // Revert inputs to defaults
      apiKeyInput.value = DEFAULT_API_KEY;
      apiUrlInput.value = DEFAULT_API_URL;
      
      // Hide reset button
      resetConfigBtn.style.display = "none";
      
      // Close modal and fetch using defaults
      closeModal();
      fetchDashboardData(DEFAULT_API_KEY, reportDateInput.value);
    });
  }

  // Toggle Leaderboard View
  if (viewTableBtn && viewChartBtn) {
    viewTableBtn.addEventListener("click", () => {
      viewTableBtn.classList.add("active");
      viewChartBtn.classList.remove("active");
      leaderboardTableContainer.style.display = "block";
      leaderboardChartContainer.style.display = "none";
    });
    
    viewChartBtn.addEventListener("click", () => {
      viewChartBtn.classList.add("active");
      viewTableBtn.classList.remove("active");
      leaderboardTableContainer.style.display = "none";
      leaderboardChartContainer.style.display = "block";
      // Re-trigger resize to fit container
      if (leaderboardChartInstance) {
        leaderboardChartInstance.resize();
      }
    });
  }

  // Toggle Daily/Weekly View
  if (viewDailyBtn && viewWeeklyBtn) {
    viewDailyBtn.addEventListener("click", () => {
      viewDailyBtn.classList.add("active");
      viewWeeklyBtn.classList.remove("active");
      currentTrendMode = 'daily';
      renderDailyWeeklyTrendChart();
    });

    viewWeeklyBtn.addEventListener("click", () => {
      viewWeeklyBtn.classList.add("active");
      viewDailyBtn.classList.remove("active");
      currentTrendMode = 'weekly';
      renderDailyWeeklyTrendChart();
    });
  }
});

// Modal helpers
function openModal() {
  configModal.classList.add("active");
  
  // Show "Reset to Default" button only if there is a saved override in localStorage and a default is configured
  const savedKey = localStorage.getItem("supabase_anon_key");
  if (savedKey && DEFAULT_API_KEY) {
    resetConfigBtn.style.display = "inline-block";
  } else {
    resetConfigBtn.style.display = "none";
  }
}

function closeModal() {
  configModal.classList.remove("active");
  apiStatusMessage.style.display = "none";
}

function showStatusError(message) {
  apiStatusMessage.textContent = message;
  apiStatusMessage.className = "status-banner error";
  apiStatusMessage.style.display = "block";
}

// Formatters
function formatCurrency(amount) {
  if (amount === undefined || amount === null) return "\u20b90";
  return "\u20b9" + Math.round(Number(amount)).toLocaleString("en-IN");
}

// Calculate comparison trend percentages
function renderTrendFooter(element, current, previous, label) {
  element.classList.remove("positive", "negative", "neutral");
  
  if (current === undefined || current === null || previous === undefined || previous === null || previous === 0) {
    element.textContent = `${label}: -`;
    element.classList.add("neutral");
    return;
  }
  
  const diff = current - previous;
  const pct = (diff / previous) * 100;
  const sign = pct >= 0 ? "+" : "";
  
  element.textContent = `${sign}${pct.toFixed(1)}% vs ${label}`;
  element.classList.add(pct >= 0 ? "positive" : "negative");
}

// Fetch data from Supabase RPC endpoint
async function fetchDashboardData(apiKey, reportDate) {
  const url = apiUrlInput.value.trim() || DEFAULT_API_URL || "https://picpwddoywtufoxoiyzq.supabase.co/rest/v1/rpc/get_sale_dashboard";
  
  showLoadingState();

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": apiKey,
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({ report_date: reportDate })
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMsg = "Failed to fetch data.";
      try {
        const errorJson = JSON.parse(errorText);
        errorMsg = errorJson.message || errorJson.error || errorMsg;
      } catch (e) {
        errorMsg = errorText || errorMsg;
      }
      throw new Error(errorMsg);
    }

    const resData = await response.json();
    
    if (!resData || (Array.isArray(resData) && resData.length === 0)) {
      throw new Error("No data returned from RPC database function.");
    }

    const payload = Array.isArray(resData) ? resData[0] : resData;
    
    // Update dashboard UI
    updateDashboardUI(payload);
    
  } catch (error) {
    console.error("Dashboard Fetch Error:", error);
    showErrorState(error.message);
    openModal();
    showStatusError(`Fetch failed: ${error.message}`);
  }
}

// UI State Renderers
function showLoadingState() {
  todaysSalesEl.textContent = "...";
  todaysRevenueEl.textContent = "...";
  mtdSalesEl.textContent = "...";
  mtdRevenueEl.textContent = "...";
  
  leaderboardBodyEl.innerHTML = `
    <tr>
      <td colspan="6" class="table-loading">Fetching live leaderboard from Supabase...</td>
    </tr>
  `;
  
  if (monthlyChartInstance) { monthlyChartInstance.destroy(); monthlyChartInstance = null; }
  if (dailyChartInstance) { dailyChartInstance.destroy(); dailyChartInstance = null; }
  if (leaderboardChartInstance) { leaderboardChartInstance.destroy(); leaderboardChartInstance = null; }
}

function showErrorState(message) {
  todaysSalesEl.textContent = "Error";
  todaysRevenueEl.textContent = "Error";
  mtdSalesEl.textContent = "Error";
  mtdRevenueEl.textContent = "Error";
  
  todaysSalesTrendEl.textContent = "Connection error";
  todaysSalesTrendEl.className = "trend-indicator negative";
  todaysRevenueTrendEl.textContent = "Connection error";
  todaysRevenueTrendEl.className = "trend-indicator negative";
  mtdSalesTrendEl.textContent = "Connection error";
  mtdSalesTrendEl.className = "trend-indicator negative";
  mtdRevenueTrendEl.textContent = "Connection error";
  mtdRevenueTrendEl.className = "trend-indicator negative";
  
  leaderboardBodyEl.innerHTML = `
    <tr>
      <td colspan="6" class="table-loading" style="color: var(--color-danger);">Error: ${message || "Could not load data"}</td>
    </tr>
  `;
  
  if (monthlyChartInstance) { monthlyChartInstance.destroy(); monthlyChartInstance = null; }
  if (dailyChartInstance) { dailyChartInstance.destroy(); dailyChartInstance = null; }
  if (leaderboardChartInstance) { leaderboardChartInstance.destroy(); leaderboardChartInstance = null; }
}

function updateDashboardUI(data) {
  // 1. KPI Cards
  const kpi = data.kpi_cards || {};
  
  todaysSalesEl.textContent = kpi.todays_sales !== undefined && kpi.todays_sales !== null ? kpi.todays_sales.toLocaleString("en-IN") : "0";
  todaysRevenueEl.textContent = formatCurrency(kpi.todays_revenue);
  
  mtdSalesEl.textContent = kpi.mtd_sales !== undefined && kpi.mtd_sales !== null ? kpi.mtd_sales.toLocaleString("en-IN") : "0";
  mtdRevenueEl.textContent = formatCurrency(kpi.mtd_revenue);

  // KPIs Comparison Footer
  renderTrendFooter(todaysSalesTrendEl, kpi.todays_sales, kpi.prev_same_day_sales, "prev same day");
  renderTrendFooter(todaysRevenueTrendEl, kpi.todays_revenue, kpi.prev_same_day_revenue, "prev same day");
  renderTrendFooter(mtdSalesTrendEl, kpi.mtd_sales, kpi.prev_sales, "prev month");
  renderTrendFooter(mtdRevenueTrendEl, kpi.mtd_revenue, kpi.prev_revenue, "prev month");

  // 2. Leaderboard Table
  const leaderboard = data.leaderboard_metrics || [];
  leaderboardBodyEl.innerHTML = "";
  
  if (leaderboard.length === 0) {
    leaderboardBodyEl.innerHTML = `
      <tr>
        <td colspan="6" class="table-loading">No active employees recorded for this period.</td>
      </tr>
    `;
  } else {
    // Sort leaderboard by MTD Sales descending
    const sortedLeaderboard = [...leaderboard].sort((a, b) => (b.mtd_sales || 0) - (a.mtd_sales || 0));
    
    sortedLeaderboard.forEach((emp, index) => {
      const rank = index + 1;
      const rankClass = rank <= 3 ? `table-rank-${rank}` : "";
      
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="table-rank ${rankClass}">#${rank}</td>
        <td><strong>${emp.emp_name}</strong></td>
        <td style="text-align: right;">${(emp.mtd_sales || 0).toLocaleString("en-IN")}</td>
        <td style="text-align: right; color: #cbd5e1;">${formatCurrency(emp.mtd_revenue)}</td>
        <td style="text-align: right;">${emp.tdy_sales !== null && emp.tdy_sales !== undefined ? emp.tdy_sales : "-"}</td>
        <td style="text-align: right; color: var(--text-muted);">${emp.tdy_revenue !== null && emp.tdy_revenue !== undefined ? formatCurrency(emp.tdy_revenue) : "-"}</td>
      `;
      leaderboardBodyEl.appendChild(tr);
    });
  }

  // 3. Monthly Sales Chart
  renderMonthlyTrendChart(data.monthly_metrics || []);

  // 4. Daily Sales Chart (caches daily metrics and supports day/week toggle)
  cachedDailyMetrics = data.daily_metrics || [];
  renderDailyWeeklyTrendChart();
  
  // 5. Leaderboard Chart
  renderLeaderboardChart(data.leaderboard_metrics || []);
}

// Chart.js Rendering Helpers
function renderMonthlyTrendChart(monthlyData) {
  if (monthlyChartInstance) {
    monthlyChartInstance.destroy();
  }

  if (!monthlyData || monthlyData.length === 0) {
    return;
  }

  const sortedMonthly = [...monthlyData].sort((a, b) => a.month - b.month);
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const labels = sortedMonthly.map(m => m.month <= 12 ? monthNames[m.month - 1] : `Month ${m.month}`);
  const sales = sortedMonthly.map(m => m.number_of_sales || 0);

  const ctx = monthlyTrendCanvas.getContext('2d');
  
  const gradient = ctx.createLinearGradient(0, 0, 0, 200);
  gradient.addColorStop(0, 'rgba(99, 102, 241, 0.85)'); // Indigo
  gradient.addColorStop(1, 'rgba(129, 140, 248, 0.1)');  // Fade

  monthlyChartInstance = new Chart(monthlyTrendCanvas, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Sales',
        data: sales,
        backgroundColor: gradient,
        borderColor: '#6366f1',
        borderWidth: 1.5,
        borderRadius: 6,
        borderSkipped: false,
        maxBarThickness: 32
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: '#1e293b',
          titleColor: '#f3f4f6',
          bodyColor: '#cbd5e1',
          borderColor: 'rgba(255, 255, 255, 0.08)',
          borderWidth: 1,
          padding: 10,
          displayColors: false,
          callbacks: {
            label: function(context) {
              return ` ${context.parsed.y.toLocaleString('en-IN')} Sales`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            display: false
          },
          ticks: {
            color: '#9ca3af',
            font: {
              weight: '500'
            }
          }
        },
        y: {
          grid: {
            color: 'rgba(255, 255, 255, 0.05)'
          },
          border: {
            dash: [4, 4]
          },
          ticks: {
            color: '#6b7280',
            precision: 0
          }
        }
      }
    }
  });
}

function renderDailyWeeklyTrendChart() {
  if (dailyChartInstance) {
    dailyChartInstance.destroy();
  }

  if (!cachedDailyMetrics || cachedDailyMetrics.length === 0) {
    return;
  }

  const ctx = dailyTrendCanvas.getContext('2d');
  
  if (currentTrendMode === 'daily') {
    // Render Day-wise Line Chart
    const sortedDaily = [...cachedDailyMetrics].sort((a, b) => a.day - b.day);
    const labels = sortedDaily.map(d => `Day ${d.day}`);
    const sales = sortedDaily.map(d => d.num_of_sales || 0);

    const gradient = ctx.createLinearGradient(0, 0, 0, 200);
    gradient.addColorStop(0, 'rgba(99, 102, 241, 0.3)'); // Indigo glow
    gradient.addColorStop(1, 'rgba(99, 102, 241, 0.0)');

    dailyChartInstance = new Chart(dailyTrendCanvas, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Daily Sales',
          data: sales,
          fill: true,
          backgroundColor: gradient,
          borderColor: '#6366f1',
          borderWidth: 2.5,
          pointBackgroundColor: '#6366f1',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 1.5,
          pointRadius: 3,
          pointHoverRadius: 6,
          tension: 0.35
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: '#1e293b',
            titleColor: '#f3f4f6',
            bodyColor: '#cbd5e1',
            borderColor: 'rgba(255, 255, 255, 0.08)',
            borderWidth: 1,
            padding: 10,
            displayColors: false,
            callbacks: {
              label: function(context) {
                return ` ${context.parsed.y} Sales`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: {
              display: false
            },
            ticks: {
              color: '#9ca3af',
              font: {
                size: 10
              },
              callback: function(val, index) {
                return index % 3 === 0 ? this.getLabelForValue(val) : '';
              }
            }
          },
          y: {
            grid: {
              color: 'rgba(255, 255, 255, 0.05)'
            },
            border: {
              dash: [4, 4]
            },
            ticks: {
              color: '#6b7280',
              precision: 0
            }
          }
        }
      }
    });
  } else {
    // Render Weekly-wise Bar Chart
    const weeklyData = getWeeklyMetrics(cachedDailyMetrics);
    const labels = weeklyData.map(w => w.label);
    const sales = weeklyData.map(w => w.sales);

    const gradient = ctx.createLinearGradient(0, 0, 0, 200);
    gradient.addColorStop(0, 'rgba(59, 130, 246, 0.85)'); // Blue gradient for weekly
    gradient.addColorStop(1, 'rgba(99, 102, 241, 0.15)');

    dailyChartInstance = new Chart(dailyTrendCanvas, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Weekly Sales',
          data: sales,
          backgroundColor: gradient,
          borderColor: '#3b82f6',
          borderWidth: 1.5,
          borderRadius: 6,
          borderSkipped: false,
          maxBarThickness: 36
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: '#1e293b',
            titleColor: '#f3f4f6',
            bodyColor: '#cbd5e1',
            borderColor: 'rgba(255, 255, 255, 0.08)',
            borderWidth: 1,
            padding: 10,
            displayColors: false,
            callbacks: {
              label: function(context) {
                return ` ${context.parsed.y} Sales`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: {
              display: false
            },
            ticks: {
              color: '#9ca3af',
              font: {
                weight: '500'
              }
            }
          },
          y: {
            grid: {
              color: 'rgba(255, 255, 255, 0.05)'
            },
            border: {
              dash: [4, 4]
            },
            ticks: {
              color: '#6b7280',
              precision: 0
            }
          }
        }
      }
    });
  }
}

function getWeeklyMetrics(dailyData) {
  const weeks = [
    { label: "Week 1 (1-7)", sales: 0 },
    { label: "Week 2 (8-14)", sales: 0 },
    { label: "Week 3 (15-21)", sales: 0 },
    { label: "Week 4 (22-28)", sales: 0 },
    { label: "Week 5 (29+)", sales: 0 }
  ];
  
  dailyData.forEach(d => {
    const day = Number(d.day);
    const sales = Number(d.num_of_sales || 0);
    if (day >= 1 && day <= 7) {
      weeks[0].sales += sales;
    } else if (day >= 8 && day <= 14) {
      weeks[1].sales += sales;
    } else if (day >= 15 && day <= 21) {
      weeks[2].sales += sales;
    } else if (day >= 22 && day <= 28) {
      weeks[3].sales += sales;
    } else if (day >= 29) {
      weeks[4].sales += sales;
    }
  });

  const hasDay29Plus = dailyData.some(d => Number(d.day) >= 29);
  if (!hasDay29Plus) {
    return weeks.slice(0, 4);
  }
  
  return weeks;
}

function renderLeaderboardChart(leaderboardData) {
  if (leaderboardChartInstance) {
    leaderboardChartInstance.destroy();
  }

  if (!leaderboardData || leaderboardData.length === 0) {
    return;
  }

  const sortedLeaderboard = [...leaderboardData].sort((a, b) => (b.mtd_revenue || 0) - (a.mtd_revenue || 0));
  
  const labels = sortedLeaderboard.map(emp => emp.emp_name);
  const revenue = sortedLeaderboard.map(emp => emp.mtd_revenue || 0);
  const sales = sortedLeaderboard.map(emp => emp.mtd_sales || 0);

  const ctx = leaderboardCanvas.getContext('2d');
  
  const gradientRevenue = ctx.createLinearGradient(0, 0, 400, 0);
  gradientRevenue.addColorStop(0, 'rgba(16, 185, 129, 0.85)'); // Emerald Green
  gradientRevenue.addColorStop(1, 'rgba(52, 211, 153, 0.2)');

  const gradientSales = ctx.createLinearGradient(0, 0, 400, 0);
  gradientSales.addColorStop(0, 'rgba(99, 102, 241, 0.85)'); // Indigo
  gradientSales.addColorStop(1, 'rgba(129, 140, 248, 0.2)');

  leaderboardChartInstance = new Chart(leaderboardCanvas, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'MTD Revenue (₹)',
          data: revenue,
          backgroundColor: gradientRevenue,
          borderColor: '#10b981',
          borderWidth: 1.5,
          borderRadius: 4,
          maxBarThickness: 16
        },
        {
          label: 'MTD Sales (Units)',
          data: sales,
          backgroundColor: gradientSales,
          borderColor: '#6366f1',
          borderWidth: 1.5,
          borderRadius: 4,
          maxBarThickness: 16
        }
      ]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            color: '#f3f4f6',
            font: {
              weight: '600'
            }
          }
        },
        tooltip: {
          backgroundColor: '#1e293b',
          titleColor: '#f3f4f6',
          bodyColor: '#cbd5e1',
          borderColor: 'rgba(255, 255, 255, 0.08)',
          borderWidth: 1,
          padding: 12,
          callbacks: {
            label: function(context) {
              const value = context.raw;
              if (context.datasetIndex === 0) {
                return ` MTD Revenue: ₹${Math.round(value).toLocaleString('en-IN')}`;
              } else {
                return ` MTD Sales: ${value.toLocaleString('en-IN')} units`;
              }
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            color: 'rgba(255, 255, 255, 0.05)'
          },
          ticks: {
            color: '#6b7280',
            callback: function(value) {
              if (value >= 1000) {
                return value.toLocaleString('en-IN');
              }
              return value;
            }
          }
        },
        y: {
          grid: {
            display: false
          },
          ticks: {
            color: '#cbd5e1',
            font: {
              weight: '600'
            }
          }
        }
      }
    }
  });
}
