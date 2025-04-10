class RigvedaSearch {
    constructor({ searchBox, searchButton, clearSearch, databaseSelect, resultsContainer, resultsList }) {
      this.searchBox = searchBox;
      this.searchButton = searchButton;
      this.clearSearch = clearSearch;
      this.databaseSelect = databaseSelect;
      this.resultsContainer = resultsContainer;
      this.resultsList = resultsList;
      this.currentData = null;
      this.pageRankScores = {};
  
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
    
          this.calculatePageRank();
          console.log("PageRank scores:", this.pageRankScores);
        } catch (error) {
          console.error("Error loading database:", error);
        }
      }
  
    calculatePageRank(dampingFactor = 0.85, maxIterations = 100, tolerance = 1.0e-6) {
      const nodes = this.currentData.nodes.map(n => n.id);
      const edges = this.currentData.edges;
      const graph = {};
      const outLinks = {};
  
      // Initialize graph structure
      nodes.forEach(id => {
        graph[id] = [];
        outLinks[id] = 0;
      });
  
      // Build connection graph
      edges.forEach(edge => {
        if (graph[edge.source]) {
          graph[edge.source].push(edge.target);
          outLinks[edge.source]++;
        }
      });
  
      // Calculate PageRank scores
      const N = nodes.length;
      let scores = {};
      nodes.forEach(id => (scores[id] = 1 / N));
  
      for (let iter = 0; iter < maxIterations; iter++) {
        let delta = 0;
        const newScores = {};
  
        nodes.forEach(node => {
          let inboundSum = 0;
          nodes.forEach(other => {
            if (graph[other].includes(node)) {
              inboundSum += scores[other] / outLinks[other];
            }
          });
          newScores[node] = (1 - dampingFactor) / N + dampingFactor * inboundSum;
          delta += Math.abs(newScores[node] - scores[node]);
        });
  
        scores = newScores;
        if (delta < tolerance) break;
      }
  
      this.pageRankScores = scores;
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
  
      const filteredNodes = this.currentData.nodes.filter(node =>
        node.text && node.text.toLowerCase().includes(searchTerm)
      );
  
      filteredNodes.sort((a, b) => 
        (this.pageRankScores[b.id] || 0) - (this.pageRankScores[a.id] || 0)
      );

      console.log("Search results with PageRank:");
      filteredNodes.forEach(node => {
        console.log(`${node.id} → ${this.pageRankScores[node.id]?.toFixed(6)}`);
      });
  
      this.showSearchResults(filteredNodes, searchTerm);
    }
  
    showSearchResults(nodes, searchTerm) {
      this.resultsList.innerHTML = '';
      
      if (nodes.length === 0) {
        this.resultsList.innerHTML = '<li>No results found.</li>';
      } else {
        nodes.forEach(node => {
          const li = document.createElement('li');
          const highlightedText = node.text.replace(
            new RegExp(`(${searchTerm})`, 'gi'),
            '<mark>$1</mark>'
          );
          li.innerHTML = `
            <a href="chapter.html?chapterId=${encodeURIComponent(node.id)}&chapterName=${encodeURIComponent(node.name)}&database=${encodeURIComponent(this.databaseSelect.value)}">
              <strong>${node.name}</strong><br>
              <span>${highlightedText}</span>
            </a>
          `;
          this.resultsList.appendChild(li);
        });
      }
      
      this.resultsContainer.style.display = 'block';
    }
  }