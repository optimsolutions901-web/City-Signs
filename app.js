// ============================================================
// CITY SIGNS — TRADE PORTAL
// app.js — Main application logic
// ============================================================

// ── CONFIG ───────────────────────────────────────────────────
// Edit these values to customize the portal for your location.
const CONFIG = {
  SHOP_NAME: "City Signs",
  SHOP_TAGLINE: "Custom Signs · Displays · Print Products",
  SHOP_ADDRESS: "123 Main Street, Your City, ST 00000",
  SHOP_HQ_LAT: 32.7767,   // ← Replace with your actual HQ latitude
  SHOP_HQ_LNG: -96.7970,  // ← Replace with your actual HQ longitude
  LOCAL_RADIUS_MILES: 75,
  FORCE_WHOLESALE_MODE: false, // Set true to route all requests to wholesale

  WEBHOOK_URL: "https://your-webhook-url.com/submit", // Google Sheets / GHL webhook
  SUPPORT_PHONE: "(555) 123-4567",
  SUPPORT_EMAIL: "orders@citysigns.com",
  CUSTOMER_SERVICE_HOURS: "Mon–Fri 8AM–6PM, Sat 9AM–2PM (Local Time)",

  // Configurable messaging
  TURNAROUND_MESSAGE: "Orders submitted before 12PM may qualify for next-business-day production. Contact us to confirm availability for your job.",
  SAME_DAY_SERVICE_MESSAGE: "Rush same-day service may be available for qualifying jobs. Call or chat to check current capacity.",
  NAV_BADGE_TEXT: "Trade Portal",

  PICKUP_LOCATIONS: [
    {
      name: "City Signs — Main Location",
      address: "123 Main Street",
      city: "Your City, ST 00000",
      hours: "Mon–Fri: 8AM–5PM",
      sat: "Sat: 9AM–1PM",
      timezone: "CT",
      phone: "(555) 123-4567"
    },
    {
      name: "City Signs — Eastside Branch",
      address: "456 Commerce Blvd",
      city: "Your City, ST 00000",
      hours: "Mon–Fri: 9AM–5PM",
      sat: "Sat: Closed",
      timezone: "CT",
      phone: "(555) 234-5678"
    },
    {
      name: "City Signs — Westside Drop-off",
      address: "789 Industry Drive",
      city: "Your City, ST 00000",
      hours: "Mon–Fri: 8AM–4PM",
      sat: "Sat: By Appt",
      timezone: "CT",
      phone: "(555) 345-6789"
    }
  ]
};

// ── STATE ────────────────────────────────────────────────────
const STATE = {
  currentPage: "home",
  estimateCart: [],
  uploadedFiles: [],
  searchQuery: "",
  activeCategory: "all",
  activeSubcategory: null,
  currentProduct: null,
  fulfillmentResult: null,
  mockOrders: [
    { id: "CS-2024-001", items: "13oz Vinyl Banner × 3", status: "In Production", date: "2024-01-15", updated: "Today" },
    { id: "CS-2024-002", items: "10x10 Event Tent, Table Throw × 2", status: "Ready for Pickup", date: "2024-01-14", updated: "Yesterday" },
    { id: "CS-2024-003", items: "Standard Channel Letters", status: "In Review", date: "2024-01-13", updated: "2 days ago" },
    { id: "CS-2024-004", items: "Feather Flag × 5, Banner Stand × 2", status: "Shipped", date: "2024-01-10", updated: "3 days ago" },
    { id: "CS-2024-005", items: "SEG Backlit Display", status: "Quote Requested", date: "2024-01-09", updated: "4 days ago" }
  ]
};

// ── UTILITY ──────────────────────────────────────────────────
function toRad(deg) { return deg * Math.PI / 180; }
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 3958.8; // Earth radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function determineFulfillment(lat, lng) {
  if (CONFIG.FORCE_WHOLESALE_MODE) return { type: "wholesale", message: "📦 Your order will be fulfilled through our wholesale fulfillment network." };
  const dist = haversineDistance(CONFIG.SHOP_HQ_LAT, CONFIG.SHOP_HQ_LNG, lat, lng);
  if (dist <= CONFIG.LOCAL_RADIUS_MILES) {
    return { type: "local", message: `✅ Local fulfillment available! Your location is within our service area.` };
  }
  return { type: "wholesale", message: "📦 Your order will be fulfilled through our wholesale fulfillment network." };
}

// Mock geocode from address string (placeholder — swap with real API)
async function mockGeocode(address) {
  // TODO: Replace with real Google Maps or Mapbox Geocoding API call
  // Example: const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=YOUR_KEY`);
  return new Promise(resolve => {
    setTimeout(() => {
      resolve({ lat: CONFIG.SHOP_HQ_LAT + (Math.random() * 2 - 1) * 2, lng: CONFIG.SHOP_HQ_LNG + (Math.random() * 2 - 1) * 2 });
    }, 600);
  });
}

function navigate(page, extra) {
  STATE.currentPage = page;
  if (extra) Object.assign(STATE, extra);
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
  document.querySelectorAll(".nav-link").forEach(l => l.classList.toggle("active", l.dataset.page === page));
}

function addToCart(product) {
  const existing = STATE.estimateCart.find(i => i.id === product.id);
  if (existing) { existing.qty++; } else {
    STATE.estimateCart.push({ ...product, qty: 1, selectedSize: product.sizes[0], selectedMaterial: product.materials[0], notes: "" });
  }
  updateCartBadge();
  showToast(`"${product.name}" added to estimate`);
}

function removeFromCart(id) {
  STATE.estimateCart = STATE.estimateCart.filter(i => i.id !== id);
  updateCartBadge();
  if (STATE.currentPage === "estimate") render();
}

function updateCartBadge() {
  const total = STATE.estimateCart.reduce((s, i) => s + i.qty, 0);
  document.querySelectorAll(".cart-badge").forEach(b => {
    b.textContent = total;
    b.style.display = total > 0 ? "flex" : "none";
  });
}

