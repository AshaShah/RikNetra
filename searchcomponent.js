class RigvedaSearch {
  constructor({ searchBox, searchButton, clearSearch, databaseSelect, resultsContainer, resultsList }) {
    this.searchBox = searchBox;
    this.searchButton = searchButton;
    this.clearSearch = clearSearch;
    this.databaseSelect = databaseSelect;
    this.resultsContainer = resultsContainer;
    this.resultsList = resultsList;
    this.currentData = null;
    this.nodeWeights = {};

    // Initialize event listeners
    this.setupEventListeners();
    this.loadDatabase(this.databaseSelect.value);
  }

// Helper Methods (defined first)
getTextPreview(text, searchTerm) {
  const index = text.toLowerCase().indexOf(searchTerm);
  if (index === -1) return text.slice(0, 50) + (text.length > 50 ? "..." : "");
  
  const start = Math.max(0, index - 20);
  const end = Math.min(text.length, index + searchTerm.length + 30);
  return (start > 0 ? "..." : "") + text.slice(start, end) + (end < text.length ? "..." : "");
}

  setupEventListeners() {
    // Search interactions
    this.searchBox.addEventListener('input', () => this.onSearchInput());
    this.searchBox.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.performSearch();
      }
    });
    this.searchButton.addEventListener('click', () => this.performSearch());

    // Clear button
    this.clearSearch.addEventListener('click', (e) => {
      e.stopPropagation();
      this.clearSearchBox();
    });

    // Database selection
    this.databaseSelect.addEventListener('change', () => {
      this.loadDatabase(this.databaseSelect.value);
    });

    // Click outside to close results
    document.addEventListener('click', (e) => {
      if (!this.isSearchElement(e.target)) {
        this.closeResults();
      }
    }, true); // Use capture phase for reliable detection
  }

  isSearchElement(target) {
    return this.searchBox.contains(target) ||
           this.searchButton.contains(target) ||
           this.clearSearch.contains(target) ||
           this.resultsContainer.contains(target) ||
           this.databaseSelect.contains(target);
  }

  closeResults() {
    this.resultsContainer.style.display = 'none';
  }

  async loadDatabase(url) {
      try {
        const response = await fetch(url);
        const data = await response.json();
        this.currentData = data;
        console.log("Loaded database:", url);

        this.calculateWeights();
        console.log("Node weights:", this.nodeWeights);
      } catch (error) {
        console.error("Error loading database:", error);
      }
  }

  calculateWeights() {
    const edges = this.currentData.edges || [];
    this.nodeWeights = {};

    // Sum weights for each target node
    edges.forEach(edge => {
      if (!this.nodeWeights[edge.target]) {
        this.nodeWeights[edge.target] = 0;
      }
      this.nodeWeights[edge.target] += edge.weight;
    });
  }

  onSearchInput() {
    const hasValue = this.searchBox.value.trim().length > 0;
    this.clearSearch.style.display = hasValue ? 'inline' : 'none';
    if (!hasValue) this.closeResults();
  }

  clearSearchBox() {
    this.searchBox.value = '';
    this.clearSearch.style.display = 'none';
    this.closeResults();
  }

  performSearch() {
    const searchTerm = this.searchBox.value.trim().toLowerCase();
    if (!searchTerm || !this.currentData) {
      this.closeResults();
      return;
    }

    // Run all three algorithms
    const hybridResults = this.hybridSearch(searchTerm);
    const tfidfResults = this.tfidfSearch(searchTerm);
    const bm25Results = this.bm25Search(searchTerm);

    // Display comparison
    this.showAlgorithmComparison({
      "Hybrid (Current)": hybridResults,
      "TF-IDF": tfidfResults,
      "BM25": bm25Results
    }, searchTerm);
  }

  hybridSearch(searchTerm) {
    // First create the basic matching nodes array
    const matchingNodes = this.currentData.nodes
      .filter(node => node.text?.toLowerCase().includes(searchTerm))
      .map(node => ({
        ...node,
        frequency: (node.text.toLowerCase().match(new RegExp(searchTerm, 'g')) || []).length,
        preview: this.getTextPreview(node.text, searchTerm)
      }));
  
    // Now calculate connections and scores
    const nodesWithScores = matchingNodes.map(node => {
      const connections = this.currentData.edges.filter(edge => 
        (edge.source === node.id && matchingNodes.some(n => n.id === edge.target)) ||
        (edge.target === node.id && matchingNodes.some(n => n.id === edge.source))
      );
      
      const minWeight = connections.length > 0 ? 
        Math.min(...connections.map(c => c.weight)) : 
        Infinity;
      
      return {
        ...node,
        algorithm: 'Hybrid',
        score: (node.frequency * 100) + (1/minWeight * 10),
        minWeight
      };
    });
  
    return nodesWithScores.sort((a, b) => b.score - a.score);
  }

  tfidfSearch(searchTerm) {
    const nodes = this.currentData.nodes;
    const N = nodes.length;
    const df = nodes.filter(n => n.text.toLowerCase().includes(searchTerm)).length;
    const idf = Math.log(N / (df + 1));

    return nodes
      .filter(node => node.text.toLowerCase().includes(searchTerm))
      .map(node => {
        const frequency = (node.text.toLowerCase().match(new RegExp(searchTerm, 'g')) || []).length;
        const tf = frequency;
        return {
          ...node,
          algorithm: 'TF-IDF',
          score: tf * idf,
          frequency,
          preview: this.getTextPreview(node.text, searchTerm)
        };
      })
      .sort((a, b) => b.score - a.score);
  }

  bm25Search(searchTerm, k1 = 1.2, b = 0.75) {
    const nodes = this.currentData.nodes;
    const N = nodes.length;
    const df = nodes.filter(n => n.text.toLowerCase().includes(searchTerm)).length;
    const idf = Math.log((N - df + 0.5) / (df + 0.5) + 1);
    const avgLength = nodes.reduce((sum, n) => sum + n.text.length, 0) / N;

    return nodes
      .filter(node => node.text.toLowerCase().includes(searchTerm))
      .map(node => {
        const frequency = (node.text.toLowerCase().match(new RegExp(searchTerm, 'g')) || []).length;
        const tf = frequency;
        const lengthRatio = node.text.length / avgLength;
        const score = idf * (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * lengthRatio));
        
        return {
          ...node,
          algorithm: 'BM25',
          score,
          frequency,
          preview: this.getTextPreview(node.text, searchTerm)
        };
      })
      .sort((a, b) => b.score - a.score);
  }

  showAlgorithmComparison(resultsByAlgorithm, searchTerm) {
    // Create comparison columns
    this.resultsList.innerHTML = `
      <div class="algorithm-comparison">
        ${Object.entries(resultsByAlgorithm).map(([algorithmName, results]) => `
          <div class="algorithm-column">
            <h3>${algorithmName}</h3>
            <ol>
              ${results.slice(0, 10).map(node => `
                <li>
                  <a href="chapter.html?chapterId=${encodeURIComponent(node.id)}&chapterName=${encodeURIComponent(node.name)}&database=${encodeURIComponent(this.databaseSelect.value)}">
                    <strong>${node.name}</strong>
                    <small>Score: ${node.score.toFixed(2)}</small>
                    ${node.minWeight !== undefined ? `<small>Dist: ${node.minWeight === Infinity ? 'N/A' : node.minWeight}</small>` : ''}
                    <small>Matches: ${node.frequency}</small>
                    <p>${node.preview.replace(new RegExp(`(${searchTerm})`, 'gi'), '<mark>$1</mark>')}</p>
                  </a>
                </li>
              `).join('')}
            </ol>
          </div>
        `).join('')}
      </div>
    `;
    
    this.resultsContainer.style.display = 'block';
  }
}