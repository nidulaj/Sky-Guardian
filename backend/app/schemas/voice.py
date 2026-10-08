from datetime import date
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.schemas.journey import JourneyAnalysisResponse

VoiceLanguage = Literal["en", "si", "ta"]


class VoiceTextRequest(BaseModel):
    text: str = Field(min_length=1, max_length=4000)
    language: VoiceLanguage = "en"
    reference_date: date

    @field_validator("text")
    @classmethod
    def nonblank_text(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Enter a journey description.")
        return value.strip()


class VoiceLegDraft(BaseModel):
    flight_number: str | None = Field(default=None, max_length=20)
    origin: str | None = Field(default=None, max_length=10)
    destination: str | None = Field(default=None, max_length=10)
    travel_date: str | None = Field(default=None, max_length=30)


class VoiceExtraction(BaseModel):
    transcript: str = Field(max_length=4000)
    intent: Literal["analyze_journey", "read_summary", "unsupported"]
    legs: list[VoiceLegDraft] = Field(default_factory=list, max_length=6)


class VoiceDraftResponse(VoiceExtraction):
    language: VoiceLanguage
    missing_fields: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    requires_review: Literal[True] = True


class VoiceBriefingRequest(BaseModel):
    language: VoiceLanguage = "en"
    analysis: JourneyAnalysisResponse


class VoiceBriefingResponse(BaseModel):
    text: str
    language: VoiceLanguage
    audio_base64: str | None = None
    audio_mime_type: str | None = None
    warnings: list[str] = Field(default_factory=list)
