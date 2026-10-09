import logging
from typing import Optional, List, Dict, Any
from app.config import settings

logger = logging.getLogger(__name__)

class LLMPolicySynthesizer:
    """
    LLM Synthesizer for SkyGuardian Passenger Policy Assistant.
    Connects to Google Gemini (or configured LLM provider) to transform
    retrieved RAG context and live airline web search excerpts into
    empathetic, accurate, and passenger-friendly advice.
    """
    def __init__(self):
        self._configured = False

    def _get_api_key(self) -> Optional[str]:
        for key in (settings.LLM_API_KEY, settings.GEMINI_API_KEY):
            if key and key != "mock_key":
                return key.strip()
        return None

    def _get_model_candidates(self) -> List[str]:
        chosen = settings.LLM_MODEL or "gemini-1.5-flash"
        # Always try chosen first, then reliable fallbacks
        candidates = [chosen]
        for fallback in ["gemini-1.5-flash", "gemini-2.0-flash", "gemini-pro"]:
            if fallback not in candidates:
                candidates.append(fallback)
        return candidates

    async def synthesize_rag_answer(
        self,
        question: str,
        context_text: str,
        airline: Optional[str] = None
    ) -> Optional[str]:
        """
        Synthesizes a natural, grounded answer from internal Supabase RAG document chunks.
        """
        if settings.LLM_PROVIDER != "gemini":
            return None

        api_key = self._get_api_key()
        if not api_key:
            logger.info("No valid Gemini API key found for LLM synthesis. Using deterministic fallback.")
            return None

        try:
            import google.generativeai as genai
            genai.configure(api_key=api_key)

            system_instructions = (
                "You are SkyGuardian AI's Passenger Rights & Aviation Policy Assistant.\n"
                "Your role is to explain flight disruption policies, missed connection compensation, and airline conditions of carriage.\n"
                "Rules:\n"
                "1. Base your answer strictly on the provided DOCUMENT CONTEXT.\n"
                "2. Be concise, clear, and empathetic to the passenger.\n"
                "3. Clearly state entitlements (e.g. meal vouchers, free rebooking, overnight hotel, cash compensation).\n"
                "4. Cite the official policy name or section.\n"
                "5. If the context does not explicitly mention a detail, do not speculate."
            )

            prompt = (
                f"{system_instructions}\n\n"
                f"DOCUMENT CONTEXT:\n{context_text}\n\n"
                f"PASSENGER QUESTION:\n{question}\n\n"
                f"ANSWER:"
            )

            for model_name in self._get_model_candidates():
                try:
                    model = genai.GenerativeModel(model_name)
                    res = await model.generate_content_async(prompt)
                    if res and res.text:
                        logger.info(f"Successfully synthesized RAG answer using {model_name}")
                        return res.text.strip()
                except Exception as model_err:
                    logger.warning(f"Gemini generation with model '{model_name}' failed: {model_err}")
                    continue

        except Exception as e:
            logger.warning(f"Gemini synthesis initialization error: {e}")

        return None

    async def synthesize_web_answer(
        self,
        question: str,
        airline_label: str,
        snippets: List[str],
        sources: List[Dict[str, Any]],
        tavily_summary: Optional[str] = None
    ) -> Optional[str]:
        """
        Synthesizes live official airline web search excerpts into an authoritative, grounded summary.
        """
        if settings.LLM_PROVIDER != "gemini":
            return None

        api_key = self._get_api_key()
        if not api_key:
            return None

        try:
            import google.generativeai as genai
            genai.configure(api_key=api_key)

            combined_context = ""
            if tavily_summary:
                combined_context += f"Live Web AI Summary:\n{tavily_summary}\n\n"
            
            combined_context += "Official Web Excerpts:\n" + "\n\n".join([f"- {s}" for s in snippets if s])

            prompt = (
                f"You are SkyGuardian AI, an aviation policy expert assistant.\n"
                f"Answer the passenger's question regarding {airline_label} based on the following verified official web search excerpts.\n"
                f"Focus on passenger rights, delay/cancellation compensation, rebooking, and duty of care (meals, hotel).\n"
                f"Be direct, structured, and helpful.\n\n"
                f"VERIFIED WEB CONTEXT:\n{combined_context}\n\n"
                f"PASSENGER QUESTION:\n{question}\n\n"
                f"ANSWER:"
            )

            for model_name in self._get_model_candidates():
                try:
                    model = genai.GenerativeModel(model_name)
                    res = await model.generate_content_async(prompt)
                    if res and res.text:
                        logger.info(f"Successfully synthesized Web Search answer using {model_name}")
                        return res.text.strip()
                except Exception as model_err:
                    logger.warning(f"Gemini generation with model '{model_name}' failed: {model_err}")
                    continue

        except Exception as e:
            logger.warning(f"Gemini web search synthesis initialization error: {e}")

        return None

llm_synthesizer = LLMPolicySynthesizer()
