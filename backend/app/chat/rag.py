"""
RAG engine.

Pipeline:
Query
    ↓
Gemini Embedding
    ↓
ChromaDB Similarity Search
    ↓
Context Builder
    ↓
Gemini 2.5 Flash
    ↓
Answer + Sources
"""

from __future__ import annotations

import os
from functools import lru_cache

import chromadb
from google import genai


ANTI_HALLUCINATION_SYSTEM_PROMPT = """
Eres DocuMind, un asistente especializado en responder preguntas
ÚNICAMENTE usando el contexto entregado.

Reglas:

1. Nunca inventes información.
2. Si el contexto no contiene la respuesta dilo claramente.
3. Siempre cita los fragmentos utilizados como [fragmento X].
4. No utilices conocimiento externo.
5. Responde en español o inglés dependiendo el idioma de la pregunta que te hagan.
"""


###########################################################
# Helpers
###########################################################

def count_tokens(text: str) -> int:
    if not text:
        return 0

    return max(1, round(len(text) / 4))


###########################################################
# Chroma
###########################################################

@lru_cache(maxsize=1)
def _client() -> chromadb.PersistentClient:
    persist_dir = os.environ.get(
        "CHROMA_PERSIST_DIR",
        "./chroma_data",
    )

    os.makedirs(persist_dir, exist_ok=True)

    return chromadb.PersistentClient(path=persist_dir)


def _collection_name(document_id: str) -> str:
    return f"doc_{document_id.replace('-', '')}"


def get_collection(document_id: str):
    return _client().get_or_create_collection(
        name=_collection_name(document_id)
    )


def delete_collection(document_id: str):
    try:
        _client().delete_collection(
            name=_collection_name(document_id)
        )
    except Exception:
        pass


###########################################################
# Gemini Client
###########################################################

@lru_cache(maxsize=1)
def _genai_client():

    return genai.Client(
        api_key=os.environ["GEMINI_API_KEY"]
    )


###########################################################
# Embeddings
###########################################################

def embed_texts(
    texts: list[str],
    task_type: str = "RETRIEVAL_DOCUMENT",
) -> list[list[float]]:

    client = _genai_client()

    model = os.environ.get(
        "GEMINI_EMBEDDING_MODEL",
        "gemini-embedding-001",
    )

    vectors = []

    for text in texts:

        response = client.models.embed_content(
            model=model,
            contents=text,
        )

        vectors.append(
            response.embeddings[0].values
        )

    return vectors


###########################################################
# Indexing
###########################################################

def index_chunks(
    document_id: str,
    chunk_records: list[dict],
) -> int:

    if not chunk_records:
        return 0

    collection = get_collection(document_id)

    texts = [
        c["text"]
        for c in chunk_records
    ]

    embeddings = embed_texts(texts)

    collection.add(
        ids=[
            c["id"]
            for c in chunk_records
        ],

        embeddings=embeddings,

        documents=texts,

        metadatas=[
            {
                "page_number":
                    c["page_number"]
                    if c["page_number"] is not None
                    else -1,

                "chunk_index":
                    c["chunk_index"],
            }
            for c in chunk_records
        ],
    )

    return sum(
        count_tokens(text)
        for text in texts
    )


###########################################################
# Retrieval
###########################################################

def retrieve(
    document_id: str,
    query: str,
    top_k: int = 5,
):

    collection = get_collection(document_id)

    query_embedding = embed_texts(
        [query],
        task_type="RETRIEVAL_QUERY",
    )[0]

    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=top_k,
        include=[
            "documents",
            "metadatas",
            "distances",
        ],
    )

    hits = []

    ids = results["ids"][0]
    docs = results["documents"][0]
    metas = results["metadatas"][0]
    dists = results["distances"][0]

    for i in range(len(ids)):

        hits.append(
            {
                "chunk_id": ids[i],
                "text": docs[i],
                "page_number":
                    None
                    if metas[i]["page_number"] == -1
                    else metas[i]["page_number"],
                "chunk_index": metas[i]["chunk_index"],
                "distance": dists[i],
            }
        )

    return hits


###########################################################
# Context Builder
###########################################################

def build_context(
    hits: list[dict],
    max_tokens: int,
):

    used_hits = []

    pieces = []

    used_tokens = 0

    for i, hit in enumerate(hits):

        label = f"[fragmento {i+1}]"

        page = (
            f" (página {hit['page_number']})"
            if hit["page_number"]
            else ""
        )

        text = f"{label}{page}: {hit['text']}"

        tokens = count_tokens(text)

        if used_tokens + tokens > max_tokens and used_hits:
            break

        pieces.append(text)

        used_hits.append(hit)

        used_tokens += tokens

    return (
        "\n\n".join(pieces),
        used_hits,
        used_tokens,
    )


###########################################################
# LLM
###########################################################

def generate_answer(
    query: str,
    context_text: str,
    history: list[dict] | None = None,
    stream: bool = False,
):

    client = _genai_client()

    model = os.environ.get(
        "GEMINI_CHAT_MODEL",
        "gemini-2.5-flash",
    )

    history_text = ""

    for turn in history or []:

        role = (
            "Usuario"
            if turn["role"] == "user"
            else "Asistente"
        )

        history_text += f"{role}: {turn['content']}\n"

    prompt = f"""
{ANTI_HALLUCINATION_SYSTEM_PROMPT}

==========================
CONTEXTO
==========================

{context_text}

==========================
HISTORIAL
==========================

{history_text}

==========================
PREGUNTA
==========================

{query}

Responde únicamente usando el contexto.

Siempre cita los fragmentos utilizados.
"""

    if stream:

        return client.models.generate_content_stream(
            model=model,
            contents=prompt,
        )

    return client.models.generate_content(
        model=model,
        contents=prompt,
    )