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

# Health check endpoint for Render
@app.route('/health')
def health_check():
    return jsonify({"status": "healthy"}), 200

# Initialize NLTK
nltk.download('stopwords')

# Set seeds for reproducibility
SEED = 42
torch.manual_seed(SEED)
np.random.seed(SEED)
torch.use_deterministic_algorithms(True)
os.environ["CUBLAS_WORKSPACE_CONFIG"] = ":4096:8"
os.environ["TOKENIZERS_PARALLELISM"] = "false"

# Force CPU usage for Render compatibility
device = torch.device("cpu")
logger.info(f"Using device: {device}")

# Configure Torch for optimal CPU performance
torch.set_num_threads(1)  # Prevents CPU overutilization on Render

# Initialize models with CPU optimization
logger.info("Loading SentenceTransformer model...")
embedder = SentenceTransformer("all-mpnet-base-v2", device=device)
embedder.eval()

# Get the directory of the current script
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Load data files with error handling
def load_sbert_embeddings(file_path):
    try:
        return np.loadtxt(file_path, delimiter='\t')
    except Exception as e:
        logger.error(f"Error loading embeddings: {str(e)}")
        raise

def read_griffith_text(file_path):
    try:
        with open(file_path, 'r') as f:
            return f.readlines()
    except Exception as e:
        logger.error(f"Error reading Griffith text: {str(e)}")
        raise

def read_jamison_text(file_path):
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return f.read()
    except Exception as e:
        logger.error(f"Error reading Jamison text: {str(e)}")
        raise

# Load data with progress logging
logger.info("Loading data files...")
try:
    corpus_np = load_sbert_embeddings(os.path.join(BASE_DIR, "sbert_queryembeddings.tsv"))
    corpus_embeddings = torch.tensor(corpus_np).to(device)
    labels = pd.read_csv(os.path.join(BASE_DIR, "suktalabels.tsv"), header=None)
    griffith_text = read_griffith_text(os.path.join(BASE_DIR, "Griff_translation.txt"))
    rigsuktatext = read_jamison_text(os.path.join(BASE_DIR, "consuktasrigveda.txt"))
    logger.info("Data loading completed successfully")
except Exception as e:
    logger.error(f"Failed to load data: {str(e)}")
    raise

# Preprocessing function
def preprocessing(raw_text):
    raw_text = raw_text.lower()
    raw_text = re.sub('[0-9]+', '', raw_text)
    raw_text = re.sub('—',' ', raw_text)
    raw_text = re.sub('–',' ', raw_text)
    pattern = r'[^\w\s]'
    clean_raw_text = re.sub(pattern, '', raw_text)
    clean_split_text = clean_raw_text.split('\n')
    sukta_stop_words = set(stopwords.words("english"))
    processed_text = [word for word in clean_split_text if word not in sukta_stop_words and len(word) > 2]
    return processed_text

# Tokenizer function
def sukta_tokenizer(suktext):
    return suktext.split()

# Initialize TF-IDF Vectorizer
logger.info("Initializing TF-IDF vectorizer...")
vectorizer = TfidfVectorizer(
    tokenizer=sukta_tokenizer,
    max_df=0.75, 
    min_df=5, 
    token_pattern=None, 
    lowercase=False, 
    strip_accents=None
)
processed_text = preprocessing(rigsuktatext)
vectorizer.fit_transform(processed_text)
logger.info("TF-IDF vectorizer initialized")

# user_query_function
def user_query_function(queries, text, k, embedding_model, text_embeddings, sukta_labels):
    top_k = min(k, len(text))
    top_terms = []
    collected_text = ""
    text_dict = {}
    text_embeddings = text_embeddings.to(device)
    
    for query in queries:
        query_lower = query.lower()
        query_trans = vectorizer.transform([query_lower])
        non_zero_items = list(zip(query_trans.indices, query_trans.data))
        
        if non_zero_items:
            sorted_items = sorted(non_zero_items, key=lambda x: x[1], reverse=True)
            suktafeat_names = vectorizer.get_feature_names_out()
            top_terms = [suktafeat_names[idx] for idx, _ in sorted_items[:5]]
        
        new_query_string = " ".join(top_terms) if len(top_terms) >= 2 else query_lower
        
        query_embedding = embedding_model.encode(new_query_string, convert_to_tensor=True).to(device)
        query_embedding = query_embedding.to(dtype=torch.float64)
        
        similarity_scores = embedding_model.similarity(query_embedding, text_embeddings)[0]
        scores, indices = torch.topk(similarity_scores, k=top_k)
        
        for score, idx in zip(scores, indices):
            index = idx.tolist()
            label_num = sukta_labels.iloc[index, 0]
            text_dict[label_num] = text[index]
            collected_text += "".join(text[index])
    
    return collected_text, text_dict

# Thread pool for handling requests (limited to 1 worker for CPU constraints)
executor = ThreadPoolExecutor(max_workers=1)

@app.route('/semantic-search', methods=['POST'])
def api_semantic_search():
    data = request.get_json()
    query = data.get("query", "").strip().lower()
    
    if not query:
        return jsonify({"error": "Please enter a non-empty query"}), 400
    
    query_list = [query]
    num_of_suktas = 10
    
    try:
        # Submit to thread pool with timeout
        future = executor.submit(
            user_query_function,
            queries=query_list,
            text=griffith_text,
            k=num_of_suktas,
            embedding_model=embedder,
            text_embeddings=corpus_embeddings,
            sukta_labels=labels
        )
        collected_text, text_dict = future.result(timeout=60)  # 60 second timeout
        
        
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

        cohere_api_key = os.environ.get('COHERE_API_KEY')
        if not cohere_api_key:
            logger.error("Cohere API key not found")
            return jsonify({"error": "Cohere API key not found"}), 500

        co = cohere.ClientV2(api_key=cohere_api_key)

        response = co.chat(
            model="command-a-03-2025",
            messages=[{"role": "user", "content": message}],
            temperature=0.0
        )
        llm_text = response.message.content[0].text.strip()
        
        return jsonify({
            "results": [{"sukta": f"RV {k}", "text": v} for k, v in text_dict.items()],
            "rag_summary": llm_text,
            "text_dict": text_dict
        })
        
    except TimeoutError:
        logger.warning("Request timed out")
        return jsonify({"error": "Request timed out. Please try a simpler query."}), 408
    except Exception as e:
        logger.error(f"Error in semantic search: {str(e)}", exc_info=True)
        return jsonify({"error": f"An error occurred: {str(e)}"}), 500

# Original routes preserved
@app.route('/')
def index():
    return send_from_directory(app.template_folder, 'index.html')

@app.route('/database/<path:filename>')
def serve_database(filename):
    return send_from_directory(os.path.join(BASE_DIR, '../database'), filename)

@app.route('/templates/<path:filename>')
def serve_template(filename):
    return send_from_directory(app.template_folder, filename)
