from flask import Flask, request, jsonify
import re
import os
import nltk
import torch
import cohere
import random
import pickle
import numpy as np
import pandas as pd
from unidecode import unidecode
from nltk.corpus import stopwords
from sklearn import preprocessing
from scipy.sparse import csr_matrix
from nltk.tokenize import word_tokenize
from sklearn.decomposition import TruncatedSVD
from sentence_transformers import SentenceTransformer
from sklearn.feature_extraction.text import TfidfVectorizer

# Initialize Flask app
app = Flask(__name__)

# Download NLTK stopwords
nltk.download('stopwords')
nltk.download('punkt')

# Initialize global variables
corpus_embeddings = None
griffith_text = None
rigsuktatext = None
vectorizer = None
labels = None
embedder = None

def initialize_models():
    global corpus_embeddings, griffith_text, rigsuktatext, vectorizer, labels, embedder
    
    # Load SBERT embeddings
    corpus_np = np.loadtxt("sbert_queryembeddings.tsv", delimiter='\t')
    corpus_embeddings = torch.tensor(corpus_np)
    
    # Load sukta labels
    labels = pd.read_csv("suktalabels.tsv", header=None)
    
    # Load text files
    grif_text = "Griff_translation.txt"

    #Importing the Jaimeson version processed text
    fname = 'consuktasrigveda.txt'
    
    with open(grif_text, 'r') as gr_text:
        griffith_text = gr_text.readlines()
    
    with open(fname, 'r', encoding="utf-8") as j_text:
        rigsuktatext = j_text.read()
    
    # Initialize SBERT model
    embedder = SentenceTransformer('all-MiniLM-L6-v2')
    
    # Initialize TF-IDF Vectorizer
    def sukta_tokenizer(suktext):
        return suktext.split()
    
    vectorizer = TfidfVectorizer(
        tokenizer=sukta_tokenizer,
        max_df=0.75, 
        min_df=5, 
        token_pattern=None, 
        lowercase=False, 
        strip_accents=None
    )
    
    processed_text = preprocess_text(rigsuktatext)
    vectorizer.fit_transform(processed_text)

def preprocess_text(raw_text):
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

def process_query(queries: str, k=5, include_rag=True):
    top_k = min(k, len(griffith_text))
    top_terms = []
    collected_text = ""
    text_dict = {}
    results = []
    
    device = torch.device("cuda:0" if torch.cuda.is_available() else "cpu")
    text_embeddings = corpus_embeddings.to(device)
    
    for query in queries:
        query_lower = query.lower()
        # TF-IDF transformation
        query_trans = vectorizer.transform([query_lower])
        # Extract non-zero tf-idf scores and their feature indices
        non_zero_items = list(zip(query_trans.indices, query_trans.data))  # (feature_idx, tfidf_score)
        
        if non_zero_items:
            sorted_items = sorted(non_zero_items, key=lambda x: x[1], reverse=True)
            suktafeat_names = vectorizer.get_feature_names_out()
            top_terms = [suktafeat_names[idx] for idx, _ in sorted_items[:5]]
        
        if len(top_terms) >= 2:
            new_query_string = " ".join(top_terms)
        else:
            new_query_string = query_lower
        
        # Generate embedding for the final query string
        query_embedding = embedder.encode(new_query_string, convert_to_tensor=True).to(device)
        query_embedding = query_embedding.to(dtype=torch.float64)
        
        # Compute similarity and fetch top-k results
        similarity_scores = embedder.similarity(query_embedding, text_embeddings)[0]
        scores, indices = torch.topk(similarity_scores, k=top_k)
        
        for score, idx in zip(scores, indices):
            index = idx.tolist()
            label_num = labels.iloc[index, 0]
            text_dict.update({label_num: griffith_text[idx]})
            collected_text += "".join(griffith_text[idx])
            results.append({
                "sukta": label_num,
                "score": score.item(),
                "text": griffith_text[idx]
            })
    
    rag_summary = ""
    if include_rag and collected_text:
        rag_summary = generate_rag_summary(query, collected_text)
    
    return {
        "results": results,
        "rag_summary": rag_summary
    }

def generate_rag_summary(query, context):
    # Initialize Cohere client
    co = cohere.Client(api_key='cjsgL5O9U4MfBmBT1j8lYmNa9eRtmM02CzVTxR9m')  # Make sure to set API_KEY
    
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
    
    \n{context}"""

    try:
        response = co.chat(
            model="command-a-03-2025",
            message=message,
            temperature=0.0
        )
        return response.text
    except Exception as e:
        print(f"Error generating RAG summary: {e}")
        return "An error occurred while generating the summary."

@app.route('/semantic-search', methods=['POST'])
def semantic_search():
    data = request.get_json()
    query = data.get('query')
    top_k = data.get('top_k', 5)
    include_rag = data.get('include_rag', True)
    
    if not query:
        return jsonify({"error": "Query parameter is required"}), 400
    
    try:
        results = process_query([query], k=top_k, include_rag=include_rag)
        return jsonify(results)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    initialize_models()
    app.run(host='0.0.0.0', port=5000, debug=True)