import re
from dotenv import load_dotenv
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

load_dotenv() # Load environment variables from .env file

# Set seeds for reproducibility
SEED = 42
torch.manual_seed(SEED)
np.random.seed(SEED)
torch.use_deterministic_algorithms(True)
os.environ["CUBLAS_WORKSPACE_CONFIG"] = ":4096:8"
os.environ["TOKENIZERS_PARALLELISM"] = "false"

# Initialize models
device = torch.device("cuda:0" if torch.cuda.is_available() else "cpu")
print(f"Using device: {device}")
embedder = SentenceTransformer("all-mpnet-base-v2")
embedder.eval()

# Load data files
def load_sbert_embeddings(file_path):
    return np.loadtxt(file_path, delimiter='\t')

def read_griffith_text(file_path):
    with open(file_path, 'r') as f:
        return f.readlines()

def read_jamison_text(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        return f.read()

# Load data
corpus_np = load_sbert_embeddings("pythoncode/sbert_queryembeddings.tsv")
corpus_embeddings = torch.tensor(corpus_np)
labels = pd.read_csv("pythoncode/suktalabels.tsv", header=None)
griffith_text = read_griffith_text("pythoncode/Griff_translation.txt")
rigsuktatext = read_jamison_text("pythoncode/consuktasrigveda.txt")

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

# API endpoint for semantic search
@app.route('/semantic-search', methods=['POST'])
def api_semantic_search():
    data = request.get_json()
    query = data.get("query", "").strip()
    
    if not query:
        return jsonify({"error": "Please enter a non-empty query"}), 400
    
    query_list = [query]
    num_of_suktas = 10
    
    try:
        collected_text, text_dict = user_query_function(
            queries=query_list,
            text=griffith_text,
            k=num_of_suktas,
            embedding_model=embedder,
            text_embeddings=corpus_embeddings,
            sukta_labels=labels
        )
        
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

        co = cohere.Client(api_key=os.getenv("COHERE_API_KEY"))
        response = co.chat(
            model="command-a-03-2025",
            message=message,
            temperature=0.0
        )
        llm_text = response.text.strip()
        
        return jsonify({
            "results": [{"sukta": f"RV {k}", "text": v} for k, v in text_dict.items()],
            "rag_summary": llm_text,
            "text_dict": text_dict
        })
        
    except Exception as e:
        return jsonify({"error": f"An error occurred: {str(e)}"}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)











# import re
# import os
# import nltk
# import torch
# import cohere
# import numpy as np
# import pandas as pd
# from flask import Flask, request, jsonify
# from flask_cors import CORS
# from unidecode import unidecode
# from nltk.corpus import stopwords
# from sentence_transformers import SentenceTransformer
# from sklearn.feature_extraction.text import TfidfVectorizer

# app = Flask(__name__)
# CORS(app)

# # Initialize NLTK
# nltk.download('stopwords')

# # Set seeds for reproducibility
# SEED = 42
# torch.manual_seed(SEED)
# np.random.seed(SEED)
# torch.use_deterministic_algorithms(True)
# os.environ["CUBLAS_WORKSPACE_CONFIG"] = ":4096:8"
# os.environ["TOKENIZERS_PARALLELISM"] = "false"

# # Initialize models
# device = torch.device("cuda:0" if torch.cuda.is_available() else "cpu")
# embedder = SentenceTransformer("all-mpnet-base-v2")
# embedder.eval()

# # Load Griffith translation text
# grif_text = "pythoncode/Griff_translation.txt"
# with open(grif_text, 'r') as grf_text:
#     griffith_text = grf_text.readlines()

# # Load precomputed SBERT embeddings
# corpus_np = np.loadtxt("pythoncode/sbert_queryembeddings.tsv", delimiter='\t')
# corpus_embeddings = torch.tensor(corpus_np)
# labels = pd.read_csv("pythoncode/suktalabels.tsv", header=None)

# # Initialize TF-IDF 
# sukta_stop_words = set(stopwords.words("english"))


# fname = 'pythoncode/consuktasrigveda.txt'
# with open(fname, 'r', encoding='utf-8') as f:
#     rigsuktatext = f.read()

# # Preprocessing function for Rigveda text
# def preprocessing(raw_text):
#     raw_text = raw_text.lower()
#     raw_text = re.sub('[0-9]+', '', raw_text)
#     raw_text = re.sub('—',' ', raw_text)
#     raw_text = re.sub('–',' ', raw_text)
#     pattern = r'[^\w\s]'
#     clean_raw_text = re.sub(pattern, '', raw_text)
#     clean_split_text = clean_raw_text.split('\n')
#     processed_text = [word for word in clean_split_text if word not in sukta_stop_words and len(word) > 2]
#     return processed_text

# # Tokenizer function for TF-IDF
# def sukta_tokenizer(suktext):
#     return suktext.split()

# # Initialize TF-IDF Vectorizer 
# vectorizer = TfidfVectorizer(
#     tokenizer=sukta_tokenizer,
#     max_df=0.75, 
#     min_df=5, 
#     token_pattern=None, 
#     lowercase=False, 
#     strip_accents=None
# )
# processed_text = preprocessing(rigsuktatext)
# vectorizer.fit_transform(processed_text)

# # Function to handle user queries
# def user_query_function(queries: list, k: int):
#     top_k = min(k, len(griffith_text))
#     top_terms = []
#     collected_text = ""
#     text_dict = {}
#     text_embeddings = corpus_embeddings.to(device)
    
#     for query in queries:
#         query_lower = query.lower()
#         query_trans = vectorizer.transform([query_lower])
#         non_zero_items = list(zip(query_trans.indices, query_trans.data))
        
#         if non_zero_items:
#             sorted_items = sorted(non_zero_items, key=lambda x: x[1], reverse=True)
#             suktafeat_names = vectorizer.get_feature_names_out()
#             top_terms = [suktafeat_names[idx] for idx, _ in sorted_items[:5]]
        
#         new_query_string = " ".join(top_terms) if len(top_terms) >= 2 else query_lower
        
#         query_embedding = embedder.encode(new_query_string, convert_to_tensor=True).to(device)
#         query_embedding = query_embedding.to(dtype=torch.float64)
        
#         similarity_scores = embedder.similarity(query_embedding, text_embeddings)[0]
#         scores, indices = torch.topk(similarity_scores, k=top_k)
        
#         for score, idx in zip(scores, indices):
#             index = idx.tolist()
#             label_num = labels.iloc[index, 0]
#             text_dict[label_num] = griffith_text[index]
#             collected_text += "".join(griffith_text[index])
    
#     # Clean up the collected text
#     message = f"""{queries[0]}.
#     Instructions:
    
#     Generate a concise and focused summary based only on the given Rigveda hymns.
#     Do not use bullet points. The summary must be written as a continuous paragraph, using natural language.
#     Do not start the summary with the phrase "The Rigveda hymns"; instead, return the summary content directly.

#     Stay strictly on the topic of the user's query, and include only information that is contextually present in the hymns provided.

#     You are only allowed to use knowledge derived from the Rigveda context.
#     If the user's query is unrelated or no relevant information is found in the hymns, respond politely:

#     "The entered query '<user_query>' is not relevant to the Rigveda context. Please enter a query related to the Rigveda."

#     Do not generate any content that is not grounded in the given hymns.

#     Example 1 — Query: "What is Creation"

#     The origins of the universe are described as beginning in a state of neither existence nor non-existence, shrouded in darkness.
#     From this void emerged Desire, the primal force of creation. The hymns reference Hiranyagarbha, the golden womb, as the cosmic source of all,
#     along with deities like Savitar and Visvakarman who shaped the cosmos. The cycle of creation, sacrifice, and divine order is emphasized,
#     along with Indra's role in defeating chaos and releasing the life-giving waters.

#     Example 2 — Query: "What is computer science"

#     The entered query "What is computer science" is not relevant to the Rigveda context. Please enter a query related to the Rigveda.
    
#     \n{collected_text}"""

#     # Cohere implementation
#     co = cohere.Client(api_key="API_KEY_HERE")  # Replace with your actual API key
#     response = co.chat(
#         model="command-a-03-2025",
#         message=message,
#         temperature=0.0
#     )
#     llm_text = response.text.strip()
    
#     return {
#         "results": [{"sukta": f"RV {k}", "text": v} for k,v in text_dict.items()],
#         "rag_summary": llm_text,
#         "text_dict": text_dict
#     }

# # API endpoint for semantic search
# @app.route('/semantic-search', methods=['POST'])
# def api_semantic_search():
#     data = request.get_json()
#     query = data.get("query", "")
    
#     if not query:
#         return jsonify({"results": []})
    
#     results = user_query_function([query], k=10) 
#     return jsonify(results)

# if __name__ == "__main__":
#     app.run(host="0.0.0.0", port=5000)


