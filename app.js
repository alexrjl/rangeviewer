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
  // Using the correct pattern mapping from: pattern_map = { 'mono': 1, 'trip_high': 2, 'trip_low': 3, 'double': 4, 'single_high': 5, 'single_low': 6, 'rainbow': 7 }
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
  const cardColors = getColorsForPattern(patternType, cards);
  
  // Create the card elements with the small-card class
  const cardElements = cards.map((rank, index) => 
    `<div class="card small-card" style="background-color: ${cardColors[index]}">
       ${rank.toUpperCase()}
     </div>`
  ).join('');
  
  return `<div class="hand-visualization">${cardElements}</div>`;
}

// Get colors for pattern
function getColorsForPattern(pattern, cards) {
  // Color mapping (with better contrast for dark mode)
  const colors = {
    club: '#6FBD66',    // Green
    heart: '#FF6B70',   // Red
    diamond: '#5B9FF7', // Blue
    spade: '#FFD866'    // Yellow
  };
  
  // Detect impossible cases early
  const rankCounts = {};
  for (const rank of cards) {
    rankCounts[rank] = (rankCounts[rank] || 0) + 1;
  }
  
  // Check for impossible cases
  if (pattern === 'mono') {
    // Mono pattern with any duplicate ranks cannot be resolved
    for (const [rank, count] of Object.entries(rankCounts)) {
      if (count > 1) {
        throw new Error(`Cannot resolve mono pattern with duplicate rank: ${rank}`);
      }
    }
  }
  
  // Check for triple of the same rank in trip patterns
  if ((pattern === 'trip_high' || pattern === 'trip_low')) {
    for (const [rank, count] of Object.entries(rankCounts)) {
      if (count >= 3) {
        throw new Error(`Cannot resolve ${pattern} pattern with triple of rank: ${rank}`);
      }
    }
  }
  
  // Special case for double pattern with AABB structure (paired double suited)
  if (pattern === 'double' && 
      cards.length === 4 && 
      cards[0] === cards[1] && 
      cards[2] === cards[3] && 
      cards[0] !== cards[2]) {
    // AABB gets alternating colors: green, red, green, red
    return [colors.club, colors.heart, colors.club, colors.heart];
  }
  
  // Define the ideal suits for each pattern
  let idealSuits;
  switch (pattern) {
    case 'mono':
      idealSuits = ['club', 'club', 'club', 'club'];
      break;
    case 'double':
      idealSuits = ['club', 'club', 'heart', 'heart'];
      break;
    case 'trip_high':
      idealSuits = ['club', 'club', 'club', 'heart'];
      break;
    case 'trip_low':
      idealSuits = ['heart', 'club', 'club', 'club'];
      break;
    case 'single_high':
      idealSuits = ['club', 'club', 'heart', 'diamond'];
      break;
    case 'single_low':
      idealSuits = ['heart', 'club', 'club', 'diamond'];
      break;
    case 'rainbow':
      idealSuits = ['club', 'heart', 'diamond', 'spade'];
      break;
    default:
      idealSuits = ['club', 'heart', 'diamond', 'spade'];
  }
  
  // Copy the ideal suits - we'll modify this
  const assignedSuits = [...idealSuits];
  
  // Find conflicts (same rank getting same suit)
  const rankSuitMap = new Map(); // Maps rank to the suits already assigned
  const conflicts = [];
  
  for (let i = 0; i < cards.length; i++) {
    const rank = cards[i];
    const suit = assignedSuits[i];
    
    if (!rankSuitMap.has(rank)) {
      rankSuitMap.set(rank, []);
    }
    
    // Check if this rank already has this suit assigned
    if (rankSuitMap.get(rank).includes(suit)) {
      conflicts.push(i); // Store the position of the conflict
    } else {
      rankSuitMap.get(rank).push(suit);
    }
  }
  
  // Resolve conflicts by swapping
  for (const conflictPos of conflicts) {
    const rank = cards[conflictPos];
    const currentSuit = assignedSuits[conflictPos];
    const usedSuits = rankSuitMap.get(rank);
    
    // Try to swap with a later position
    let swapped = false;
    
    // First, try to swap with a position that has the same suit type
    // This helps preserve the pattern structure (e.g., keeping 3 clubs in trip patterns)
    for (let i = conflictPos + 1; i < cards.length; i++) {
      const laterRank = cards[i];
      const laterSuit = assignedSuits[i];
      
      // Skip if same rank
      if (laterRank === rank) continue;
      
      // Skip if this would create a new conflict
      if (rankSuitMap.get(laterRank)?.includes(currentSuit)) continue;
      
      // Skip if the conflicting rank already has the later suit
      if (usedSuits.includes(laterSuit)) continue;
      
      // Perform the swap
      [assignedSuits[conflictPos], assignedSuits[i]] = [assignedSuits[i], assignedSuits[conflictPos]];
      
      // Update rank-suit mappings
      rankSuitMap.get(rank).push(assignedSuits[conflictPos]);
      if (!rankSuitMap.has(laterRank)) {
        rankSuitMap.set(laterRank, []);
      }
      rankSuitMap.get(laterRank).push(currentSuit);
      
      swapped = true;
      break;
    }
    
    // If no swap was possible, this is an impossible case
    if (!swapped) {
      throw new Error(`Cannot resolve suit conflicts for ${pattern} pattern with current rank distribution`);
    }
  }
  
  // Convert suits to colors
  const result = assignedSuits.map(suit => colors[suit]);
  
  // Final verification
  const finalMap = new Map();
  for (let i = 0; i < cards.length; i++) {
    const rank = cards[i];
    const color = result[i];
    
    if (!finalMap.has(rank)) {
      finalMap.set(rank, new Set());
    }
    
    if (finalMap.get(rank).has(color)) {
      throw new Error(`Verification failed: Duplicate color ${color} for rank ${rank}`);
    }
    
    finalMap.get(rank).add(color);
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
  const sbOpenPct = actions["100BB SB open"] || 0;
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
  const sb4betPct = actions["100BB SB 4bet"] || 0;
  const sbCallPct = actions["100BB SB Cv3bet"] || 0;
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
  const bb3betPct = actions["100BB BB 3bet"] || 0;
  const bbCallPct = actions["100BB BB call"] || 0;
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
  const bb5betPct = actions["100BB BB 5bet"] || 0;
  const bbCv4betPct = actions["100BB BB Cv4bet"] || 0;
  const bbFv4betPct = actions["100BB BB Fv4bet"] || 0;
  
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
