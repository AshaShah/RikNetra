class RigvedaSearch {
  constructor({ searchBox, searchButton, clearSearch, databaseSelect, resultsContainer, resultsList }) {
    // DOM Elements
    this.searchBox = searchBox;
    this.searchButton = searchButton;
    this.clearSearch = clearSearch;
    this.databaseSelect = databaseSelect;
    this.resultsContainer = resultsContainer;
    this.resultsList = resultsList;

    // Data
    this.currentData = null;
    this.nodeWeights = {};
    this.termClusters = {};
    this.termFrequency = {};
    this.termPositions = {}; // New: Stores terms per node for faster searching
    this.bm25Stats = {
      avgDocLength: 0,
      docFrequencies: {},
      totalDocs: 0
    };

    // Initialize
    this.setupEventListeners();
    this.loadDatabase(this.databaseSelect.value);
  }

  // ======================
  //  Core Methods
  // ======================

  async loadDatabase(url) {
    try {
      const response = await fetch(url);
      this.currentData = await response.json();
      
      this.calculateWeights();
      this.precomputeBM25Stats();
      this.buildTermPositionIndex(); // New optimization
      await this.optimizedAutoCluster();
      
      console.log("Database loaded with optimized clusters");
    } catch (error) {
      console.error("Error loading database:", error);
    }
  }

  // ======================
  //  Optimized Methods
  // ======================

  buildTermPositionIndex() {
    // Create a quick lookup of terms for each node
    this.termPositions = {};
    this.currentData.nodes.forEach(node => {
      this.termPositions[node.id] = 
        node.text.toLowerCase().match(/[a-zāēīōūṁḥ]+/g) || [];
    });
  }

  async optimizedAutoCluster() {
    console.time("Optimized Clustering");
    const termMap = new Map();
    
    // Phase 1: Build term frequency and document index
    this.currentData.nodes.forEach((node, nodeIndex) => {
      const terms = this.termPositions[node.id];
      terms.forEach(term => {
        if (term.length < 4) return; // Skip short terms
        
        if (!termMap.has(term)) {
          termMap.set(term, {
            count: 0,
            docs: new Set()
          });
        }
        const termData = termMap.get(term);
        termData.count++;
        termData.docs.add(nodeIndex);
      });
    });

    // Phase 2: Cluster using original logic with optimized data structures
    const processed = new Set();
    const allTerms = Array.from(termMap.keys());
    
    // Process terms in order of frequency (most frequent first)
    allTerms.sort((a, b) => termMap.get(b).count - termMap.get(a).count);

    // Process in batches to avoid blocking
    const BATCH_SIZE = 100;
    let batchStart = 0;
    
    const processBatch = () => {
      const batchEnd = Math.min(batchStart + BATCH_SIZE, allTerms.length);
      
      for (let i = batchStart; i < batchEnd; i++) {
        const termA = allTerms[i];
        if (processed.has(termA)) continue;

        const cluster = [termA];
        const cooccurrenceCounts = {};
        const docsWithTermA = termMap.get(termA).docs;

        // Check co-occurrence using pre-built index
        for (const nodeIndex of docsWithTermA) {
          const terms = this.termPositions[this.currentData.nodes[nodeIndex].id];
          terms.forEach(termB => {
            if (termA !== termB && termB.length >= 4) {
              cooccurrenceCounts[termB] = (cooccurrenceCounts[termB] || 0) + 1;
            }
          });
        }

        // Original clustering criteria
        const minCooccurrence = docsWithTermA.size * 0.05;
        Object.entries(cooccurrenceCounts).forEach(([term, count]) => {
          if (count > minCooccurrence) {
            cluster.push(term);
            processed.add(term);
          }
        });

        if (cluster.length > 2) {
          const clusterName = cluster[0];
          cluster.forEach(term => {
            this.termClusters[term] = clusterName;
            this.termFrequency[term] = termMap.get(term).count;
          });
        }
      }

      batchStart = batchEnd;
      if (batchStart < allTerms.length) {
        setTimeout(processBatch, 0); // Yield to browser
      } else {
        console.timeEnd("Optimized Clustering");
      }
    };

    processBatch();
  }

  // ======================
  //  Search Algorithms (Preserved Quality)
  // ======================

  performSearch() {
    const searchTerm = this.searchBox.value.trim().toLowerCase();
    if (!searchTerm || !this.currentData) {
      this.closeResults();
      return;
    }

    const results = this.hybridSearch(searchTerm);
    this.showResults(results, searchTerm);
  }

  hybridSearch(searchTerm) {
    // 1. Get BM25 base scores (unchanged)
    const bm25Results = this.bm25Search(searchTerm);
    const bm25Map = new Map(bm25Results.map(r => [r.id, r.score]));

    // 2. Expand terms using original logic
    const queryTerms = searchTerm.toLowerCase().match(/[a-zāēīōūṁḥ]+/g) || [];
    const expandedTerms = [...new Set([
      ...queryTerms,
      ...this.getRelatedTerms(queryTerms)
    ])];

    // 3. Optimized filtering using termPositions
    const matchingNodes = [];
    
    this.currentData.nodes.forEach(node => {
      const nodeTerms = this.termPositions[node.id];
      let hasTerm = false;
      
      // Check terms in order of length (longer terms first)
      for (const term of expandedTerms.sort((a, b) => b.length - a.length)) {
        if (nodeTerms.includes(term)) {
          hasTerm = true;
          break;
        }
      }

      if (hasTerm) {
        matchingNodes.push({
          ...node,
          algorithm: 'Hybrid',
          ...this.calculateScores(node, bm25Map, queryTerms),
          preview: this.getTextPreview(node.text, searchTerm)
        });
      }
    });

    return matchingNodes.sort((a, b) => b.score - a.score);
  }

  // ======================
  //  Scoring Components (Unchanged)
  // ======================

  calculateScores(node, bm25Map, queryTerms) {
    // BM25 Component (0-1 range)
    const bm25Score = bm25Map.get(node.id) || 0;

    // Semantic Component (50 points for cluster matches)
    const semanticBonus = queryTerms.some(term => 
      this.termClusters[term] && node.text.toLowerCase().includes(term)
    ) ? 50 : 0;

    // Group Connection Component
    const connections = this.currentData.edges.filter(e => 
      e.source === node.id || e.target === node.id
    );
    const graphScore = connections.length > 0 
      ? (1 / Math.min(...connections.map(c => c.weight))) * 10 
      : 0;

    // Final Weighted Score
    const score = (bm25Score * 100) + semanticBonus + graphScore;

    return {
      score: parseFloat(score.toFixed(2)),
      bm25Score: parseFloat(bm25Score.toFixed(4)),
      semanticBonus,
      graphScore: parseFloat(graphScore.toFixed(2)),
      frequency: [...queryTerms].reduce((sum, term) => 
        sum + (node.text.toLowerCase().match(new RegExp(term, 'g')) || []).length, 0)
    };
  }

  getRelatedTerms(terms) {
    const related = [];
    terms.forEach(term => {
      if (this.termClusters[term]) {
        related.push(...Object.keys(this.termClusters)
          .filter(t => this.termClusters[t] === this.termClusters[term]));
      }
    });
    return related;
  }

  // ======================
  //  BM25 Implementation (Unchanged)
  // ======================

  precomputeBM25Stats() {
    const nodes = this.currentData.nodes;
    const textLengths = nodes.map(node => node.text.length);
    
    const docFrequencies = {};
    nodes.forEach(node => {
      const terms = new Set(node.text.toLowerCase().match(/\w+/g) || []);
      terms.forEach(term => {
        docFrequencies[term] = (docFrequencies[term] || 0) + 1;
      });
    });

    this.bm25Stats = {
      avgDocLength: textLengths.reduce((a, b) => a + b, 0) / textLengths.length,
      docFrequencies,
      totalDocs: nodes.length
    };
  }

  bm25Search(searchTerm, k1 = 1.2, b = 0.75) {
    const { avgDocLength, docFrequencies, totalDocs } = this.bm25Stats;
    const terms = searchTerm.toLowerCase().match(/\w+/g) || [];
    
    return this.currentData.nodes
      .map(node => {
        const docLength = node.text.length;
        let score = 0;
        
        terms.forEach(term => {
          const tf = (node.text.toLowerCase().match(new RegExp(term, 'g')) || []).length;
          if (tf === 0) return;
          
          const df = docFrequencies[term] || 0;
          const idf = Math.log((totalDocs - df + 0.5) / (df + 0.5) + 1);
          const numerator = tf * (k1 + 1);
          const denominator = tf + k1 * (1 - b + b * (docLength / avgDocLength));
          
          score += idf * (numerator / denominator);
        });

        return score > 0 ? {
          ...node,
          algorithm: 'BM25',
          score: parseFloat(score.toFixed(4)),
          preview: this.getTextPreview(node.text, searchTerm)
        } : null;
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score);
  }

  // ======================
  //  UI Methods (Unchanged)
  // ======================

  showResults(results, searchTerm) {
    const queryTerms = searchTerm.toLowerCase().match(/[a-zāēīōūṁḥ]+/g) || [];
    const relatedClusters = new Set();
    
    queryTerms.forEach(term => {
      if (this.termClusters[term]) {
        relatedClusters.add(this.termClusters[term]);
      }
    });

    this.resultsList.innerHTML = `
      <div class="search-header">
        <h3>Results for "${searchTerm}"</h3>
      </div>
      <ol class="result-list">
        ${results.slice(0, 10).map(node => `
          <li>
            <a href="chapter.html?chapterId=${encodeURIComponent(node.id)}&chapterName=${encodeURIComponent(node.name)}&database=${encodeURIComponent(this.databaseSelect.value)}">
              <strong>${node.name}</strong>
              <div class="score-breakdown">
                <span>Score: ${node.score.toFixed(2)}</span>
                <span>BM25: ${(node.bm25Score * 100).toFixed(2)}</span>
                ${node.semanticBonus ? `<span>Semantic: +${node.semanticBonus}</span>` : ''}
                <span>Graph: ${node.graphScore.toFixed(2)}</span>
                <span>Matches: ${node.frequency}</span>
              </div>
              <p class="preview">${node.preview.replace(new RegExp(`(${searchTerm})`, 'gi'), '<mark>$1</mark>')}</p>
            </a>
          </li>
        `).join('')}
      </ol>
    `;
    this.resultsContainer.style.display = 'block';
  }

  getTextPreview(text, highlightTerm) {
    const index = text.toLowerCase().indexOf(highlightTerm.toLowerCase());
    if (index === -1) return text.slice(0, 100) + (text.length > 100 ? "..." : "");
    
    const start = Math.max(0, index - 30);
    const end = Math.min(text.length, index + highlightTerm.length + 70);
    return (start > 0 ? "..." : "") + text.slice(start, end) + (end < text.length ? "..." : "");
  }

  calculateWeights() {
    this.currentData.edges.forEach(edge => {
      this.nodeWeights[edge.target] = (this.nodeWeights[edge.target] || 0) + edge.weight;
    });
  }


  // ======================
  //  Event Handlers
  // ======================

  setupEventListeners() {
    this.searchBox.addEventListener('input', () => this.onSearchInput());
    this.searchBox.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.performSearch();
    });
    this.searchButton.addEventListener('click', () => this.performSearch());
    this.clearSearch.addEventListener('click', () => this.clearSearchBox());
    this.databaseSelect.addEventListener('change', () => {
      this.loadDatabase(this.databaseSelect.value);
    });
    document.addEventListener('click', (e) => {
      if (!this.isSearchElement(e.target)) this.closeResults();
    }, true);
  }

  isSearchElement(target) {
    return this.searchBox.contains(target) ||
           this.searchButton.contains(target) ||
           this.clearSearch.contains(target) ||
           this.resultsContainer.contains(target) ||
           this.databaseSelect.contains(target);
  }

  onSearchInput() {
    const hasValue = this.searchBox.value.trim().length > 0;
    this.clearSearch.style.display = hasValue ? 'block' : 'none';
    if (!hasValue) this.closeResults();
  }

  clearSearchBox() {
    this.searchBox.value = '';
    this.clearSearch.style.display = 'none';
    this.closeResults();
  }

  closeResults() {
    this.resultsContainer.style.display = 'none';
  }
}