function showToast(msg) {
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add("show"), 10);
  setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 300); }, 2800);
}

function openProduct(product) {
  STATE.currentProduct = product;
  renderProductModal(product);
}

// ── NAV ──────────────────────────────────────────────────────
function renderNav() {
  const cartCount = STATE.estimateCart.reduce((s, i) => s + i.qty, 0);
  return `
  <nav class="topnav" id="topnav">
    <div class="nav-inner">
      <div class="nav-left">
        <button class="hamburger" id="hamburgerBtn" aria-label="Menu">
          <span></span><span></span><span></span>
        </button>
        <a class="logo" href="#" onclick="navigate('home');return false;">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><rect x="2" y="6" width="24" height="16" rx="3" fill="#fff" fill-opacity=".15" stroke="#fff" stroke-width="1.5"/><path d="M7 10h14M7 14h9" stroke="#f97316" stroke-width="2" stroke-linecap="round"/><circle cx="21" cy="14" r="2.5" fill="#f97316"/></svg>
          <span class="logo-text">${CONFIG.SHOP_NAME}</span>
        </a>
        <span class="nav-badge">${CONFIG.NAV_BADGE_TEXT}</span>
      </div>
      <div class="nav-center">
        <div class="nav-links" id="navLinks">
          <a class="nav-link ${STATE.currentPage==='home'?'active':''}" data-page="home" href="#" onclick="navigate('home');return false;">Home</a>
          <a class="nav-link dropdown-toggle ${STATE.currentPage==='catalog'?'active':''}" data-page="catalog" href="#" onclick="navigate('catalog');return false;">All Products ▾</a>
          <a class="nav-link ${STATE.currentPage==='upload'?'active':''}" data-page="upload" href="#" onclick="navigate('upload');return false;">Upload</a>
          <a class="nav-link ${STATE.currentPage==='estimate'?'active':''}" data-page="estimate" href="#" onclick="navigate('estimate');return false;">Estimate</a>
          <a class="nav-link ${STATE.currentPage==='orders'?'active':''}" data-page="orders" href="#" onclick="navigate('orders');return false;">Orders</a>
          <a class="nav-link ${STATE.currentPage==='new'?'active':''}" data-page="new" href="#" onclick="navigate('new');return false;">New</a>
          <a class="nav-link ${STATE.currentPage==='contact'?'active':''}" data-page="contact" href="#" onclick="navigate('contact');return false;">Contact</a>
        </div>
      </div>
      <div class="nav-right">
        <div class="nav-search-wrap">
          <input class="nav-search" id="navSearch" type="text" placeholder="Search products…" value="${STATE.searchQuery}" oninput="handleSearch(this.value)">
          <svg class="nav-search-icon" width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="4.5" stroke="#94a3b8" stroke-width="1.5"/><path d="M11 11l2.5 2.5" stroke="#94a3b8" stroke-width="1.5" stroke-linecap="round"/></svg>
        </div>
        <button class="nav-icon-btn" onclick="navigate('estimate')" title="Estimate Cart">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M3 5h14M5 10h10M7 15h6" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/></svg>
          <span class="cart-badge" style="display:${cartCount>0?'flex':'none'}">${cartCount}</span>
        </button>
        <button class="nav-icon-btn" onclick="navigate('upload')" title="Upload Files">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 13V7M10 7l-3 3M10 7l3 3" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/><rect x="3" y="14" width="14" height="3" rx="1.5" fill="#fff" fill-opacity=".2"/></svg>
        </button>
      </div>
    </div>
  </nav>
  <div class="mobile-overlay" id="mobileOverlay" onclick="closeMobileMenu()"></div>
  <div class="mobile-menu" id="mobileMenu">
    <div class="mobile-menu-header">
      <span class="logo-text">${CONFIG.SHOP_NAME}</span>
      <button onclick="closeMobileMenu()" class="close-btn">✕</button>
    </div>
    <nav class="mobile-nav-links">
      <a onclick="navigate('home');closeMobileMenu();return false;" href="#">🏠 Home</a>
      <a onclick="navigate('catalog');closeMobileMenu();return false;" href="#">🗂️ All Products</a>
      <a onclick="navigate('upload');closeMobileMenu();return false;" href="#">📤 Upload Artwork</a>
      <a onclick="navigate('estimate');closeMobileMenu();return false;" href="#">📋 Estimate</a>
      <a onclick="navigate('orders');closeMobileMenu();return false;" href="#">📦 Orders</a>
      <a onclick="navigate('new');closeMobileMenu();return false;" href="#">🆕 New Products</a>
      <a onclick="navigate('contact');closeMobileMenu();return false;" href="#">📞 Contact</a>
    </nav>
  </div>`;
}

function handleSearch(val) {
  STATE.searchQuery = val;
  if (val.length > 1) navigate("catalog");
}

function closeMobileMenu() {
  document.getElementById("mobileMenu")?.classList.remove("open");
  document.getElementById("mobileOverlay")?.classList.remove("show");
}

