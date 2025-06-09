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
    this.setupScrollControls();
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

    setupScrollControls() {
    const scrollUp = document.querySelector('.scroll-up');
    const scrollDown = document.querySelector('.scroll-down');
    const resultsContainer = document.querySelector('.results-list-container');

    if (scrollUp && scrollDown && resultsContainer) {
      // Set initial height (can adjust as needed)
      resultsContainer.style.maxHeight = '300px';

      scrollUp.addEventListener('click', () => {
        const currentHeight = parseInt(getComputedStyle(resultsContainer).maxHeight);
        if (currentHeight > 200) { // Minimum height
          resultsContainer.style.maxHeight = `${currentHeight - 50}px`;
        }
      });

      scrollDown.addEventListener('click', () => {
        const currentHeight = parseInt(getComputedStyle(resultsContainer).maxHeight);
        if (currentHeight < 600) { // Maximum height
          resultsContainer.style.maxHeight = `${currentHeight + 50}px`;
        }
      });
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
      let matchedNodes = this.processSearchResults(semanticData);

      this.updateSearchResults(matchedNodes, this.currentSearchTerm);
      this.loadGraphData(currentDatabase, this.currentSearchTerm, matchedNodes);
    } catch (error) {
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

  updateSearchResults(results, searchTerm) {
    this.searchSummary.innerHTML = "";
    this.updateRagSummary(results, searchTerm);
    this.renderResultsList(results);
  }

  updateRagSummary(results, searchTerm) {
    let summaryText = `Search for "${searchTerm}" found ${results.length} matching Suktas.`;
    if (results.length > 0) {
      summaryText += ` Key verses like ${results
        .slice(0, 3)
        .map((r) => this.cleanSuktaName(r.name))
        .join(", ")} are highlighted.`;
    }
    this.ragSummary.querySelector(
      ".summary-content"
    ).innerHTML = `<p>${summaryText}</p>`;
  }

  renderResultsList(results) {
    this.resultCards.innerHTML = "";

    if (results.length === 0) {
      this.resultCards.innerHTML =
        "<p class='no-results'>No Suktas found matching your search term.</p>";
      return;
    }

    const container = document.createElement("div");
    container.className = "results-list-container";

    const list = document.createElement("ul");
    list.className = "results-list";

    results.forEach((sukta, index) => {
      list.appendChild(this.createResultItem(sukta, index));
    });

    container.appendChild(list);

    if (results.length > 3) {
      container.appendChild(this.createToggleButton());
    }

    this.resultCards.appendChild(container);
  }

  createResultItem(sukta, index) {
    const cleanName = this.cleanSuktaName(sukta.name);
    const contentPreview = this.getContentPreview(sukta.text);

    const item = document.createElement("li");
    item.className = "result-item";
    item.innerHTML = `
      <div class="result-header">
        <span class="result-title">${cleanName}</span>
        <span class="result-score">${Math.max(70, 100 - index * 5)}%</span>
      </div>
      ${
        contentPreview
          ? `<div class="result-content"><p>${contentPreview}</p></div>`
          : ""
      }
      <div class="result-actions">
        <button class="view-connections" data-node-id="${sukta.id}">
          <i class="fas fa-link"></i> Connections
        </button>
        <button class="read-full" data-node-id="${
          sukta.id
        }" data-node-name="${cleanName}">
          <i class="fas fa-book-open"></i> Read
        </button>
      </div>`;

    item
      .querySelector(".view-connections")
      .addEventListener("click", () => this.handleViewConnections(sukta.id));
    item
      .querySelector(".read-full")
      .addEventListener("click", (event) =>
        this.handleReadFull(event, cleanName)
      );

    return item;
  }

  getContentPreview(text) {
    if (!text) return "";

    const firstLine = text.split(/[\n.]/)[0].trim();
    return firstLine.length > 0
      ? firstLine
      : text.substring(0, 60).trim() + (text.length > 60 ? "..." : "");
  }

  createToggleButton() {
    const toggle = document.createElement("div");
    toggle.className = "view-more-toggle";
    toggle.textContent = "Show More";
    return toggle;
  }

  handleViewConnections(nodeId) {
    const node = this.nodesData.find((n) => n.id === nodeId);
    if (!node) return;

    this.highlightGraphNode(nodeId);
    this.showPopup(node);
    this.zoomToNode(node);
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
  document.getElementById('search-guide-card').classList.remove('hidden');
  this.resultsContainer.style.display = "none";
  this.resetGraph();
  }

  // --- D3 Graph Initialization and Rendering ---
  initializeGraph() {
    const container = this.graphSvg.parentElement;
    const width = container.clientWidth;
    const height = container.clientHeight;

    this.svg.attr("width", width).attr("height", height);

    this.zoom = d3
      .zoom()
      .scaleExtent([0.1, 5])
      .on("zoom", (event) => {
        this.g.attr("transform", event.transform);
      });
    this.svg.call(this.zoom);
    this.g = this.svg.append("g");
    this.loadGraphData(this.databaseSelect.value);
  }

  loadGraphData(database, searchTerm = null, highlightNodes = []) {
    this.g.selectAll("*").remove();
    d3.json(database)
      .then((data) => {
        this.nodesData = data.nodes;
        this.edgesData = data.edges;

        const width = this.graphSvg.parentElement.clientWidth;
        const height = this.graphSvg.parentElement.clientHeight;

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

        // No fixed positions, let force simulation handle it
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
          .on("tick", () => this.ticked());

        this.link = this.g
          .append("g")
          .selectAll("line")
          .data(this.edgesData)
          .enter()
          .append("line")
          .attr("class", "edge")
          .attr("stroke-width", (d) => 11 - d.normalized_weight)
          .attr("stroke", "#aaa")
          .on("click", (event, d) => {
            if (this.selectedEdge) {
              this.selectedEdge.attr("stroke", "#aaa");
            }
            this.selectedEdge = d3
              .select(event.target)
              .attr("stroke", "red")
              .attr("stroke-width", 11 - d.normalized_weight);
            this.highlightEdgeNodes(d);
          })
          .on("mouseover", (event, d) => {
            d3.select(event.target)
              .attr("stroke", "red")
              .attr("stroke-width", 11 - d.normalized_weight);
          })
          .on("mouseout", (event, d) => {
            if (
              !this.selectedEdge ||
              d3.select(event.target).datum() !== this.selectedEdge.datum()
            ) {
              d3.select(event.target)
                .attr("stroke", "#aaa")
                .attr("stroke-width", 11 - d.normalized_weight);
            }
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
              .style("left", `${event.pageX + 5}px`)
              .style("top", `${event.pageY + 5}px`);
          })
          .on("mouseout", () => {
            this.tooltip.style("display", "none");
          })
          .on("click", (event, d) => {
            this.selectedNode = d;
            this.showPopup(d);
            this.zoomToNode(d);
            this.highlightGraphNode(d.id); // Highlight selected node and its connections
            this.displaySummary(d); // Display summary for the clicked node
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
          .style("font-size", "5px")
          .style("fill", "black");

        // Initial highlighting based on search results
        if (highlightNodes && highlightNodes.length > 0) {
          this.highlightGraphNode(highlightNodes[0].id);
        } else if (searchTerm) {
          this.ragSummary.querySelector(
            ".summary-content"
          ).innerHTML = `<p>No direct matches found in graph. Click on nodes to explore connections.</p>`;
        } else {
          this.ragSummary.querySelector(
            ".summary-content"
          ).innerHTML = `<p>Summary of search results will appear here.</p>`;
        }

        this.updateGraphVisibility(); // Apply initial visibility (all visible)
      })
      .catch((error) => {
        console.error("Error loading the graph data:", error);
      });
  }

  ticked() {
    this.link
      .attr("x1", (d) => d.source.x)
      .attr("y1", (d) => d.source.y)
      .attr("x2", (d) => d.target.x)
      .attr("y2", (d) => d.target.y);

    this.node.attr("cx", (d) => d.x).attr("cy", (d) => d.y);

    this.label.attr("x", (d) => d.x + 10).attr("y", (d) => d.y + 5);
  }

  dragStarted(event, d) {
    if (!event.active) this.simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
  }

  dragged(event, d) {
    d.fx = event.x;
    d.fy = event.y;
    this.simulation.alpha(0.3).restart();
  }

  dragEnded(event, d) {
    if (!event.active) this.simulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
  }

  highlightGraphNode(nodeId) {
    this.selectedNode = this.nodesData.find((n) => n.id === nodeId);
    if (!this.selectedNode) return;

    // Determine nodes to highlight up to 3 levels
    const highlightedNodeIds = new Set();
    const queue = [{ id: this.selectedNode.id, level: 0 }];
    highlightedNodeIds.add(this.selectedNode.id);

    let head = 0;
    while (head < queue.length) {
      const { id, level } = queue[head++];

      if (level < 3) {
        this.edgesData.forEach((edge) => {
          let connectedNodeId = null;
          if (edge.source.id === id) {
            connectedNodeId = edge.target.id;
          } else if (edge.target.id === id) {
            connectedNodeId = edge.source.id;
          }

          if (connectedNodeId && !highlightedNodeIds.has(connectedNodeId)) {
            highlightedNodeIds.add(connectedNodeId);
            queue.push({ id: connectedNodeId, level: level + 1 });
          }
        });
      }
    }

    this.node
      .attr("opacity", (d) => (highlightedNodeIds.has(d.id) ? 1 : 0.1))
      .attr("stroke", (d) =>
        d.id === this.selectedNode.id
          ? "red"
          : highlightedNodeIds.has(d.id)
          ? "orange"
          : null
      )
      .attr("stroke-width", (d) =>
        d.id === this.selectedNode.id
          ? 3
          : highlightedNodeIds.has(d.id)
          ? 1.5
          : null
      )
      .attr("fill", (d) =>
        d.id === this.selectedNode.id
          ? "darkred"
          : highlightedNodeIds.has(d.id)
          ? "darkblue"
          : "#7fb3d5"
      );

    this.link
      .attr("opacity", (d) =>
        highlightedNodeIds.has(d.source.id) &&
        highlightedNodeIds.has(d.target.id)
          ? 1
          : 0.1
      )
      .attr("stroke", (d) =>
        d.source.id === this.selectedNode.id ||
        d.target.id === this.selectedNode.id
          ? "red"
          : "#aaa"
      );

    this.label
      .style("opacity", (d) => (highlightedNodeIds.has(d.id) ? 1 : 0.1))
      .style("fill", (d) => (highlightedNodeIds.has(d.id) ? "red" : "black"));

    this.displaySummary(this.selectedNode); // Update summary for the highlighted node
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

  displaySummary(node) {
    const cleanName = this.cleanSuktaName(node.name);
    const summaryContentDiv = this.ragSummary.querySelector(".summary-content");
    if (window.getSuktaSummary) {
      // Check if the function exists
      const summary = window.getSuktaSummary(node.id);
      summaryContentDiv.innerHTML = `
            <h4>Summary for ${cleanName}</h4>
            <p>${summary || "Summary not available for this Sukta."}</p>
        `;
    } else {
      summaryContentDiv.innerHTML = `<p>Summary for ${cleanName} will appear here. (sukta_summary.js not loaded or function missing)</p>`;
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
