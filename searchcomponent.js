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
  }

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
  }

  setupEventListeners() {
    this.searchBox.addEventListener("input", this.handleSearchInput.bind(this));
    this.searchButton.addEventListener(
      "click",
      this.handleSearchClick.bind(this)
    );
    this.clearSearch.addEventListener("click", this.resetSearch.bind(this));
    this.databaseSelect.addEventListener(
      "change",
      this.handleDatabaseChange.bind(this)
    );
    this.searchBox.addEventListener("keydown", this.handleKeyDown.bind(this));

    // Popup/Read Chapter
    this.closePopupBtn.on("click", this.closePopup.bind(this));
    this.readChapterBtn.on("click", this.readChapter.bind(this));
  }

  handleSearchInput() {
    this.currentSearchTerm = this.searchBox.value.trim();
    this.toggleClearButton();

    if (this.searchTimeout) clearTimeout(this.searchTimeout);
    if (this.currentSearchTerm.length > 0) {
      this.searchTimeout = setTimeout(() => this.performSearch(), 300);
    }
  }

  handleSearchClick() {
    if (this.searchTimeout) clearTimeout(this.searchTimeout);
    this.performSearch();
  }

  handleDatabaseChange() {
    this.loadGraphData(this.databaseSelect.value, this.currentSearchTerm);
    if (this.currentSearchTerm.length > 0) {
      this.performSearch();
    } else {
      this.resetSearch();
    }
  }

  handleKeyDown(e) {
    if (e.key === "Enter") {
      if (this.searchTimeout) clearTimeout(this.searchTimeout);
      this.performSearch();
    }
  }

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
    window.location.href = `chapter.html?chapterId=${encodeURIComponent(
      chapterId
    )}&chapterName=${encodeURIComponent(
      chapterName
    )}&database=${encodeURIComponent(database)}`;
  }

  toggleClearButton() {
    this.clearSearch.classList.toggle(
      "visible",
      this.currentSearchTerm.length > 0
    );
  }

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

    try {
      const data = await d3.json(currentDatabase);
      this.nodesData = data.nodes;
      this.edgesData = data.edges;

      const semanticData = await this.fetchSemanticResults();
      console.log("RAG data received:", semanticData.rag_summary); // Debug

      let matchedNodes = this.processSearchResults(semanticData);

      // Pass semanticData to update results
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
    const response = await fetch("http://localhost:5000/semantic-search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: this.currentSearchTerm,
        top_k: 5,
        include_rag: true, // Request RAG summary from backend
      }),
    });
    return response.json();
  }

  processSearchResults(semanticData) {
    let matchedNodes = [];

    if (semanticData.results?.length > 0) {
      matchedNodes = semanticData.results
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

  showSearchError() {
    this.searchSummary.innerHTML = `<h2>Error</h2><p>Could not perform search.</p>`;
    this.ragSummary.querySelector(
      ".summary-content"
    ).innerHTML = `<p>An error occurred while performing search.</p>`;
  }

  updateSearchResults(results, searchTerm, semanticData) {
    this.searchSummary.innerHTML = `<h2>Results for "${searchTerm}"</h2>`;

    // Update RAG summary with the semanticData
    this.updateRagSummary(results, searchTerm, semanticData);

    // Render regular results (unchanged)
    this.renderResultsList(results);
  }

  updateRagSummary(results, searchTerm, semanticData) {
    const ragContainer = this.ragSummary.querySelector(".summary-content");

    if (semanticData?.rag_summary) {
      ragContainer.innerHTML = `
            <div class="rag-container">
                <h3>AI Analysis</h3>
                <div class="rag-content">${semanticData.rag_summary}</div>
                ${
                  semanticData.text_dict
                    ? `
                <div class="source-suktas">
                    <h4>Based on:</h4>
                    <ul>
                        ${Object.entries(semanticData.text_dict)
                          .map(
                            ([key, text]) => `
                        <li>
                            <strong>Sukta ${key}:</strong> 
                            ${this.getContentPreview(text)}
                        </li>`
                          )
                          .join("")}
                    </ul>
                </div>`
                    : ""
                }
            </div>`;
    } else {
      // Fallback to basic summary
      let summaryText = `Found ${results.length} matching Suktas for "${searchTerm}"`;
      if (results.length > 0) {
        summaryText += ` including ${results
          .slice(0, 3)
          .map((r) => this.cleanSuktaName(r.name))
          .join(", ")}`;
      }
      ragContainer.innerHTML = `<p>${summaryText}</p>`;
    }
  }

  renderResultsList(results) {
    this.resultCards.innerHTML = "";

    if (!results || results.length === 0) {
      this.resultCards.innerHTML =
        "<p class='no-results'>No Suktas found matching your search term.</p>";
      return;
    }

    // Create horizontal container
    const container = document.createElement("div");
    container.className = "horizontal-results-container";

    // Add results to horizontal container
    results.forEach((result, index) => {
      // Use the EXACT same name handling as original createResultItem
      const cleanName = this.cleanSuktaName(
        result.name || `RV ${result.index || ""}`
      );
      const contentPreview =
        result.text || this.getContentPreview(result.content);

      const item = document.createElement("div");
      item.className = "horizontal-result-item";
      item.innerHTML = `
            <div class="horizontal-result-header">
                <span class="horizontal-result-title">${cleanName}</span>
                <span class="horizontal-result-score">${Math.max(
                  70,
                  100 - index * 5
                )}%</span>
            </div>
            <div class="horizontal-result-content">
                ${contentPreview || "No preview available"}
            </div>
            <div class="horizontal-result-actions">
                <button class="view-connections" data-node-id="${
                  result.id || result.index
                }">
                    <i class="fas fa-link"></i> Connections
                </button>
                <button class="read-full" data-node-id="${
                  result.id || result.index
                }" 
                        data-node-name="${cleanName}">
                    <i class="fas fa-book-open"></i> Read
                </button>
            </div>
        `;

      // Maintain original event listeners
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

  // Keep your original cleanSuktaName method exactly as is
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

  // Keep your original getContentPreview method exactly as is
  getContentPreview(text) {
    if (!text) return "";

    const firstLine = text.split(/[\n.]/)[0].trim();
    return firstLine.length > 0
      ? firstLine
      : text.substring(0, 60).trim() + (text.length > 60 ? "..." : "");
  }

  handleViewSukta(suktaId) {
    const node = this.nodesData.find((n) => n.id.includes(suktaId));
    if (node) {
      this.zoomToNode(node);
      this.highlightGraphNode(node.id);
      this.showPopup(node);
    }
  }

  handleViewConnections(nodeId) {
    const node = this.nodesData.find((n) => n.id === nodeId);
    if (!node) return;
    this.zoomToNode(node);
    this.highlightGraphNode(nodeId);
    this.showPopup(node);
    this.ragSummary.querySelector(".summary-content").innerHTML = `
      <h4>Showing connections for: ${this.cleanSuktaName(node.name)}</h4>
      <p>Direct connections in dark blue, secondary in light blue, tertiary in gray.</p>
    `;
  }

  handleReadFull(event, chapterName) {
    const chapterId = event.target.dataset.nodeId;
    const database = this.databaseSelect.value;
    window.location.href = `chapter.html?chapterId=${encodeURIComponent(
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
    this.clearSearch.classList.remove("visible");
    document.body.classList.remove("search-active");
    this.welcomeSection.classList.remove("hidden");
    document.getElementById("search-guide-card").classList.remove("hidden");
    this.resultsContainer.style.display = "none";
    this.resetGraph();
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

  loadGraphData(database, searchTerm = null, highlightNodes = []) {
    this.g.selectAll("*").remove();

    // Example data fallback, replace with your d3.json(database) logic
    // d3.json(database)...
    d3.json(database)
      .then((data) => {
        this.nodesData = data.nodes;
        this.edgesData = data.edges;

        const width = this.graphSvg.parentElement.clientWidth;
        const height = this.graphSvg.parentElement.clientHeight;

        // D3 simulation
        this.simulation = d3
          .forceSimulation(this.nodesData)
          .force(
            "link",
            d3
              .forceLink(this.edgesData)
              .id((d) => d.id)
              .distance(80)
          )
          .force("charge", d3.forceManyBody().strength(-120))
          .force("center", d3.forceCenter(width / 2, height / 2))
          .on("tick", () => this.ticked());

        // Draw edges
        this.link = this.g
          .append("g")
          .attr("stroke", "#999")
          .attr("stroke-opacity", 0.6)
          .selectAll("line")
          .data(this.edgesData)
          .enter()
          .append("line")
          .attr("class", "link")
          .attr("stroke-width", 2);

        // Draw nodes
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
          .attr("r", 12)
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
            this.selectedNode = d;
            this.showPopup(d);
            this.zoomToNode(d);
            this.highlightGraphNode(d.id);
          });

        // Draw labels
        this.label = this.g
          .append("g")
          .selectAll("text")
          .data(this.nodesData)
          .enter()
          .append("text")
          .attr("dy", 4)
          .attr("x", 16)
          .text((d) => this.cleanSuktaName(d.name))
          .style("font-size", "11px")
          .style("fill", "black")
          .style("pointer-events", "none");

        this.updateGraphVisibility();
      })
      .catch((err) => {
        console.error("Graph data load error", err);
      });
  }

  ticked() {
    // Position edges
    this.link
      .attr("x1", (d) => d.source.x)
      .attr("y1", (d) => d.source.y)
      .attr("x2", (d) => d.target.x)
      .attr("y2", (d) => d.target.y);

    // Position nodes
    this.node.attr("cx", (d) => d.x).attr("cy", (d) => d.y);

    // Position labels
    this.label.attr("x", (d) => d.x + 16).attr("y", (d) => d.y);
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

    // Reset levels
    this.levels = { 1: new Set(), 2: new Set(), 3: new Set() };

    // 1st level connections (direct neighbors)
    this.edgesData.forEach((edge) => {
      if (edge.source.id === nodeId) this.levels[1].add(edge.target.id);
      if (edge.target.id === nodeId) this.levels[1].add(edge.source.id);
    });

    // 2nd level connections (friends of friends)
    this.levels[1].forEach((id) => {
      this.edgesData.forEach((edge) => {
        if (edge.source.id === id && edge.target.id !== nodeId) {
          this.levels[2].add(edge.target.id);
        }
        if (edge.target.id === id && edge.source.id !== nodeId) {
          this.levels[2].add(edge.source.id);
        }
      });
    });

    // 3rd level connections (friends of friends of friends)
    this.levels[2].forEach((id) => {
      this.edgesData.forEach((edge) => {
        if (edge.source.id === id && !this.levels[1].has(edge.target.id)) {
          this.levels[3].add(edge.target.id);
        }
        if (edge.target.id === id && !this.levels[1].has(edge.source.id)) {
          this.levels[3].add(edge.source.id);
        }
      });
    });

    // Remove duplicates (a node shouldn't appear in multiple levels)
    this.levels[2] = new Set(
      [...this.levels[2]].filter((id) => !this.levels[1].has(id))
    );
    this.levels[3] = new Set(
      [...this.levels[3]].filter(
        (id) => !this.levels[1].has(id) && !this.levels[2].has(id)
      )
    );

    // Apply visual styling
    this.node
      .attr("opacity", (d) => {
        if (d.id === nodeId) return 1;
        if (this.levels[1].has(d.id)) return 1;
        if (this.levels[2].has(d.id)) return 1;
        if (this.levels[3].has(d.id)) return 1;
        return 0.1;
      })
      .attr("fill", (d) => {
        if (d.id === nodeId) return "#ff0000"; // Red for selected node
        if (this.levels[1].has(d.id)) return "#1f77b4"; // Blue for 1st level
        if (this.levels[2].has(d.id)) return "#ff7f0e"; // Orange for 2nd level
        if (this.levels[3].has(d.id)) return "#2ca02c"; // Green for 3rd level
        return "#7fb3d5"; // Default color
      })
      .attr("stroke", (d) => (d.id === nodeId ? "#000" : "none"))
      .attr("stroke-width", (d) => (d.id === nodeId ? 2 : 0))
      .attr("r", (d) => {
        if (d.id === nodeId) return 12;
        if (this.levels[1].has(d.id)) return 10;
        return 8;
      });

    // Style links
    this.link
      .attr("stroke", (d) => {
        const sourceLevel = this.getNodeLevel(d.source.id);
        const targetLevel = this.getNodeLevel(d.target.id);

        if (sourceLevel === 1 && targetLevel === 1) return "#1f77b4";
        if (
          (sourceLevel === 1 && targetLevel === 2) ||
          (sourceLevel === 2 && targetLevel === 1)
        )
          return "#ff7f0e";
        if (sourceLevel > 0 && targetLevel > 0) return "#2ca02c";
        return "#aaa";
      })
      .attr("stroke-opacity", (d) => {
        const sourceVisible = this.getNodeLevel(d.source.id) > -1;
        const targetVisible = this.getNodeLevel(d.target.id) > -1;
        return sourceVisible && targetVisible ? 0.6 : 0.1;
      })
      .attr("stroke-width", (d) => {
        const sourceLevel = this.getNodeLevel(d.source.id);
        const targetLevel = this.getNodeLevel(d.target.id);
        if (sourceLevel === 1 && targetLevel === 1) return 3;
        if (sourceLevel > 0 && targetLevel > 0) return 2;
        return 1;
      });

    // Style labels
    this.label
      .style("opacity", (d) => {
        if (d.id === nodeId) return 1;
        if (this.levels[1].has(d.id)) return 0.9;
        if (this.levels[2].has(d.id)) return 0.7;
        if (this.levels[3].has(d.id)) return 0.5;
        return 0;
      })
      .style("font-weight", (d) => (d.id === nodeId ? "bold" : "normal"));
  }

  highlightEdgeNodes(edge) {
    this.node.attr("fill", (d) => {
      if (d.id === edge.source.id) return "blue";
      if (d.id === edge.target.id) return "green";
      return "#7fb3d5"; // Default color for others
    });
    this.node
      .attr("stroke", (d) => {
        if (d.id === edge.source.id || d.id === edge.target.id) return "red";
        return null;
      })
      .attr("stroke-width", (d) => {
        if (d.id === edge.source.id || d.id === edge.target.id) return 2;
        return null;
      });

    this.link.attr("stroke", (l) => (l === edge ? "red" : "#aaa"));
    this.label.style("fill", (d) => {
      if (d.id === edge.source.id || d.id === edge.target.id) return "red";
      return "black";
    });
  }

  zoomToNode(node) {
    const x = node.x;
    const y = node.y;
    const scale = 2; // Zoom level
    const transform = d3.zoomIdentity
      .translate(
        this.graphSvg.parentElement.clientWidth / 2,
        this.graphSvg.parentElement.clientHeight / 2
      )
      .scale(scale)
      .translate(-x, -y);
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
      this.label.style("opacity", 1).style("display", "block"); // Ensure labels are visible
    }
  }

  resetGraph() {
    // Clear graph elements
    this.g.selectAll("*").remove();
    // Reload initial graph data (resets colors, positions, etc.)
    this.loadGraphData(this.databaseSelect.value);
    // Reset zoom/pan
    this.svg
      .transition()
      .duration(750)
      .call(this.zoom.transform, d3.zoomIdentity);
    // Reset selection
    this.selectedNode = null;
    this.selectedEdge = null;
    this.isolateMode = false;
    this.levels = { 1: new Set(), 2: new Set(), 3: new Set() };
    this.popup.style("display", "none");
    this.ragSummary.querySelector(
      ".summary-content"
    ).innerHTML = `<p>Summary of search results will appear here.</p>`;
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
}
