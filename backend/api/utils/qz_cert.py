"""Gestion du certificat de signature QZ Tray.

Permet de signer les requêtes côté serveur pour que QZ Tray n'affiche plus
le popup "Untrusted website".
"""
from __future__ import annotations

import base64
from datetime import datetime, timedelta, timezone
from pathlib import Path

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.x509.oid import NameOID
from django.conf import settings


def _get_qz_dir() -> Path:
    qz_dir = getattr(settings, "QZ_CERT_DIR", None)
    if qz_dir:
        path = Path(qz_dir)
    else:
        path = Path(getattr(settings, "MEDIA_ROOT", "/tmp")) / "qz"
    path.mkdir(parents=True, exist_ok=True)
    return path


def _get_key_path() -> Path:
    return _get_qz_dir() / "qz_private.pem"


def _get_cert_path() -> Path:
    return _get_qz_dir() / "qz_certificate.pem"


def _generate_key_pair():
    key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
    )
    subject = issuer = x509.Name(
        [
            x509.NameAttribute(NameOID.COUNTRY_NAME, "CM"),
            x509.NameAttribute(NameOID.STATE_OR_PROVINCE_NAME, "Douala"),
            x509.NameAttribute(NameOID.LOCALITY_NAME, "Douala"),
            x509.NameAttribute(NameOID.ORGANIZATION_NAME, "Zenith Pharma"),
            x509.NameAttribute(NameOID.COMMON_NAME, "localhost"),
        ]
    )
    cert = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(issuer)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(datetime.now(timezone.utc) - timedelta(days=1))
        .not_valid_after(datetime.now(timezone.utc) + timedelta(days=3650))
        .add_extension(
            x509.BasicConstraints(ca=True, path_length=0), critical=True
        )
        .add_extension(
            x509.KeyUsage(
                digital_signature=True,
                content_commitment=False,
                key_encipherment=False,
                data_encipherment=False,
                key_agreement=False,
                key_cert_sign=True,
                crl_sign=True,
                encipher_only=False,
                decipher_only=False,
            ),
            critical=True,
        )
        .add_extension(
            x509.SubjectAlternativeName(
                [x509.DNSName("localhost"), x509.DNSName("localhost.qz.io")]
            ),
            critical=False,
        )
        .sign(key, hashes.SHA256())
    )

    _get_key_path().write_bytes(
        key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.TraditionalOpenSSL,
            encryption_algorithm=serialization.NoEncryption(),
        )
    )
    _get_cert_path().write_bytes(cert.public_bytes(serialization.Encoding.PEM))
    return key, cert


def _load_or_generate():
    key_path = _get_key_path()
    cert_path = _get_cert_path()
    if key_path.exists() and cert_path.exists():
        key_pem = key_path.read_bytes()
        cert_pem = cert_path.read_bytes()
        key = serialization.load_pem_private_key(key_pem, password=None)
        cert = x509.load_pem_x509_certificate(cert_pem)
        return key, cert
    return _generate_key_pair()


def get_certificate_pem() -> str:
    """Retourne le certificat public au format PEM."""
    _, cert = _load_or_generate()
    return cert.public_bytes(serialization.Encoding.PEM).decode("ascii")


def sign_qz_request(request_to_sign: str | bytes) -> str:
    """Signe une requête QZ Tray avec SHA512/RSA et retourne la signature Base64."""
    key, _ = _load_or_generate()
    data = (
        request_to_sign.encode("utf-8")
        if isinstance(request_to_sign, str)
        else request_to_sign
    )
    signature = key.sign(data, padding.PKCS1v15(), hashes.SHA512())
    return base64.b64encode(signature).decode("ascii")
