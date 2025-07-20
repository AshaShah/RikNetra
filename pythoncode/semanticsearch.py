import re
import os
import nltk
import torch
import cohere 
import numpy as np
import pandas as pd
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from unidecode import unidecode
from nltk.corpus import stopwords
from sentence_transformers import SentenceTransformer
from sklearn.feature_extraction.text import TfidfVectorizer
from dotenv import load_dotenv
import logging
from concurrent.futures import ThreadPoolExecutor, TimeoutError

# Initialize logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Initialize Flask app
app = Flask(__name__,
            static_folder=os.path.join(os.path.dirname(os.path.abspath(__file__)), '../static'),
            template_folder=os.path.join(os.path.dirname(os.path.abspath(__file__)), '../templates'))
CORS(app)

# Health check endpoint (required by Render)
@app.route('/health')
def health_check():
    return jsonify({"status": "healthy"}), 200

# Initialize NLTK
nltk.download('stopwords')

# Set seeds for reproducibility
SEED = 42
torch.manual_seed(SEED)
np.random.seed(SEED)

# Configuration
MAX_TIMEOUT = 60  # seconds
TOP_K_RESULTS = 10

# Initialize resources in memory (only once when app starts)
logger.info("Starting application initialization...")

# 1. Load models and data efficiently
def load_resources():
    """Load all heavy resources once at startup"""
    resources = {}
    
    # Set device (use CPU on Render)
    device = torch.device("cpu")  # Force CPU for Render compatibility
    logger.info(f"Using device: {device}")
    
    # Load embedding model
    logger.info("Loading SentenceTransformer model...")
    resources['embedder'] = SentenceTransformer("all-mpnet-base-v2", device=device)
    resources['embedder'].eval()
    
    # Load data files
    logger.info("Loading data files...")
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    
    # Load embeddings
    logger.info("Loading SBERT embeddings...")
    corpus_np = np.loadtxt(os.path.join(BASE_DIR, "sbert_queryembeddings.tsv"), delimiter='\t')
    resources['corpus_embeddings'] = torch.tensor(corpus_np).to(device)
    
    # Load labels
    resources['labels'] = pd.read_csv(os.path.join(BASE_DIR, "suktalabels.tsv"), header=None)
    
    # Load text files
    def read_text_file(file_path):
        with open(file_path, 'r', encoding='utf-8') as f:
            return f.read()
    
    resources['griffith_text'] = read_text_file(os.path.join(BASE_DIR, "Griff_translation.txt"))
    rigsuktatext = read_text_file(os.path.join(BASE_DIR, "consuktasrigveda.txt"))
    
    # Initialize TF-IDF Vectorizer
    logger.info("Initializing TF-IDF vectorizer...")
    
    def preprocessing(raw_text):
        raw_text = raw_text.lower()
        raw_text = re.sub('[0-9]+', '', raw_text)
        raw_text = re.sub('—',' ', raw_text)
        raw_text = re.sub('–',' ', raw_text)
        pattern = r'[^\w\s]'
        clean_raw_text = re.sub(pattern, '', raw_text)
        clean_split_text = clean_raw_text.split('\n')
        sukta_stop_words = set(stopwords.words("english"))
        return [word for word in clean_split_text if word not in sukta_stop_words and len(word) > 2]
    
    def sukta_tokenizer(suktext):
        return suktext.split()
    
    processed_text = preprocessing(rigsuktatext)
    resources['vectorizer'] = TfidfVectorizer(
        tokenizer=sukta_tokenizer,
        max_df=0.75, 
        min_df=5, 
        token_pattern=None, 
        lowercase=False, 
        strip_accents=None
    )
    resources['vectorizer'].fit_transform(processed_text)
    
    logger.info("Resource loading completed!")
    return resources

# Load all resources at startup
resources = load_resources()

# Thread pool for handling requests
executor = ThreadPoolExecutor(max_workers=2)

