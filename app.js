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

// Get colors for pattern - FIXED to handle paired ranks correctly
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
  
  // Initialize the result array and tracking of used suits
  const result = new Array(cards.length);
  const usedSuits = [];
  
  // Assign colors based on pattern, ensuring same ranks get different suits
  switch (pattern) {
    case 'mono':
      // For mono pattern, use different suits for cards with the same rank
      for (let i = 0; i < cards.length; i++) {
        const rank = cards[i];
        // Since mono would normally be all the same suit, we'll use 4 different suits for duplicates
        const suitOptions = ['club', 'heart', 'diamond', 'spade'];
        const suit = suitOptions[i % suitOptions.length];
        
        // Add to the rank-suit map
        if (!rankSuitMap.has(rank)) {
          rankSuitMap.set(rank, []);
        }
        rankSuitMap.get(rank).push(suit);
        
        result[i] = colors[suit];
        usedSuits.push(suit);
      }
      break;
      
    case 'double':
      // For double pattern, assign first two cards one suit, last two another suit
      // But ensure cards with same rank get different suits
      const firstSuit = 'club';
      const secondSuit = 'heart';
      
      for (let i = 0; i < cards.length; i++) {
        const rank = cards[i];
        let selectedSuit;
        
        if (i < 2) {
          // First two cards should have the same suit (unless same rank)
          if (cards[0] === cards[1] && i === 1) {
            // If first two cards are the same rank, use a different suit
            selectedSuit = 'diamond';
          } else {
            selectedSuit = firstSuit;
          }
        } else {
          // Last two cards should have the same suit (unless same rank)
          if (cards[2] === cards[3] && i === 3) {
            // If last two cards are the same rank, use a different suit
            selectedSuit = 'spade';
          } else {
            selectedSuit = secondSuit;
          }
        }
        
        // Add to the rank-suit map
        if (!rankSuitMap.has(rank)) {
          rankSuitMap.set(rank, []);
        }
        rankSuitMap.get(rank).push(selectedSuit);
        
        result[i] = colors[selectedSuit];
        usedSuits.push(selectedSuit);
      }
      break;
      
    case 'trip_high':
      // First 3 same suit, last card different
      for (let i = 0; i < cards.length; i++) {
        const rank = cards[i];
        let selectedSuit;
        
        if (i < 3) {
          // Check if this rank already appeared
          const sameRankIndices = cards.slice(0, i).map((r, idx) => r === rank ? idx : -1).filter(idx => idx !== -1);
          
          if (sameRankIndices.length > 0) {
            // This rank already appeared, use a different suit
            selectedSuit = getUniqueSuitForRank(rank, usedSuits);
          } else {
            selectedSuit = 'club';
          }
        } else {
          // Last card
          selectedSuit = 'heart';
          // If this rank appeared earlier, find a unique suit
          if (cards.slice(0, 3).includes(rank)) {
            selectedSuit = getUniqueSuitForRank(rank, usedSuits);
          }
        }
        
        // Add to the rank-suit map
        if (!rankSuitMap.has(rank)) {
          rankSuitMap.set(rank, []);
        }
        rankSuitMap.get(rank).push(selectedSuit);
        
        result[i] = colors[selectedSuit];
        usedSuits.push(selectedSuit);
      }
      break;
      
    case 'trip_low':
      // First card different, last 3 same suit
      for (let i = 0; i < cards.length; i++) {
        const rank = cards[i];
        let selectedSuit;
        
        if (i === 0) {
          selectedSuit = 'heart';
        } else {
          // Check if this rank already appeared
          const sameRankIndices = cards.slice(0, i).map((r, idx) => r === rank ? idx : -1).filter(idx => idx !== -1);
          
          if (sameRankIndices.length > 0) {
            // This rank already appeared, use a different suit
            selectedSuit = getUniqueSuitForRank(rank, usedSuits);
          } else {
            selectedSuit = 'club';
          }
        }
        
        // Add to the rank-suit map
        if (!rankSuitMap.has(rank)) {
          rankSuitMap.set(rank, []);
        }
        rankSuitMap.get(rank).push(selectedSuit);
        
        result[i] = colors[selectedSuit];
        usedSuits.push(selectedSuit);
      }
      break;
      
    case 'single_high':
      // First 2 same suit, last 2 different suits
      for (let i = 0; i < cards.length; i++) {
        const rank = cards[i];
        let selectedSuit;
        
        if (i < 2) {
          // Check if this rank already appeared
          if (i === 1 && cards[0] === cards[1]) {
            // Same rank, use a different suit
            selectedSuit = 'diamond';
          } else {
            selectedSuit = 'club';
          }
        } else if (i === 2) {
          selectedSuit = 'heart';
          // If this rank appeared earlier, find a unique suit
          if (cards.slice(0, 2).includes(rank)) {
            selectedSuit = getUniqueSuitForRank(rank, usedSuits);
          }
        } else { // i === 3
          selectedSuit = 'diamond';
          // If this rank appeared earlier, find a unique suit
          if (cards.slice(0, 3).includes(rank)) {
            selectedSuit = getUniqueSuitForRank(rank, usedSuits);
          }
        }
        
        // Add to the rank-suit map
        if (!rankSuitMap.has(rank)) {
          rankSuitMap.set(rank, []);
        }
        rankSuitMap.get(rank).push(selectedSuit);
        
        result[i] = colors[selectedSuit];
        usedSuits.push(selectedSuit);
      }
      break;
      
    case 'single_low':
      // First card one suit, middle 2 same suit, last card different suit
      for (let i = 0; i < cards.length; i++) {
        const rank = cards[i];
        let selectedSuit;
        
        if (i === 0) {
          selectedSuit = 'heart';
        } else if (i < 3) {
          // Check if this rank already appeared
          if ((i === 2 && cards[1] === cards[2]) || (i === 1 && cards[0] === cards[1])) {
            // Same rank, use a different suit
            selectedSuit = getUniqueSuitForRank(rank, usedSuits);
          } else {
            selectedSuit = 'club';
          }
        } else { // i === 3
          selectedSuit = 'diamond';
          // If this rank appeared earlier, find a unique suit
          if (cards.slice(0, 3).includes(rank)) {
            selectedSuit = getUniqueSuitForRank(rank, usedSuits);
          }
        }
        
        // Add to the rank-suit map
        if (!rankSuitMap.has(rank)) {
          rankSuitMap.set(rank, []);
        }
        rankSuitMap.get(rank).push(selectedSuit);
        
        result[i] = colors[selectedSuit];
        usedSuits.push(selectedSuit);
      }
      break;
      
    case 'rainbow':
      // All different suits
      const rainbowSuits = ['club', 'heart', 'diamond', 'spade'];
      for (let i = 0; i < cards.length; i++) {
        const rank = cards[i];
        
        // Add to the rank-suit map
        if (!rankSuitMap.has(rank)) {
          rankSuitMap.set(rank, []);
        }
        rankSuitMap.get(rank).push(rainbowSuits[i]);
        
        result[i] = colors[rainbowSuits[i]];
      }
      break;
      
    default:
      // Default to rainbow
      const defaultSuits = ['club', 'heart', 'diamond', 'spade'];
      for (let i = 0; i < cards.length; i++) {
        result[i] = colors[defaultSuits[i]];
      }
  }
  
  return result;
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
  
  // Use the actions-horizontal class for side-by-side display
  return `
    <div class="actions actions-horizontal">
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
