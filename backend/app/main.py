from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.api import health, auth, journeys, weather, airports, voice
from app.rag.router import router as rag_router

app = FastAPI(
    title=settings.APP_NAME,
    description="Multi-Agent Proactive Flight Disruption Risk and Recovery Platform API",
    version="0.1.0"
)

# CORS Middleware Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Router Registrations
app.include_router(health.router)
app.include_router(auth.router)
app.include_router(journeys.router)
app.include_router(weather.router)
app.include_router(rag_router)
app.include_router(airports.router)
app.include_router(voice.router)

@app.get("/")
async def root():
    return {
        "app": settings.APP_NAME,
        "tagline": "Predict the disruption. Protect the journey.",
        "status": "online",
        "docs": "/docs"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=settings.HOST, port=settings.PORT, reload=True)