// ── HOME PAGE ────────────────────────────────────────────────
function renderHome() {
  const featured = PRODUCTS.filter(p => p.isFeatured).slice(0, 6);
  const newProds = PRODUCTS.filter(p => p.isNew).slice(0, 6);
  const turnaround = PRODUCTS.filter(p => p.tags.includes("Popular")).slice(0, 4);

  return `
  <!-- HERO -->
  <section class="hero">
    <div class="hero-bg"></div>
    <div class="hero-content">
      <div class="hero-eyebrow">Professional Print & Signage</div>
      <h1 class="hero-title">${CONFIG.SHOP_NAME}</h1>
      <p class="hero-sub">${CONFIG.SHOP_TAGLINE} — Quote-Based Ordering for Businesses & Trade</p>
      <div class="hero-ctas">
        <button class="btn btn-primary btn-lg" onclick="navigate('catalog')">Shop All Products</button>
        <button class="btn btn-outline btn-lg" onclick="navigate('estimate')">Request Estimate</button>
        <button class="btn btn-ghost btn-lg" onclick="navigate('upload')">Upload Artwork</button>
        <button class="btn btn-ghost btn-lg" onclick="navigate('orders')">View Orders</button>
      </div>
    </div>
    <div class="hero-scroll-hint">↓</div>
  </section>

  <!-- TURNAROUND SPOTLIGHT -->
  <section class="section">
    <div class="section-header">
      <div>
        <div class="section-label">⚡ Quick Turnaround</div>
        <h2 class="section-title">Fast-Track Products</h2>
        <p class="section-sub">${CONFIG.TURNAROUND_MESSAGE}</p>
      </div>
      <button class="btn-see-all" onclick="navigate('catalog')">See All →</button>
    </div>
    <div class="scroll-row">
      ${turnaround.map(p => productCard(p, "scroll")).join("")}
    </div>
  </section>

  <!-- TOP CATEGORIES -->
  <section class="section section-alt">
    <div class="section-header">
      <div>
        <div class="section-label">Browse by Type</div>
        <h2 class="section-title">Top Categories</h2>
      </div>
      <button class="btn-see-all" onclick="navigate('catalog')">View All →</button>
    </div>
    <div class="category-grid">
      ${CATEGORIES.filter(c => c.id !== "all").slice(0, 12).map(c => `
        <button class="cat-card" onclick="navigate('catalog', {activeCategory:'${c.id}'})">
          <div class="cat-icon" style="background:${c.color}20; color:${c.color}">${c.icon}</div>
          <div class="cat-name">${c.name}</div>
        </button>
      `).join("")}
    </div>
  </section>

  <!-- NEW PRODUCTS -->
  <section class="section">
    <div class="section-header">
      <div>
        <div class="section-label">Just Arrived</div>
        <h2 class="section-title">New Products</h2>
      </div>
      <button class="btn-see-all" onclick="navigate('new')">See All New →</button>
    </div>
    <div class="scroll-row">
      ${newProds.map(p => productCard(p, "scroll")).join("")}
    </div>
  </section>

  <!-- FEATURED PRODUCTS -->
  <section class="section section-alt">
    <div class="section-header">
      <div>
        <div class="section-label">Editor's Picks</div>
        <h2 class="section-title">Featured Products</h2>
      </div>
      <button class="btn-see-all" onclick="navigate('catalog')">Shop All →</button>
    </div>
    <div class="product-grid product-grid-4">
      ${featured.map(p => productCard(p, "grid")).join("")}
    </div>
  </section>

  <!-- PROMO BANNER -->
  <section class="promo-banner">
    <div class="promo-inner">
      <div class="promo-block">
        <div class="promo-icon">⚡</div>
        <div>
          <h3>Rush Turnaround Available</h3>
          <p>${CONFIG.TURNAROUND_MESSAGE}</p>
        </div>
      </div>
      <div class="promo-divider"></div>
      <div class="promo-block">
        <div class="promo-icon">🏃</div>
        <div>
          <h3>Same-Day Service</h3>
          <p>${CONFIG.SAME_DAY_SERVICE_MESSAGE}</p>
        </div>
      </div>
      <div class="promo-divider"></div>
      <div class="promo-block">
        <div class="promo-icon">🗂️</div>
        <div>
          <h3>Bundle Your Order</h3>
          <p>Add multiple products to one estimate request and submit everything together.</p>
        </div>
      </div>
    </div>
  </section>

  <!-- SUPPORT -->
  <section class="section">
    <div class="section-header">
      <div>
        <div class="section-label">We're Here</div>
        <h2 class="section-title">Need Help? We've Got You.</h2>
      </div>
    </div>
    <div class="support-grid">
      <div class="support-card" onclick="document.getElementById('liveChatBtn').click()">
        <div class="support-icon">💬</div>
        <h4>Live Chat</h4>
        <p>Chat with our team in real time for quick answers and order help.</p>
        <span class="support-link">Start Chat →</span>
      </div>
      <div class="support-card">
        <div class="support-icon">📞</div>
        <h4>Phone</h4>
        <p>${CONFIG.SUPPORT_PHONE}</p>
        <span class="support-link">Call Now →</span>
      </div>
      <div class="support-card">
        <div class="support-icon">✉️</div>
        <h4>Email</h4>
        <p>${CONFIG.SUPPORT_EMAIL}</p>
        <span class="support-link">Send Email →</span>
      </div>
      <div class="support-card">
        <div class="support-icon">🕐</div>
        <h4>Office Hours</h4>
        <p>${CONFIG.CUSTOMER_SERVICE_HOURS}</p>
      </div>
      <div class="support-card" onclick="navigate('contact')">
        <div class="support-icon">💡</div>
        <h4>Share Your Thoughts</h4>
        <p>We value your input. Suggestions or feedback? Let us know.</p>
        <span class="support-link">Give Feedback →</span>
      </div>
    </div>
  </section>

  <!-- PICKUP LOCATIONS -->
  <section class="section section-alt">
    <div class="section-header">
      <div>
        <div class="section-label">Local Service</div>
        <h2 class="section-title">Store Pickup Locations</h2>
      </div>
    </div>
    <div class="locations-grid">
      ${CONFIG.PICKUP_LOCATIONS.map(loc => `
        <div class="location-card">
          <div class="location-icon">📍</div>
          <h4>${loc.name}</h4>
          <p class="loc-address">${loc.address}<br>${loc.city}</p>
          <div class="loc-hours">
            <span>${loc.hours}</span>
            <span>${loc.sat}</span>
          </div>
          <div class="loc-meta">
            <span class="loc-tz">${loc.timezone}</span>
            <span>${loc.phone}</span>
          </div>
        </div>
      `).join("")}
    </div>
  </section>

  ${renderFooter()}`;
}

