from fastapi import APIRouter

router = APIRouter(
    prefix="/api/auth",
    tags=["Authentication"],
)


@router.get("/ping")
async def ping():
    return {"message": "Authentication API is working"}
