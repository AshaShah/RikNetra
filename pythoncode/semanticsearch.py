from flask import Flask, request, jsonify
import torch
import pandas as pd
import numpy as np
import random
import os
import re
import nltk
from sentence_transformers import SentenceTransformer
from flask_cors import CORS
import cohere
from nltk.corpus import stopwords

app = Flask(__name__)
CORS(app)

print("Semantic search API starting...")

# Initialize NLTK
try:
    nltk.data.find('corpora/stopwords')
except LookupError:
    nltk.download('stopwords')

# Initialize Cohere
co = cohere.ClientV2(api_key="cjsgL5O9U4MfBmBT1j8lYmNa9eRtmM02CzVTxR9m")  # Replace with your actual API key

# Load data
grif_text = "pythoncode/Griffith_Translation_Rigveda.txt"
with open(grif_text, 'r') as grf_text:
    griffith_text = grf_text.readlines()

# Initialize models
embedder = SentenceTransformer("all-mpnet-base-v2")
embedder.eval()
device = torch.device("cuda:0" if torch.cuda.is_available() else "cpu")

# Set seeds for reproducibility
SEED = 42
torch.manual_seed(SEED)
np.random.seed(SEED)
random.seed(SEED)
torch.use_deterministic_algorithms(True)
os.environ["CUBLAS_WORKSPACE_CONFIG"] = ":4096:8"
os.environ["TOKENIZERS_PARALLELISM"] = "false"

# Load embeddings and labels
corpus_np = np.loadtxt("pythoncode/sbert_queryembeddings.tsv", delimiter='\t')
corpus_embeddings = torch.tensor(corpus_np)
labels = pd.read_csv("pythoncode/suktalabels.tsv", header=None)

def semantic_search(query, k=5):
    top_k = min(k, len(griffith_text))
    text_embeddings = corpus_embeddings.to(device)
    
    # Generate query embedding
    query_embedding = embedder.encode(query, convert_to_tensor=True).to(device)
    query_embedding = query_embedding.to(dtype=torch.float64)
    
    # Compute similarity
    similarity_scores = embedder.similarity(query_embedding, text_embeddings)[0]
    scores, indices = torch.topk(similarity_scores, k=top_k)
    
    # Prepare results and collect text for RAG
    results = []
    rag_text = ""
    text_dict = {}
    
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
        
        rag_text += text
        text_dict[label_num] = text.strip()
    
    # Generate RAG summary
    try:
        message = f"{query}. Generate a concise summary of the given Rigveda hymns as bullet points. Focus on the initial question and choose only contextually needed information.\n{rag_text}"
        response = co.chat(
            model="command-a-03-2025",
            messages=[{"role": "user", "content": message}],
            temperature=0.0
        )
        rag_summary = response.message.content[0].text
    except Exception as e:
        print(f"Error generating RAG summary: {e}")
        rag_summary = "Could not generate summary at this time."
    
    return {
        "results": results,
        "rag_summary": rag_summary,
        "text_dict": text_dict
    }

@app.route('/semantic-search', methods=['POST'])
def api_semantic_search():
    data = request.get_json()
    query = data.get("query", "")
    top_k = int(data.get("top_k", 5))
    
    if not query:
        return jsonify({"results": []})
    
    search_results = semantic_search(query, k=top_k)
    return jsonify(search_results)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)