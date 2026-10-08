# Optional Voice Agent

Owner: Savi. Voice chat is an optional conversational layer around the existing journey tools.

## Setup

Add `GEMINI_API_KEY=<your key>` to `backend/.env` and restart FastAPI. An existing real
`LLM_API_KEY` is also accepted. Do not commit either key or put it in a `NEXT_PUBLIC_*` variable.
Voice does not require changing `LLM_PROVIDER`, flight providers, or the recovery agent.

Defaults (overridable in the backend environment):

```dotenv
VOICE_ENABLED=true
VOICE_MODEL=gemini-2.5-flash
VOICE_TTS_MODEL=gemini-3.8-flash-tts
VOICE_TTS_VOICE=Kore
VOICE_TIMEOUT_SECONDS=45
```

The API key needs access and quota for both configured models. Model availability varies;
change the model settings if necessary. For Docker, supply these variables through Compose's
root `.env` or shell environment; the container does not read the host's `backend/.env`.
`VOICE_ENABLED=false` disables Gemini calls and leaves the written English briefing available.

## Flow

1. On `/journeys/new`, open Voice assistant and choose English, Sinhala, or Tamil.
2. Record up to 60 seconds, or type a journey description. Microphone capture requires
   localhost or HTTPS and explicit browser microphone permission.
3. Messages appear in a chat thread. Gemini asks for missing flight details and retains
   earlier details across turns. Missing or invalid fields remain blank, not invented.
4. Questions route to FlightAgent, WeatherAgent, verified RAG policy retrieval, or the
   existing journey workflow. Replies use these results rather than model memory for
   flight status, weather, risk and policy facts. Sources and demo warnings appear with replies.
5. Every reply is synthesized in the selected language. Automatic playback is attempted;
   browser autoplay restrictions may require pressing play. Mute, replay, cancel and new-chat
   controls are available. Written replies remain usable if speech fails.
6. Use these flight details copies collected legs into the editable form only on request.
   Check my journey remains available; Discuss this assessment sends the displayed result
   into the conversation. Nothing books or changes flights.

For a demo, say: "UL001 from CMB to KUL today, then XX123 from KUL to NRT today."
Use mock flight mode for those demo flight numbers.

## Contracts

| Endpoint | Input | Output |
| --- | --- | --- |
| `GET /api/voice/config` | None | Availability, languages and recording limits, never credentials |
| `POST /api/voice/interpret` | JSON: text, language, local reference_date | Transcript, intent, nullable draft legs, missing fields, requires_review |
| `POST /api/voice/transcribe` | Multipart: audio, language, local reference_date | Same draft contract |
| `POST /api/voice/briefing` | JSON: displayed JourneyAnalysisResponse as analysis, language | Written briefing, actual response language, optional base64 WAV, warnings |
| `POST /api/voice/chat` | JSON: text, language, reference_date, history, legs, optional analysis | Transcript, reply, audio, collected legs, missing fields, sources, warnings |
| `POST /api/voice/chat/audio` | Multipart: audio, context (JSON with the same conversation fields, excluding text) | Same chat reply contract |

The briefing endpoint describes the supplied analysis; it is not a fresh flight lookup or a
server-persisted report. The frontend sends the actual displayed API result. Briefings include
demo and missing-data warnings and describe risk as a prototype score, not a probability.
Policy/recovery prose and hardcoded alternatives are excluded from the spoken summary.

Gemini is called only on the backend over HTTPS with the key in an HTTP header. Audio is
limited to 8 MB, passed inline to Gemini, and not stored by this feature. Transcripts are
not persisted or logged. Provider retention is governed by the Gemini account's terms.
Input speech/text and model outputs are untrusted; drafts require user review. The adapter
does not add a mandatory step to the Supervisor or change its agent order. Conversation
history is limited to 20 messages and six collected flight legs. It is held in page memory,
sent to Gemini for each turn, and cleared on reload or New conversation. No chat persistence
or arbitrary web browsing is added. Retrieval is bounded to one selected tool per turn with
a 35-second timeout; the client allows 180 seconds for planning, retrieval, reply and speech.
Policy chat uses verified retrieval results only, not PolicyAgent's hardcoded fallback prose.

Translations are rejected if numeric literals or flight codes change. If translation fails,
the actual language is reported as English. If speech fails, the written
briefing remains available and device read-aloud is offered only when a matching voice exists.
Sinhala/Tamil accuracy and pronunciation need human evaluation with a configured live key.
Chat replies are generated directly in the selected language, not post-translated. The numeric
translation checks above apply to the legacy deterministic briefing endpoint. This is a
turn-based travel chatbot, not a streaming/full-duplex voice call.

## Verification

```sh
cd backend
./.venv/bin/pytest tests/test_voice.py tests/test_voice_chat.py -q
```

Frontend tests cover conversation history, draft review, language selection, audio playback,
unavailable services, cancellations, new conversations and microphone permission errors.
No real Gemini requests are made by automated tests.

API references: [audio understanding](https://ai.google.dev/gemini-api/docs/generate-content/audio),
[speech generation](https://ai.google.dev/gemini-api/docs/generate-content/speech-generation).
