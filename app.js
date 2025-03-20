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
// Get colors for pattern with correct card constraints
function getColorsForPattern(pattern, cards) {
  // Color mapping (with better contrast for dark mode)
  const colors = {
    club: '#6FBD66',    // Green (g)
    heart: '#FF6B70',   // Red (r)
    diamond: '#5B9FF7', // Blue (b)
    spade: '#FFD866',   // Yellow (y)
    error: '#FF00FF'    // Pink (for errors)
  };
  
  // Determine the rank pattern (ABCD, AABC, etc.)
  const rankPattern = determineRankPattern(cards);
  
  // Define color patterns for each combination (g=green, r=red, b=blue, y=yellow)
  const colorPatterns = {
    'ABCD': {
      'double': 'grgr',
      'single_high': 'ggrb',
      'single_low': 'grbb',
      'trip_high': 'gggr',
      'trip_low': 'grrr',
      'mono': 'yyyy',
      'rainbow': 'grby'
    },
    'AABB': {
      'double': 'grgr',
      'single_high': 'grgb',
      'single_low': 'error',
      'trip_high': 'error',
      'trip_low': 'error',
      'mono': 'error',
      'rainbow': 'grby'
    },
    'AABC': {
      'double': 'grgr',
      'single_high': 'grgb',
      'single_low': 'grbb',
      'trip_high': 'rggg',
      'trip_low': 'error',
      'mono': 'error',
      'rainbow': 'grby'
    },
    'ABBC': {
      'double': 'grgr',
      'single_high': 'ggrb',
      'single_low': 'grbb',
      'trip_high': 'grgg',
      'trip_low': 'error',
      'mono': 'error',
      'rainbow': 'grby'
    },
    'ABCC': {
      'double': 'grgr',
      'single_high': 'ggrb',
      'single_low': 'grrb',
      'trip_high': 'gggr',
      'trip_low': 'error',
      'mono': 'error',
      'rainbow': 'grby'
    },
    'AAAB': {
      'double': 'error',
      'single_high': 'grbg',
      'single_low': 'error',
      'trip_high': 'error',
      'trip_low': 'error',
      'mono': 'error',
      'rainbow': 'grby'
    },
    'ABBB': {
      'double': 'error',
      'single_high': 'grbg',
      'single_low': 'error',
      'trip_high': 'error',
      'trip_low': 'error',
      'mono': 'error',
      'rainbow': 'grby'
    },
    'AAAA': {
      'double': 'error',
      'single_high': 'error',
      'single_low': 'error',
      'trip_high': 'error',
      'trip_low': 'error',
      'mono': 'error',
      'rainbow': 'grby'
    }
  };
  
  // Get the color pattern for this combination
  const colorPattern = colorPatterns[rankPattern]?.[pattern];
  
  // If it's an error pattern or undefined, return all error colors
  if (colorPattern === 'error' || !colorPattern) {
    return Array(cards.length).fill(colors.error);
  }
  
  // Map color codes to actual colors
  const colorMap = {
    'g': colors.club,    // Green
    'r': colors.heart,   // Red
    'b': colors.diamond, // Blue
    'y': colors.spade    // Yellow
  };
  
  // Create the result array with the appropriate colors
  return colorPattern.split('').map(colorCode => colorMap[colorCode]);
}

// Helper function to determine the rank pattern
function determineRankPattern(cards) {
  // Define rank value mapping for comparison
  const rankValues = {
    '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, 
    'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
  };
  
  // If some ranks aren't in our mapping (like 't' lowercase), convert to uppercase
  const normalizedCards = cards.map(card => card.toUpperCase());
  
  // Sort cards by rank in descending order (A is highest)
  const sortedCards = [...normalizedCards].sort((a, b) => rankValues[b] - rankValues[a]);
  
  // Count occurrences of each rank after sorting
  const rankCounts = {};
  for (const rank of sortedCards) {
    rankCounts[rank] = (rankCounts[rank] || 0) + 1;
  }
  
  // Get unique ranks in sorted order
  const uniqueRanks = [];
  for (const rank of sortedCards) {
    if (!uniqueRanks.includes(rank)) {
      uniqueRanks.push(rank);
    }
  }
  
  // Create pattern string
  let patternString = '';
  for (const rank of sortedCards) {
    patternString += String.fromCharCode(65 + uniqueRanks.indexOf(rank));
  }
  
  // At this point patternString could be something like 'AABC', 'ABBC', etc.
  
  // AAAA: All four cards are the same rank
  if (patternString === 'AAAA') {
    return 'AAAA';
  }
  // AAAB: Three cards of the same rank (highest) and one different
  else if (patternString === 'AAAB') {
    return 'AAAB';
  }
  // ABBB: One card of a rank (highest) and three of another rank
  else if (patternString === 'ABBB') {
    return 'ABBB';
  }
  // AABB: Two pairs of the same rank
  else if (patternString === 'AABB') {
    return 'AABB'; // Now correctly handled as its own pattern
  }
  // AABC: Two highest cards of the same rank, the other two different
  else if (patternString === 'AABC') {
    return 'AABC';
  }
  // ABBC: Two middle cards of the same rank, the other two different
  else if (patternString === 'ABBC') {
    return 'ABBC';
  }
  // ABCC: Two lowest cards of the same rank, the other two different
  else if (patternString === 'ABCC') {
    return 'ABCC';
  }
  // ABCD: All four cards of different ranks
  else {
    return 'ABCD';
  }
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
