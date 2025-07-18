class RigvedaSearch {
  constructor(options) {
    // DOM Elements initialization
    this.initElements(options);

    // D3 Graph Variables
    this.initGraphVariables();

    // Search state
    this.currentSearchTerm = "";
    this.searchTimeout = null;

    // Initialize
    this.setupEventListeners();
    this.setupTagListeners();
    this.initializeGraph();
  }

  // Initialize DOM elements
  initElements(options) {
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
    this.graphSvg = options.graphSvg;
    this.recentHymnsList = document.getElementById("recent-hymns-list");
    this.recentNodes = []; // Stores recently clicked nodes
  }

  // Initialize D3 Graph variables
  initGraphVariables() {
    this.g = null;
    this.link = null;
    this.node = null;
    this.label = null;
    this.nodesData = [];
    this.edgesData = [];
    this.simulation = null;
    this.zoom = null;
    this.svg = d3.select(this.graphSvg);
    this.tooltip = d3.select("#tooltip");
    this.popup = d3.select("#popup");
    this.popupTitle = d3.select("#popup-title");
    this.popupLinks = d3.select("#popup-links");
    this.closePopupBtn = d3.select("#close-popup");
    this.readChapterBtn = d3.select("#read-chapter");
    this.isolateMode = false;
    this.selectedNode = null;
    this.selectedEdge = null;
    this.levels = {
      1: new Set(),
      2: new Set(),
      3: new Set(),
    }; // Initialize levels for getNodeLevel
  }

  // Setup event listeners for search and graph interactions
  setupEventListeners() {
    this.searchBox.addEventListener("input", this.handleSearchInput.bind(this));
    this.searchButton.addEventListener(
      "click",
      this.handleSearchClick.bind(this)
    );
    this.databaseSelect.addEventListener(
      "change",
      this.handleDatabaseChange.bind(this)
    );
    this.searchBox.addEventListener("keydown", this.handleKeyDown.bind(this));

    // Popup/Read Chapter
    this.closePopupBtn.on("click", this.closePopup.bind(this));
    this.readChapterBtn.on("click", this.readChapter.bind(this));
  }

  // Auto search on input - commented out to avoid auto search on every keystroke
  handleSearchInput() {
    this.currentSearchTerm = this.searchBox.value.trim();
  }

  // Search button click handler
  handleSearchClick() {
    if (this.searchTimeout) clearTimeout(this.searchTimeout);
    this.performSearch();
  }

  // Database change handler
  handleDatabaseChange() {
    this.loadGraphData(this.databaseSelect.value, this.currentSearchTerm);
    if (this.currentSearchTerm.length > 0) {
      this.performSearch();
    } else {
      this.resetSearch();
    }
  }

  // Handle Enter key for search
  handleKeyDown(e) {
    if (e.key === "Enter") {
      if (this.searchTimeout) clearTimeout(this.searchTimeout);
      this.performSearch();
    }
  }

  // --- Popup and Read Chapter ---
  closePopup() {
    this.popup.style("display", "none");
    this.isolateMode = false;
    this.updateGraphVisibility();
    this.resetGraphHighlights();
  }

  readChapter() {
    if (!this.selectedNode) {
      alert("Please select a node first.");
      return;
    }
    const chapterName = this.cleanSuktaName(this.selectedNode.name);
    const chapterId = this.selectedNode.id;
    const database = this.databaseSelect.value;
    window.location.href = `/templates/chapter.html?chapterId=${encodeURIComponent(
      chapterId
    )}&chapterName=${encodeURIComponent(
      chapterName
    )}&database=${encodeURIComponent(database)}`;
  }

  // --- Search and Results Handling ---
  showLoading() {
    document.body.classList.add("search-active");
    this.welcomeSection.classList.add("hidden");
    document.getElementById("search-guide-card").classList.add("hidden");
    this.searchSummary.innerHTML = `<h2>Searching for "${this.currentSearchTerm}"</h2><p>Loading results...</p>`;
    this.ragSummary.querySelector(
      ".summary-content"
    ).innerHTML = `<p>Generating summary for "${this.currentSearchTerm}"...</p>`;
    this.resultCards.innerHTML = `
      <div class="result-card loading"><div class="loading-line" style="width: 80%"></div></div>
      <div class="result-card loading"><div class="loading-line" style="width: 75%"></div></div>
      <div class="result-card loading"><div class="loading-line" style="width: 70%"></div></div>`;
    this.resultsContainer.style.display = "flex";
  }

  async performSearch() {
    if (this.currentSearchTerm.length === 0) {
      this.resetSearch();
      return;
    }
    this.showLoading();
    const currentDatabase = this.databaseSelect.value;

    // Always show RAG summary unless exact match found
    this.ragSummary.style.display = "";

    try {
      // 1. Load JSON data for exact match
      const data = await d3.json(`${currentDatabase}`);
      this.nodesData = data.nodes;
      this.edgesData = data.edges;

      // 2. Try to find an exact match in the node names
      const searchTermNorm = this.cleanSuktaName(this.currentSearchTerm)
        .toLowerCase()
        .replace(/\s+/g, "");
      const exactNode = this.nodesData.find(
        (node) =>
          this.cleanSuktaName(node.name).toLowerCase().replace(/\s+/g, "") ===
          searchTermNorm
      );

      if (exactNode) {
        // Hide the RAG summary for exact matches
        this.ragSummary.style.display = "none";
        this.updateSearchResults([exactNode], this.currentSearchTerm, {
          rag_summary: null,
        });
        this.loadGraphData(currentDatabase, this.currentSearchTerm, [
          exactNode,
        ]);
        return;
      }

      // 3. If not found, proceed as usual with semantic search
      const semanticData = await this.fetchSemanticResults();
      let matchedNodes = this.processSearchResults(semanticData);

      this.updateSearchResults(
        matchedNodes,
        this.currentSearchTerm,
        semanticData
      );
      this.loadGraphData(currentDatabase, this.currentSearchTerm, matchedNodes);
    } catch (error) {
      console.error("Search error:", error);
      this.showSearchError();
    }
  }

async fetchSemanticResults() {
    try {
        const response = await fetch("/semantic-search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: this.currentSearchTerm }),
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error("Error fetching semantic results:", error);
        return {
            error: error.message,
            results: [],
            rag_summary: `Error: ${error.message}`
        };
    }
}

processSearchResults(semanticData) {
    // Handle error case first
    if (semanticData.error) {
        console.error("Semantic search error:", semanticData.error);
        return [];
    }

    let matchedNodes = [];
    const hasResults = semanticData.results && semanticData.results.length > 0;
    const hasTextDict = semanticData.text_dict && Object.keys(semanticData.text_dict).length > 0;

    if (hasResults || hasTextDict) {
        const resultsToUse = hasResults ? semanticData.results : 
            Object.entries(semanticData.text_dict).map(([k,v]) => ({sukta: `RV ${k}`, text: v}));
            
        matchedNodes = resultsToUse
            .map((result) => this.findMatchingNode(result.sukta))
            .filter(Boolean);
    }

    if (matchedNodes.length === 0) {
        matchedNodes = this.nodesData
            .filter((node) => this.matchesSearchTerm(node))
            .slice(0, 5);
    }

    return matchedNodes;
}

  findMatchingNode(sukta) {
    return this.nodesData.find(
      (node) =>
        node.id.includes(sukta) ||
        this.cleanSuktaName(node.name).includes(this.cleanSuktaName(sukta))
    );
  }

  matchesSearchTerm(node) {
    return (
      this.cleanSuktaName(node.name)
        .toLowerCase()
        .includes(this.currentSearchTerm.toLowerCase()) ||
      (node.content &&
        node.content
          .toLowerCase()
          .includes(this.currentSearchTerm.toLowerCase()))
    );
  }

showSearchError(error) {
    const errorMessage = error?.message || "Could not perform search";
    this.searchSummary.innerHTML = `
        <h2>Error</h2>
        <p class="error-message">${errorMessage}</p>
        <button class="retry-button">Try Again</button>
    `;
    
    this.ragSummary.querySelector(".summary-content").innerHTML = `
        <p class="error">An error occurred while performing search.</p>
    `;
    
    // Add retry functionality
    this.searchSummary.querySelector(".retry-button")?.addEventListener("click", () => {
        this.performSearch();
    });
}

  updateSearchResults(results, searchTerm, semanticData) {
    this.searchSummary.innerHTML = `<h2>Results for "${searchTerm}"</h2>`;
    this.updateRagSummary(results, searchTerm, semanticData);
    this.renderResultsList(results);
  }

  updateRagSummary(results, searchTerm, semanticData) {
    const ragContainer = this.ragSummary.querySelector(".summary-content");

    if (semanticData?.rag_summary) {
      // Split summary into sentences
      let sentences = semanticData.rag_summary
        .split(/(?<=[.!?])\s+/)
        .filter((s) => s.trim().length > 0);

      // Group sentences into paragraphs of 3
      let paragraphs = [];
      for (let i = 0; i < sentences.length; i += 3) {
        paragraphs.push(sentences.slice(i, i + 3).join(" "));
      }

      // Format paragraphs with HTML
      let formattedSummary = paragraphs.map((p) => `<p>${p}</p>`).join("");

      ragContainer.innerHTML = `
            <div class="rag-container">
                <div class="rag-content">${formattedSummary}</div>
            </div>`;
    } else {
      ragContainer.innerHTML = `<p>Found ${results.length} results for "${searchTerm}"</p>`;
    }
  }

  renderResultsList(results) {
    this.resultCards.innerHTML = "";

    if (!results || results.length === 0) {
      this.resultCards.innerHTML =
        "<p class='no-results'>No Suktas found matching your search term.</p>";
      return;
    }

    const isExact =
      results.length === 1 && this.ragSummary.style.display === "none";

    const container = document.createElement("div");
    container.className = "vertical-result-list";

    results.forEach((result, index) => {
      const cleanName = this.cleanSuktaName(
        result.name || `RV ${result.index || ""}`
      );
      const contentPreview =
        result.text || this.getContentPreview(result.content);

      const item = document.createElement("div");
      item.className = "vertical-result-item";
      if (isExact) item.classList.add("exact-match");
      if (
        this.selectedNode &&
        (result.id === this.selectedNode.id ||
          result.index === this.selectedNode.id)
      ) {
        item.classList.add("selected"); // Highlight if this is the selected node
      }
      item.innerHTML = `
            <div class="vertical-result-header">
                <span class="vertical-result-title">${cleanName}</span>
            </div>
            <div class="vertical-result-content">
                ${contentPreview || "No preview available"}
            </div>
            <div class="vertical-result-actions">
                <button class="view-connections" data-node-id="${
                  result.id || result.index
                }">
                    <i class="fas fa-link"></i> Hymns Net.
                </button>
                <button class="read-full" data-node-id="${
                  result.id || result.index
                }" data-node-name="${cleanName}">
                    <i class="fas fa-book-open"></i> Read Full
                </button>
            </div>
        `;

      item
        .querySelector(".view-connections")
        .addEventListener("click", () =>
          this.handleViewConnections(result.id || result.index)
        );
      item
        .querySelector(".read-full")
        .addEventListener("click", (event) =>
          this.handleReadFull(event, cleanName)
        );

      container.appendChild(item);
    });

    this.resultCards.appendChild(container);
  }

  cleanSuktaName(name) {
    if (!name) return name;
    // Remove extra "RV" prefixes and trim whitespace
    let cleanName = name.replace(/^(RV\s*)+/i, "RV ").trim();
    // Ensure "RV" is followed by a space if not already
    if (!cleanName.startsWith("RV ")) {
      cleanName = "RV " + cleanName;
    }
    // Remove any remaining duplicate "RV"
    cleanName = cleanName.replace(/(RV\s+)+/g, "RV ");
    return cleanName.trim();
  }

  getContentPreview(text) {
    if (!text) return "";

    // First try to get a complete sentence
    const sentenceMatch = text.match(/^.*?[.!?](?=\s|$)/);
    if (
      sentenceMatch &&
      sentenceMatch[0].length >= 40 &&
      sentenceMatch[0].length <= 60
    ) {
      return sentenceMatch[0];
    }

    // If no suitable sentence, get the first line or truncate
    const firstLine = text.split(/\n/)[0].trim();
    if (firstLine.length >= 40 && firstLine.length <= 60) {
      return firstLine;
    }

    // If still too long, truncate to 60 chars at word boundary
    if (firstLine.length > 60) {
      return firstLine.substring(0, 60).replace(/\s+\S*$/, "...");
    }

    // If too short, try to get more content
    if (firstLine.length < 60) {
      const moreContent = text.substring(0, 60).trim();
      return moreContent + (text.length > 60 ? "..." : "");
    }

    return firstLine;
  }

  handleViewConnections(nodeId) {
    let node = this.nodesData.find((n) => n.id === nodeId);
    if (!node) {
      node = this.nodesData.find((n) => n.id.includes(nodeId));
    }
    if (!node) {
      node = this.nodesData.find((n) =>
        this.cleanSuktaName(n.name).includes(this.cleanSuktaName(nodeId))
      );
    }
    if (!node) return;

    // Add to recent hymns
    this.addToRecentHymns(node);

    // Highlight the selected result card
    const resultItems = document.querySelectorAll(".vertical-result-item");
    resultItems.forEach((item) => {
      item.classList.remove("selected");
      if (item.querySelector(`[data-node-id="${nodeId}"]`)) {
        item.classList.add("selected");
      }
    });

    this.zoomToNode(node);
    this.highlightGraphNode(node.id);
  }

  handleReadFull(event, chapterName) {
    const chapterId = event.target.dataset.nodeId;
    const database = this.databaseSelect.value;
    window.location.href = `/templates/chapter.html?chapterId=${encodeURIComponent(
      chapterId
    )}&chapterName=${encodeURIComponent(
      chapterName
    )}&database=${encodeURIComponent(database)}`;
  }

  setupTagListeners() {
    const tagsContainer = document.getElementById("search-tags");
    if (tagsContainer) {
      tagsContainer.addEventListener("click", (event) => {
        const tag = event.target.closest(".tag");
        if (tag) {
          const searchTerm = tag.dataset.searchTerm;
          this.searchBox.value = searchTerm;
          this.currentSearchTerm = searchTerm;
          this.performSearch();
        }
      });
    }
  }

  resetSearch() {
    this.currentSearchTerm = "";
    this.searchBox.value = "";
    document.body.classList.remove("search-active");
    this.welcomeSection.classList.remove("hidden");
    document.getElementById("search-guide-card").classList.remove("hidden");
    this.resultsContainer.style.display = "none";
  }

  resetGraphHighlights() {
    if (this.node) {
      this.node
        .attr("fill", "#7fb3d5")
        .attr("stroke", "none")
        .attr("stroke-width", 0)
        .attr("r", 8)
        .attr("opacity", 1);
    }
    if (this.link) {
      this.link
        .attr("stroke", "#aaa")
        .attr("stroke-opacity", 0.6)
        .attr("stroke-width", 2);
    }
    if (this.label) {
      this.label
        .style("font-weight", "normal")
        .style("opacity", 0.6)
        .style("font-size", "6px");
    }
    this.selectedNode = null;
    this.selectedEdge = null;
  }

  // --- D3 Graph Initialization and Rendering ---
  initializeGraph() {
    const container = this.graphSvg.parentElement;
    if (!container) {
      console.error("Container element not found!");
      return;
    }
    // Set SVG size based on container
    const width = container.clientWidth;
    const height = container.clientHeight;

    this.svg = d3
      .select(this.graphSvg)
      .attr("width", width)
      .attr("height", height);

    // Remove any previous group, then create new 'g'
    this.svg.selectAll("g").remove();
    this.g = this.svg.append("g");

    // Setup zoom
    this.zoom = d3
      .zoom()
      .scaleExtent([0.1, 5])
      .on("zoom", (event) => {
        this.g.attr("transform", event.transform);
      });
    this.svg.call(this.zoom);

    // Load graph data
    this.loadGraphData(this.databaseSelect.value);
  }

  getConnectedNodes(nodeId) {
    const connectedNodes = new Set();

    this.edgesData.forEach((edge) => {
      if (edge.source.id === nodeId) {
        const targetNode = this.nodesData.find((n) => n.id === edge.target.id);
        if (targetNode) connectedNodes.add(targetNode);
      } else if (edge.target.id === nodeId) {
        const sourceNode = this.nodesData.find((n) => n.id === edge.source.id);
        if (sourceNode) connectedNodes.add(sourceNode);
      }
    });

    return Array.from(connectedNodes);
  }

  getNodeLevel(nodeId) {
    if (!this.selectedNode) return -1;
    if (nodeId === this.selectedNode.id) return 0;
    if (this.levels[1].has(nodeId)) return 1;
    if (this.levels[2].has(nodeId)) return 2;
    if (this.levels[3].has(nodeId)) return 3;
    return -1;
  }

  highlightEdgeNodes(edge) {
    // Highlight the source and target nodes of the clicked edge
    const sourceId = edge.source.id;
    const targetId = edge.target.id;

    this.node
      .attr("fill", (d) => {
        if (d.id === sourceId || d.id === targetId) return "#E57373";
        return "#7fb3d5";
      })
      .attr("r", (d) => {
        if (d.id === sourceId || d.id === targetId) return 8;
        return 5;
      });

    this.label
      .style("font-weight", (d) =>
        d.id === sourceId || d.id === targetId ? "bold" : "normal"
      )
      .style("opacity", (d) =>
        d.id === sourceId || d.id === targetId ? 1 : 0.6
      );
  }

  loadGraphData(database, searchTerm = null, highlightNodes = []) {
    this.g.selectAll("*").remove();

    d3.json(database)
      .then((data) => {
        this.nodesData = data.nodes;
        this.edgesData = data.edges;

        const width = this.graphSvg.parentElement.clientWidth;
        const height = this.graphSvg.parentElement.clientHeight;

        // Normalize edge weights
        const weights = this.edgesData.map((d) => d.weight);
        const min_weight = Math.min(...weights);
        const max_weight = Math.max(...weights);
        const new_min = 1;
        const new_max = 10;

        this.edgesData.forEach((d) => {
          if (max_weight === min_weight) {
            d.normalized_weight = new_max;
          } else {
            d.normalized_weight =
              ((d.weight - min_weight) / (max_weight - min_weight)) *
                (new_max - new_min) +
              new_min;
          }
        });

        // Use the same scaling approach
        const xScale = d3
          .scaleLinear()
          .domain([
            d3.min(this.nodesData, (d) => d.x),
            d3.max(this.nodesData, (d) => d.x),
          ])
          .range([100, width - 100]);

        const yScale = d3
          .scaleLinear()
          .domain([
            d3.min(this.nodesData, (d) => d.y),
            d3.max(this.nodesData, (d) => d.y),
          ])
          .range([100, height - 100]);

        this.link = this.g
          .append("g")
          .selectAll("line")
          .data(this.edgesData)
          .enter()
          .append("line")
          .attr("class", "link")
          .attr("stroke-width", 2)
          .attr("stroke", "#aaa")
          .attr("stroke-opacity", 0.6)
          .on("click", (event, d) => {
            this.selectedEdge = d3.select(event.target);
            this.highlightEdgeNodes(d);
            this.selectedEdge.attr("stroke", "red").attr("stroke-width", 2);
          })
          .on("mouseover", (event, d) => {
            d3.select(event.target)
              .attr("stroke", "red")
              .attr("stroke-width", 2);
          })
          .on("mouseout", (event, d) => {
            if (
              !this.selectedEdge ||
              d3.select(event.target).datum() !== this.selectedEdge.datum()
            ) {
              d3.select(event.target)
                .attr("stroke", "#aaa")
                .attr("stroke-width", 2);
            }
          });

        this.simulation = d3
          .forceSimulation(this.nodesData)
          .force(
            "link",
            d3
              .forceLink(this.edgesData)
              .id((d) => d.id)
              .distance(50)
          )
          .force("charge", d3.forceManyBody().strength(-30))
          .force("center", d3.forceCenter(width / 2, height / 2))
          .force(
            "x",
            d3.forceX().x((d) => xScale(d.x))
          )
          .force(
            "y",
            d3.forceY().y((d) => yScale(d.y))
          )
          .on("tick", () => this.ticked());

        this.nodesData.forEach((node) => {
          node.x = xScale(node.x);
          node.y = yScale(node.y);
        });

        const drag = d3
          .drag()
          .on("start", (event, d) => this.dragStarted(event, d))
          .on("drag", (event, d) => this.dragged(event, d))
          .on("end", (event, d) => this.dragEnded(event, d));

        this.node = this.g
          .append("g")
          .selectAll("circle")
          .data(this.nodesData)
          .enter()
          .append("circle")
          .attr("class", "node")
          .attr("r", 8)
          .attr("fill", "#7fb3d5")
          .call(drag)
          .on("mouseover", (event, d) => {
            this.tooltip
              .style("display", "block")
              .html(`<strong>${this.cleanSuktaName(d.name)}</strong>`)
              .style("left", `${event.pageX + 10}px`)
              .style("top", `${event.pageY + 10}px`);
          })
          .on("mouseout", () => {
            this.tooltip.style("display", "none");
          })
          .on("click", (event, d) => {
            event.stopPropagation();
            if (this.selectedEdge) {
              this.selectedEdge.attr("stroke", "#aaa");
              this.selectedEdge = null;
            }

            // Add to recent hymns
            this.addToRecentHymns(d);

            // Perform exact search for the clicked node
            this.searchBox.value = this.cleanSuktaName(d.name);
            this.currentSearchTerm = this.cleanSuktaName(d.name);
            this.performSearch();

            this.selectedNode = d;
            this.highlightGraphNode(d.id);
            this.zoomToNode(d);
          });

        this.label = this.g
          .append("g")
          .selectAll("text")
          .data(this.nodesData)
          .enter()
          .append("text")
          .attr("x", (d) => d.x + 7)
          .attr("y", (d) => d.y + 0)
          .attr("class", "node-label")
          .text((d) => this.cleanSuktaName(d.name))
          .style("font-size", "6px")
          .style("pointer-events", "none");
      })
      .catch((err) => {
        console.error("Graph data load error", err);
      });
  }

  ticked() {
    try {
      this.link
        .attr("x1", (d) => d.source.x || 0)
        .attr("y1", (d) => d.source.y || 0)
        .attr("x2", (d) => d.target.x || 0)
        .attr("y2", (d) => d.target.y || 0);

      this.node.attr("cx", (d) => d.x || 0).attr("cy", (d) => d.y || 0);

      this.label.attr("x", (d) => (d.x || 0) + 7).attr("y", (d) => d.y || 0);
    } catch (e) {
      console.error("Tick error:", e);
    }
  }

  dragStarted(event, d) {
    if (!event.active) this.simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
  }

  dragged(event, d) {
    d.fx = event.x;
    d.fy = event.y;
  }

  dragEnded(event, d) {
    if (!event.active) this.simulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
  }

  highlightGraphNode(nodeId) {
    this.selectedNode = this.nodesData.find((n) => n.id === nodeId);
    if (!this.selectedNode) return;

    // Create connection levels
    const level1 = new Set();
    const level2 = new Set();
    const level3 = new Set();

    // Find level 1 connections (only outgoing edges from selected node)
    this.edgesData.forEach((edge) => {
      if (edge.source.id === nodeId) level1.add(edge.target.id);
    });

    // Find level 2 connections (outgoing edges from level 1 nodes)
    level1.forEach((id) => {
      this.edgesData.forEach((edge) => {
        if (edge.source.id === id && edge.target.id !== nodeId)
          level2.add(edge.target.id);
      });
    });

    // Find level 3 connections (outgoing edges from level 2 nodes)
    level2.forEach((id) => {
      this.edgesData.forEach((edge) => {
        if (edge.source.id === id && !level1.has(edge.target.id))
          level3.add(edge.target.id);
      });
    });

    // Remove duplicates from higher levels
    level2.forEach((id) => {
      if (level1.has(id)) level2.delete(id);
    });
    level3.forEach((id) => {
      if (level1.has(id) || level2.has(id)) level3.delete(id);
    });

    // Store levels for getNodeLevel
    this.levels[1] = level1;
    this.levels[2] = level2;
    this.levels[3] = level3;

    // Color scheme - matching suktaconnection.html
    const colors = {
      selected: "#E57373",
      level1: "#FFB74D",
      level2: "#64B5F6",
      level3: "#81C784",
      default: "#7fb3d5",
      edgeDefault: "#aaa",
      edgeHighlight: "#E97777",
    };

    // Style nodes
    this.node
      .attr("opacity", (d) => {
        if (d.id === nodeId) return 1;
        if (level1.has(d.id)) return 1;
        if (level2.has(d.id)) return 0.8;
        if (level3.has(d.id)) return 0.6;
        return 0.07;
      })
      .attr("fill", (d) => {
        if (d.id === nodeId) return colors.selected;
        if (level1.has(d.id)) return colors.level1;
        if (level2.has(d.id)) return colors.level2;
        if (level3.has(d.id)) return colors.level3;
        return colors.default;
      })
      .attr("stroke", (d) => (d.id === nodeId ? "#000" : "none"))
      .attr("stroke-width", (d) => (d.id === nodeId ? 2 : 0))
      .attr("r", (d) => {
        if (d.id === nodeId) return 8;
        if (level1.has(d.id)) return 6;
        if (level2.has(d.id)) return 5;
        if (level3.has(d.id)) return 4;
        return 3;
      });

    // Edge highlighting logic
    this.link
      .attr("stroke", (d) => {
        if (d.source.id === nodeId) return colors.edgeHighlight;
        const sourceInLevel =
          level1.has(d.source.id) ||
          level2.has(d.source.id) ||
          level3.has(d.source.id);
        const targetInLevel =
          level1.has(d.target.id) ||
          level2.has(d.target.id) ||
          level3.has(d.target.id);
        if (sourceInLevel && targetInLevel) {
          if (level1.has(d.source.id) && level1.has(d.target.id))
            return colors.level1;
          if (level2.has(d.source.id) && level2.has(d.target.id))
            return colors.level2;
          return colors.edgeDefault;
        }
        return colors.edgeDefault;
      })
      .attr("stroke-opacity", (d) => {
        if (d.source.id === nodeId) return 1;
        const sourceInLevel =
          level1.has(d.source.id) ||
          level2.has(d.source.id) ||
          level3.has(d.source.id);
        const targetInLevel =
          level1.has(d.target.id) ||
          level2.has(d.target.id) ||
          level3.has(d.target.id);
        if (sourceInLevel && targetInLevel) {
          if (level1.has(d.source.id) && level1.has(d.target.id)) return 0.8;
          if (level2.has(d.source.id) && level2.has(d.target.id)) return 0.6;
          return 0.4;
        }
        return 0.07;
      })
      .attr("stroke-width", 2)
      .attr("stroke-linecap", "round");

    this.label
      .style("opacity", (d) => {
        if (d.id === nodeId) return 1;
        if (level1.has(d.id)) return 1;
        if (level2.has(d.id)) return 0.8;
        if (level3.has(d.id)) return 0.6;
        return 0.07;
      })
      .style("font-weight", (d) => (d.id === nodeId ? "bold" : "normal"))
      .style("font-size", "5px");

    this.zoomToNode(this.selectedNode);
  }

  zoomToNode(node) {
    if (!node || isNaN(node.x) || isNaN(node.y)) {
      console.error("Invalid node position:", node);
      return;
    }

    const container = this.graphSvg.parentElement;
    const width = container.clientWidth;
    const height = container.clientHeight;
    const scale = 2;

    const transform = d3.zoomIdentity
      .translate(width / 2, height / 2)
      .scale(scale)
      .translate(-node.x, -node.y);

    this.svg.transition().duration(750).call(this.zoom.transform, transform);
  }

  updateGraphVisibility() {
    if (this.node) {
      this.node.attr("opacity", 1);
    }
    if (this.link) {
      this.link.attr("opacity", 1);
    }
    if (this.label) {
      this.label.style("opacity", 1).style("display", "block");
    }
  }

  addToRecentHymns(node) {
    // Check if already exists
    const exists = this.recentNodes.some((n) => n.id === node.id);
    if (exists) return;

    // Add to beginning of array
    this.recentNodes.unshift({
      id: node.id,
      name: this.cleanSuktaName(node.name),
    });

    // Keep only last 5 items
    if (this.recentNodes.length > 5) {
      this.recentNodes.pop();
    }

    this.updateRecentHymnsList();
  }

  updateRecentHymnsList() {
    this.recentHymnsList.innerHTML = "";

    this.recentNodes.forEach((node, index) => {
      const item = document.createElement("div");
      item.className = `recent-hymn-item recent-hymn-${index + 1}`; // Add numbered class
      item.textContent = node.name;
      item.dataset.nodeId = node.id;
      item.addEventListener("click", () => {
        this.searchBox.value = node.name;
        this.currentSearchTerm = node.name;
        this.performSearch();
      });
      this.recentHymnsList.appendChild(item);
    });
  }
}
