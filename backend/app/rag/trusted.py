import os
import yaml
import logging
from typing import Dict, List, Any
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

class TrustedDomainValidator:
    """
    Validates domain trust for aviation RAG sources against config/trusted_domains.yaml.
    Prevents untrusted, unverified blogs or user forums from entering grounded agent evidence.
    """
    def __init__(self, config_path: str = None):
        if not config_path:
            # Locate config/trusted_domains.yaml relative to project root
            base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
            config_path = os.path.join(base_dir, "config", "trusted_domains.yaml")
        
        self.config_path = config_path
        self.trusted_airlines: List[str] = []
        self.trusted_airports: List[str] = []
        self.aviation_authorities: List[str] = []
        self.untrusted_keywords: List[str] = []
        self._load_config()

    def _load_config(self):
        try:
            if os.path.exists(self.config_path):
                with open(self.config_path, "r", encoding="utf-8") as f:
                    data = yaml.safe_load(f) or {}
                    self.trusted_airlines = data.get("trusted_airlines", [])
                    self.trusted_airports = data.get("trusted_airports", [])
                    self.aviation_authorities = data.get("aviation_authorities", [])
                    self.untrusted_keywords = data.get("untrusted_keywords", [])
                logger.info(f"Loaded trusted domains from {self.config_path}")
            else:
                logger.warning(f"Trusted domains file not found at {self.config_path}, using defaults.")
                self._load_defaults()
        except Exception as e:
            logger.warning(f"Error reading trusted_domains.yaml: {e}, using defaults.")
            self._load_defaults()

    def _load_defaults(self):
        self.trusted_airlines = ["srilankan.com", "malaysiaairlines.com", "singaporeair.com", "qantas.com", "emirates.com", "qatarairways.com"]
        self.trusted_airports = ["airport-cmb.lk", "malaysiaairports.com.my", "changiairport.com", "narita-airport.jp"]
        self.aviation_authorities = ["caasl.gov.lk", "caam.gov.my", "faa.gov", "easa.europa.eu", "iata.org", "icao.int"]
        self.untrusted_keywords = ["blog", "forum", "reddit", "quora", "tripadvisor", "travelhacks"]

    def extract_domain(self, url: str) -> str:
        """Extracts netloc domain from a URL or raw domain string."""
        if not url:
            return ""
        if "://" in url:
            parsed = urlparse(url)
            domain = parsed.netloc.lower()
        else:
            domain = url.lower().split("/")[0]
        # Strip port or www prefix
        domain = domain.split(":")[0]
        if domain.startswith("www."):
            domain = domain[4:]
        return domain

    def is_trusted(self, url: str) -> bool:
        """
        Determines whether a source URL or domain is explicitly trusted.
        Rejects domains matching untrusted keywords.
        """
        if not url:
            return True # Allow internal/system sources
        
        # Internal Supabase storage paths are trusted user-uploaded documents
        if url.startswith("storage://") or "supabase.co/storage" in url:
            return True
        
        domain = self.extract_domain(url)
        if not domain:
            return True

        # Check untrusted keywords
        for bad in self.untrusted_keywords:
            if bad in domain or bad in url.lower():
                return False

        all_trusted = self.trusted_airlines + self.trusted_airports + self.aviation_authorities
        for trusted in all_trusted:
            if domain == trusted or domain.endswith("." + trusted):
                return True

        # If it's a known official domain ending (.gov, .europa.eu, etc.)
        gov_endings = (".gov", ".europa.eu", ".gov.lk", ".gov.my", ".gov.uk", ".gov.au", ".gov.sg", ".gov.ae")
        if any(domain.endswith(ending) for ending in gov_endings):
            return True

        return False

    def add_trusted_domain(self, domain: str):
        """Allows dynamically registering an official airline or airport domain."""
        clean = self.extract_domain(domain)
        if clean and clean not in self.trusted_airlines:
            self.trusted_airlines.append(clean)
            logger.info(f"Dynamically added trusted airline domain: {clean}")

