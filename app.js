// Application state
const appState = {
  hands: {},
  index: {},
  patterns: {},
  isDataLoaded: false
};

// DOM elements
const searchInput = document.getElementById('search-input');
const clearButton = document.getElementById('clear-button');
const resultsContainer = document.getElementById('results');

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  // Load the compressed JSON data
  fetch('comprangedict.json')
    .then(response => {
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json();
    })
    .then(data => {
      // Store the data in app state
      appState.hands = data.hands;
      appState.index = data.index;
      appState.patterns = data.patterns;
      appState.isDataLoaded = true;
      
      // Setup event listeners
      setupEventListeners();
    })
    .catch(error => {
      console.error('Error loading data:', error);
      resultsContainer.innerHTML = `
        <div class="error-message">
          <p>Error loading data. Please check if the comprangedict.json file exists and is correctly formatted.</p>
          <p>Technical details: ${error.message}</p>
        </div>
      `;
    });
});

// Setup event listeners
function setupEventListeners() {
  // Handle input changes
  searchInput.addEventListener('input', debounce(handleSearch, 100));
  
  // Handle clear button
  clearButton.addEventListener('click', () => {
    searchInput.value = '';
    resultsContainer.innerHTML = '<div class="initial-message">Enter card ranks to see matching hands</div>';
  });
}

// Handle search input
function handleSearch() {
  const query = searchInput.value.trim();
  
  if (!query) {
    resultsContainer.innerHTML = '<div class="initial-message">Enter card ranks to see matching hands</div>';
    return;
  }
  
  if (!appState.isDataLoaded) {
    resultsContainer.innerHTML = '<div class="loading">Loading data...</div>';
    return;
  }
  
  // Convert to lowercase for case-insensitive search
  const queryLower = query.toLowerCase();
  
  // Create a frequency map of the search chars
  const searchFrequency = {};
  for (const char of queryLower) {
    searchFrequency[char] = (searchFrequency[char] || 0) + 1;
  }
  
  // Find matching rank combinations
  let matches = [];
  
  // If we have at least one search term
  if (queryLower.length > 0) {
    // Start with all hands containing the first unique search term
    const firstChar = Object.keys(searchFrequency)[0];
    const initialCandidates = appState.index[firstChar] || [];
    
    // Check each candidate to ensure it contains the right frequency of each character
    matches = initialCandidates.filter(hand => {
      const handLower = hand.toLowerCase();
      // Check if all characters in search are in the hand with correct frequency
      for (const [char, count] of Object.entries(searchFrequency)) {
        // Count occurrences of this character in the hand
        const charCountInHand = (handLower.match(new RegExp(char, 'g')) || []).length;
        
        // If we don't have enough of this character, or require exact matches when all 4 ranks are specified
        if (charCountInHand < count || (queryLower.length === 4 && charCountInHand > count)) {
          return false;
        }
      }
      return true;
    });
  }
  
  // Display the results
  displayResults(matches);
}

// Display search results
function displayResults(matches) {
  if (matches.length === 0) {
    resultsContainer.innerHTML = '<div class="no-results">No matching hands found</div>';
    return;
  }
  
  // Clear the results container
  resultsContainer.innerHTML = '';
  
  // Group matches by rank combination
  matches.forEach(rankCombo => {
    const handContainer = document.createElement('div');
    handContainer.className = 'hand-group';
    
    const header = document.createElement('h3');
    header.textContent = rankCombo;
    handContainer.appendChild(header);
    
    // Get suitedness patterns for this rank combo
    const patterns = appState.hands[rankCombo];
    
    // Check if patterns exist for this rank combo
    if (!patterns) {
      const noPatternMsg = document.createElement('div');
      noPatternMsg.className = 'no-pattern';
      noPatternMsg.textContent = 'No pattern data available for this combination';
      handContainer.appendChild(noPatternMsg);
      resultsContainer.appendChild(handContainer);
      return;
    }
    
    // Create elements for each suitedness pattern
    Object.entries(patterns).forEach(([patternId, actions]) => {
      const patternElement = document.createElement('div');
      patternElement.className = 'hand-pattern';
      
      // Add the visualization
      patternElement.innerHTML = renderHandVisualization(rankCombo, patternId);
      
      // Add the actions
      patternElement.innerHTML += renderActions(actions);
      
      handContainer.appendChild(patternElement);
    });
    
    resultsContainer.appendChild(handContainer);
  });
}

// Render hand visualization
function renderHandVisualization(rankCombo, patternId) {
  const pattern = appState.patterns[patternId];
  const cards = rankCombo.split('');
  
  // Define card colors based on the suitedness pattern
  const cardColors = getColorsForPattern(pattern, cards);
  
  // Create the card elements
  const cardElements = cards.map((rank, index) => 
    `<div class="card" style="background-color: ${cardColors[index]}">
       ${rank.toUpperCase()}
     </div>`
  ).join('');
  
  return `<div class="hand-visualization">${cardElements}</div>`;
}

// Get colors for pattern
function getColorsForPattern(pattern, cards) {
  // Color mapping
  const colors = {
    club: '#5FAD56',    // Green
    heart: '#F2545B',   // Red
    diamond: '#4A8FE7', // Blue
    spade: '#F9C846'    // Yellow
  };
  
  // Assign colors based on pattern
  switch (pattern) {
    case 'mono':
      return [colors.club, colors.club, colors.club, colors.club];
    case 'trip_high':
      return [colors.club, colors.club, colors.club, colors.heart];
    case 'trip_low':
      return [colors.heart, colors.club, colors.club, colors.club];
    case 'double':
      return [colors.club, colors.club, colors.heart, colors.heart];
    case 'single_high':
      return [colors.club, colors.club, colors.heart, colors.diamond];
    case 'single_low':
      return [colors.heart, colors.club, colors.club, colors.diamond];
    case 'rainbow':
      return [colors.club, colors.heart, colors.diamond, colors.spade];
    default:
      return [colors.club, colors.heart, colors.diamond, colors.spade];
  }
}

// Render actions
function renderActions(actions) {
  // Safely handle potentially missing actions
  if (!actions) {
    return `<div class="actions"><div class="no-actions">No action data available</div></div>`;
  }
  
  // Process SB actions
  const sbOpen = actions["100BB SB open"] > 0 ? "Raise" : "Fold";
  let sbResponse = "Fold";
  if (actions["100BB SB 4bet"] > 0) sbResponse = "4bet";
  else if (actions["100BB SB Cv3bet"] > 0) sbResponse = "Call";
  
  // Process BB actions
  let bbAction = "Fold";
  if (actions["100BB BB 3bet"] > 0) bbAction = "3bet";
  else if (actions["100BB BB call"] > 0) bbAction = "Call";
  
  let bbResponse = "Fold";
  if (actions["100BB BB 5bet"] > 0) bbResponse = "5bet";
  else if (actions["100BB BB Cv4bet"] > 0) bbResponse = "Call";
  
  return `
    <div class="actions">
      <div class="sb-action">SB: ${sbOpen}/${sbResponse}</div>
      <div class="bb-action">BB: ${bbAction}/${bbResponse}</div>
    </div>
  `;
}

// Debounce function to limit how often a function is called
function debounce(func, wait) {
  let timeout;
  return function() {
    const context = this;
    const args = arguments;
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      func.apply(context, args);
    }, wait);
  };
}
