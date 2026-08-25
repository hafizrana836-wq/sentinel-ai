from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "Sentinel AI"
    SECRET_KEY: str = "CHANGE_THIS_TO_A_LONG_RANDOM_SECRET"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    DATABASE_URL: str
    REDIS_URL: str

    class Config:
        env_file = ".env"


settings = Settings()
