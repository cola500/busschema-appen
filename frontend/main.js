// Use relative URL - works both locally (with Vercel CLI) and in production
const API_URL = '/api';
let currentStopGid = null;
let currentStopName = null;
let refreshInterval = null;

// === SAFE LOCALSTORAGE HELPERS ===
// All localStorage operations wrapped in try-catch to handle corrupt data

/**
 * Safely read and parse JSON from localStorage
 * @param {string} key - localStorage key
 * @param {*} defaultValue - value to return if read fails
 * @returns {*} parsed value or defaultValue
 */
function safeGetJSON(key, defaultValue = null) {
  try {
    const stored = localStorage.getItem(key);
    if (stored === null) return defaultValue;
    return JSON.parse(stored);
  } catch (e) {
    console.error(`localStorage read error for "${key}":`, e);
    // Attempt to remove corrupt data
    try {
      localStorage.removeItem(key);
    } catch (removeError) {
      console.error('Could not remove corrupt localStorage key:', removeError);
    }
    return defaultValue;
  }
}

/**
 * Safely write JSON to localStorage
 * @param {string} key - localStorage key
 * @param {*} value - value to store
 * @returns {boolean} true if successful, false otherwise
 */
function safeSetJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.error(`localStorage write error for "${key}":`, e);
    // Could be quota exceeded or other storage error
    return false;
  }
}

// === HTML ESCAPING (XSS Protection) ===

/**
 * Escape HTML special characters to prevent XSS
 * @param {string} str - string to escape
 * @returns {string} escaped string safe for innerHTML
 */
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

// === API VALIDATION HELPERS ===

/**
 * Validate that a departure object has required fields
 * @param {Object} dep - departure object from API
 * @returns {boolean} true if valid
 */
function isValidDeparture(dep) {
  return dep &&
    dep.serviceJourney &&
    dep.serviceJourney.line &&
    (dep.serviceJourney.line.shortName || dep.serviceJourney.line.name) &&
    dep.serviceJourney.direction &&
    (dep.estimatedTime || dep.plannedTime);
}

/**
 * Get line number from departure, with fallback
 * @param {Object} dep - departure object
 * @returns {string} line number or '?'
 */
function getLineNumber(dep) {
  if (!dep?.serviceJourney?.line) return '?';
  return dep.serviceJourney.line.shortName || dep.serviceJourney.line.name || '?';
}

// DOM elements
const stopSearchInput = document.getElementById('stopSearch');
const searchResults = document.getElementById('searchResults');
const departuresDiv = document.getElementById('departures');
const loadingDiv = document.getElementById('loading');
const errorDiv = document.getElementById('error');
const refreshBtn = document.getElementById('refreshBtn');
const lastUpdateSpan = document.getElementById('lastUpdate');
const clockDiv = document.getElementById('clock');
const favoritesSection = document.getElementById('favoritesSection');
const favoritesList = document.getElementById('favoritesList');
const noFavorites = document.getElementById('noFavorites');
const addFavoriteBtn = document.getElementById('addFavoriteBtn');
const filterInfoDiv = document.getElementById('filterInfo');
const filterTextSpan = document.getElementById('filterText');
const clearFilterBtn = document.getElementById('clearFilterBtn');

