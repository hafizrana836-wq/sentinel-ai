from sqlalchemy.orm import Session

from app.models.scan import Scan


def save_scan(
    db: Session,
    target: str,
    scan_result: dict,
):

    analysis = scan_result.get(
        "analysis",
        {}
    )

    risk = analysis.get(
        "overall_risk",
        "Unknown"
    )

    scan = Scan(
        target=target,
        scan_type="full",
        result=str(scan_result),
        risk=risk,
    )

    db.add(scan)
    db.commit()
    db.refresh(scan)

    return scan


def get_scan_history(
    db: Session,
    limit: int = 20,
):

    return (
        db.query(Scan)
        .order_by(
            Scan.created_at.desc()
        )
        .limit(limit)
        .all()
    )
