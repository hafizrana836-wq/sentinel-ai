from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.schemas.scan import (
    PortScanRequest,
    PortScanResponse,
)

from app.database.session import get_db

from app.scanners.port_scanner import scan_ports
from app.scanners.header_scanner import scan_headers
from app.scanners.ssl_scanner import scan_ssl
from app.scanners.dns_scanner import scan_dns

from app.ai.risk_engine import calculate_security_score

from app.services.scan_service import (
    save_scan,
    get_scan_history,
)


router = APIRouter(
    prefix="/api/scanner",
    tags=["Scanner"],
)


@router.post(
    "/ports",
    response_model=PortScanResponse,
)
def port_scan(
    request: PortScanRequest
):

    ports = scan_ports(
        request.target
    )

    return {
        "target": request.target,
        "open_ports": ports,
    }



@router.post("/headers")
def header_scan(
    request: PortScanRequest
):

    return scan_headers(
        request.target
    )



@router.post("/ssl")
def ssl_scan(
    request: PortScanRequest
):

    return scan_ssl(
        request.target
    )



@router.post("/dns")
def dns_scan(
    request: PortScanRequest
):

    return scan_dns(
        request.target
    )



@router.post("/full-scan")
def full_scan(
    request: PortScanRequest,
    db: Session = Depends(get_db),
):

    report = {

        "target": request.target,

        "port_scan": {
            "open_ports": scan_ports(
                request.target
            ),
        },

        "header_scan": scan_headers(
            request.target
        ),

        "ssl_scan": scan_ssl(
            request.target
        ),

        "dns_scan": scan_dns(
            request.target
        ),
    }


    report["analysis"] = (
        calculate_security_score(
            report
        )
    )


    saved_scan = save_scan(
        db=db,
        target=request.target,
        scan_result=report,
    )


    return {
        "message": "Scan completed",
        "scan_id": saved_scan.id,
        "report": report,
    }



@router.get("/history")
def scan_history(
    db: Session = Depends(get_db),
):

    return get_scan_history(
        db
    )
