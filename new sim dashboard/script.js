// ============================================================
//  Supabase configuration
//  Paste the anon (public) key below so the dashboard works
//  for everyone after deployment.
// ============================================================
const HARDCODED_API_KEY = "";

const DEFAULT_API_URL = "https://picpwddoywtufoxoiyzq.supabase.co/rest/v1/rpc/get_sale_dashboard";
const DEFAULT_REPORT_DATE = "2026-05-31";

// Uses the hardcoded key; falls back to a key saved earlier in this
// browser so local testing keeps working until the key above is filled in.
function getActiveKey() {
  return (HARDCODED_API_KEY || localStorage.getItem("supabase_anon_key") || "").trim();
}

function getActiveUrl() {
  return DEFAULT_API_URL;
}

// DOM Elements for KPIs
const todaysSalesEl = document.getElementById("todaysSales");
const todaysSalesTrendEl = document.getElementById("todaysSalesTrend");
const todaysRevenueEl = document.getElementById("todaysRevenue");
const todaysRevenueTrendEl = document.getElementById("todaysRevenueTrend");
const mtdSalesEl = document.getElementById("mtdSales");
const mtdSalesTrendEl = document.getElementById("mtdSalesTrend");
const mtdRevenueEl = document.getElementById("mtdRevenue");
const mtdRevenueTrendEl = document.getElementById("mtdRevenueTrend");

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

// ============================================================
//  Chart theme — matches the light UI palette
// ============================================================
const THEME = {
  blue: '#2563eb',
  blueSoft: 'rgba(37, 99, 235, 0.75)',
  blueFade: 'rgba(37, 99, 235, 0.03)',
  teal: '#0d9488',
  tealSoft: 'rgba(13, 148, 136, 0.75)',
  tealFade: 'rgba(13, 148, 136, 0.10)',
  sky: '#0284c7',
  text: '#1e293b',
  textSoft: '#64748b',
  textMuted: '#94a3b8',
  grid: '#eef2f7',
  tooltipBg: '#1e293b',
  tooltipBorder: '#334155'
};

// Shared tooltip look for every chart
const TOOLTIP_STYLE = {
  backgroundColor: THEME.tooltipBg,
  titleColor: '#f8fafc',
  bodyColor: '#cbd5e1',
  borderColor: THEME.tooltipBorder,
  borderWidth: 1,
  padding: 10,
  cornerRadius: 8,
  titleFont: { weight: '600' },
  bodyFont: { weight: '500' }
};

// Configure global Chart.js defaults
if (typeof Chart !== 'undefined') {
  Chart.defaults.font.family = "'Inter', sans-serif";
  Chart.defaults.font.weight = '500';
  Chart.defaults.color = THEME.textSoft;
}

// Date Picker
const reportDateInput = document.getElementById("reportDate");

const refreshBtn = document.getElementById("refreshBtn");

