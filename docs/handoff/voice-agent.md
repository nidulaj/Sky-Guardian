# Optional Voice Agent

Owner: Savi. Voice is an input/output adapter around the existing journey workflow.

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
3. Gemini transcribes and extracts up to six draft flight legs. Review the transcript;
   missing or invalid fields remain blank. Ambiguous airports must be clarified in the form.
4. Use these flight details copies the draft into the existing editable journey form.
   It never automatically starts analysis or books anything.
5. Check my journey runs the existing Supervisor and specialist agents.
6. Prepare spoken assessment builds a deterministic briefing from that displayed analysis,
   translates it if requested, and generates audio. Playback is user-initiated.

For a demo, say: "UL001 from CMB to KUL today, then XX123 from KUL to NRT today."
Use mock flight mode for those demo flight numbers.

## Contracts

| Endpoint | Input | Output |
| --- | --- | --- |
| `GET /api/voice/config` | None | Availability, languages and recording limits, never credentials |
| `POST /api/voice/interpret` | JSON: text, language, local reference_date | Transcript, intent, nullable draft legs, missing fields, requires_review |
| `POST /api/voice/transcribe` | Multipart: audio, language, local reference_date | Same draft contract |
| `POST /api/voice/briefing` | JSON: displayed JourneyAnalysisResponse as analysis, language | Written briefing, actual response language, optional base64 WAV, warnings |

The briefing endpoint describes the supplied analysis; it is not a fresh flight lookup or a
server-persisted report. The frontend sends the actual displayed API result. Briefings include
demo and missing-data warnings and describe risk as a prototype score, not a probability.
Policy/recovery prose and hardcoded alternatives are excluded from the spoken summary.

Gemini is called only on the backend over HTTPS with the key in an HTTP header. Audio is
limited to 8 MB, passed inline to Gemini, and not stored by this feature. Transcripts are
not persisted or logged. Provider retention is governed by the Gemini account's terms.
Input speech/text and model outputs are untrusted; drafts require user review. The adapter
does not add a mandatory step to the Supervisor or change its agent order.

Translations are rejected if numeric literals or flight codes change. If translation fails,
the actual language is reported as English. If speech fails, the written
briefing remains available and device read-aloud is offered only when a matching voice exists.
Sinhala/Tamil accuracy and pronunciation need human evaluation with a configured live key.
This is turn-based recording, not streaming or an open-ended voice chatbot.

## Verification

```sh
cd backend
./.venv/bin/pytest tests/test_voice.py -q
```

Frontend tests cover draft review, language selection, unavailable services, cancellations,
and microphone permission errors. No real Gemini requests are made by automated tests.

API references: [audio understanding](https://ai.google.dev/gemini-api/docs/generate-content/audio),
[speech generation](https://ai.google.dev/gemini-api/docs/generate-content/speech-generation).
