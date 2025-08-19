# RikNetra

RikNetra is an interactive web platform for exploring the Rigveda, an ancient Hindu scripture, through semantic search, interconnected hymn visualization, and textual analysis. It leverages natural language processing (NLP) and graph-based visualization to enable scholars, researchers, and enthusiasts to navigate Rigvedic hymns (suktas) intuitively.

<img src="static/Images/riknetra.png" alt="RikNetra Screenshot" width="300">

## Features

- **Semantic Search**: Search Rigveda suktas using keywords, queries, or specific hymn references (e.g., "RV 1.1", "hymns to Agni"). Powered by SentenceTransformer embeddings and TF-IDF for enhanced query understanding.
- **Graph Visualization**: Visualize connections between suktas using an interactive force-directed graph, built with D3.js. Supports zoom, drag, node highlighting, and topic-based color coding.
- **RAG Summary**: Retrieve augmented generation (RAG) summaries for search results, providing concise insights into selected hymns using Cohere's language model.
- **Triptych Layout**: Displays search results in a three-column layout: top results, connection graph, and RAG summary.
- **Dark Mode**: Toggle between light and dark themes for comfortable reading.
- **Sukta Reader**: Read full texts of suktas with related connections, sourced from Griffith's and Jamison's translations of the Rigveda.
- **Database Selection**: Choose from multiple graph databases (k3 to k11) representing suktas with varying connection densities (2 to 10 neighbors).
- **Topic Visualization**: Toggle topic-based node coloring in the graph to highlight thematic clusters (e.g., Creation, Marut, Surya).
