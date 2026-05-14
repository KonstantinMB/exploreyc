"""
Filter generic AI-related words from startup idea text before embedding.

These terms appear in many YC company descriptions and add little discriminative
value to vector search. Removing them helps focus on the core concept.
"""

import re
from typing import Tuple

# Case-insensitive stopwords (normalized to lowercase for matching)
# Include both single words and common phrases
AI_STOPWORDS = frozenset({
    "ai", "ml", "llm", "llms", "gpt", "chatgpt", "agents", "agent", "agentic",
    "generative", "genai", "neural", "nlp", "transformer", "transformer-based",
    "deep learning", "machine learning", "artificial intelligence",
    "computer vision", "cv", "copilot", "autonomous", "automated", "automation",
    "intelligent", "smart", "predictive", "recommendation", "recommendation engine",
    "ai-powered", "ml-powered", "ai-driven", "ml-driven",
    "large language model", "language model", "foundation model",
    "natural language", "computer vision", "deep learning",
})


def filter_ai_words_for_search(idea: str) -> Tuple[str, list]:
    """
    Remove AI-related stopwords from idea text before embedding.

    Uses word-boundary matching so substrings are preserved (e.g. "main" stays).

    Args:
        idea: Raw startup idea description

    Returns:
        Tuple of (filtered_text, list_of_removed_terms)
    """
    if not idea or not idea.strip():
        return "", []

    text = idea.strip()
    removed = []

    # Build regex pattern for each stopword with word boundaries
    # Sort by length descending so longer phrases match first (e.g. "machine learning" before "learning")
    sorted_stopwords = sorted(AI_STOPWORDS, key=len, reverse=True)

    for stopword in sorted_stopwords:
        # Word boundary regex: \b for start/end of word
        pattern = re.compile(r"\b" + re.escape(stopword) + r"\b", re.IGNORECASE)
        if pattern.search(text):
            text = pattern.sub(" ", text)
            removed.append(stopword)

    # Collapse multiple spaces and trim
    text = " ".join(text.split()).strip()

    return text, removed


def get_search_text_for_embedding(idea: str, min_length: int = 10) -> str:
    """
    Get the text to use for embedding, with AI words filtered.
    Falls back to original idea if filtered text is too short.

    Args:
        idea: Raw startup idea
        min_length: Minimum character length after filtering; if shorter, use original

    Returns:
        Text to pass to embedding service
    """
    filtered, _ = filter_ai_words_for_search(idea)
    if len(filtered) >= min_length:
        return filtered
    return idea.strip() if idea else ""