// Update clock
function updateClock() {
  const now = new Date();
  const timeString = now.toLocaleTimeString('sv-SE', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  clockDiv.textContent = timeString;
}

setInterval(updateClock, 1000);
updateClock();

// Update build info
function updateBuildInfo() {
  const buildInfoElement = document.getElementById('buildInfo');
  if (buildInfoElement) {
    const now = new Date();
    const environment = window.location.hostname === 'localhost' ? 'Development' : 'Production';
    buildInfoElement.textContent = `${environment} • ${now.toLocaleDateString('sv-SE')}`;
  }
}

updateBuildInfo();

// === FAVORITES MANAGEMENT ===

// Get favorites from localStorage (using safe helper)
function getFavorites() {
  const favorites = safeGetJSON('favorites', []);
  // Validate structure - ensure it's an array of objects with required fields
  if (!Array.isArray(favorites)) return [];
  return favorites.filter(fav => fav && fav.gid && fav.name);
}

// Save favorites to localStorage (using safe helper)
function saveFavorites(favorites) {
  return safeSetJSON('favorites', favorites);
}

// Check if current stop is a favorite
function isFavorite(gid) {
  const favorites = getFavorites();
  return favorites.some(fav => fav.gid === gid);
}

// Add current stop to favorites
function addToFavorites() {
  if (!currentStopGid || !currentStopName) {
    alert('Välj en hållplats först!');
    return;
  }

  const favorites = getFavorites();

  // Check if already exists
  if (isFavorite(currentStopGid)) {
    removeFromFavorites(currentStopGid);
    return;
  }

  // Limit to 5 favorites
  if (favorites.length >= 5) {
    alert('Du kan max ha 5 favoriter. Ta bort en favorit först.');
    return;
  }

  // Add new favorite
  favorites.push({
    gid: currentStopGid,
    name: currentStopName,
    addedAt: new Date().toISOString()
  });

  saveFavorites(favorites);
  updateFavoriteButton();
  renderFavorites();
}

// Remove a favorite
function removeFromFavorites(gid) {
  let favorites = getFavorites();
  favorites = favorites.filter(fav => fav.gid !== gid);
  saveFavorites(favorites);
  updateFavoriteButton();
  renderFavorites();
}

// Update favorite button appearance
function updateFavoriteButton() {
  if (!currentStopGid) {
    addFavoriteBtn.style.display = 'none';
    return;
  }

  addFavoriteBtn.style.display = 'flex';

  if (isFavorite(currentStopGid)) {
    addFavoriteBtn.classList.add('is-favorite');
    addFavoriteBtn.querySelector('.star-icon').textContent = '★';
    addFavoriteBtn.title = 'Ta bort från favoriter';
  } else {
    addFavoriteBtn.classList.remove('is-favorite');
    addFavoriteBtn.querySelector('.star-icon').textContent = '☆';
    addFavoriteBtn.title = 'Lägg till som favorit';
  }
}

// Render favorites list
// Note: Event listeners use delegation on parent (set up once in setupEventDelegation)
function renderFavorites() {
  const favorites = getFavorites();

  if (favorites.length === 0) {
    favoritesList.innerHTML = '';
    noFavorites.style.display = 'block';
    return;
  }

  noFavorites.style.display = 'none';

  // Build HTML with escaped user data to prevent XSS
  favoritesList.innerHTML = favorites.map(fav => `
    <div class="favorite-item" data-gid="${escapeHtml(fav.gid)}" data-name="${escapeHtml(fav.name)}">
      <span class="favorite-item-name">${escapeHtml(fav.name)}</span>
      <button class="favorite-item-delete" data-gid="${escapeHtml(fav.gid)}" title="Ta bort favorit">
        🗑️
      </button>
    </div>
  `).join('');
  // Event handling via delegation - no listeners added here
}

// === END FAVORITES ===

// === LINE FILTER MANAGEMENT ===

// Get hidden lines for a specific stop from localStorage (using safe helper)
function getLineFilters(gid) {
  const filters = safeGetJSON('lineFilters', {});
  // Validate structure
  if (typeof filters !== 'object' || filters === null) return [];
  const stopFilters = filters[gid];
  if (!Array.isArray(stopFilters)) return [];
  // Ensure all items are strings
  return stopFilters.filter(item => typeof item === 'string');
}

// Save hidden lines for a specific stop to localStorage (using safe helper)
function saveLineFilters(gid, hiddenLines) {
  const filters = safeGetJSON('lineFilters', {});
  const validFilters = (typeof filters === 'object' && filters !== null) ? filters : {};
  validFilters[gid] = hiddenLines;
  return safeSetJSON('lineFilters', validFilters);
}

// Toggle a line's visibility (hide/show)
function toggleLineFilter(lineNumber) {
  const hidden = getLineFilters(currentStopGid);
  const index = hidden.indexOf(lineNumber);
  if (index === -1) {
    hidden.push(lineNumber);
  } else {
    hidden.splice(index, 1);
  }
  saveLineFilters(currentStopGid, hidden);
  fetchDepartures();
}

// Clear all filters for current stop
function clearLineFilters() {
  saveLineFilters(currentStopGid, []);
  fetchDepartures();
}

// Update filter info display
// Note: Event listeners use delegation on parent (set up once in setupEventDelegation)
function updateFilterInfo(hiddenLines) {
  if (hiddenLines.length === 0) {
    filterInfoDiv.style.display = 'none';
    return;
  }

  filterInfoDiv.style.display = 'flex';

  // Create clickable badges for hidden lines (escaped to prevent XSS)
  const badgesHtml = hiddenLines.map(line =>
    `<span class="line-badge filtered" data-line="${escapeHtml(line)}" title="Klicka för att visa linje ${escapeHtml(line)}">${escapeHtml(line)}</span>`
  ).join('');

  filterTextSpan.innerHTML = `Dolda: ${badgesHtml}`;
  // Event handling via delegation - no listeners added here
}

// === END LINE FILTER ===

// Debounce function for search
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Search for stops
async function searchStops(query) {
  if (!query || query.length < 2) {
    searchResults.innerHTML = '';
    return;
  }

  try {
    const response = await fetch(`${API_URL}/stops/search?query=${encodeURIComponent(query)}`);
    if (!response.ok) throw new Error('Failed to search stops');

    const data = await response.json();
    displaySearchResults(data);
  } catch (error) {
    console.error('Error searching stops:', error);
    searchResults.innerHTML = '<div style="color: red; padding: 10px;">Kunde inte söka hållplatser</div>';
  }
}

// Display search results
// Note: Event listeners use delegation on parent (set up once in setupEventDelegation)
function displaySearchResults(data) {
  if (!data.results || data.results.length === 0) {
    searchResults.innerHTML = '<div style="padding: 10px; color: #6c757d;">Inga resultat</div>';
    return;
  }

  // Filter and escape data to prevent XSS
  const validResults = data.results
    .filter(result => result.locationType === 'stoparea' && result.gid && result.name)
    .slice(0, 5);

  searchResults.innerHTML = validResults
    .map(result => `
      <div class="search-result-item" data-gid="${escapeHtml(result.gid)}" data-name="${escapeHtml(result.name)}">
        <strong>${escapeHtml(result.name)}</strong>
      </div>
    `)
    .join('');
  // Event handling via delegation - no listeners added here
}

// Select a stop
function selectStop(gid, name) {
  currentStopGid = gid;
  currentStopName = name;
  stopSearchInput.value = name;
  searchResults.innerHTML = '';

  // Update header (textContent is XSS-safe)
  document.querySelector('.header h1').textContent = `🚌 ${name}`;

  // Update favorite button
  updateFavoriteButton();

  // Save to localStorage (using safe helper)
  safeSetJSON('selectedStop', { gid, name });

  // Fetch departures
  fetchDepartures();

  // Set up auto-refresh every 30 seconds
  if (refreshInterval) clearInterval(refreshInterval);
  refreshInterval = setInterval(fetchDepartures, 30000);
}

// Fetch departures
async function fetchDepartures() {
  if (!currentStopGid) {
    showError('Välj en hållplats först');
    return;
  }

  loadingDiv.style.display = 'block';
  errorDiv.style.display = 'none';
  departuresDiv.innerHTML = '';

  try {
    const response = await fetch(`${API_URL}/departures/${currentStopGid}?limit=15&timeSpan=120`);
    if (!response.ok) throw new Error('Failed to fetch departures');

    const data = await response.json();
    displayDepartures(data);

    // Update last update time
    const now = new Date();
    lastUpdateSpan.textContent = `Uppdaterat: ${now.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}`;
  } catch (error) {
    console.error('Error fetching departures:', error);
    showError('Kunde inte hämta avgångar. Försök igen.');
  } finally {
    loadingDiv.style.display = 'none';
  }
}

// Display departures
// Note: Event listeners use delegation on parent (set up once in setupEventDelegation)
function displayDepartures(data) {
  // Get hidden lines for current stop
  const hiddenLines = getLineFilters(currentStopGid);

  // Update filter info display
  updateFilterInfo(hiddenLines);

  if (!data.results || data.results.length === 0) {
    departuresDiv.innerHTML = '<div style="text-align: center; padding: 40px; color: #6c757d;">Inga avgångar just nu</div>';
    return;
  }

  // Filter and validate departures - only keep valid ones
  const validDepartures = data.results.filter(isValidDeparture);

  if (validDepartures.length === 0) {
    departuresDiv.innerHTML = '<div style="text-align: center; padding: 40px; color: #6c757d;">Inga giltiga avgångar</div>';
    console.warn('API returned departures but none were valid:', data.results);
    return;
  }

  // Filter out hidden lines
  const visibleDepartures = validDepartures.filter(dep => {
    const lineNumber = getLineNumber(dep);
    return !hiddenLines.includes(lineNumber);
  });

  if (visibleDepartures.length === 0) {
    departuresDiv.innerHTML = '<div style="text-align: center; padding: 40px; color: #6c757d;">Alla linjer är dolda. Klicka "Visa alla" för att återställa.</div>';
    return;
  }

  // Build HTML with escaped data to prevent XSS
  departuresDiv.innerHTML = visibleDepartures.map(dep => {
    const time = formatDepartureTime(dep.estimatedTime || dep.plannedTime);
    const isSoon = getMinutesUntil(dep.estimatedTime || dep.plannedTime) <= 5;
    const lineNumber = getLineNumber(dep);
    const direction = escapeHtml(dep.serviceJourney.direction);
    const platform = dep.stopPoint?.platform ? escapeHtml(dep.stopPoint.platform) : null;
    // Colors from API are validated CSS values, but escape anyway
    const bgColor = escapeHtml(dep.serviceJourney.line.backgroundColor || '#1a73b5');
    const fgColor = escapeHtml(dep.serviceJourney.line.foregroundColor || 'white');

    return `
      <div class="departure-card">
        <div class="line-badge"
             data-line="${escapeHtml(lineNumber)}"
             title="Klicka för att dölja linje ${escapeHtml(lineNumber)}"
             style="background: ${bgColor}; color: ${fgColor}">
          ${escapeHtml(lineNumber)}
        </div>
        <div class="departure-info">
          <div class="departure-destination">
            ${direction}
          </div>
          <div class="departure-track">
            ${platform ? `Läge ${platform}` : ''}
          </div>
        </div>
        <div class="departure-time ${isSoon ? 'soon' : ''}">
          ${time}
        </div>
      </div>
    `;
  }).join('');
  // Event handling via delegation - no listeners added here
}

// Format departure time
function formatDepartureTime(timestamp) {
  const now = new Date();
  const depTime = new Date(timestamp);
  const diffMinutes = Math.round((depTime - now) / 60000);

  if (diffMinutes <= 0) return 'Nu';
  if (diffMinutes === 1) return '1 min';
  if (diffMinutes < 10) return `${diffMinutes} min`;

  return depTime.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
}

// Get minutes until departure
function getMinutesUntil(timestamp) {
  const now = new Date();
  const depTime = new Date(timestamp);
  return Math.round((depTime - now) / 60000);
}

// Show error
function showError(message) {
  errorDiv.textContent = message;
  errorDiv.style.display = 'block';
  loadingDiv.style.display = 'none';
}

// === EVENT DELEGATION ===
// Set up event listeners once on parent elements to avoid memory leaks
// This is called once on page load and handles all dynamic content

function setupEventDelegation() {
  // Handle clicks on favorites list (select stop or delete)
  favoritesList.addEventListener('click', (e) => {
    const deleteBtn = e.target.closest('.favorite-item-delete');
    if (deleteBtn) {
      e.stopPropagation();
      const gid = deleteBtn.dataset.gid;
      if (gid) removeFromFavorites(gid);
      return;
    }

    const favoriteItem = e.target.closest('.favorite-item');
    if (favoriteItem) {
      const gid = favoriteItem.dataset.gid;
      const name = favoriteItem.dataset.name;
      if (gid && name) {
        selectStop(gid, name);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  });

  // Handle clicks on search results (select stop)
  searchResults.addEventListener('click', (e) => {
    const resultItem = e.target.closest('.search-result-item');
    if (resultItem) {
      const gid = resultItem.dataset.gid;
      const name = resultItem.dataset.name;
      if (gid && name) {
        selectStop(gid, name);
      }
    }
  });

  // Handle clicks on departure line badges (toggle filter)
  departuresDiv.addEventListener('click', (e) => {
    const lineBadge = e.target.closest('.line-badge');
    if (lineBadge) {
      e.stopPropagation();
      const lineNumber = lineBadge.dataset.line;
      if (lineNumber) toggleLineFilter(lineNumber);
    }
  });

  // Handle clicks on filter info badges (show hidden line)
  filterTextSpan.addEventListener('click', (e) => {
    const lineBadge = e.target.closest('.line-badge');
    if (lineBadge) {
      const lineNumber = lineBadge.dataset.line;
      if (lineNumber) toggleLineFilter(lineNumber);
    }
  });
}

// === EVENT LISTENERS (static elements) ===
stopSearchInput.addEventListener('input', debounce((e) => {
  searchStops(e.target.value);
}, 300));

refreshBtn.addEventListener('click', fetchDepartures);
addFavoriteBtn.addEventListener('click', addToFavorites);
clearFilterBtn.addEventListener('click', clearLineFilters);

// === INITIALIZATION ===

// Set up event delegation (once, handles all dynamic content)
setupEventDelegation();

// Initialize favorites on page load
renderFavorites();
updateFavoriteButton();

// Load saved stop from localStorage (using safe helper)
const savedStop = safeGetJSON('selectedStop', null);
if (savedStop && savedStop.gid && savedStop.name) {
  selectStop(savedStop.gid, savedStop.name);
} else {
  // Default: search for Betaniagatan
  stopSearchInput.value = 'Betaniagatan';
  searchStops('Betaniagatan');
}