# Optimized query processing function
def process_query(query, top_k=TOP_K_RESULTS):
    """Optimized version of user_query_function"""
    try:
        embedder = resources['embedder']
        corpus_embeddings = resources['corpus_embeddings']
        labels = resources['labels']
        griffith_text = resources['griffith_text']
        vectorizer = resources['vectorizer']
        
        query_lower = query.lower()
        query_trans = vectorizer.transform([query_lower])
        non_zero_items = list(zip(query_trans.indices, query_trans.data))
        
        top_terms = []
        if non_zero_items:
            sorted_items = sorted(non_zero_items, key=lambda x: x[1], reverse=True)
            suktafeat_names = vectorizer.get_feature_names_out()
            top_terms = [suktafeat_names[idx] for idx, _ in sorted_items[:5]]
        
        new_query_string = " ".join(top_terms) if len(top_terms) >= 2 else query_lower
        
        # Process embeddings
        query_embedding = embedder.encode(
            new_query_string, 
            convert_to_tensor=True,
            show_progress_bar=False
        ).to(dtype=torch.float64)
        
        # Efficient similarity calculation
        similarity_scores = torch.nn.functional.cosine_similarity(
            query_embedding.unsqueeze(0),
            corpus_embeddings
        )
        
        scores, indices = torch.topk(similarity_scores, k=min(top_k, len(griffith_text)))
        
        # Collect results
        text_dict = {}
        collected_text = []
        for score, idx in zip(scores, indices):
            index = idx.item()
            label_num = labels.iloc[index, 0]
            text_dict[label_num] = griffith_text[index]
            collected_text.append(griffith_text[index])
        
        return "".join(collected_text), text_dict
    
    except Exception as e:
        logger.error(f"Error in process_query: {str(e)}", exc_info=True)
        raise


# API endpoint for semantic search
@app.route('/semantic-search', methods=['POST'])
def api_semantic_search():
    data = request.get_json()
    query = data.get("query", "").strip().lower()
    
    if not query:
        return jsonify({"error": "Please enter a non-empty query"}), 400
    
    query_list = [query]
    num_of_suktas = 10
    print("Calling user_query_function")
    
    try:
        collected_text, text_dict = user_query_function(
            queries=query_list,
            text=griffith_text,
            k=num_of_suktas,
            embedding_model=embedder,
            text_embeddings=corpus_embeddings,
            sukta_labels=labels
        )
        print("user_query_function completed successfully")
        
        message = f"""{query}.
        Instructions:

        Generate a concise and focused summary based only on the given Rigveda hymns.
       
        Do not use bullet points. The summary must be written as a continuous paragraph, using natural language.
        Do not start the summary with the phrase "The Rigveda hymns"; instead, return the summary content directly.

        Stay strictly on the topic of the user's query, and include only information that is contextually present in the hymns provided.

        You are only allowed to use knowledge derived from the Rigveda context.
        If the user's query is unrelated or no relevant information is found in the hymns, respond politely:

        "The entered query '<user_query>' is not relevant to the Rigveda context. Please enter a query related to the Rigveda."

        Do not generate any content that is not grounded in the given hymns.

        Example 1 — Query: "What is Creation"

        The origins of the universe are described as beginning in a state of neither existence nor non-existence, shrouded in darkness.
        From this void emerged Desire, the primal force of creation. The hymns reference Hiranyagarbha, the golden womb, as the cosmic source of all,
        along with deities like Savitar and Visvakarman who shaped the cosmos. The cycle of creation, sacrifice, and divine order is emphasized,
        along with Indra's role in defeating chaos and releasing the life-giving waters.

        Example 2 — Query: "What is computer science"

        The entered query "What is computer science" is not relevant to the Rigveda context. Please enter a query related to the Rigveda.

        
        \n{collected_text}"""

        print(f"Collected text length: {len(collected_text)}")
        print(f"Text dict: {text_dict}")

        cohere_api_key = os.getenv("COHERE_API_KEY")
        if not cohere_api_key:
            print("Cohere API key not found")
            return jsonify({"error": "Cohere API key not found in .env file"}), 500
        
        print("Initializing Cohere client")
        co = cohere.ClientV2(api_key=os.getenv("COHERE_API_KEY"))


        print("Sending Cohere chat request")
        response = co.chat(
            model="command-a-03-2025",
            messages=[{"role": "user", "content": message}],
            temperature=0.0
        )
        llm_text = response.message.content[0].text.strip()
        print(f"Cohere response: {llm_text}")
        
        return jsonify({
            "results": [{"sukta": f"RV {k}", "text": v} for k, v in text_dict.items()],
            "rag_summary": llm_text,
            "text_dict": text_dict
        })
        
    except TimeoutError:
        logger.warning(f"Query timed out: {query}")
        return jsonify({"error": "Request timed out. Please try a simpler query."}), 408
    except Exception as e:
        logger.error(f"Error in API: {str(e)}", exc_info=True)
        return jsonify({"error": f"An error occurred: {str(e)}"}), 500


# Static Routes
@app.route('/')
def index():
    return send_from_directory(app.template_folder, 'index.html')

@app.route('/database/<path:filename>')
def serve_database(filename):
    return send_from_directory(os.path.join(BASE_DIR, '../database'), filename)

@app.route('/templates/<path:filename>')
def serve_template(filename):
    return send_from_directory(app.template_folder, filename)




