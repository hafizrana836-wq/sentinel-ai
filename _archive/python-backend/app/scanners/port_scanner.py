import socket


COMMON_PORTS = [
    22,
    80,
    443,
    8080,
    3306,
    5432,
]


def scan_ports(target: str):
    open_ports = []

    for port in COMMON_PORTS:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(1)

        result = sock.connect_ex((target, port))

        if result == 0:
            open_ports.append(port)

        sock.close()

    return open_ports
