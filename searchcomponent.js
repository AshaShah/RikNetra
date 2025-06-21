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
    // this.clearSearch.addEventListener("click", this.resetSearch.bind(this));
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
      // Remove **text** and format bullets
      let formattedSummary = semanticData.rag_summary
        .replace(/\*\*(.*?)\*\*/g, "$1") // Remove **bold**
        .replace(/^\s*-\s*/gm, "<br>• ") // Replace - with • and new line
        .replace(/\n/g, "<br>"); // Preserve other line breaks

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

    // VERTICAL container
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
      item.innerHTML = `
      <div class="vertical-result-header">
        <span class="vertical-result-title">${cleanName}</span>
        <span class="vertical-result-score">${Math.max(
          70,
          100 - index * 5
        )}%</span>
      </div>
      <div class="vertical-result-content">
        ${contentPreview || "No preview available"}
      </div>
      <div class="vertical-result-actions">
        <button class="view-connections" data-node-id="${
          result.id || result.index
        }">
          <i class="fas fa-link"></i> View Graph
        </button>
        <button class="read-full" data-node-id="${
          result.id || result.index
        }" data-node-name="${cleanName}">
          <i class="fas fa-book-open"></i> Read Full
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
    }
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
    this.zoomToNode(node);
    this.highlightGraphNode(node.id);
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

  // --- THE MAIN CHANGE: ADD forceX/forceY and xScale/yScale for fixed layout ---
  loadGraphData(database, searchTerm = null, highlightNodes = []) {
    this.g.selectAll("*").remove();

    d3.json(database)
      .then((data) => {
        this.nodesData = data.nodes;
        this.edgesData = data.edges;

        const width = this.graphSvg.parentElement.clientWidth;
        const height = this.graphSvg.parentElement.clientHeight;

        // Normalize edge weights exactly like the reference code
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

        // Use the same scaling approach as reference code
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
          .attr("stroke-width", 2) // Constant width
          .attr("stroke", "#aaa")
          .attr("stroke-opacity", 0.6)
          .on("click", (event, d) => {
            this.selectedEdge = d3.select(event.target);
            this.highlightEdgeNodes(d);
            this.selectedEdge
              .attr("stroke", "red")
              .attr("stroke-width", 2); // Constant width
          })
          .on("mouseover", (event, d) => {
            d3.select(event.target)
              .attr("stroke", "red")
              .attr("stroke-width", 2); // Constant width
          })
          .on("mouseout", (event, d) => {
            if (
              !this.selectedEdge ||
              d3.select(event.target).datum() !== this.selectedEdge.datum()
            ) {
              d3.select(event.target)
                .attr("stroke", "#aaa")
                .attr("stroke-width", 2); // Constant width
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
            if (this.selectedNode && this.selectedNode.id === d.id) {
              this.resetGraphHighlights();
              this.selectedNode = null;
              this.popup.style("display", "none");
              return;
            }
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
          .attr("x", (d) => d.x + 10)
          .attr("y", (d) => d.y + 5)
          .text((d) => this.cleanSuktaName(d.name))
          .style("font-size", "6px")
          .style("fill", "black")
          .style("pointer-events", "none");

        if (highlightNodes && highlightNodes.length > 0) {
          this.highlightGraphNode(highlightNodes[0].id);
          this.zoomToNode(highlightNodes[0].id);
        }
      })
      .catch((err) => {
        console.error("Graph data load error", err);
      });
  }

  // --- END MAIN CHANGE ---

  ticked() {
    try {
      this.link
        .attr("x1", (d) => d.source.x || 0)
        .attr("y1", (d) => d.source.y || 0)
        .attr("x2", (d) => d.target.x || 0)
        .attr("y2", (d) => d.target.y || 0);

      this.node.attr("cx", (d) => d.x || 0).attr("cy", (d) => d.y || 0);

      this.label.attr("x", (d) => (d.x || 0) + 16).attr("y", (d) => d.y || 0);
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
    const level1 = new Set(); // Direct connections
    const level2 = new Set(); // Friends of friends
    const level3 = new Set(); // Friends of friends of friends

    // Find level 1 connections
    this.edgesData.forEach((edge) => {
      if (edge.source.id === nodeId) level1.add(edge.target.id);
      if (edge.target.id === nodeId) level1.add(edge.source.id);
    });

    // Find level 2 connections
    level1.forEach((id) => {
      this.edgesData.forEach((edge) => {
        if (edge.source.id === id && edge.target.id !== nodeId)
          level2.add(edge.target.id);
        if (edge.target.id === id && edge.source.id !== nodeId)
          level2.add(edge.source.id);
      });
    });

    // Find level 3 connections
    level2.forEach((id) => {
      this.edgesData.forEach((edge) => {
        if (edge.source.id === id && !level1.has(edge.target.id))
          level3.add(edge.target.id);
        if (edge.target.id === id && !level1.has(edge.source.id))
          level3.add(edge.source.id);
      });
    });

    // Remove duplicates from higher levels
    level2.forEach((id) => {
      if (level1.has(id)) level2.delete(id);
    });
    level3.forEach((id) => {
      if (level1.has(id) || level2.has(id)) level3.delete(id);
    });

    // Color scheme - matching suktaconnection.html
    const colors = {
      selected: "#E57373", // Selected node color
      level1: "#FFB74D", // Direct connections color
      level2: "#64B5F6", // Friends of friends color
      level3: "#81C784", // Friends of friends of friends color
      default: "#7fb3d5", // Default node color
      edgeDefault: "#aaa", // Default edge color
      edgeHighlight: "#E97777", // Edge highlight color (matches selected node)
    };

    // Style nodes - matching opacity and sizing from suktaconnection.html
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

    this.link
      .attr("stroke", (d) => {
        if (d.source.id === nodeId || d.target.id === nodeId)
          return colors.edgeHighlight;
        if (level1.has(d.source.id) || level1.has(d.target.id))
          return colors.level1;
        if (level2.has(d.source.id) || level2.has(d.target.id))
          return colors.level2;
        if (level3.has(d.source.id) || level3.has(d.target.id))
          return colors.level3;
        return colors.edgeDefault;
      })
      .attr("stroke-opacity", (d) => {
        if (d.source.id === nodeId || d.target.id === nodeId) return 1;
        if (level1.has(d.source.id) || level1.has(d.target.id)) return 0.8;
        if (level2.has(d.source.id) || level2.has(d.target.id)) return 0.6;
        if (level3.has(d.source.id) || level3.has(d.target.id)) return 0.4;
        return 0.07;
      })
      .attr("stroke-width", 2) // Constant width
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
      .style("font-size", "6px");
  }

  resetGraphHighlights() {
    this.node
      .attr("opacity", 1)
      .attr("fill", "#7fb3d5")
      .attr("stroke", "none")
      .attr("stroke-width", 0)
      .attr("r", 8);

    this.link
      .attr("stroke", "#aaa")
      .attr("stroke-opacity", 0.6)
      .attr("stroke-width", 2); // Constant width

    this.label.style("opacity", 1).style("font-weight", "normal");
  }
  // --- Zoom to node function ---
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
      this.label.style("opacity", 1).style("display", "block"); // Ensure labels are visible
    }
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
