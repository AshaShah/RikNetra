from flask import Flask, request, jsonify
import torch
import pandas as pd
import numpy as np
import random
import os
from sentence_transformers import SentenceTransformer
from flask_cors import CORS

app = Flask(__name__)
CORS(app) # Allow CORS for localhost testing

print("Semantic search API starting...")
grif_text = "pythoncode/Griffith_Translation_Rigveda.txt"
with open(grif_text, 'r') as grf_text:
    griffith_text = grf_text.readlines()

embedder = SentenceTransformer("all-mpnet-base-v2")
embedder.eval()

device = torch.device("cuda:0" if torch.cuda.is_available() else "cpu")

SEED = 42
torch.manual_seed(SEED)
np.random.seed(SEED)
random.seed(SEED)
torch.use_deterministic_algorithms(True)
os.environ["CUBLAS_WORKSPACE_CONFIG"] = ":4096:8"
os.environ["TOKENIZERS_PARALLELISM"] = "false"

corpus_np = np.loadtxt("pythoncode/sbert_queryembeddings.tsv", delimiter='\t')
corpus_embeddings = torch.tensor(corpus_np)
labels = pd.read_csv("pythoncode/suktalabels.tsv", header=None)

def semantic_search(query, k=5):
    top_k = min(k, len(griffith_text))
    text_embeddings = corpus_embeddings.to(device)
    query_embedding = embedder.encode(query, convert_to_tensor=True).to(device)
    query_embedding = query_embedding.to(dtype=torch.float64)
    similarity_scores = embedder.similarity(query_embedding, text_embeddings)[0]
    scores, indices = torch.topk(similarity_scores, k=top_k)
    results = []
    for score, idx in zip(scores, indices):
        index = idx.tolist()
        label_num = labels[0][index]
        results.append({
            "sukta": f"RV {label_num}",
            "score": float(score),
            "index": int(index)
        })
    return results

@app.route('/semantic-search', methods=['POST'])
def api_semantic_search():
    data = request.get_json()
    query = data.get("query", "")
    top_k = int(data.get("top_k", 5))
    if not query:
        return jsonify({"results": []})
    results = semantic_search(query, k=top_k)
    return jsonify({"results": results})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)