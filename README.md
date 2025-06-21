To run locally,

1. Install all the dependency: pip3 install -r requirements.txt
2. Run two terminal parallel
- python3 pythoncode/semanticsearch.py
- python3 -m http.server 8000
___________________________________

# RikNetra: Rigveda Knowledge Network

## Overview
RikNetra is an interactive web application that visualizes and explores the interconnected wisdom of the Rigveda, one of the oldest sacred texts of Hinduism. This project combines modern data visualization techniques with ancient Vedic knowledge to reveal hidden connections between suktas (hymns) in the Rigveda.

## Key Features
- **Interactive Network Visualization**: Explore connections between Rigveda suktas through an interactive force-directed graph
- **Comprehensive Search**: 
  - Semantic search using SBERT vector cosine similarities
  - Traditional graph search
  - Combined results for comprehensive exploration
- **RAG Summarization**: AI-powered summarization of search results and connections
- **Multiple Connection Views**: Analyze suktas with varying degrees of connections (2-10 connections)
- **Detailed Sukta Exploration**: Read individual suktas with their related hymns
- **Dark Mode**: Eye-friendly dark theme option

## Technical Components
### Frontend
- **D3.js**: For interactive network visualizations and graph rendering
- **Modern Web Technologies**: HTML5, CSS3, JavaScript (ES6+)
- **Responsive Design**: Adapts to different screen sizes
- **UI Components**:
  - Interactive side panel
  - Search functionality with filters
  - Zoom and pan controls for graphs
  - Node isolation features

### Backend (Future Implementation)
- **SBERT Integration**: For semantic search capabilities
- **RAG Pipeline**: For generating summaries and insights
- **Vector Database**: To store and query Sukta embeddings

## Project Structure
RikNetra/
├── css/
│ ├── index.css
│ ├── chapter.css
│ └── suktaconnection.css
├── database/
│ ├── k3database.json (2 connections)
│ ├── k4database.json (3 connections)
│ ├── ...
│ └── k11database.json (10 connections)
├── Images/
│ └── riknetra.png
├── js/
│ ├── searchComponent.js
│ ├── darkMode.js
│ └── sukta_summary.js
├── index.html (Main interface)
├── chapter.html (Sukta reader)
└── suktasconnection.html (Network visualization)


## How to Use
1. **Home Page (index.html)**:
   - Search for suktas using keywords or references
   - View top results and their connections
   - See AI-generated summaries of search results

2. **Network Visualization (suktasconnection.html)**:
   - Explore the interconnected web of suktas
   - Zoom and pan through the network
   - Isolate specific nodes to focus on particular connections
   - Click on nodes to see detailed information

3. **Sukta Reader (chapter.html)**:
   - Read individual suktas with proper formatting
   - View connected suktas and their relationships
   - Access dropdown content for additional context

## Future Enhancements
1. **Enhanced Semantic Search**: Improve SBERT integration for more accurate results
2. **Advanced Analytics**: Add more sophisticated graph analysis tools
3. **User Accounts**: Allow users to save searches and create annotations
4. **Multilingual Support**: Add translations for broader accessibility
5. **Comparative Analysis**: Tools to compare different suktas or versions

## Installation
To run RikNetra locally:
1. Clone the repository
2. Navigate to the project directory
3. Open any HTML file in your preferred browser (Chrome/Firefox recommended)

## Dependencies
- D3.js (v7)
- Font Awesome (v6)

## Contributing
Contributions are welcome! Please fork the repository and submit pull requests for any improvements or bug fixes.

## License
This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments
- The ancient Rishis who composed the Rigveda
- Developers of D3.js for the powerful visualization library
- The open-source community for various tools and libraries used in this project
