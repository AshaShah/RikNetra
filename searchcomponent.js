class RigvedaSearch {
  constructor(options) {
    // DOM Elements
    this.searchBox = options.searchBox;
    this.searchButton = options.searchButton;
    this.clearSearch = options.clearSearch;
    this.databaseSelect = options.databaseSelect;
    this.resultsContainer = options.resultsContainer;
    this.welcomeSection = options.welcomeSection;
    this.searchSection = options.searchSection; // Added for search section control
    this.topResults = options.topResults;
    this.graphSection = options.graphSection;
    this.searchSummary = options.searchSummary;
    this.ragSummary = options.ragSummary;
    this.resultCards = options.resultCards;
    this.graphSvg = options.graphSvg; // D3 SVG element

    // D3 Graph Variables
    this.g = null; // D3 group element for graph
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
    this.selectedNode = null; // Currently selected node for highlighting
    this.selectedEdge = null; // Currently selected edge

    // Search state
    this.currentSearchTerm = '';
    this.searchTimeout = null;

    // Initialize
    this.setupEventListeners();
    this.initializeGraph(); // Setup D3 graph initially
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
      this.loadGraphData(this.databaseSelect.value, this.currentSearchTerm); // Reload graph data with new database
      if (this.currentSearchTerm.length > 0) {
        this.performSearch(); // Re-run search with new database
      } else {
        this.resetSearch(); // Reset if no search term but database changed
      }
    });

    // Enter key to search
    this.searchBox.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        if (this.searchTimeout) clearTimeout(this.searchTimeout);
        this.performSearch();
      }
    });

    // Graph popup close and read chapter
    this.closePopupBtn.on("click", () => {
      this.popup.style("display", "none");
      this.isolateMode = false; // Reset isolate mode when popup closes
      this.updateGraphVisibility();
      this.resetGraphHighlights(); // Reset node/link highlights
    });

    this.readChapterBtn.on("click", () => {
      if (this.selectedNode) {
        const chapterName = this.selectedNode.name;
        const chapterId = this.selectedNode.id;
        const database = this.databaseSelect.value;
        window.location.href = `chapter.html?chapterId=${encodeURIComponent(chapterId)}&chapterName=${encodeURIComponent(chapterName)}&database=${encodeURIComponent(database)}`;
      } else {
        alert("Please select a node first.");
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

  showLoading() {
    // Activate search mode
    document.body.classList.add('search-active');
    this.welcomeSection.classList.add('hidden'); // Hide welcome section

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
    this.resultsContainer.style.display = 'flex'; // Show results container
  }

  performSearch() {
    if (this.currentSearchTerm.length === 0) {
      this.resetSearch();
      return;
    }

    this.showLoading();

    const currentDatabase = this.databaseSelect.value;

    // Simulate API call for search results (top 5 matching)
    // In a real app, this would be an actual API call to your backend
    // which returns matching suktas and their summary/connections.
    d3.json(currentDatabase).then(data => {
      // Filter nodes based on search term
      const matchedNodes = data.nodes.filter(node =>
        node.name.toLowerCase().includes(this.currentSearchTerm.toLowerCase()) ||
        (node.content && node.content.toLowerCase().includes(this.currentSearchTerm.toLowerCase()))
      );

      // Sort by relevance (e.g., if content matches more, higher relevance)
      const topResults = matchedNodes.slice(0, 5); // Take top 5

      // Update UI
      this.updateSearchResults(topResults, this.currentSearchTerm);

      // Now, load the graph based on the selected database and highlight
      this.loadGraphData(currentDatabase, this.currentSearchTerm, topResults);
    }).catch(error => {
      console.error("Error loading database for search:", error);
      this.searchSummary.innerHTML = `<h2>Error</h2><p>Could not load search results.</p>`;
      this.ragSummary.querySelector('.summary-content').innerHTML = `<p>An error occurred while fetching data.</p>`;
      this.resultCards.innerHTML = `<p>No results found due to an error.</p>`;
    });
  }

  updateSearchResults(results, searchTerm) {
    this.searchSummary.innerHTML = `
      <h2>Results for "${searchTerm}"</h2>
      <p>Found ${results.length} matching Suktas</p>
    `;

    // Simulate RAG summary (replace with actual summary generation)
    let summaryText = `The search for "${searchTerm}" revealed connections within the selected Rigveda database. `;
    if (results.length > 0) {
      summaryText += `Key verses like ${results.map(r => r.name).join(', ')} are highlighted, touching upon themes relevant to your query.`;
    } else {
      summaryText += `No direct matches were found, but the network might reveal indirect connections.`;
    }

    this.ragSummary.querySelector('.summary-content').innerHTML = `<p>${summaryText}</p>`;

    this.resultCards.innerHTML = '';
    if (results.length > 0) {
      results.forEach((sukta, index) => {
        const card = document.createElement('div');
        card.classList.add('result-card');
        card.innerHTML = `
          <h3>${sukta.name}</h3>
          <span class="score">Relevance: ${Math.max(70, 100 - index * 5)}%</span> <p>${sukta.content ? sukta.content.substring(0, 150) + '...' : 'No summary available.'}</p>
          <div class="actions">
            <button class="view-connections" data-node-id="${sukta.id}"><i class="fas fa-link"></i> View Connections</button>
            <button class="read-full" data-node-id="${sukta.id}" data-node-name="${sukta.name}"><i class="fas fa-book-open"></i> Read Full</button>
          </div>
        `;
        this.resultCards.appendChild(card);

        // Add event listeners to the new buttons
        card.querySelector('.view-connections').addEventListener('click', () => {
          this.highlightGraphNode(sukta.id);
          this.showPopup(sukta); // Show popup for the clicked node
          this.zoomToNode(this.nodesData.find(n => n.id === sukta.id)); // Zoom to the node
        });
        card.querySelector('.read-full').addEventListener('click', (event) => {
          const chapterId = event.target.dataset.nodeId;
          const chapterName = event.target.dataset.nodeName;
          const database = this.databaseSelect.value;
          window.location.href = `chapter.html?chapterId=${encodeURIComponent(chapterId)}&chapterName=${encodeURIComponent(chapterName)}&database=${encodeURIComponent(database)}`;
        });
      });
    } else {
      this.resultCards.innerHTML = '<p>No Suktas found matching your search term.</p>';
    }
  }

  resetSearch() {
    this.currentSearchTerm = '';
    this.searchBox.value = '';
    this.clearSearch.classList.remove('visible');
    document.body.classList.remove('search-active');
    this.welcomeSection.classList.remove('hidden'); // Show welcome section
    this.resultsContainer.style.display = 'none'; // Hide results container
    this.resetGraph(); // Reset the graph view
  }

  // --- D3 Graph Initialization and Rendering ---
  initializeGraph() {
    const container = this.graphSvg.parentElement;
    const width = container.clientWidth;
    const height = container.clientHeight;

    this.svg.attr("width", width).attr("height", height);

    this.zoom = d3.zoom()
      .scaleExtent([0.1, 5])
      .on("zoom", (event) => {
        this.g.attr("transform", event.transform);
      });

    this.svg.call(this.zoom);

    // Append group element once
    this.g = this.svg.append("g");

    // Load initial graph data when the component initializes
    this.loadGraphData(this.databaseSelect.value);
  }

  resetGraphHighlights() {
    if (this.node) {
      this.node
        .attr("fill", "#7fb3d5") // Default color
        .attr("stroke", null)
        .attr("stroke-width", null);
    }
    if (this.link) {
      this.link
        .attr("stroke", "#aaa") // Default color
        .attr("stroke-width", d => 11 - d.normalized_weight);
    }
    if (this.label) {
        this.label.style("fill", "black");
    }
    this.selectedNode = null;
    this.selectedEdge = null;
    this.isolateMode = false; // Ensure isolate mode is off
    this.updateGraphVisibility(); // Update visibility to show all
  }

  loadGraphData(database, searchTerm = null, initialHighlightNodes = []) {
    this.g.selectAll("*").remove(); // Clear previous graph elements
    this.resetGraphHighlights(); // Reset highlights and colors

    d3.json(database).then(data => {
      this.nodesData = data.nodes;
      this.edgesData = data.edges;

      const width = this.graphSvg.parentElement.clientWidth;
      const height = this.graphSvg.parentElement.clientHeight;

      const weights = this.edgesData.map(d => d.weight);
      const min_weight = Math.min(...weights);
      const max_weight = Math.max(...weights);
      const new_min = 1;
      const new_max = 10;

      this.edgesData.forEach(d => {
        if (max_weight === min_weight) {
          d.normalized_weight = new_max;
        } else {
          d.normalized_weight = ((d.weight - min_weight) / (max_weight - min_weight)) * (new_max - new_min) + new_min;
        }
      });

      // No fixed positions, let force simulation handle it
      this.simulation = d3.forceSimulation(this.nodesData)
        .force("link", d3.forceLink(this.edgesData).id(d => d.id).distance(50))
        .force("charge", d3.forceManyBody().strength(-30))
        .force("center", d3.forceCenter(width / 2, height / 2))
        .on("tick", () => this.ticked());

      this.link = this.g.append("g")
        .selectAll("line")
        .data(this.edgesData)
        .enter()
        .append("line")
        .attr("class", "edge")
        .attr("stroke-width", d => 11 - d.normalized_weight)
        .attr("stroke", "#aaa")
        .on("click", (event, d) => {
          if (this.selectedEdge) {
            this.selectedEdge.attr("stroke", "#aaa");
          }
          this.selectedEdge = d3.select(event.target).attr("stroke", "red").attr("stroke-width", 11 - d.normalized_weight);
          this.highlightEdgeNodes(d);
        })
        .on("mouseover", (event, d) => {
          d3.select(event.target).attr("stroke", "red").attr("stroke-width", 11 - d.normalized_weight);
        })
        .on("mouseout", (event, d) => {
          if (!this.selectedEdge || d3.select(event.target).datum() !== this.selectedEdge.datum()) {
            d3.select(event.target).attr("stroke", "#aaa").attr("stroke-width", 11 - d.normalized_weight);
          }
        });

      const drag = d3.drag()
        .on("start", (event, d) => this.dragStarted(event, d))
        .on("drag", (event, d) => this.dragged(event, d))
        .on("end", (event, d) => this.dragEnded(event, d));

      this.node = this.g.append("g")
        .selectAll("circle")
        .data(this.nodesData)
        .enter()
        .append("circle")
        .attr("class", "node")
        .attr("r", 8)
        .attr("fill", "#7fb3d5")
        .call(drag)
        .on("mouseover", (event, d) => {
          this.tooltip.style("display", "block")
            .html(`<strong>${d.name}</strong>`)
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

      this.label = this.g.append("g")
        .selectAll("text")
        .data(this.nodesData)
        .enter()
        .append("text")
        .attr("x", d => d.x + 10)
        .attr("y", d => d.y + 5)
        .text(d => d.name)
        .style("font-size", "5px")
        .style("fill", "black");

      // Initial highlighting based on search results
      if (initialHighlightNodes.length > 0) {
        this.highlightGraphNode(initialHighlightNodes[0].id); // Highlight the first result by default
        this.displaySummary(initialHighlightNodes[0]); // Display summary for the first result
      } else if (searchTerm) {
        // If no direct matches but a search term was provided,
        // you might want to show a general summary or instruct user to click nodes.
        this.ragSummary.querySelector('.summary-content').innerHTML = `<p>No direct matches found in graph. Click on nodes to explore connections.</p>`;
      } else {
        // Default state when no search is active
        this.ragSummary.querySelector('.summary-content').innerHTML = `<p>Summary of search results will appear here.</p>`;
      }

      this.updateGraphVisibility(); // Apply initial visibility (all visible)

    }).catch(error => {
      console.error("Error loading the graph data:", error);
    });
  }

  ticked() {
    this.link
      .attr("x1", d => d.source.x)
      .attr("y1", d => d.source.y)
      .attr("x2", d => d.target.x)
      .attr("y2", d => d.target.y);

    this.node
      .attr("cx", d => d.x)
      .attr("cy", d => d.y);

    this.label
      .attr("x", d => d.x + 10)
      .attr("y", d => d.y + 5);
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
    this.selectedNode = this.nodesData.find(n => n.id === nodeId);
    if (!this.selectedNode) return;

    // Determine nodes to highlight up to 3 levels
    const highlightedNodeIds = new Set();
    const queue = [{ id: this.selectedNode.id, level: 0 }];
    highlightedNodeIds.add(this.selectedNode.id);

    let head = 0;
    while (head < queue.length) {
        const { id, level } = queue[head++];

        if (level < 3) {
            this.edgesData.forEach(edge => {
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

    this.node.attr("opacity", d => highlightedNodeIds.has(d.id) ? 1 : 0.1)
      .attr("stroke", d => d.id === this.selectedNode.id ? "red" : (highlightedNodeIds.has(d.id) ? "orange" : null))
      .attr("stroke-width", d => d.id === this.selectedNode.id ? 3 : (highlightedNodeIds.has(d.id) ? 1.5 : null))
      .attr("fill", d => d.id === this.selectedNode.id ? "darkred" : (highlightedNodeIds.has(d.id) ? "darkblue" : "#7fb3d5"));

    this.link.attr("opacity", d =>
      (highlightedNodeIds.has(d.source.id) && highlightedNodeIds.has(d.target.id)) ? 1 : 0.1
    ).attr("stroke", d =>
      (d.source.id === this.selectedNode.id || d.target.id === this.selectedNode.id) ? "red" : "#aaa"
    );

    this.label.style("opacity", d => highlightedNodeIds.has(d.id) ? 1 : 0.1)
        .style("fill", d => highlightedNodeIds.has(d.id) ? "red" : "black");

    this.displaySummary(this.selectedNode); // Update summary for the highlighted node
  }

  highlightEdgeNodes(edge) {
    this.node.attr("fill", d => {
      if (d.id === edge.source.id) return "blue";
      if (d.id === edge.target.id) return "green";
      return "#7fb3d5"; // Default color for others
    });
    this.node.attr("stroke", d => {
        if (d.id === edge.source.id || d.id === edge.target.id) return "red";
        return null;
    }).attr("stroke-width", d => {
        if (d.id === edge.source.id || d.id === edge.target.id) return 2;
        return null;
    });

    this.link.attr("stroke", l => l === edge ? "red" : "#aaa");
    this.label.style("fill", d => {
        if (d.id === edge.source.id || d.id === edge.target.id) return "red";
        return "black";
    });
  }


  showPopup(node) {
    this.popupTitle.text(`${node.name} and its related Sukta`);
    this.popupLinks.html("");

    const connections = this.edgesData.filter(e => e.source.id === node.id || e.target.id === node.id)
      .map(e => (e.source.id === node.id ? e.target : e.source))
      .sort((a, b) => a.name.localeCompare(b.name)); // Sort alphabetically

    // Remove duplicates
    const uniqueConnections = Array.from(new Set(connections.map(c => c.id)))
        .map(id => this.nodesData.find(n => n.id === id));


    uniqueConnections.forEach(conn => {
      this.popupLinks.append("li")
        .text(`${conn.name}`);
    });

    this.popup.style("display", "block");
  }

  zoomToNode(node) {
    const x = node.x;
    const y = node.y;
    const scale = 2; // Zoom level
    const transform = d3.zoomIdentity
      .translate(this.graphSvg.parentElement.clientWidth / 2, this.graphSvg.parentElement.clientHeight / 2)
      .scale(scale)
      .translate(-x, -y);
    this.svg.transition().duration(750).call(this.zoom.transform, transform);
  }

  updateGraphVisibility() {
    // For now, this is simpler, just showing all.
    // If you re-introduce isolate mode, this function will become more complex.
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
    // This function will fetch and display summary from sukta_summary.js
    // Assuming sukta_summary.js has a global function `getSuktaSummary`
    // or you pass the summary data through your database.
    const summaryContentDiv = this.ragSummary.querySelector('.summary-content');
    if (window.getSuktaSummary) { // Check if the function exists
        const summary = window.getSuktaSummary(node.id);
        summaryContentDiv.innerHTML = `
            <h4>Summary for ${node.name}</h4>
            <p>${summary || "Summary not available for this Sukta."}</p>
        `;
    } else {
        summaryContentDiv.innerHTML = `<p>Summary for ${node.name} will appear here. (sukta_summary.js not loaded or function missing)</p>`;
    }
  }

  resetGraph() {
      // Clear graph elements
      this.g.selectAll("*").remove();
      // Reload initial graph data (resets colors, positions, etc.)
      this.loadGraphData(this.databaseSelect.value);
      // Reset zoom/pan
      this.svg.transition().duration(750).call(this.zoom.transform, d3.zoomIdentity);
      // Reset selection
      this.selectedNode = null;
      this.selectedEdge = null;
      this.isolateMode = false;
      this.popup.style("display", "none");
      this.ragSummary.querySelector('.summary-content').innerHTML = `<p>Summary of search results will appear here.</p>`;
  }
}