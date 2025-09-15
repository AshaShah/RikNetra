# Retrieval Results

| **Q1: How is the Sun associated with life, health, and vitality** <br> Relevant Items = 16, Top K = 20                                 |          |         |            |       |       |       |
|----------------------------------------------------------------------------------------------------|----------|---------|------------|-------|-------|-------|
| Method                                                                                             | Correct  | Missing | Non famous | P     | R     | F     |
| BM25                                                                                               | 0        | 16      | 20         | 0.000 | 0.000 | 0.000 |
| SBERT                                                                                              | 4        | 12      | 16         | 0.200 | 0.250 | 0.222 |
| TFIDF                                                                                              | 0        | 16      | 20         | 0.000 | 0.000 | 0.000 |
| RikNetra                                                                                           | 5        | 11      | 15         | 0.250 | 0.313 | 0.278 |
| RRF(BM25 & SBERT)                                                                                  | 3        | 13      | 17         | 0.150 | 0.188 | 0.167 |
| RRF(TFIDF & SBERT)                                                                                 | 3        | 13      | 17         | 0.150 | 0.188 | 0.167 |
| Cohere-Rerank                                                                                      | 2        | 14      | 18         | 0.100 | 0.125 | 0.111 |
|                                                                                                    |          |         |            |       |       |       |
| **Q2: What   does the Rigveda says about creation of the Universe** <br>Relevant Items = 9, Top K = 10                               |          |         |            |       |       |       |
| Method                                                                                             | Correct  | Missing | Non famous | P     | R     | F     |
| BM25                                                                                               | 2        | 7       | 8          | 0.200 | 0.222 | 0.211 |
| SBERT                                                                                              | 6        | 3       | 4          | 0.600 | 0.667 | 0.632 |
| TFIDF                                                                                              | 2        | 7       | 8          | 0.200 | 0.222 | 0.211 |
| RikNetra                                                                                           | 7        | 2       | 3          | 0.700 | 0.778 | 0.737 |
| RRF(BM25 & SBERT)                                                                                  | 4        | 5       | 6          | 0.400 | 0.444 | 0.421 |
| RRF(TFIDF & SBERT)                                                                                 | 5        | 4       | 5          | 0.500 | 0.556 | 0.526 |
| Cohere-Rerank                                                                                      | 4        | 5       | 6          | 0.400 | 0.444 | 0.421 |
|                                                                                                    |          |         |            |       |       |       |
| **Q3: What is   the role of Heaven & Earth in the Rigveda**  <br>Relevant Items = 6, Top K = 10                                     |          |         |            |       |       |       |
| Method                                                                                             | Correct  | Missing | Non famous | P     | R     | F     |
| BM25                                                                                               | 0        | 6       | 10         | 0.000 | 0.000 | 0.000 |
| SBERT                                                                                              | 2        | 4       | 8          | 0.200 | 0.333 | 0.250 |
| TFIDF                                                                                              | 2        | 4       | 8          | 0.200 | 0.333 | 0.250 |
| RikNetra                                                                                           | 3        | 3       | 7          | 0.300 | 0.500 | 0.375 |
| RRF(BM25 & SBERT)                                                                                  | 2        | 4       | 8          | 0.200 | 0.333 | 0.250 |
| RRF(TFIDF & SBERT)                                                                                 | 3        | 3       | 7          | 0.300 | 0.500 | 0.375 |
| Cohere-Rerank                                                                                      | 3        | 3       | 7          | 0.300 | 0.500 | 0.375 |
|                                                                                                    |          |         |            |       |       |       |
| **Q4: Who are the Maruts and what do they do**  <br> Relevant Items = 14, Top K = 15                                                  |          |         |            |       |       |       |
| Method                                                                                             | Correct  | Missing | Non famous | P     | R     | F     |
| BM25                                                                                               | 1        | 13      | 14         | 0.067 | 0.071 | 0.069 |
| SBERT                                                                                              | 5        | 9       | 10         | 0.333 | 0.357 | 0.345 |
| TFIDF                                                                                              | 3        | 11      | 12         | 0.200 | 0.214 | 0.207 |
| RikNetra                                                                                           | 6        | 8       | 9          | 0.400 | 0.429 | 0.414 |
| RRF(BM25 & SBERT)                                                                                  | 3        | 11      | 12         | 0.200 | 0.214 | 0.207 |
| RRF(TFIDF & SBERT)                                                                                 | 4        | 10      | 11         | 0.267 | 0.286 | 0.276 |
| Cohere-Rerank                                                                                      | 6        | 8       | 9          | 0.400 | 0.429 | 0.414 |
|                                                                                                    |          |         |            |       |       |       |
| **Q5:How is water associated with speech, sound, and the preservation of ṛta in Rigvedic thought** <br> Relevant Items = 6, Top K = 10 |          |         |            |       |       |       |
| Method                                                                                             | Correct  | Missing | Non famous | P     | R     | F     |
| BM25                                                                                               | 0        | 6       | 10         | 0.000 | 0.000 | 0.000 |
| SBERT                                                                                              | 2        | 4       | 8          | 0.200 | 0.333 | 0.250 |
| TFIDF                                                                                              | 0        | 6       | 10         | 0.000 | 0.000 | 0.000 |
| RikNetra                                                                                           | 4        | 2       | 6          | 0.400 | 0.667 | 0.500 |
| RRF(BM25 & SBERT)                                                                                  | 1        | 5       | 9          | 0.100 | 0.167 | 0.125 |
| RRF(TFIDF & SBERT)                                                                                 | 1        | 5       | 9          | 0.100 | 0.167 | 0.125 |
| Cohere-Rerank                                                                                      | 0        | 6       | 10         | 0.000 | 0.000 | 0.000 |
|                                                                                                    |          |         |            |       |       |       |
| **Q6: What is the importance of the Yama and the death** <br> Relevant Items = 12, Top K = 15                                     |          |         |            |       |       |       |
| Method                                                                                             | Correct  | Missing | Non famous | P     | R     | F     |
| BM25                                                                                               | 7        | 5       | 8          | 0.467 | 0.583 | 0.519 |
| SBERT                                                                                              | 7        | 5       | 8          | 0.467 | 0.583 | 0.519 |
| TFIDF                                                                                              | 6        | 6       | 9          | 0.400 | 0.500 | 0.444 |
| RikNetra                                                                                           | 7        | 5       | 8          | 0.467 | 0.583 | 0.519 |
| RRF(BM25 & SBERT)                                                                                  | 6        | 6       | 9          | 0.400 | 0.500 | 0.444 |
| RRF(TFIDF & SBERT)                                                                                 | 7        | 5       | 8          | 0.467 | 0.583 | 0.519 |
| Cohere-Rerank                                                                                      | 7        | 5       | 8          | 0.467 | 0.583 | 0.519 |
|                                                                                                    |          |         |            |       |       |       |
| **Q7: How is Brhaspati related to other gods**  <br>  Relevant Items = 9, Top K = 10                                           |          |         |            |       |       |       |
| Method                                                                                             | Correct  | Missing | Non famous | P     | R     | F     |
| BM25                                                                                               | 0        | 9       | 10         | 0.000 | 0.000 | 0.000 |
| SBERT                                                                                              | 3        | 6       | 7          | 0.300 | 0.333 | 0.316 |
| TFIDF                                                                                              | 2        | 7       | 8          | 0.200 | 0.222 | 0.211 |
| RikNetra                                                                                           | 3        | 6       | 7          | 0.300 | 0.333 | 0.316 |
| RRF(BM25 & SBERT)                                                                                  | 2        | 7       | 8          | 0.200 | 0.222 | 0.211 |
| RRF(TFIDF & SBERT)                                                                                 | 3        | 6       | 7          | 0.300 | 0.333 | 0.316 |
| Cohere-Rerank                                                                                      | 3        | 6       | 7          | 0.300 | 0.333 | 0.316 |
|                                                                                                    |          |         |            |       |       |       |
| **Mean**                                                                                           |          |         |            |       |       |       |
| Method                                                                                             | P        | R       | F          |       |       |       |
| TFIDF                                                                                              | 0.171    | 0.213   | 0.190      |       |       |       |
| BM25                                                                                               | 0.105    | 0.125   | 0.114      |       |       |       |
| SBERT                                                                                              | 0.329    | 0.408   | 0.364      |       |       |       |
| RRF(TFIDF & SBERT)                                                                                 | 0.298    | 0.373   | 0.331      |       |       |       |
| RRF(BM25 & SBERT)                                                                                  | 0.236    | 0.295   | 0.262      |       |       |       |
| Cohere-Rerank                                                                                      | 0.281    | 0.345   | 0.310      |       |       |       |
| RikNetra                                                                                           | 0.402    | 0.515   | 0.452      |       |       |       |
