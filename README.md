# RikNetra

RikNetra is an interactive web platform for exploring the ancient wisdom of the Rigveda through semantic search, interconnected verse visualization, and detailed textual analysis. It leverages natural language processing (NLP) and graph-based visualization to provide an intuitive interface for scholars, researchers, and enthusiasts to discover and navigate Rigvedic hymns (suktas).

![RikNetra Screenshot](Images/riknetra.png)

## Features

- **Semantic Search**: Search Rigveda suktas using keywords, queries, or specific hymn references (e.g., "RV 1.1", "hymns to Agni"). Powered by SentenceTransformer embeddings and TF-IDF for enhanced query understanding.
- **Graph Visualization**: Visualize connections between suktas using an interactive force-directed graph, built with D3.js. Supports zoom, drag, and node highlight.
- **RAG Summary**: Retrieve augmented generation (RAG) summaries for search results, providing concise insights into selected hymns using Cohere's language model.
- **Triptych Layout**: Displays search results in a three-column layout: top results, connection graph, and summary.
- **Dark Mode**: Toggle between light and dark themes for comfortable reading.
- **Sukta Reader**: Read full texts of suktas with related connections, sourced from Griffith's translation of the Rigveda.
- **Database Selection**: Choose from multiple graph databases (k3 to k11) representing suktas with varying connection densities.

## Tech Stack

- **Backend**:
  - Flask (Python): Serves the semantic search API.
  - SentenceTransformers (`all-mpnet-base-v2`): Generates text embeddings for semantic similarity.
  - Cohere API: Powers RAG-based summarization.
  - TF-IDF Vectorizer: Enhances query processing with keyword extraction.
  - NLTK: Handles text preprocessing (stopwords, tokenization).
  
- **Frontend**:
  - HTML/CSS/JavaScript: Core web interface.
  - D3.js: Renders interactive force-directed graphs.
  - Font Awesome: Provides icons for UI elements.
  
- **Data**:
  - Griffith’s Rigveda Translation: Text source for suktas.
  - Precomputed Embeddings: Stored in TSV files for efficient similarity search.
  - JSON Databases: Graph data (nodes and edges) for suktas with varying connections.

## Installation

### Prerequisites
- Python 3.8+
- Node.js (optional, for local development)
- Git
- Cohere API key (sign up at [Cohere](https://cohere.ai/))

### Steps

1. **Clone the Repository**:
   git clone https://github.com/AshaShah/Visualization.git

2. **Install Python Dependencies**:
    `pip install -r python/requirements.txt`

3. **Configure Cohere API Key**:
   Replace the placeholder API key in `semanticsearch.py` with your Cohere API key:
   co = cohere.ClientV2(api_key="your-cohere-api-key")

4. **Download NLTK Data**:
   `python -c "import nltk; nltk.download('stopwords'); nltk.download('punkt')"`

5. **Prepare Data**:
   Ensure the following files are in the `pythoncode/` directory:
   - `Griffith_Translation_Rigveda.txt`: Sukta texts.
   - `sbert_queryembeddings.tsv`: Precomputed embeddings.
   - `suktalabels.tsv`: Sukta labels.
   - `consuktasrigveda.txt`: Preprocessed Rigveda text for TF-IDF.
   - Place graph databases (`k3database.json to k11database.json`) in the `database/` directory.

6. **Run the Flask API**:
   python pythoncode/semanticsearch.py
   The API will run at `http://localhost:5000`.

7. **Serve the Frontend**:
   Use a static file server (e.g., Python’s http.server):
      `python -m http.server 8000`
      Open `http://localhost:8000/index.html` in your browser.
      
### Usage

1. **Home Page (`index.html`)**:
   - Enter a search query (e.g., "RV 1.1", "hymns to Indra", or "What is creation").
   - Select a database (k3 to k11) to adjust connection density.
   - View results in the triptych layout: top results, graph visualization, and RAG summary.
   - Click tags (e.g., "Purusha Sukta") for quick searches.

2. **Sukta Connections (`suktasconnection.html`)**:
   - Explore suktas as an interactive graph.
   - Click nodes to view connections and zoom.
   - Use controls to toggle labels, isolate nodes, or switch to multi-color mode.

3. **Read Suktas (`chapter.html`)**:
   - View full sukta text with related suktas listed.
   - Search for specific suktas (e.g., "RV 1.1").

### Project Structure

riknetra/
├── css/
│   ├── chapter.css
│   ├── index.css
│   ├── suktaconnection.css
├── database/
│   ├── k3database.json
│   ├── ...
│   ├── k11database.json
├── darkmode/
│   ├── darkMode.js
├── Images/
│   ├── riknetra.png
├── pythoncode/
│   ├── Griffith_Translation_Rigveda.txt
│   ├── sbert_queryembeddings.tsv
│   ├── suktalabels.tsv
│   ├── consuktasrigveda.txt
|   ├── requirements.txt
|   ├── semanticsearch.py
├── searchcomponent.js
├── suktaconnection.html
├── chapter.html
├── index.html
├── README.md

### Contributing

Contributions are welcome! Please follow these steps:

   - Fork the repository.
   - Create a feature branch (git checkout -b feature/your-feature).
   - Commit your changes (git commit -m "Add your feature").
   - Push to the branch (git push origin feature/your-feature).
   - Open a pull request.

### Acknowledgments
   - Griffith’s Translation of the Rigveda for textual data.
   - SentenceTransformers for semantic embeddings.
   - Cohere for RAG summarization.
   - D3.js for graph visualization.


© 2025 RikNetra. All rights reserved.