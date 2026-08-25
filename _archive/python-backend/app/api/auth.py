from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.schemas.user import UserCreate, UserResponse, UserLogin
from app.services.user_service import (
    create_user,
    get_user_by_email
)
from app.core.security import verify_password
from app.auth.jwt import create_access_token


router = APIRouter(
    prefix="/api/auth",
    tags=["Authentication"],
)


@router.get("/ping")
async def ping():
    return {
        "message": "Authentication API is working"
    }


@router.post("/register", response_model=UserResponse)
def register(
    user: UserCreate,
    db: Session = Depends(get_db)
):

    existing_user = get_user_by_email(
        db,
        user.email
    )

    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Email already registered",
        )

    new_user = create_user(
        db=db,
        username=user.username,
        email=user.email,
        password=user.password,
    )

    return new_user


@router.post("/login")
def login(
    user: UserLogin,
    db: Session = Depends(get_db)
):

    db_user = get_user_by_email(
        db,
        user.email
    )

    if not db_user:
        raise HTTPException(
            status_code=401,
            detail="Invalid credentials"
        )


    if not verify_password(
        user.password,
        db_user.hashed_password
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid credentials"
        )


    token = create_access_token(
        {
            "sub": str(db_user.id),
            "email": db_user.email
        }
    )


    return {
        "access_token": token,
        "token_type": "bearer"
    }
