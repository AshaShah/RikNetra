class RigvedaSearch {
  constructor(options) {
    // DOM Elements
    this.searchBox = options.searchBox;
    this.searchButton = options.searchButton;
    this.clearSearch = options.clearSearch;
    this.databaseSelect = options.databaseSelect;
    this.resultsContainer = options.resultsContainer;
    this.welcomeSection = options.welcomeSection;
    this.searchSection = options.searchSection;
    this.topResults = options.topResults;
    this.graphSection = options.graphSection;
    this.searchSummary = options.searchSummary;
    this.ragSummary = options.ragSummary;
    this.resultCards = options.resultCards;

    // Search state
    this.currentSearchTerm = '';
    this.searchTimeout = null;

    // Initialize
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Real-time search with debounce
    this.searchBox.addEventListener('input', () => {
      this.currentSearchTerm = this.searchBox.value.trim();
      this.toggleClearButton();
      
      if (this.searchTimeout) clearTimeout(this.searchTimeout);
      
      this.searchTimeout = setTimeout(() => {
        if (this.currentSearchTerm.length > 0) {
          this.performSearch();
        } else {
          this.resetSearch();
        }
      }, 300);
    });

    // Search button click
    this.searchButton.addEventListener('click', () => {
      if (this.searchTimeout) clearTimeout(this.searchTimeout);
      this.performSearch();
    });

    // Clear search
    this.clearSearch.addEventListener('click', () => {
      this.resetSearch();
    });

    // Database change
    this.databaseSelect.addEventListener('change', () => {
      if (this.currentSearchTerm.length > 0) {
        this.performSearch();
      }
    });

    // Enter key to search
    this.searchBox.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        if (this.searchTimeout) clearTimeout(this.searchTimeout);
        this.performSearch();
      }
    });
  }

  toggleClearButton() {
    if (this.currentSearchTerm.length > 0) {
      this.clearSearch.classList.add('visible');
    } else {
      this.clearSearch.classList.remove('visible');
    }
  }

  performSearch() {
    if (this.currentSearchTerm.length === 0) {
      this.resetSearch();
      return;
    }

    // Show loading state
    this.showLoading();

    // In a real implementation, you would make an API call here
    // For demo purposes, we'll simulate a search
    setTimeout(() => {
      this.showResults(this.currentSearchTerm);
    }, 800);
  }

  showLoading() {
    // Activate search mode
    document.body.classList.add('search-active');
    
    // Show loading in results
    this.searchSummary.innerHTML = `
      <h2>Searching for "${this.currentSearchTerm}"</h2>
      <p>Loading results...</p>
    `;
    
    this.ragSummary.querySelector('.summary-content').innerHTML = `
      <p>Generating summary for "${this.currentSearchTerm}"...</p>
    `;
    
    this.resultCards.innerHTML = `
      <div class="result-card loading">
        <div class="loading-line" style="width: 80%"></div>
        <div class="loading-line" style="width: 60%"></div>
        <div class="loading-line" style="width: 70%"></div>
      </div>
      <div class="result-card loading">
        <div class="loading-line" style="width: 75%"></div>
        <div class="loading-line" style="width: 65%"></div>
        <div class="loading-line" style="width: 50%"></div>
      </div>
      <div class="result-card loading">
        <div class="loading-line" style="width: 70%"></div>
        <div class="loading-line" style="width: 80%"></div>
        <div class="loading-line" style="width: 60%"></div>
      </div>
    `;
  }

  showResults(searchTerm) {
    // Update search summary
    this.searchSummary.innerHTML = `
      <h2>Results for "${searchTerm}"</h2>
      <p>Found 24 matching verses</p>
    `;
    
    // Update RAG summary (simulated)
    this.ragSummary.querySelector('.summary-content').innerHTML = `
      <p>The search for "${searchTerm}" revealed several important verses in the Rigveda that discuss this concept. The most relevant appear in Mandala 10, with connections to creation hymns and philosophical verses.</p>
      <p>Key themes include cosmic order, divine power, and the nature of existence.</p>
    `;
    
    // Update top results (simulated)
    this.resultCards.innerHTML = `
      <div class="result-card">
        <h3>RV 10.129 - Nasadiya Sukta</h3>
        <span class="score">Relevance: 98%</span>
        <p>The famous Creation Hymn that describes the origin of the universe, with philosophical questioning about creation...</p>
        <div class="actions">
          <button><i class="fas fa-link"></i> View Connections</button>
          <button><i class="fas fa-book-open"></i> Read Full</button>
        </div>
      </div>
      <div class="result-card">
        <h3>RV 10.90 - Purusha Sukta</h3>
        <span class="score">Relevance: 92%</span>
        <p>The cosmic man hymn describing the sacrifice of Purusha and the creation of the universe and social order...</p>
        <div class="actions">
          <button><i class="fas fa-link"></i> View Connections</button>
          <button><i class="fas fa-book-open"></i> Read Full</button>
        </div>
      </div>
      <div class="result-card">
        <h3>RV 1.164 - Asya Vamiya Sukta</h3>
        <span class="score">Relevance: 88%</span>
        <p>A philosophical hymn containing famous riddles about the nature of the universe and the supreme reality...</p>
        <div class="actions">
          <button><i class="fas fa-link"></i> View Connections</button>
          <button><i class="fas fa-book-open"></i> Read Full</button>
        </div>
      </div>
    `;
    
    // In a real implementation, you would render the graph here
    this.renderGraph();
  }

  renderGraph() {
    // This would be replaced with actual D3.js graph rendering
    const graphContainer = document.getElementById('graph-visualization');
    graphContainer.innerHTML = `
      <div class="graph-message">
        <i class="fas fa-project-diagram"></i>
        <h3>Connections Graph</h3>
        <p>Visualizing relationships between verses containing "${this.currentSearchTerm}"</p>
      </div>
    `;
  }

  resetSearch() {
    this.currentSearchTerm = '';
    this.searchBox.value = '';
    this.clearSearch.classList.remove('visible');
    document.body.classList.remove('search-active');
  }
}