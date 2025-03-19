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
  // Apply dark mode by default
  document.body.classList.add('dark-mode');
  
  // Create theme toggle button
  createThemeToggle();
  
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

// Create theme toggle button
function createThemeToggle() {
  const toggleButton = document.createElement('button');
  toggleButton.className = 'theme-toggle';
  toggleButton.innerHTML = '🌓';
  toggleButton.setAttribute('aria-label', 'Toggle dark mode');
  toggleButton.setAttribute('title', 'Toggle dark mode');
  
  toggleButton.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
  });
  
  document.body.appendChild(toggleButton);
}

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
    
    // Define the order of patterns using the numeric IDs from the JSON data
    // Based on the provided mapping: pattern_map = { 'mono': 1, 'trip_high': 2, 'trip_low': 3, 'double': 4, 'single_high': 5, 'single_low': 6, 'rainbow': 7 }
    // But we want to maintain the original display order preference
    const patternOrder = {
      '4': 1, // double (first)
      '5': 2, // single_high (second)
      '6': 3, // single_low (third)
      '2': 4, // trip_high (fourth) 
      '3': 5, // trip_low (fifth)
      '1': 6, // mono (sixth)
      '7': 7  // rainbow (last)
    };
    
    // Convert to array and sort by custom order
    const sortedPatterns = Object.entries(patterns)
      .sort((a, b) => {
        const orderA = patternOrder[a[0]] || 999;
        const orderB = patternOrder[b[0]] || 999;
        return orderA - orderB;
      });
    
    // Create elements for each suitedness pattern
    sortedPatterns.forEach(([patternId, actions]) => {
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
  // Convert the numeric patternId to the corresponding pattern type
  const patternTypes = {
    '1': 'mono',
    '2': 'trip_high',
    '3': 'trip_low',
    '4': 'double',
    '5': 'single_high',
    '6': 'single_low',
    '7': 'rainbow'
  };
  
  const patternType = patternTypes[patternId] || 'rainbow'; // Default to rainbow if unknown
  const cards = rankCombo.split('');
  
  // Define card colors based on the suitedness pattern
  try {
    const cardColors = getColorsForPattern(patternType, cards);
    
    // Create the card elements with the small-card class
    const cardElements = cards.map((rank, index) => 
      `<div class="card small-card" style="background-color: ${cardColors[index]}">
         ${rank.toUpperCase()}
       </div>`
    ).join('');
    
    return `<div class="hand-visualization">${cardElements}</div>`;
  } catch (error) {
    console.error(`Error rendering ${rankCombo} with pattern ${patternType}:`, error.message);
    
    // ERROR INDICATOR: Bright pink cards with error message
    const errorColor = '#FF00FF'; // Bright pink
    
    // Create the card elements with error color
    const cardElements = cards.map((rank) => 
      `<div class="card small-card" style="background-color: ${errorColor}; border: 2px dashed red;">
         ${rank.toUpperCase()}
       </div>`
    ).join('');
    
    // Add the error message below the cards
    return `
      <div class="hand-visualization-error">
        <div class="hand-visualization">${cardElements}</div>
        <div class="pattern-error-message" style="color: red; font-size: 12px; margin-top: 5px;">
          Error with pattern: ${patternType}
        </div>
      </div>
    `;
  }
}
// Get colors for pattern with correct card constraints
function getColorsForPattern(pattern, cards) {
  // Color mapping (with better contrast for dark mode)
  const colors = {
    club: '#6FBD66',    // Green
    heart: '#FF6B70',   // Red
    diamond: '#5B9FF7', // Blue
    spade: '#FFD866'    // Yellow
  };
  
  // Define suit order for each pattern (cards displayed high to low)
  const suitOrders = {
    'mono': ['club', 'club', 'club', 'club'],          // All same suit
    'double': ['club', 'club', 'heart', 'heart'],      // Two high cards same suit, two low cards same suit
    'trip_high': ['club', 'club', 'club', 'heart'],    // Three high cards same suit, low card different
    'trip_low': ['heart', 'club', 'club', 'club'],     // High card different, three low cards same suit
    'single_high': ['club', 'club', 'heart', 'diamond'], // Highest card and one other same suit
    'single_low': ['heart', 'diamond', 'club', 'club'], // Two lowest cards same suit
    'rainbow': ['club', 'heart', 'diamond', 'spade']   // All different suits
  };
  
  // Get the appropriate suit order for this pattern
  const suitOrder = suitOrders[pattern] || suitOrders['rainbow'];
  
  // Count frequencies to identify pairs, trips, etc.
  const rankCounts = {};
  for (const rank of cards) {
    rankCounts[rank] = (rankCounts[rank] || 0) + 1;
  }
  
  // We need to respect the constraint that cards with the same rank must have different suits
  // Create a map from rank to the suits assigned
  const rankToSuits = {};
  
  // Create a result array with the right length
  const result = new Array(cards.length);
  
  // First, handle unpaired cards (which have more flexibility)
  for (let i = 0; i < cards.length; i++) {
    const rank = cards[i];
    // Skip paired cards for now
    if (rankCounts[rank] > 1) continue;
    
    // This is a single card (not paired) - assign the suit from suitOrder
    const suit = suitOrder[i];
    result[i] = colors[suit];
    
    // Record that we've used this suit for this rank
    if (!rankToSuits[rank]) rankToSuits[rank] = [];
    rankToSuits[rank].push(suit);
  }
  
  // Now handle paired cards - these need different suits
  // Group card positions by rank
  const positionsByRank = {};
  for (let i = 0; i < cards.length; i++) {
    const rank = cards[i];
    if (rankCounts[rank] > 1) {
      if (!positionsByRank[rank]) positionsByRank[rank] = [];
      positionsByRank[rank].push(i);
    }
  }
  
  // Assign suits to paired ranks
  for (const [rank, positions] of Object.entries(positionsByRank)) {
    // For each paired rank, assign different suits
    const availableSuits = ['club', 'heart', 'diamond', 'spade']
      .filter(suit => !rankToSuits[rank] || !rankToSuits[rank].includes(suit));
    
    if (availableSuits.length < positions.length) {
      throw new Error(`Not enough suits available for rank ${rank}`);
    }
    
    // Assign each position a different suit
    for (let i = 0; i < positions.length; i++) {
      const pos = positions[i];
      result[pos] = colors[availableSuits[i]];
      
      // Record that we've used this suit for this rank
      if (!rankToSuits[rank]) rankToSuits[rank] = [];
      rankToSuits[rank].push(availableSuits[i]);
    }
  }
  
  // Make sure we've assigned a color to every position
  for (let i = 0; i < cards.length; i++) {
    if (!result[i]) {
      throw new Error(`Failed to assign color to position ${i}`);
    }
  }
  
  return result;
}
// Render actions with mixed strategy support
function renderActions(actions) {
  // Safely handle potentially missing actions
  if (!actions) {
    return `<div class="actions"><div class="no-actions">No action data available</div></div>`;
  }
  
  // Process SB open action (first action)
  const sbOpenPct = actions["SB open"] || 0;
  let sbOpen = "Fold";
  if (sbOpenPct > 0) {
    sbOpen = "Raise";
    // Show percentage only if it's less than 99%
    if (sbOpenPct < 99 && sbOpenPct > 0) {
      sbOpen = `Raise[${Math.round(sbOpenPct)}%]`;
    }
  }
  
  // Process SB response to 3bet (second action)
  let sbResponse = "Fold";
  const sb4betPct = actions["SB 4bet"] || 0;
  const sbCallPct = actions["SB Cv3bet"] || 0;
  const sbFoldVs3betPct = 100 - sb4betPct - sbCallPct;
  
  // Add actions that exceed 5% threshold
  const sbResponseActions = [];
  if (sb4betPct >= 5) {
    // Skip percentage if it's ≥99%
    if (sb4betPct >= 99) sbResponseActions.push("4bet");
    else sbResponseActions.push(`4bet[${Math.round(sb4betPct)}%]`);
  }
  if (sbCallPct >= 5) {
    // Skip percentage if it's ≥99%
    if (sbCallPct >= 99) sbResponseActions.push("call");
    else sbResponseActions.push(`call[${Math.round(sbCallPct)}%]`);
  }
  if (sbFoldVs3betPct >= 5) {
    // Skip percentage if it's ≥99%
    if (sbFoldVs3betPct >= 99) sbResponseActions.push("fold");
    else sbResponseActions.push(`fold[${Math.round(sbFoldVs3betPct)}%]`);
  }
  
  // If we have mixed second actions, join them with slashes
  if (sbResponseActions.length > 1) {
    sbResponse = sbResponseActions.join('/');
  } 
  // If only one action exceeds 5%, use that
  else if (sbResponseActions.length === 1) {
    sbResponse = sbResponseActions[0];
  }
  
  // Process BB first action vs open
  let bbAction = "Fold";
  const bb3betPct = actions["BB 3bet"] || 0;
  const bbCallPct = actions["BB call"] || 0;
  const bbFoldPct = 100 - bb3betPct - bbCallPct;
  
  // For BB first action, show the majority action with percentage if mixed
  if (bb3betPct > bbCallPct && bb3betPct > bbFoldPct) {
    bbAction = bb3betPct < 99 ? `3bet[${Math.round(bb3betPct)}%]` : "3bet";
  } else if (bbCallPct > bb3betPct && bbCallPct > bbFoldPct) {
    bbAction = bbCallPct < 99 ? `call[${Math.round(bbCallPct)}%]` : "call";
  } else if (bbFoldPct > bb3betPct && bbFoldPct > bbCallPct) {
    bbAction = bbFoldPct < 99 ? `fold[${Math.round(bbFoldPct)}%]` : "fold";
  } 
  // Handle exact ties by showing both
  else if (bb3betPct === bbCallPct && bb3betPct > bbFoldPct) {
    bbAction = `3bet[${Math.round(bb3betPct)}%]/call[${Math.round(bbCallPct)}%]`;
  } else if (bb3betPct === bbFoldPct && bb3betPct > bbCallPct) {
    bbAction = `3bet[${Math.round(bb3betPct)}%]/fold[${Math.round(bbFoldPct)}%]`;
  } else if (bbCallPct === bbFoldPct && bbCallPct > bb3betPct) {
    bbAction = `call[${Math.round(bbCallPct)}%]/fold[${Math.round(bbFoldPct)}%]`;
  }
  // Perfect three-way tie (very unlikely)
  else if (bb3betPct === bbCallPct && bb3betPct === bbFoldPct) {
    bbAction = `3bet[${Math.round(bb3betPct)}%]/call[${Math.round(bbCallPct)}%]/fold[${Math.round(bbFoldPct)}%]`;
  }
  
  // Process BB response to 4bet (second action)
  let bbResponse = "Fold";
  const bb5betPct = actions["BB 5bet"] || 0;
  const bbCv4betPct = actions["BB Cv4bet"] || 0;
  const bbFv4betPct = actions["BB Fv4bet"] || 0;
  
  // Add actions that exceed 5% threshold
  const bbResponseActions = [];
  if (bb5betPct >= 5) {
    // Skip percentage if it's ≥99%
    if (bb5betPct >= 99) bbResponseActions.push("5bet");
    else bbResponseActions.push(`5bet[${Math.round(bb5betPct)}%]`);
  }
  if (bbCv4betPct >= 5) {
    // Skip percentage if it's ≥99%
    if (bbCv4betPct >= 99) bbResponseActions.push("call");
    else bbResponseActions.push(`call[${Math.round(bbCv4betPct)}%]`);
  }
  if (bbFv4betPct >= 5) {
    // Skip percentage if it's ≥99%
    if (bbFv4betPct >= 99) bbResponseActions.push("fold");
    else bbResponseActions.push(`fold[${Math.round(bbFv4betPct)}%]`);
  }
  
  // If we have mixed second actions, join them with slashes
  if (bbResponseActions.length > 1) {
    bbResponse = bbResponseActions.join('/');
  } 
  // If only one action exceeds 5%, use that
  else if (bbResponseActions.length === 1) {
    bbResponse = bbResponseActions[0];
  }
  
  // Return the formatted actions with pipe separator
  return `
    <div class="actions actions-horizontal">
      <div class="sb-action">SB: ${sbOpen} | ${sbResponse}</div>
      <div class="bb-action">BB: ${bbAction} | ${bbResponse}</div>
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
