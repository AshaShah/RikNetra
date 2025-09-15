import re
import os
import nltk
import torch
import cohere
import numpy as np
import pandas as pd
from flask import Flask, request, jsonify
from flask_cors import CORS
from unidecode import unidecode
from nltk.corpus import stopwords
from sentence_transformers import SentenceTransformer
from sklearn.feature_extraction.text import TfidfVectorizer

app = Flask(__name__)
CORS(app)

# Initialize NLTK
nltk.download('stopwords')

# Set seeds for reproducibility
SEED = 42
torch.manual_seed(SEED)
np.random.seed(SEED)
torch.use_deterministic_algorithms(True)
os.environ["CUBLAS_WORKSPACE_CONFIG"] = ":4096:8"
os.environ["TOKENIZERS_PARALLELISM"] = "false"

# Initialize models
device = torch.device("cuda:0" if torch.cuda.is_available() else "cpu")
embedder = SentenceTransformer("all-mpnet-base-v2")
embedder.eval()

# Load data with original paths
grif_text = "pythoncode/Griff_translation.txt"
with open(grif_text, 'r') as grf_text:
    griffith_text = grf_text.readlines()

corpus_np = np.loadtxt("pythoncode/sbert_queryembeddings.tsv", delimiter='\t')
corpus_embeddings = torch.tensor(corpus_np)
labels = pd.read_csv("pythoncode/suktalabels.tsv", header=None)

# Initialize TF-IDF 
sukta_stop_words = set(stopwords.words("english"))

fname = 'pythoncode/consuktasrigveda.txt'
with open(fname, 'r', encoding='utf-8') as f:
    rigsuktatext = f.read()

# Preprocessing function for Rigveda text
def preprocessing(raw_text):
    raw_text = raw_text.lower()
    raw_text = re.sub('[0-9]+', '', raw_text)
    raw_text = re.sub('—',' ', raw_text)
    raw_text = re.sub('–',' ', raw_text)
    pattern = r'[^\w\s]'
    clean_raw_text = re.sub(pattern, '', raw_text)
    clean_split_text = clean_raw_text.split('\n')
    processed_text = [word for word in clean_split_text if word not in sukta_stop_words and len(word) > 2]
    return processed_text

# Tokenizer function for TF-IDF
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
processed_text = preprocessing(rigsuktatext)
vectorizer.fit_transform(processed_text)

# Function to handle user queries
def user_query_function(queries: list, k: int):
    top_k = min(k, len(griffith_text))
    top_terms = []
    collected_text = ""
    text_dict = {}
    text_embeddings = corpus_embeddings.to(device)
    
    for query in queries:
        query_lower = query.lower()
        query_trans = vectorizer.transform([query_lower])
        non_zero_items = list(zip(query_trans.indices, query_trans.data))
        
        if non_zero_items:
            sorted_items = sorted(non_zero_items, key=lambda x: x[1], reverse=True)
            suktafeat_names = vectorizer.get_feature_names_out()
            top_terms = [suktafeat_names[idx] for idx, _ in sorted_items[:5]]
        
        new_query_string = " ".join(top_terms) if len(top_terms) >= 2 else query_lower
        
        query_embedding = embedder.encode(new_query_string, convert_to_tensor=True).to(device)
        query_embedding = query_embedding.to(dtype=torch.float64)
        
        similarity_scores = embedder.similarity(query_embedding, text_embeddings)[0]
        scores, indices = torch.topk(similarity_scores, k=top_k)
        
        for score, idx in zip(scores, indices):
            index = idx.tolist()
            label_num = labels.iloc[index, 0]
            text_dict[label_num] = griffith_text[index]
            collected_text += "".join(griffith_text[index])
    
    # Clean up the collected text
    message = f"""{queries[0]}.
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

    # Original Cohere implementation
    co = cohere.Client(api_key="xyz")
    response = co.chat(
        model="command-a-03-2025",
        message=message,
        temperature=0.0
    )
    llm_text = response.text.strip()
    
    return {
        "results": [{"sukta": f"RV {k}", "text": v} for k,v in text_dict.items()],
        "rag_summary": llm_text,
        "text_dict": text_dict
    }

# Minimal Flask wrapper
@app.route('/semantic-search', methods=['POST'])
def api_semantic_search():
    data = request.get_json()
    query = data.get("query", "")
    
    if not query:
        return jsonify({"results": []})
    
    results = user_query_function([query], k=5) 
    return jsonify(results)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
