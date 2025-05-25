// Create summary popup element on load
document.addEventListener('DOMContentLoaded', function() {
  const summaryPopup = document.createElement('div');
  summaryPopup.id = 'summary-popup';
  summaryPopup.className = 'summary-popup';
  summaryPopup.style.display = 'none';
  summaryPopup.innerHTML = `
    <span class="close-summary">&times;</span>
    <div class="summary-content"></div>
  `;
  document.body.appendChild(summaryPopup);
});

// Store dark mode state
let isDarkMode = document.body.classList.contains('dark-mode');

// Function to update summary popup colors based on dark mode
function updateSummaryColors() {
  const summaryPopup = document.getElementById('summary-popup');
  if (!summaryPopup) return;
  
  // Just toggle the class - let CSS handle the styling
  if (isDarkMode) {
    summaryPopup.classList.add('dark-mode');
  } else {
    summaryPopup.classList.remove('dark-mode');
  }
}

// Listen for dark mode changes
document.addEventListener('darkModeChanged', (e) => {
  isDarkMode = e.detail.isDarkMode;
  updateSummaryColors();
});

// Initialize dark mode from localStorage if available
if (localStorage.getItem('darkMode')) {
  isDarkMode = localStorage.getItem('darkMode') === 'true';
  updateSummaryColors();
}

// Add close event listener
function setupSummaryCloseListener() {
  const closeBtn = document.querySelector('.close-summary');
  if (closeBtn) {
    closeBtn.addEventListener('click', function() {
      document.getElementById('summary-popup').style.display = 'none';
    });
  }
}

// Function to summarize the texts with Vedic context awareness
function summarizeTexts(texts, selectedNodeName, maxLines = 2) {
  if (!texts || texts.length === 0) return "No summary available";

  // Enhanced stop words for Vedic context
  const stopWords = new Set([
    'the', 'and', 'with', 'their', 'this', 'that', 'for', 'are', 'has', 'have',
    'वै', 'च', 'हि', 'तु', 'एव', 'इति', 'न', 'वा', 'यद्', 'किम्', 'अथ', 'स्म'
  ]);

  // Vedic-specific important terms to prioritize
  const vedicTerms = new Set([
    'agni', 'indra', 'soma', 'varuna', 'ushas', 'vayu', 'surya',
    'ऋषि', 'देव', 'यज्ञ', 'मंत्र', 'ब्रह्म', 'ऋक्', 'साम'
  ]);

  // Process texts while preserving some structure
  const processedTexts = texts.map(text => {
    return text.toLowerCase()
      .replace(/[॥।]/g, '')
      .replace(/[^\w\sअ-ह']/g, ' ');
  });

  // Extract meaningful phrases with Vedic awareness
  const phrases = [];
  processedTexts.forEach(text => {
    const words = text.match(/[अ-हa-z']+/g) || [];

    for (let i = 0; i < words.length - 1; i++) {
      if (!stopWords.has(words[i])) {
        const isVedicPhrase = vedicTerms.has(words[i]) || vedicTerms.has(words[i + 1]);

        if (!stopWords.has(words[i + 1])) {
          const phrase = words[i] + ' ' + words[i + 1];
          if (isVedicPhrase) phrases.unshift(phrase);
          else phrases.push(phrase);
        }

        if (i < words.length - 2 && !stopWords.has(words[i + 2])) {
          const threeWordVedic = vedicTerms.has(words[i]) ||
            vedicTerms.has(words[i + 1]) ||
            vedicTerms.has(words[i + 2]);
          if (threeWordVedic) {
            phrases.unshift(words[i] + ' ' + words[i + 1] + ' ' + words[i + 2]);
          }
        }
      }
    }
  });

  // Count and weight phrases
  const phraseWeights = {};
  phrases.forEach(phrase => {
    const weight = phrase.split(' ').some(word => vedicTerms.has(word)) ? 2 : 1;
    phraseWeights[phrase] = (phraseWeights[phrase] || 0) + weight;
  });

  // Get top phrases
  const topPhrases = Object.entries(phraseWeights)
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, 3)
    .map(([phrase]) => {
      return phrase.split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    });

  if (topPhrases.length > 0) {
    const mainSubject = selectedNodeName || "These verses";
    const summaryParts = [
      `${mainSubject} focus on:`,
      `• ${topPhrases[0]}`,
      topPhrases[1] ? `• ${topPhrases[1]}` : "",
      topPhrases[2] ? `• ${topPhrases[2]}` : ""
    ].filter(Boolean).join("<br>");

    return `${summaryParts}<br>Showing interconnected Vedic wisdom.`;
  }

  return `${selectedNodeName || "These verses"} share profound Vedic knowledge.`;
}

// Function to display summary (make this globally available)
window.displaySummary = function(node, connectedNodes) {
  const connectedTexts = connectedNodes.map(n => n.text || n.description || "").filter(t => t);
  const summary = summarizeTexts(connectedTexts, node.name);
  
  const summaryPopup = document.getElementById('summary-popup');
  const summaryContent = summaryPopup.querySelector('.summary-content');
  
  summaryContent.innerHTML = `
    <div class="summary-header">${node.name} Connections</div>
    <div class="summary-body">${summary}</div>
  `;
  
  if (!summaryPopup.dataset.listenerAdded) {
    setupSummaryCloseListener();
    summaryPopup.dataset.listenerAdded = 'true';
  }
  
  updateSummaryColors();
  summaryPopup.style.display = 'block';
};