// Initialize application
document.addEventListener("DOMContentLoaded", () => {
  if (DEFAULT_REPORT_DATE) {
    reportDateInput.value = DEFAULT_REPORT_DATE;
  }

  loadDashboard();

  // Setup Event Listeners
  reportDateInput.addEventListener("change", loadDashboard);
  refreshBtn.addEventListener("click", loadDashboard);

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

// Single entry point for loading data
function loadDashboard() {
  const key = getActiveKey();

  if (!key) {
    showEmptyState("Supabase API key is not configured.");
    return;
  }

  fetchDashboardData(key, reportDateInput.value);
}

// Formatters
function formatCurrency(amount) {
  if (amount === undefined || amount === null) return "₹0";
  return "₹" + Math.round(Number(amount)).toLocaleString("en-IN");
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
  const arrow = pct >= 0 ? "▲" : "▼";
  const sign = pct >= 0 ? "+" : "";

  element.textContent = `${arrow} ${sign}${pct.toFixed(1)}% vs ${label}`;
  element.classList.add(pct >= 0 ? "positive" : "negative");
}

// Fetch data from Supabase RPC endpoint
async function fetchDashboardData(apiKey, reportDate) {
  const url = getActiveUrl();

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
    // Show the problem inline instead of throwing a popup at the user
    console.error("Dashboard Fetch Error:", error);
    showErrorState(error.message);
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
      <td colspan="6" class="table-loading">Fetching live leaderboard...</td>
    </tr>
  `;

  destroyCharts();
}

function showEmptyState(message) {
  todaysSalesEl.textContent = "-";
  todaysRevenueEl.textContent = "-";
  mtdSalesEl.textContent = "-";
  mtdRevenueEl.textContent = "-";

  leaderboardBodyEl.innerHTML = `
    <tr>
      <td colspan="6" class="table-loading">${message}</td>
    </tr>
  `;

  destroyCharts();
}

function showErrorState(message) {
  todaysSalesEl.textContent = "-";
  todaysRevenueEl.textContent = "-";
  mtdSalesEl.textContent = "-";
  mtdRevenueEl.textContent = "-";

  [todaysSalesTrendEl, todaysRevenueTrendEl, mtdSalesTrendEl, mtdRevenueTrendEl].forEach(el => {
    el.textContent = "Connection error";
    el.className = "trend-indicator negative";
  });

  leaderboardBodyEl.innerHTML = `
    <tr>
      <td colspan="6" class="table-loading is-error">${message || "Could not load data"}</td>
    </tr>
  `;

  destroyCharts();
}

function destroyCharts() {
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
    const medals = { 1: "#1", 2: "#2", 3: "#3" };
    const badgeTone = { 1: "gold", 2: "silver", 3: "bronze" };

    sortedLeaderboard.forEach((emp, index) => {
      const rank = index + 1;
      const rankClass = rank <= 3 ? `table-rank-${rank}` : "";
      const badgeClass = badgeTone[rank] || "";
      const rankLabel = medals[rank] || `#${rank}`;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="table-rank ${rankClass}"><span class="rank-badge ${badgeClass}">${rankLabel}</span></td>
        <td><strong>${emp.emp_name}</strong></td>
        <td style="text-align: right;">${(emp.mtd_sales || 0).toLocaleString("en-IN")}</td>
        <td class="cell-money" style="text-align: right;">${formatCurrency(emp.mtd_revenue)}</td>
        <td style="text-align: right;">${emp.tdy_sales !== null && emp.tdy_sales !== undefined ? emp.tdy_sales : "-"}</td>
        <td class="cell-muted" style="text-align: right;">${emp.tdy_revenue !== null && emp.tdy_revenue !== undefined ? formatCurrency(emp.tdy_revenue) : "-"}</td>
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

  const gradient = ctx.createLinearGradient(0, 0, 0, 220);
  gradient.addColorStop(0, 'rgba(37, 99, 235, 0.9)');
  gradient.addColorStop(1, 'rgba(37, 99, 235, 0.45)');

  monthlyChartInstance = new Chart(monthlyTrendCanvas, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Sales',
        data: sales,
        backgroundColor: gradient,
        borderWidth: 0,
        borderRadius: 4,
        borderSkipped: false,
        maxBarThickness: 30,
        hoverBackgroundColor: THEME.blue
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          ...TOOLTIP_STYLE,
          displayColors: false,
          callbacks: {
            label: function (context) {
              return ` ${context.parsed.y.toLocaleString('en-IN')} Sales`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: { color: THEME.textSoft, font: { weight: '600' } }
        },
        y: {
          grid: { color: THEME.grid },
          border: { display: false, dash: [4, 4] },
          ticks: { color: THEME.textMuted, precision: 0 }
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

    const gradient = ctx.createLinearGradient(0, 0, 0, 220);
    gradient.addColorStop(0, 'rgba(37, 99, 235, 0.18)');
    gradient.addColorStop(1, THEME.blueFade);

    dailyChartInstance = new Chart(dailyTrendCanvas, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Daily Sales',
          data: sales,
          fill: true,
          backgroundColor: gradient,
          borderColor: THEME.blue,
          borderWidth: 2,
          pointBackgroundColor: '#ffffff',
          pointBorderColor: THEME.blue,
          pointBorderWidth: 2,
          pointRadius: 2.5,
          pointHoverRadius: 5,
          pointHoverBackgroundColor: THEME.blue,
          pointHoverBorderColor: '#ffffff',
          tension: 0.35
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            ...TOOLTIP_STYLE,
            displayColors: false,
            callbacks: {
              label: function (context) {
                return ` ${context.parsed.y} Sales`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            border: { display: false },
            ticks: {
              color: THEME.textSoft,
              font: { size: 10, weight: '600' },
              callback: function (val, index) {
                return index % 3 === 0 ? this.getLabelForValue(val) : '';
              }
            }
          },
          y: {
            grid: { color: THEME.grid },
            border: { display: false, dash: [4, 4] },
            ticks: { color: THEME.textMuted, precision: 0 }
          }
        }
      }
    });
  } else {
    // Render Weekly-wise Bar Chart
    const weeklyData = getWeeklyMetrics(cachedDailyMetrics);
    const labels = weeklyData.map(w => w.label);
    const sales = weeklyData.map(w => w.sales);

    const gradient = ctx.createLinearGradient(0, 0, 0, 220);
    gradient.addColorStop(0, 'rgba(2, 132, 199, 0.9)');
    gradient.addColorStop(1, 'rgba(2, 132, 199, 0.45)');

    dailyChartInstance = new Chart(dailyTrendCanvas, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Weekly Sales',
          data: sales,
          backgroundColor: gradient,
          borderWidth: 0,
          borderRadius: 4,
          borderSkipped: false,
          maxBarThickness: 34,
          hoverBackgroundColor: THEME.sky
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            ...TOOLTIP_STYLE,
            displayColors: false,
            callbacks: {
              label: function (context) {
                return ` ${context.parsed.y} Sales`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            border: { display: false },
            ticks: { color: THEME.textSoft, font: { size: 10, weight: '600' } }
          },
          y: {
            grid: { color: THEME.grid },
            border: { display: false, dash: [4, 4] },
            ticks: { color: THEME.textMuted, precision: 0 }
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

  const gradientRevenue = ctx.createLinearGradient(0, 0, 500, 0);
  gradientRevenue.addColorStop(0, THEME.tealSoft);
  gradientRevenue.addColorStop(1, THEME.tealFade);

  const gradientSales = ctx.createLinearGradient(0, 0, 500, 0);
  gradientSales.addColorStop(0, THEME.blueSoft);
  gradientSales.addColorStop(1, 'rgba(37, 99, 235, 0.10)');

  leaderboardChartInstance = new Chart(leaderboardCanvas, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'MTD Revenue (₹)',
          data: revenue,
          backgroundColor: gradientRevenue,
          borderColor: THEME.teal,
          borderWidth: 1,
          borderRadius: 3,
          borderSkipped: false,
          maxBarThickness: 16
        },
        {
          label: 'MTD Sales (Units)',
          data: sales,
          backgroundColor: gradientSales,
          borderColor: THEME.blue,
          borderWidth: 1,
          borderRadius: 3,
          borderSkipped: false,
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
            color: THEME.text,
            usePointStyle: true,
            pointStyle: 'circle',
            boxWidth: 8,
            padding: 16,
            font: { weight: '600' }
          }
        },
        tooltip: {
          ...TOOLTIP_STYLE,
          usePointStyle: true,
          callbacks: {
            label: function (context) {
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
          grid: { color: THEME.grid },
          border: { display: false, dash: [4, 4] },
          ticks: {
            color: THEME.textMuted,
            callback: function (value) {
              if (value >= 1000) {
                return value.toLocaleString('en-IN');
              }
              return value;
            }
          }
        },
        y: {
          grid: { display: false },
          border: { display: false },
          ticks: { color: THEME.text, font: { weight: '600' } }
        }
      }
    }
  });
}
