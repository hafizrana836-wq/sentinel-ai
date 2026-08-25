from pydantic import BaseModel


class PortScanRequest(BaseModel):
    target: str


class PortScanResponse(BaseModel):
    target: str
    open_ports: list[int]
