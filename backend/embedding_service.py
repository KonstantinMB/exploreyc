"""
Embedding Service
Generates OpenAI embeddings for text, used in Startup Idea Validator

This service handles:
- On-demand embedding generation for user ideas
- Caching to avoid duplicate API calls
- Error handling and retry logic
- Rate limiting protection
"""

import os
import time
import hashlib
import logging
from typing import List, Optional, Dict
from functools import lru_cache

import openai
from openai import OpenAI

logger = logging.getLogger(__name__)

# Configuration
EMBEDDING_MODEL = 'text-embedding-3-small'  # 1536 dimensions
EMBEDDING_DIMENSIONS = 1536
MAX_RETRIES = 3
RETRY_DELAY = 2  # seconds
CACHE_SIZE = 1000  # Number of embeddings to cache in memory


class EmbeddingService:
    """Service for generating text embeddings using OpenAI"""

    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize the embedding service

        Args:
            api_key: OpenAI API key (defaults to OPENAI_API_KEY env var)
        """
        self.api_key = api_key or os.getenv('OPENAI_API_KEY')

        if not self.api_key:
            raise ValueError(
                "OpenAI API key not found. Set OPENAI_API_KEY environment variable "
                "or pass api_key to EmbeddingService constructor."
            )

        # Initialize OpenAI client
        self.client = OpenAI(api_key=self.api_key)

        # In-memory cache for embeddings (LRU cache)
        # Key: hash of text, Value: embedding vector
        self._cache: Dict[str, List[float]] = {}

        logger.info(f"Embedding service initialized with model: {EMBEDDING_MODEL}")

    def _get_text_hash(self, text: str) -> str:
        """Generate a hash of the text for caching"""
        return hashlib.md5(text.encode()).hexdigest()

    def _get_from_cache(self, text: str) -> Optional[List[float]]:
        """Try to get embedding from cache"""
        text_hash = self._get_text_hash(text)
        return self._cache.get(text_hash)

    def _save_to_cache(self, text: str, embedding: List[float]):
        """Save embedding to cache"""
        text_hash = self._get_text_hash(text)

        # Simple cache size management - if cache is full, clear half of it
        if len(self._cache) >= CACHE_SIZE:
            # Remove oldest half of entries
            keys_to_remove = list(self._cache.keys())[:CACHE_SIZE // 2]
            for key in keys_to_remove:
                del self._cache[key]
            logger.info(f"Cache size limit reached, cleared {len(keys_to_remove)} entries")

        self._cache[text_hash] = embedding

    def generate_embedding(
        self,
        text: str,
        retry_count: int = 0,
        use_cache: bool = True
    ) -> List[float]:
        """
        Generate embedding for the given text

        Args:
            text: Text to generate embedding for
            retry_count: Current retry attempt (used internally)
            use_cache: Whether to use cached embeddings

        Returns:
            List of floats representing the embedding vector (1536 dimensions)

        Raises:
            ValueError: If text is empty
            RuntimeError: If embedding generation fails after retries
        """
        if not text or not text.strip():
            raise ValueError("Text cannot be empty")

        text = text.strip()

        # Check cache first
        if use_cache:
            cached_embedding = self._get_from_cache(text)
            if cached_embedding is not None:
                logger.debug(f"Cache hit for text: {text[:50]}...")
                return cached_embedding

        try:
            logger.debug(f"Generating embedding for text: {text[:100]}...")

            # Call OpenAI API
            response = self.client.embeddings.create(
                input=text,
                model=EMBEDDING_MODEL
            )

            # Extract embedding from response
            embedding = response.data[0].embedding

            # Validate embedding dimensions
            if len(embedding) != EMBEDDING_DIMENSIONS:
                raise RuntimeError(
                    f"Unexpected embedding dimensions: {len(embedding)} "
                    f"(expected {EMBEDDING_DIMENSIONS})"
                )

            # Save to cache
            if use_cache:
                self._save_to_cache(text, embedding)

            logger.debug(f"Successfully generated embedding ({len(embedding)} dimensions)")
            return embedding

        except openai.RateLimitError as e:
            # Handle rate limiting with exponential backoff
            if retry_count < MAX_RETRIES:
                wait_time = RETRY_DELAY * (2 ** retry_count)  # Exponential backoff
                logger.warning(
                    f"Rate limit hit, waiting {wait_time}s before retry "
                    f"{retry_count + 1}/{MAX_RETRIES}"
                )
                time.sleep(wait_time)
                return self.generate_embedding(text, retry_count + 1, use_cache)
            else:
                error_msg = f"Rate limit error after {MAX_RETRIES} retries: {e}"
                logger.error(error_msg)
                raise RuntimeError(error_msg) from e

        except openai.APIError as e:
            # Handle API errors
            error_msg = f"OpenAI API error: {e}"
            logger.error(error_msg)
            raise RuntimeError(error_msg) from e

        except Exception as e:
            # Handle unexpected errors
            error_msg = f"Unexpected error generating embedding: {e}"
            logger.error(error_msg)
            raise RuntimeError(error_msg) from e

    def generate_embedding_for_idea(self, idea: str) -> List[float]:
        """
        Generate embedding for a user-submitted startup idea.

        MUST match how company descriptions are embedded in
        scripts/generate_embeddings.py — that script calls
        generate_embedding(search_text) directly, with no prefix. Any
        asymmetry between the two pipelines (e.g. prefixing the user's
        idea with "Startup idea: ") shifts the query embedding into a
        different region of vector space than where company embeddings
        live, which destroys cosine-similarity relevance ranking.

        Args:
            idea: The startup idea description

        Returns:
            Embedding vector
        """
        return self.generate_embedding(idea)

    def get_cache_stats(self) -> Dict[str, int]:
        """Get statistics about the cache"""
        return {
            "cache_size": len(self._cache),
            "cache_limit": CACHE_SIZE,
            "cache_usage_percent": (len(self._cache) / CACHE_SIZE) * 100
        }


# Global singleton instance (lazy initialization)
_embedding_service: Optional[EmbeddingService] = None


def get_embedding_service() -> EmbeddingService:
    """
    Get the global embedding service instance (singleton pattern)

    Returns:
        EmbeddingService instance
    """
    global _embedding_service

    if _embedding_service is None:
        _embedding_service = EmbeddingService()

    return _embedding_service


# Convenience function for simple use cases
def get_embedding(text: str, use_cache: bool = True) -> List[float]:
    """
    Convenience function to get embedding for text

    Args:
        text: Text to generate embedding for
        use_cache: Whether to use cached embeddings

    Returns:
        Embedding vector
    """
    service = get_embedding_service()
    return service.generate_embedding(text, use_cache=use_cache)
