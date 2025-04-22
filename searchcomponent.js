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

    // 1. Find matching nodes
    const matchingNodes = this.currentData.nodes
      .filter(node => node.text?.toLowerCase().includes(searchTerm))
      .map(node => ({
        ...node,
        frequency: (node.text.toLowerCase().match(new RegExp(searchTerm, 'g')) || []).length,
        preview: this.getTextPreview(node.text, searchTerm)
      }));

    if (matchingNodes.length === 0) {
      this.showSearchResults([], searchTerm);
      return;
    }

    // 2. Calculate connection weights (distance-based scoring)
    matchingNodes.forEach(node => {
      // Find all connections to OTHER matching nodes
      const connections = this.currentData.edges.filter(edge => 
        (edge.source === node.id && matchingNodes.some(n => n.id === edge.target)) ||
        (edge.target === node.id && matchingNodes.some(n => n.id === edge.source))
      );

      // Use the SMALLEST weight (closest distance) as primary score
      node.minWeight = connections.length > 0 
        ? Math.min(...connections.map(c => c.weight)) 
        : Infinity; // No connections = lowest priority
    });

    // 3. Sort by: closest first (minWeight), then by frequency
    matchingNodes.sort((a, b) => 
      a.minWeight - b.minWeight || // Primary: distance (ascending)
      b.frequency - a.frequency     // Secondary: match count (descending)
    );

    this.showSearchResults(matchingNodes, searchTerm);
  }

  getTextPreview(text, searchTerm) {
    const index = text.toLowerCase().indexOf(searchTerm);
    if (index === -1) return text.slice(0, 50) + (text.length > 50 ? "..." : "");
    
    const start = Math.max(0, index - 20);
    const end = Math.min(text.length, index + searchTerm.length + 30);
    return (start > 0 ? "..." : "") + text.slice(start, end) + (end < text.length ? "..." : "");
  }

  showSearchResults(nodes, searchTerm) {
    this.resultsList.innerHTML = nodes.length === 0
      ? '<li>No results found.</li>'
      : nodes.map(node => `
          <li>
            <a href="chapter.html?chapterId=${encodeURIComponent(node.id)}&chapterName=${encodeURIComponent(node.name)}&database=${encodeURIComponent(this.databaseSelect.value)}">
              <strong>${node.name}</strong>
              <small> [Distance: ${node.minWeight === Infinity ? "N/A" : node.minWeight} • Matches: ${node.frequency}]</small>
              <small><p>${node.preview.replace(new RegExp(`(${searchTerm})`, 'gi'), '<mark>$1</mark>')}</p><small>
            </a>
          </li>
        `).join('');
    
    this.resultsContainer.style.display = 'block';
  }
}