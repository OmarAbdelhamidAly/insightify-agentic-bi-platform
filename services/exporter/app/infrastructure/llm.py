"""Centralized LLM Factory.

All agents should use `get_llm()` instead of instantiating ChatGroq/ChatOpenAI
directly. This makes it easy to swap providers in one place.

Currently configured for **OpenRouter** (OpenAI-compatible API).
"""

from langchain_openai import ChatOpenAI
from langchain_core.language_models.chat_models import BaseChatModel
from app.infrastructure.config import settings


def get_llm(temperature: float = 0, model: str | None = None) -> BaseChatModel:
    """Return a configured LLM instance with strict fallback chain: Groq -> Gemini -> OpenRouter -> Ollama."""
    
    primary_model_name = model or settings.LLM_MODEL
    
    def _make_gemini(m: str = "gemini-1.5-flash"):
        try:
            from langchain_google_genai import ChatGoogleGenerativeAI
            import langchain_google_genai.chat_models
            
            # Disable redundant internal retries to let our fallback chain handle it
            def _no_retry_decorator():
                def decorator(fn):
                    return fn
                return decorator
            langchain_google_genai.chat_models._create_retry_decorator = _no_retry_decorator
            
        except ImportError:
            raise ImportError("langchain-google-genai is not installed.")

        return ChatGoogleGenerativeAI(
            model=m,
            api_key=settings.GEMINI_API_KEY,
            temperature=temperature,
            max_tokens=4096,
        )

    def _make_openrouter(m: str = "google/gemma-2-9b-it"):
        return ChatOpenAI(
            model=m,
            api_key=settings.OPENROUTER_API_KEY,
            base_url="https://openrouter.ai/api/v1",
            temperature=temperature,
            max_tokens=2048, # Reduce tokens to save context
            max_retries=2,
            default_headers={
                "HTTP-Referer": "http://localhost:8000",
                "X-Title": "DataAnalyst.AI",
            },
        )

    def _make_groq(m: str = "llama-3.1-8b-instant"):
        # Use 8B by default to avoid extreme TPM limits of 70B on free tier
        return ChatOpenAI(
            model=m,
            api_key=settings.GROQ_API_KEY,
            base_url="https://api.groq.com/openai/v1",
            temperature=temperature,
            max_tokens=2048,
            max_retries=3,
        )

    def _make_ollama(m: str = "llama3.1"):
        try:
            from langchain_ollama import ChatOllama
        except ImportError:
            raise ImportError("langchain-ollama is not installed.")
        return ChatOllama(
            model=m,
            base_url=settings.OLLAMA_BASE_URL,
            temperature=temperature,
        )

    # 1. Instantiate Primary Model
    if primary_model_name.startswith("ollama/"):
        m_name = primary_model_name.replace("ollama/", "")
        llm = _make_ollama(m_name)
    elif "gemini" in primary_model_name:
        llm = _make_gemini(primary_model_name)
    elif "groq" in primary_model_name or "llama-3" in primary_model_name:
        m_name = primary_model_name.replace("groq/", "") if primary_model_name.startswith("groq/") else primary_model_name
        llm = _make_groq(m_name)
    else:
        # Default to Groq 8B if not specified
        if "/" in primary_model_name:
             llm = _make_openrouter(primary_model_name)
        else:
             llm = _make_groq()

    # 2. Build Fallback Chain (Optimized for tokens and stability)
    # Priority: Primary -> Gemini Flash -> Groq 8B -> OpenRouter -> Ollama
    fallbacks = []

    # Gemini Flash is remarkably stable and high-limit on free tier
    if settings.GEMINI_API_KEY and "gemini-1.5-flash" not in primary_model_name:
        fallbacks.append(_make_gemini("gemini-1.5-flash"))
    
    # Try Groq 8B if not already the primary (stays under TPM better)
    if settings.GROQ_API_KEY and not primary_model_name.endswith("-8b-instant"):
        fallbacks.append(_make_groq("llama-3.1-8b-instant"))

    # Gemini Pro as a powerful backup
    if settings.GEMINI_API_KEY and "gemini-1.5-pro" not in primary_model_name:
        fallbacks.append(_make_gemini("gemini-1.5-pro"))

    # OpenRouter - specific stable slugs (removed :free suffix to avoid some 404s)
    if settings.OPENROUTER_API_KEY and "openrouter" not in primary_model_name:
        fallbacks.append(_make_openrouter("google/gemma-2-9b-it"))
        fallbacks.append(_make_openrouter("meta-llama/llama-3.1-8b-instruct"))
        fallbacks.append(_make_openrouter("mistralai/mistral-7b-instruct"))

    # Ollama as last resort
    if "ollama" not in primary_model_name:
        fallbacks.append(_make_ollama("llama3.1"))

    if fallbacks:
        return llm.with_fallbacks(fallbacks)
        
    return llm
        
    return llm



