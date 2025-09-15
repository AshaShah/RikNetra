from flask import Flask, request, jsonify
import torch
import pandas as pd
import numpy as np
import random
import os
import re
import nltk
import pickle
from unidecode import unidecode
from sentence_transformers import SentenceTransformer
from flask_cors import CORS
import cohere
from nltk.corpus import stopwords
from nltk.tokenize import word_tokenize
from sklearn import preprocessing
from scipy.sparse import csr_matrix
from sklearn.decomposition import TruncatedSVD
from sklearn.feature_extraction.text import TfidfVectorizer

app = Flask(__name__)
CORS(app)

print("Semantic search API starting...")

# Initialize NLTK
try:
    nltk.data.find('corpora/stopwords')
except LookupError:
    nltk.download('stopwords')

# Initialize Cohere
co = cohere.ClientV2(api_key="")  # Replace with your actual API key

# Set seeds for reproducibility
SEED = 42
torch.manual_seed(SEED)
np.random.seed(SEED)
random.seed(SEED)
torch.use_deterministic_algorithms(True)
os.environ["CUBLAS_WORKSPACE_CONFIG"] = ":4096:8"
os.environ["TOKENIZERS_PARALLELISM"] = "false"

# Initialize models
device = torch.device("cuda:0" if torch.cuda.is_available() else "cpu")
embedder = SentenceTransformer("all-mpnet-base-v2")
embedder.eval()

# Load data
grif_text = "pythoncode/Griffith_Translation_Rigveda.txt"
with open(grif_text, 'r') as grf_text:
    griffith_text = grf_text.readlines()

# Load embeddings and labels
corpus_np = np.loadtxt("pythoncode/sbert_queryembeddings.tsv", delimiter='\t')
corpus_embeddings = torch.tensor(corpus_np)
labels = pd.read_csv("pythoncode/suktalabels.tsv", header=None)

# Initialize TF-IDF components
sukta_stop_words = set(stopwords.words("english"))

# Load and preprocess text for TF-IDF
fname = 'pythoncode/consuktasrigveda.txt'  # You'll need to provide this file
with open(fname, 'r', encoding='utf-8') as f:
    rigsuktatext = f.read()

rigsuktatext = rigsuktatext.lower()
rigsuktatext = re.sub('[0-9]+', '', rigsuktatext)
rigsuktatext = re.sub('—',' ', rigsuktatext)
rigsuktatext = re.sub('–',' ', rigsuktatext)
pattern = r'[^\w\s]'
cleaned_string = re.sub(pattern, '', rigsuktatext)
filt2_paragraphs = cleaned_string.split('\n')
suktafiltered_words = [word for word in filt2_paragraphs if word not in sukta_stop_words and len(word) > 2]

def sukta_tokenizer(suktext):
    return suktext.split()

# Initialize TF-IDF Vectorizer
vectorizer = TfidfVectorizer(
    tokenizer=sukta_tokenizer,
    max_df=0.75, 
    min_df=5, 
    token_pattern=None, 
    lowercase=False, 
    strip_accents=None
)
X = vectorizer.fit_transform(suktafiltered_words)

def user_query_function(query, k=5):
    top_k = min(k, len(griffith_text))
    collected_text = ""
    text_dict = {}
    corpus_embeddings_tensor = corpus_embeddings.to(device)
    
    query_lower = query.lower()
    
    # TF-IDF transformation
    query_trans = vectorizer.transform([query_lower])
    non_zero_items = list(zip(query_trans.indices, query_trans.data))  # (feature_idx, tfidf_score)
    
    if non_zero_items:
        print("Using TF-IDF refined query...")
        sorted_items = sorted(non_zero_items, key=lambda x: x[1], reverse=True)
        suktafeat_names = vectorizer.get_feature_names_out()
        top_terms = [suktafeat_names[idx] for idx, _ in sorted_items[:5]]  
        new_query_string = " ".join(top_terms)
        print(f"Top TF-IDF terms from query: {top_terms}")
    else:
        print("No TF-IDF vocabulary match found - using original query directly for embeddings.")
        new_query_string = query_lower
    
    # Generate embedding for the final query string
    query_embedding = embedder.encode(new_query_string, convert_to_tensor=True).to(device)
    query_embedding = query_embedding.to(dtype=torch.float64)
    
    # Compute similarity and fetch top-k results
    similarity_scores = embedder.similarity(query_embedding, corpus_embeddings_tensor)[0]
    scores, indices = torch.topk(similarity_scores, k=top_k)
    
    # Prepare results
    results = []
    for score, idx in zip(scores, indices):
        index = idx.tolist()
        label_num = labels[0][index]
        text = griffith_text[index]
        
        results.append({
            "sukta": f"RV {label_num}",
            "score": float(score),
            "index": int(index),
            "text": text.strip()
        })
        
        collected_text += text
        text_dict[label_num] = text.strip()
    
    # Generate RAG summary
    try:
        message = f"""Generate a summary of the Rigveda hymns with STRICT formatting:
        1. **Never use bold text** (avoid `**` entirely).
        2. **Use bullet points** (start each point with `- ` on a new line).
        3. **No colons after names** (e.g., "Bṛhaspati" not "Bṛhaspati:").
        4. **No headers** (e.g., "AI Analysis" or "Based on").

        Query: {query}
        Text: {collected_text}"""

        response = co.chat(
            model="command-a-03-2025",
            messages=[{"role": "user", "content": message}],
            temperature=0.0
        )
        rag_summary = response.message.content[0].text

        # Post-process to enforce rules
        rag_summary = (
            rag_summary.replace("**", "")      # Remove **bold** markers
            .replace(": -", "\n-")             # Fix bullet points
            .replace(": \n-", "\n-")           # Fix bullet points
            .replace("•", "-")                 # Standardize bullets to hyphens
        )

    except Exception as e:
        print(f"Error generating RAG summary: {e}")
        rag_summary = "Could not generate summary at this time."

    return {
        "results": results,
        "rag_summary": rag_summary,
        "text_dict": text_dict,
    }


@app.route('/semantic-search', methods=['POST'])
def api_semantic_search():
    data = request.get_json()
    query = data.get("query", "")
    top_k = int(data.get("top_k", 5))
    
    if not query:
        return jsonify({"results": []})
    
    search_results = user_query_function(query, k=top_k)
    return jsonify(search_results)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