// ── CATALOG PAGE ──────────────────────────────────────────────
function renderCatalog() {
  const filtered = PRODUCTS.filter(p => {
    const matchCat = STATE.activeCategory === "all" || p.category === STATE.activeCategory;
    const matchSub = !STATE.activeSubcategory || p.subcategory === STATE.activeSubcategory;
    const matchSearch = !STATE.searchQuery || p.name.toLowerCase().includes(STATE.searchQuery.toLowerCase()) || p.tags.some(t => t.toLowerCase().includes(STATE.searchQuery.toLowerCase())) || p.category.toLowerCase().includes(STATE.searchQuery.toLowerCase());
    return matchCat && matchSub && matchSearch;
  });

  const activeCat = CATEGORIES.find(c => c.id === STATE.activeCategory);

  return `
  <div class="catalog-layout">
    <!-- SIDEBAR -->
    <aside class="catalog-sidebar">
      <div class="sidebar-search">
        <input type="text" placeholder="Search products…" value="${STATE.searchQuery}" oninput="STATE.searchQuery=this.value;renderCatalogContent()" class="sidebar-search-input">
      </div>
      <div class="sidebar-cats">
        <button class="sidebar-cat-item ${STATE.activeCategory==='all'?'active':''}" onclick="setCat('all')">
          🗂️ All Products <span class="cat-count">${PRODUCTS.length}</span>
        </button>
        ${CATEGORIES.filter(c=>c.id!=="all").map(c => {
          const cnt = PRODUCTS.filter(p=>p.category===c.id).length;
          const isActive = STATE.activeCategory === c.id;
          return `
          <div class="sidebar-cat-group">
            <button class="sidebar-cat-item ${isActive?'active':''}" onclick="setCat('${c.id}')">
              <span>${c.icon} ${c.name}</span>
              <span class="cat-count">${cnt}</span>
            </button>
            ${isActive && c.sub && c.sub.length ? `<div class="sidebar-subs">
              ${c.sub.map(s => `<button class="sidebar-sub ${STATE.activeSubcategory===s?'active':''}" onclick="setSub('${s}')">${s}</button>`).join("")}
            </div>` : ""}
          </div>`;
        }).join("")}
      </div>
    </aside>

    <!-- CONTENT -->
    <div class="catalog-content" id="catalogContent">
      <div class="catalog-topbar">
        <div class="catalog-breadcrumb">
          <span onclick="setCat('all')" style="cursor:pointer;color:var(--navy)">All Products</span>
          ${STATE.activeCategory !== "all" ? ` › <span style="color:var(--navy-dark)">${activeCat?.name}</span>` : ""}
          ${STATE.activeSubcategory ? ` › ${STATE.activeSubcategory}` : ""}
          ${STATE.searchQuery ? ` › Search: "${STATE.searchQuery}"` : ""}
        </div>
        <div class="catalog-count">${filtered.length} product${filtered.length !== 1 ? "s" : ""}</div>
      </div>
      <div class="product-grid product-grid-3" id="productGrid">
        ${filtered.length > 0 ? filtered.map(p => productCard(p, "grid")).join("") : `
          <div class="empty-state">
            <div style="font-size:3rem">🔍</div>
            <h3>No products found</h3>
            <p>Try a different search or category.</p>
            <button class="btn btn-primary" onclick="setCat('all');STATE.searchQuery='';render()">Clear Filters</button>
          </div>
        `}
      </div>
    </div>
  </div>`;
}

function setCat(id) { STATE.activeCategory = id; STATE.activeSubcategory = null; render(); }
function setSub(s) { STATE.activeSubcategory = STATE.activeSubcategory === s ? null : s; render(); }
function renderCatalogContent() {
  const el = document.getElementById("productGrid");
  if (el) {
    const filtered = PRODUCTS.filter(p => {
      const matchCat = STATE.activeCategory === "all" || p.category === STATE.activeCategory;
      const matchSearch = !STATE.searchQuery || p.name.toLowerCase().includes(STATE.searchQuery.toLowerCase()) || p.tags.some(t => t.toLowerCase().includes(STATE.searchQuery.toLowerCase()));
      return matchCat && matchSearch;
    });
    el.innerHTML = filtered.map(p => productCard(p, "grid")).join("");
  }
}

// ── PRODUCT CARD ──────────────────────────────────────────────
function productCard(p, mode) {
  const badgeHtml = [
    p.isNew ? '<span class="badge badge-new">New</span>' : "",
    p.isFeatured ? '<span class="badge badge-featured">Featured</span>' : "",
    p.tags.includes("Popular") ? '<span class="badge badge-popular">Popular</span>' : "",
    p.tags.includes("Outdoor") ? '<span class="badge badge-outdoor">Outdoor</span>' : "",
    p.tags.includes("Trade") ? '<span class="badge badge-trade">Trade</span>' : "",
    p.tags.includes("Event") ? '<span class="badge badge-event">Event</span>' : "",
  ].filter(Boolean).slice(0, 2).join("");

  return `
  <div class="product-card ${mode === 'scroll' ? 'product-card-scroll' : ''}" onclick="openProduct(${JSON.stringify(p).replace(/"/g, '&quot;')})">
    <div class="product-img" style="background:${p.gradient}">
      <span class="product-emoji">${p.icon}</span>
      <div class="product-badges">${badgeHtml}</div>
    </div>
    <div class="product-info">
      <div class="product-cat-label">${p.category}</div>
      <h3 class="product-name">${p.name}</h3>
      <p class="product-desc">${p.description.substring(0, 80)}…</p>
      <div class="product-footer">
        <span class="product-sizes">${p.sizes.slice(0,2).join(", ")}${p.sizes.length > 2 ? " +" + (p.sizes.length - 2) + " more" : ""}</span>
        <button class="btn-estimate-sm" onclick="event.stopPropagation();addToCart(${JSON.stringify(p).replace(/"/g, '&quot;')})">+ Estimate</button>
      </div>
    </div>
  </div>`;
}

