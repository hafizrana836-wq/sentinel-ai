from sqlalchemy import Column, ForeignKey, Integer, String, DateTime, Text
from sqlalchemy.sql import func

from app.database.base import Base


class Scan(Base):

    __tablename__ = "scans"


    id = Column(
        Integer,
        primary_key=True,
        index=True
    )


    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=True
    )


    target = Column(
        String(255),
        nullable=False
    )


    scan_type = Column(
        String(50),
        nullable=False
    )


    result = Column(
        Text,
        nullable=False
    )


    security_score = Column(
        Integer,
        nullable=True
    )


    risk = Column(
        String(20),
        nullable=False
    )


    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )
