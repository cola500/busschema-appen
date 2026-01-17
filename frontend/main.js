// Use relative URL - works both locally (with Vercel CLI) and in production
const API_URL = '/api';
let currentStopGid = null;
let currentStopName = null;
let refreshInterval = null;

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

// Get favorites from localStorage
function getFavorites() {
  const stored = localStorage.getItem('favorites');
  return stored ? JSON.parse(stored) : [];
}

// Save favorites to localStorage
function saveFavorites(favorites) {
  localStorage.setItem('favorites', JSON.stringify(favorites));
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
function renderFavorites() {
  const favorites = getFavorites();

  if (favorites.length === 0) {
    favoritesList.innerHTML = '';
    noFavorites.style.display = 'block';
    return;
  }

  noFavorites.style.display = 'none';

  favoritesList.innerHTML = favorites.map(fav => `
    <div class="favorite-item" data-gid="${fav.gid}" data-name="${fav.name}">
      <span class="favorite-item-name">${fav.name}</span>
      <button class="favorite-item-delete" data-gid="${fav.gid}" title="Ta bort favorit">
        🗑️
      </button>
    </div>
  `).join('');

  // Add click handlers for favorites
  favoritesList.querySelectorAll('.favorite-item').forEach(item => {
    const gid = item.dataset.gid;
    const name = item.dataset.name;

    // Click on favorite name to select stop
    item.addEventListener('click', (e) => {
      // Don't trigger if clicking delete button
      if (!e.target.classList.contains('favorite-item-delete')) {
        selectStop(gid, name);
        // Scroll to top to see departures
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  });

  // Add click handlers for delete buttons
  favoritesList.querySelectorAll('.favorite-item-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent selecting the stop
      const gid = btn.dataset.gid;
      removeFromFavorites(gid);
    });
  });
}

// === END FAVORITES ===

// === LINE FILTER MANAGEMENT ===

// Get hidden lines for a specific stop from localStorage
function getLineFilters(gid) {
  const stored = localStorage.getItem('lineFilters');
  const filters = stored ? JSON.parse(stored) : {};
  return filters[gid] || [];
}

// Save hidden lines for a specific stop to localStorage
function saveLineFilters(gid, hiddenLines) {
  const stored = localStorage.getItem('lineFilters');
  const filters = stored ? JSON.parse(stored) : {};
  filters[gid] = hiddenLines;
  localStorage.setItem('lineFilters', JSON.stringify(filters));
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
function updateFilterInfo(hiddenLines) {
  if (hiddenLines.length === 0) {
    filterInfoDiv.style.display = 'none';
    return;
  }

  filterInfoDiv.style.display = 'flex';
  const lineText = hiddenLines.length === 1
    ? `Linje ${hiddenLines[0]} är dold`
    : `Linjerna ${hiddenLines.join(', ')} är dolda`;
  filterTextSpan.textContent = lineText;
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
function displaySearchResults(data) {
  if (!data.results || data.results.length === 0) {
    searchResults.innerHTML = '<div style="padding: 10px; color: #6c757d;">Inga resultat</div>';
    return;
  }

  searchResults.innerHTML = data.results
    .filter(result => result.locationType === 'stoparea' && result.gid) // Only show stops with gid
    .slice(0, 5)
    .map(result => `
      <div class="search-result-item" data-gid="${result.gid}" data-name="${result.name}">
        <strong>${result.name}</strong>
      </div>
    `)
    .join('');

  // Add click handlers
  searchResults.querySelectorAll('.search-result-item').forEach(item => {
    item.addEventListener('click', () => {
      const gid = item.dataset.gid;
      const name = item.dataset.name;
      selectStop(gid, name);
    });
  });
}

// Select a stop
function selectStop(gid, name) {
  currentStopGid = gid;
  currentStopName = name;
  stopSearchInput.value = name;
  searchResults.innerHTML = '';

  // Update header
  document.querySelector('.header h1').textContent = `🚌 ${name}`;

  // Update favorite button
  updateFavoriteButton();

  // Save to localStorage
  localStorage.setItem('selectedStop', JSON.stringify({ gid, name }));

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
function displayDepartures(data) {
  // Get hidden lines for current stop
  const hiddenLines = getLineFilters(currentStopGid);

  // Update filter info display
  updateFilterInfo(hiddenLines);

  if (!data.results || data.results.length === 0) {
    departuresDiv.innerHTML = '<div style="text-align: center; padding: 40px; color: #6c757d;">Inga avgångar just nu</div>';
    return;
  }

  // Filter out hidden lines
  const visibleDepartures = data.results.filter(dep => {
    const lineNumber = dep.serviceJourney.line.shortName || dep.serviceJourney.line.name;
    return !hiddenLines.includes(lineNumber);
  });

  if (visibleDepartures.length === 0) {
    departuresDiv.innerHTML = '<div style="text-align: center; padding: 40px; color: #6c757d;">Alla linjer är dolda. Klicka "Visa alla" för att återställa.</div>';
    return;
  }

  departuresDiv.innerHTML = visibleDepartures.map(dep => {
    const time = formatDepartureTime(dep.estimatedTime || dep.plannedTime);
    const isSoon = getMinutesUntil(dep.estimatedTime || dep.plannedTime) <= 5;
    const lineNumber = dep.serviceJourney.line.shortName || dep.serviceJourney.line.name;

    return `
      <div class="departure-card">
        <div class="line-badge"
             data-line="${lineNumber}"
             title="Klicka för att dölja linje ${lineNumber}"
             style="background: ${dep.serviceJourney.line.backgroundColor || '#1a73b5'}; color: ${dep.serviceJourney.line.foregroundColor || 'white'}">
          ${lineNumber}
        </div>
        <div class="departure-info">
          <div class="departure-destination">
            ${dep.serviceJourney.direction}
          </div>
          <div class="departure-track">
            ${dep.stopPoint?.platform ? `Läge ${dep.stopPoint.platform}` : ''}
          </div>
        </div>
        <div class="departure-time ${isSoon ? 'soon' : ''}">
          ${time}
        </div>
      </div>
    `;
  }).join('');

  // Add click handlers to line badges
  departuresDiv.querySelectorAll('.line-badge').forEach(badge => {
    badge.addEventListener('click', (e) => {
      e.stopPropagation();
      const lineNumber = badge.dataset.line;
      toggleLineFilter(lineNumber);
    });
  });
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

// Event listeners
stopSearchInput.addEventListener('input', debounce((e) => {
  searchStops(e.target.value);
}, 300));

refreshBtn.addEventListener('click', fetchDepartures);
addFavoriteBtn.addEventListener('click', addToFavorites);
clearFilterBtn.addEventListener('click', clearLineFilters);

// Initialize favorites on page load
renderFavorites();
updateFavoriteButton();

// Load saved stop from localStorage
const savedStop = localStorage.getItem('selectedStop');
if (savedStop) {
  try {
    const { gid, name } = JSON.parse(savedStop);
    selectStop(gid, name);
  } catch (error) {
    console.error('Failed to load saved stop:', error);
  }
} else {
  // Default: search for Betaniagatan
  stopSearchInput.value = 'Betaniagatan';
  searchStops('Betaniagatan');
}