// ── PRODUCT MODAL ─────────────────────────────────────────────
function renderProductModal(p) {
  const existing = document.getElementById("productModal");
  if (existing) existing.remove();

  const modal = document.createElement("div");
  modal.id = "productModal";
  modal.className = "modal-overlay";
  modal.innerHTML = `
  <div class="modal-box">
    <button class="modal-close" onclick="document.getElementById('productModal').remove()">✕</button>
    <div class="modal-top">
      <div class="modal-img" style="background:${p.gradient}">
        <span style="font-size:4rem">${p.icon}</span>
        <div class="product-badges">${p.isNew ? '<span class="badge badge-new">New</span>' : ""}${p.isFeatured ? '<span class="badge badge-featured">Featured</span>' : ""}</div>
      </div>
      <div class="modal-details">
        <div class="product-cat-label">${p.category} › ${p.subcategory}</div>
        <h2>${p.name}</h2>
        <p class="modal-desc">${p.description}</p>
        <div class="modal-tags">${p.tags.map(t => `<span class="tag">${t}</span>`).join("")}</div>
        <div class="modal-form" id="modalForm">
          <div class="form-row">
            <label>Size</label>
            <select id="ms-size"><option value="">Select size…</option>${p.sizes.map(s => `<option value="${s}">${s}</option>`).join("")}</select>
          </div>
          <div class="form-row">
            <label>Material</label>
            <select id="ms-material"><option value="">Select material…</option>${p.materials.map(m => `<option value="${m}">${m}</option>`).join("")}</select>
          </div>
          ${p.sides && p.sides.length ? `
          <div class="form-row">
            <label>Sides</label>
            <select id="ms-sides"><option value="">Select…</option>${p.sides.map(s => `<option value="${s}">${s}</option>`).join("")}</select>
          </div>` : ""}
          ${p.finishing && p.finishing.length ? `
          <div class="form-row">
            <label>Finishing</label>
            <select id="ms-finish"><option value="">Select finishing…</option>${p.finishing.map(f => `<option value="${f}">${f}</option>`).join("")}</select>
          </div>` : ""}
          <div class="form-row">
            <label>Quantity</label>
            <input type="number" id="ms-qty" min="1" value="1" style="width:100px">
          </div>
          <div class="form-row">
            <label>Notes / Specs</label>
            <textarea id="ms-notes" rows="3" placeholder="Custom dimensions, colors, artwork notes…"></textarea>
          </div>
          <div class="form-row">
            <label>Attach Artwork</label>
            <input type="file" id="ms-file" accept=".pdf,.ai,.eps,.png,.jpg,.svg,.tif" multiple>
            <div class="file-hint">PDF, AI, EPS, PNG, JPG, SVG, TIF</div>
          </div>
          <div class="modal-actions">
            <button class="btn btn-primary" onclick="addToCartFromModal()">Add to Estimate</button>
            <button class="btn btn-outline" onclick="document.getElementById('productModal').remove()">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  </div>`;
  modal.addEventListener("click", e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
}

function addToCartFromModal() {
  const p = STATE.currentProduct;
  if (!p) return;
  const size = document.getElementById("ms-size")?.value;
  const material = document.getElementById("ms-material")?.value;
  const sides = document.getElementById("ms-sides")?.value;
  const finish = document.getElementById("ms-finish")?.value;
  const qty = parseInt(document.getElementById("ms-qty")?.value) || 1;
  const notes = document.getElementById("ms-notes")?.value || "";
  const item = { ...p, qty, selectedSize: size || p.sizes[0], selectedMaterial: material || p.materials[0], selectedSides: sides, selectedFinish: finish, notes };
  const existing = STATE.estimateCart.find(i => i.id === p.id);
  if (existing) { existing.qty += qty; } else { STATE.estimateCart.push(item); }
  updateCartBadge();
  showToast(`"${p.name}" added to estimate`);
  document.getElementById("productModal").remove();
}

// ── UPLOAD PAGE ───────────────────────────────────────────────
function renderUpload() {
  return `
  <div class="page-wrap">
    <div class="page-header">
      <div class="section-label">Artwork Submission</div>
      <h1>Upload Your Files</h1>
      <p>Upload your print-ready artwork files. We accept most industry-standard formats.</p>
    </div>
    <div class="upload-layout">
      <div class="upload-main">
        <div class="drop-zone" id="dropZone" ondragover="event.preventDefault();this.classList.add('drag-over')" ondragleave="this.classList.remove('drag-over')" ondrop="handleFileDrop(event)">
          <div class="drop-icon">📁</div>
          <h3>Drag & Drop Files Here</h3>
          <p>or click to browse your computer</p>
          <input type="file" id="fileInput" multiple accept=".pdf,.ai,.eps,.png,.jpg,.jpeg,.svg,.tif,.tiff,.psd" style="display:none" onchange="handleFileSelect(this.files)">
          <button class="btn btn-primary" onclick="document.getElementById('fileInput').click()">Browse Files</button>
          <div class="accepted-types">
            <strong>Accepted formats:</strong> PDF · AI · EPS · PNG · JPG · SVG · TIF · PSD
          </div>
        </div>
        <div class="file-list" id="fileList"></div>
      </div>
      <div class="upload-sidebar">
        <div class="upload-form-card">
          <h3>Project Details</h3>
          <div class="form-group">
            <label>Project Name *</label>
            <input type="text" id="upProjectName" placeholder="e.g. Grand Opening Banners">
          </div>
          <div class="form-group">
            <label>Related Product</label>
            <select id="upProduct">
              <option value="">— Select product —</option>
              ${PRODUCTS.map(p => `<option value="${p.id}">${p.name}</option>`).join("")}
            </select>
          </div>
          <div class="form-group">
            <label>Special Instructions</label>
            <textarea id="upInstructions" rows="4" placeholder="Color matching, special finishing, bleed notes…"></textarea>
          </div>
          <div class="form-group">
            <label>Your Email</label>
            <input type="email" id="upEmail" placeholder="you@company.com">
          </div>
          <button class="btn btn-primary btn-full" onclick="submitUpload()">Submit Files</button>
          <p class="form-hint">Files are linked to your estimate if one is open. Max 50MB per file.</p>
        </div>
        <div class="upload-tips-card">
          <h4>📐 File Prep Tips</h4>
          <ul>
            <li>Set bleed to 0.125" on all sides</li>
            <li>Export at 100–150 DPI at full print size</li>
            <li>Convert fonts to outlines</li>
            <li>Use CMYK color mode</li>
            <li>Embed all linked images</li>
          </ul>
        </div>
      </div>
    </div>
  </div>`;
}

function handleFileDrop(e) {
  e.preventDefault();
  document.getElementById("dropZone").classList.remove("drag-over");
  handleFileSelect(e.dataTransfer.files);
}

function handleFileSelect(files) {
  const list = document.getElementById("fileList");
  Array.from(files).forEach(f => {
    STATE.uploadedFiles.push(f);
    const item = document.createElement("div");
    item.className = "file-item";
    item.innerHTML = `<span class="file-icon">📄</span><span class="file-name">${f.name}</span><span class="file-size">${(f.size/1024/1024).toFixed(2)} MB</span><button onclick="this.parentNode.remove()">✕</button>`;
    list.appendChild(item);
  });
}

function submitUpload() {
  const name = document.getElementById("upProjectName").value;
  if (!name) { showToast("Please enter a project name."); return; }
  showToast("✅ Files submitted! We'll review and follow up shortly.");
}

// ── ESTIMATE PAGE ─────────────────────────────────────────────
function renderEstimate() {
  return `
  <div class="page-wrap">
    <div class="page-header">
      <div class="section-label">Quote Builder</div>
      <h1>Request an Estimate</h1>
      <p>Build your estimate by adding products to this list, then submit for a quote.</p>
    </div>
    <div class="estimate-layout">
      <div class="estimate-main">
        <h3>Your Items (${STATE.estimateCart.length})</h3>
        ${STATE.estimateCart.length === 0 ? `
          <div class="empty-state">
            <div style="font-size:3rem">📋</div>
            <h3>No items yet</h3>
            <p>Browse the catalog and add products to your estimate.</p>
            <button class="btn btn-primary" onclick="navigate('catalog')">Browse Products</button>
          </div>` :
          STATE.estimateCart.map((item, i) => `
          <div class="estimate-item">
            <div class="ei-img" style="background:${item.gradient}">${item.icon}</div>
            <div class="ei-info">
              <h4>${item.name}</h4>
              <div class="ei-meta">
                ${item.selectedSize ? `<span>Size: ${item.selectedSize}</span>` : ""}
                ${item.selectedMaterial ? `<span>Material: ${item.selectedMaterial}</span>` : ""}
                ${item.selectedFinish ? `<span>Finishing: ${item.selectedFinish}</span>` : ""}
              </div>
              ${item.notes ? `<p class="ei-notes">${item.notes}</p>` : ""}
            </div>
            <div class="ei-controls">
              <div class="qty-control">
                <button onclick="changeQty(${i},-1)">−</button>
                <span>${item.qty}</span>
                <button onclick="changeQty(${i},1)">+</button>
              </div>
              <button class="remove-btn" onclick="removeFromCart('${item.id}')">Remove</button>
            </div>
          </div>`).join("")
        }
        ${STATE.estimateCart.length > 0 ? `<button class="btn btn-outline" onclick="navigate('catalog')">+ Add More Products</button>` : ""}
      </div>
      <div class="estimate-sidebar">
        <div class="estimate-form-card">
          <h3>Your Information</h3>
          <div class="form-group">
            <label>Full Name *</label>
            <input type="text" id="estName" placeholder="Jane Smith">
          </div>
          <div class="form-group">
            <label>Company</label>
            <input type="text" id="estCompany" placeholder="Your Company LLC">
          </div>
          <div class="form-group">
            <label>Email *</label>
            <input type="email" id="estEmail" placeholder="jane@company.com">
          </div>
          <div class="form-group">
            <label>Phone</label>
            <input type="tel" id="estPhone" placeholder="(555) 123-4567">
          </div>
          <div class="form-group">
            <label>Service Address</label>
            <div class="address-row">
              <input type="text" id="estAddress" placeholder="Street, City, State ZIP" style="flex:1">
              <button class="btn btn-outline btn-sm" onclick="useMyLocation()" title="Use my location">📍</button>
            </div>
            <div id="fulfillmentMsg" class="fulfillment-msg"></div>
          </div>
          <div class="form-group">
            <label>Additional Notes</label>
            <textarea id="estNotes" rows="3" placeholder="Timeline, budget range, special requirements…"></textarea>
          </div>
          <button class="btn btn-primary btn-full" onclick="submitEstimate()">Submit Estimate Request</button>
          <p class="form-hint">No payment required. We'll contact you with a quote.</p>
        </div>
      </div>
    </div>
  </div>`;
}

function changeQty(i, delta) {
  STATE.estimateCart[i].qty = Math.max(1, (STATE.estimateCart[i].qty || 1) + delta);
  updateCartBadge();
  render();
}

async function useMyLocation() {
  if (!navigator.geolocation) { showToast("Geolocation not supported."); return; }
  showToast("Getting your location…");
  navigator.geolocation.getCurrentPosition(pos => {
    const result = determineFulfillment(pos.coords.latitude, pos.coords.longitude);
    STATE.fulfillmentResult = result;
    const msg = document.getElementById("fulfillmentMsg");
    if (msg) { msg.textContent = result.message; msg.className = "fulfillment-msg " + result.type; }
  }, () => showToast("Could not get location. Please enter your address."));
}

async function checkAddressDistance() {
  const addr = document.getElementById("estAddress")?.value;
  if (!addr) return;
  const coords = await mockGeocode(addr);
  const result = determineFulfillment(coords.lat, coords.lng);
  STATE.fulfillmentResult = result;
  const msg = document.getElementById("fulfillmentMsg");
  if (msg) { msg.textContent = result.message; msg.className = "fulfillment-msg " + result.type; }
}

async function submitEstimate() {
  const name = document.getElementById("estName")?.value;
  const email = document.getElementById("estEmail")?.value;
  if (!name || !email) { showToast("Please fill in your name and email."); return; }
  if (STATE.estimateCart.length === 0) { showToast("Please add at least one product to your estimate."); return; }

  const payload = {
    timestamp: new Date().toISOString(),
    customer: {
      name, email,
      company: document.getElementById("estCompany")?.value,
      phone: document.getElementById("estPhone")?.value,
      address: document.getElementById("estAddress")?.value,
      notes: document.getElementById("estNotes")?.value
    },
    fulfillment: STATE.fulfillmentResult,
    items: STATE.estimateCart.map(i => ({
      id: i.id, name: i.name, category: i.category,
      qty: i.qty, size: i.selectedSize, material: i.selectedMaterial,
      finish: i.selectedFinish, notes: i.notes
    }))
  };

  // Submit to webhook
  try {
    if (CONFIG.WEBHOOK_URL && CONFIG.WEBHOOK_URL !== "https://your-webhook-url.com/submit") {
      await fetch(CONFIG.WEBHOOK_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    }
  } catch(e) { console.log("Webhook not configured — payload:", payload); }

  showToast("✅ Estimate submitted! We'll follow up within 1 business day.");
  STATE.estimateCart = [];
  updateCartBadge();
  navigate("orders");
}

// ── ORDERS PAGE ───────────────────────────────────────────────
function renderOrders() {
  const statuses = ["Quote Requested","In Review","Approved","In Production","Ready for Pickup","Shipped"];
  const statusColors = { "Quote Requested":"#94a3b8","In Review":"#f59e0b","Approved":"#10b981","In Production":"#3b82f6","Ready for Pickup":"#8b5cf6","Shipped":"#16a34a" };

  return `
  <div class="page-wrap">
    <div class="page-header">
      <div class="section-label">Order Management</div>
      <h1>Your Orders</h1>
      <p>Track your quote requests and order status.</p>
    </div>
    <div class="orders-search-row">
      <input type="text" id="orderSearch" placeholder="Search by reference number or product…" class="orders-search" oninput="filterOrders(this.value)">
      <button class="btn btn-outline" onclick="navigate('estimate')">+ New Estimate</button>
    </div>
    <div class="status-pipeline">
      ${statuses.map(s => `<div class="pipeline-step"><div class="pipeline-dot" style="background:${statusColors[s]}"></div><span>${s}</span></div>`).join('<div class="pipeline-line"></div>')}
    </div>
    <div class="orders-list" id="ordersList">
      ${STATE.mockOrders.map(o => `
        <div class="order-card" data-search="${o.id.toLowerCase()} ${o.items.toLowerCase()}">
          <div class="order-header">
            <div>
              <div class="order-ref">${o.id}</div>
              <div class="order-items">${o.items}</div>
            </div>
            <div class="order-right">
              <span class="order-status" style="background:${statusColors[o.status]}20;color:${statusColors[o.status]};border:1px solid ${statusColors[o.status]}40">${o.status}</span>
            </div>
          </div>
          <div class="order-footer">
            <span>Submitted: ${o.date}</span>
            <span>Updated: ${o.updated}</span>
            <button class="btn btn-outline btn-sm" onclick="showToast('Contact us at ${CONFIG.SUPPORT_PHONE} for order details.')">View Details</button>
          </div>
        </div>
      `).join("")}
    </div>
    <div class="orders-note">
      <p>💡 <strong>Coming Soon:</strong> This dashboard will connect to your order history in real time. Orders submitted via the estimate form are tracked here. <em>Backend integration with Google Sheets or CRM available.</em></p>
    </div>
  </div>`;
}

function filterOrders(q) {
  document.querySelectorAll(".order-card").forEach(card => {
    card.style.display = q && !card.dataset.search.includes(q.toLowerCase()) ? "none" : "";
  });
}

// ── NEW PRODUCTS PAGE ─────────────────────────────────────────
function renderNew() {
  const newProds = PRODUCTS.filter(p => p.isNew);
  return `
  <div class="page-wrap">
    <div class="page-header">
      <div class="section-label">Just Arrived</div>
      <h1>New Products</h1>
      <p>The latest additions to our catalog — fresh products and expanded options.</p>
    </div>
    <div class="product-grid product-grid-4">
      ${newProds.map(p => productCard(p, "grid")).join("")}
    </div>
  </div>`;
}

// ── CONTACT PAGE ──────────────────────────────────────────────
function renderContact() {
  return `
  <div class="page-wrap">
    <div class="page-header">
      <div class="section-label">Get in Touch</div>
      <h1>Contact & Help Center</h1>
      <p>Our team is ready to help you with quotes, files, orders, and anything in between.</p>
    </div>
    <div class="contact-grid">
      <div class="contact-card">
        <div class="contact-icon">💬</div>
        <h3>Live Chat</h3>
        <p>Chat with a team member right now for instant assistance.</p>
        <button class="btn btn-primary" onclick="document.getElementById('liveChatBtn').click()">Start Live Chat</button>
      </div>
      <div class="contact-card">
        <div class="contact-icon">📞</div>
        <h3>Call Us</h3>
        <p>${CONFIG.SUPPORT_PHONE}</p>
        <a class="btn btn-outline" href="tel:${CONFIG.SUPPORT_PHONE}">Call Now</a>
      </div>
      <div class="contact-card">
        <div class="contact-icon">✉️</div>
        <h3>Email Us</h3>
        <p>${CONFIG.SUPPORT_EMAIL}</p>
        <a class="btn btn-outline" href="mailto:${CONFIG.SUPPORT_EMAIL}">Send Email</a>
      </div>
      <div class="contact-card">
        <div class="contact-icon">🕐</div>
        <h3>Office Hours</h3>
        <p>${CONFIG.CUSTOMER_SERVICE_HOURS}</p>
      </div>
      <div class="contact-card">
        <div class="contact-icon">📦</div>
        <h3>Request Sample Kit</h3>
        <p>Want to see our materials in person? Request a free sample kit.</p>
        <button class="btn btn-outline" onclick="showToast('Sample kit request submitted! We'll be in touch.')">Request Sample Kit</button>
      </div>
      <div class="contact-card">
        <div class="contact-icon">📅</div>
        <h3>Holiday Schedule</h3>
        <p>Check our production and shipping schedule for upcoming holidays.</p>
        <button class="btn btn-outline" onclick="showToast('Holiday schedule coming soon.')">View Schedule</button>
      </div>
    </div>
    <div class="feedback-section">
      <h2>Share Your Thoughts</h2>
      <p>We value your input. If you have suggestions or feedback, let us know — we read every message.</p>
      <div class="feedback-form">
        <div class="form-row-2">
          <div class="form-group"><label>Name</label><input type="text" id="fbName" placeholder="Your name"></div>
          <div class="form-group"><label>Email</label><input type="email" id="fbEmail" placeholder="your@email.com"></div>
        </div>
        <div class="form-group"><label>Message</label><textarea id="fbMsg" rows="5" placeholder="Tell us what you think, what we can do better, or what products you'd love to see…"></textarea></div>
        <button class="btn btn-primary" onclick="submitFeedback()">Send Feedback</button>
      </div>
    </div>
    ${renderFooter()}
  </div>`;
}

function submitFeedback() {
  const msg = document.getElementById("fbMsg")?.value;
  if (!msg) { showToast("Please enter your feedback."); return; }
  showToast("✅ Thanks for your feedback! We appreciate your input.");
}

// ── FOOTER ────────────────────────────────────────────────────
function renderFooter() {
  return `
  <footer class="footer">
    <div class="footer-inner">
      <div class="footer-col">
        <div class="footer-logo">
          <svg width="24" height="24" viewBox="0 0 28 28" fill="none"><rect x="2" y="6" width="24" height="16" rx="3" fill="#fff" fill-opacity=".15" stroke="#fff" stroke-width="1.5"/><path d="M7 10h14M7 14h9" stroke="#f97316" stroke-width="2" stroke-linecap="round"/><circle cx="21" cy="14" r="2.5" fill="#f97316"/></svg>
          <span>${CONFIG.SHOP_NAME}</span>
        </div>
        <p class="footer-about">${CONFIG.SHOP_TAGLINE}. Professional print and signage for businesses, events, and trade.</p>
        <p class="footer-address">${CONFIG.SHOP_ADDRESS}</p>
      </div>
      <div class="footer-col">
        <h4>Catalog</h4>
        <a href="#" onclick="navigate('catalog');return false;">All Products</a>
        <a href="#" onclick="navigate('new');return false;">New Products</a>
        <a href="#" onclick="navigate('catalog',{activeCategory:'Banners'});return false;">Banners</a>
        <a href="#" onclick="navigate('catalog',{activeCategory:'Channel Letters'});return false;">Channel Letters</a>
        <a href="#" onclick="navigate('catalog',{activeCategory:'Trade Show'});return false;">Trade Show</a>
      </div>
      <div class="footer-col">
        <h4>Services</h4>
        <a href="#" onclick="navigate('upload');return false;">Upload Artwork</a>
        <a href="#" onclick="navigate('estimate');return false;">Request Estimate</a>
        <a href="#" onclick="navigate('orders');return false;">Track Orders</a>
        <a href="#" onclick="showToast('Design templates coming soon!');return false;">Design Templates</a>
        <a href="#" onclick="showToast('Sample kit request submitted!');return false;">Request Sample Kit</a>
      </div>
      <div class="footer-col">
        <h4>Company</h4>
        <a href="#" onclick="showToast('About page coming soon.');return false;">About Us</a>
        <a href="#" onclick="navigate('contact');return false;">Contact Us</a>
        <a href="#" onclick="navigate('contact');return false;">Help Center</a>
        <a href="#" onclick="showToast('Holiday schedule coming soon.');return false;">Holiday Schedule</a>
        <a href="#" onclick="navigate('contact');return false;">Share Feedback</a>
      </div>
    </div>
    <div class="footer-bottom">
      <span>© ${new Date().getFullYear()} ${CONFIG.SHOP_NAME}. All rights reserved.</span>
      <span>Trade Portal — No public pricing. All orders by estimate.</span>
    </div>
  </footer>`;
}

// ── FLOATING UI ───────────────────────────────────────────────
function renderFloating() {
  return `
  <div class="floating-chat" id="liveChatBtn" onclick="showToast('Live chat launching… Contact us at ${CONFIG.SUPPORT_PHONE}')">
    <span>💬</span>
    <span class="float-label">Live Chat</span>
  </div>
  <div class="floating-feedback" onclick="navigate('contact')">
    <span>📝</span>
    <span class="float-label">Feedback</span>
  </div>`;
}

// ── MAIN RENDER ───────────────────────────────────────────────
function render() {
  let content = "";
  switch (STATE.currentPage) {
    case "home":     content = renderHome(); break;
    case "catalog":  content = renderCatalog(); break;
    case "upload":   content = renderUpload(); break;
    case "estimate": content = renderEstimate(); break;
    case "orders":   content = renderOrders(); break;
    case "new":      content = renderNew(); break;
    case "contact":  content = renderContact(); break;
    default:         content = renderHome();
  }

  document.getElementById("app").innerHTML = renderNav() + `<main class="main-content" id="mainContent">${content}</main>`;
  document.getElementById("floatingUI").innerHTML = renderFloating();
  updateCartBadge();

  // Re-bind hamburger
  document.getElementById("hamburgerBtn")?.addEventListener("click", () => {
    document.getElementById("mobileMenu").classList.toggle("open");
    document.getElementById("mobileOverlay").classList.toggle("show");
  });

  // Address blur check
  document.getElementById("estAddress")?.addEventListener("blur", checkAddressDistance);
}

// ── INIT ──────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  document.title = CONFIG.SHOP_NAME + " — Trade Portal";
  render();
});
