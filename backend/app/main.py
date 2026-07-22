from fastapi import FastAPI

app = FastAPI(
    title="Sentinel AI",
    description="AI Powered Cyber Security Agent",
    version="1.0.0"
)

@app.get("/")
async def root():
    return {
        "status": "ok",
        "application": "Sentinel AI",
        "version": "1.0.0"
    }

@app.get("/health")
async def health():
    return {
        "status": "healthy"
    }
