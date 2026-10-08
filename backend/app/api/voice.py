from datetime import date

from fastapi import APIRouter, File, Form, HTTPException, Response, UploadFile
from pydantic import ValidationError

from app.agents.voice_agent import AUDIO_TYPES, LANGUAGES, MAX_AUDIO_BYTES, VoiceAgent, VoiceServiceError
from app.agents.voice_chat import VoiceChatAgent
from app.schemas.voice import (
    VoiceBriefingRequest, VoiceBriefingResponse, VoiceDraftResponse, VoiceLanguage, VoiceTextRequest,
    VoiceChatContext, VoiceChatRequest, VoiceChatResponse,
)

router = APIRouter(prefix="/api/voice", tags=["Voice Agent"])
voice_agent = VoiceAgent()


@router.get("/config")
async def voice_config(response: Response):
    response.headers["Cache-Control"] = "no-store"
    return {"available": voice_agent.available, "languages": LANGUAGES,
            "max_audio_bytes": MAX_AUDIO_BYTES, "max_recording_seconds": 60}


@router.post("/interpret", response_model=VoiceDraftResponse)
async def interpret_text(request: VoiceTextRequest, response: Response):
    response.headers["Cache-Control"] = "no-store"
    try:
        return await voice_agent.interpret(request.language, request.reference_date, text=request.text)
    except VoiceServiceError as error:
        raise HTTPException(status_code=error.status_code, detail=str(error)) from None


@router.post("/transcribe", response_model=VoiceDraftResponse)
async def transcribe_audio(
    response: Response,
    audio: UploadFile = File(...),
    language: VoiceLanguage = Form("en"),
    reference_date: date = Form(...),
):
    response.headers["Cache-Control"] = "no-store"
    try:
        mime_type = AUDIO_TYPES.get((audio.content_type or "").split(";")[0].strip().lower())
        if not mime_type:
            raise HTTPException(status_code=415, detail="Use a WebM, MP4/M4A, OGG, WAV, MP3, AAC or FLAC audio recording.")
        data = await audio.read(MAX_AUDIO_BYTES + 1)
        if not data:
            raise HTTPException(status_code=400, detail="The recording is empty. Please record again.")
        if len(data) > MAX_AUDIO_BYTES:
            raise HTTPException(status_code=413, detail="The recording is too large. Use a shorter recording (up to 8 MB).")
        return await voice_agent.interpret(language, reference_date, audio=data, mime_type=mime_type)
    except VoiceServiceError as error:
        raise HTTPException(status_code=error.status_code, detail=str(error)) from None
    finally:
        await audio.close()


@router.post("/briefing", response_model=VoiceBriefingResponse)
async def speak_briefing(request: VoiceBriefingRequest, response: Response):
    response.headers["Cache-Control"] = "no-store"
    return await voice_agent.briefing(request.analysis, request.language)


@router.post("/chat", response_model=VoiceChatResponse)
async def chat_text(request: VoiceChatRequest, response: Response):
    response.headers["Cache-Control"] = "no-store"
    try:
        return await VoiceChatAgent(voice_agent).chat(request, text=request.text)
    except VoiceServiceError as error:
        raise HTTPException(status_code=error.status_code, detail=str(error)) from None


@router.post("/chat/audio", response_model=VoiceChatResponse)
async def chat_audio(response: Response, audio: UploadFile = File(...), context: str = Form(...)):
    response.headers["Cache-Control"] = "no-store"
    try:
        try:
            request = VoiceChatContext.model_validate_json(context)
        except ValidationError:
            raise HTTPException(status_code=422, detail="Invalid conversation context.") from None
        mime_type = AUDIO_TYPES.get((audio.content_type or "").split(";")[0].strip().lower())
        if not mime_type:
            raise HTTPException(status_code=415, detail="Use a supported audio recording.")
        data = await audio.read(MAX_AUDIO_BYTES + 1)
        if not data:
            raise HTTPException(status_code=400, detail="The recording is empty. Please record again.")
        if len(data) > MAX_AUDIO_BYTES:
            raise HTTPException(status_code=413, detail="Use a shorter recording (up to 8 MB).")
        return await VoiceChatAgent(voice_agent).chat(request, audio=data, mime_type=mime_type)
    except VoiceServiceError as error:
        raise HTTPException(status_code=error.status_code, detail=str(error)) from None
    finally:
        await audio.close()
