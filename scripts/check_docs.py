"""Check that the Group 5 SRS document is a readable DOCX with key IDs."""

from pathlib import Path
from zipfile import BadZipFile, ZipFile
import xml.etree.ElementTree as ET


DOC = Path("docs/SRS_Group5_Online_Quiz_System.docx")
REQUIRED = (
    "Software Requirements Specification",
    "OQS-F-018",
    "OQS-NF-005",
    "OQS-SO-002",
    "OQS-SR-005",
)


def validate_document(doc_path: Path = DOC) -> None:
    """Validate a DOCX package and require the identifiers used by the SRS."""
    if not doc_path.is_file():
        raise ValueError(f"Missing required SRS: {doc_path}")

    try:
        with ZipFile(doc_path) as package:
            corrupt_member = package.testzip()
            if corrupt_member:
                raise ValueError(f"Corrupt DOCX package member: {corrupt_member}")
            root = ET.fromstring(package.read("word/document.xml"))
    except (OSError, KeyError, ET.ParseError, BadZipFile) as error:
        raise ValueError(f"Invalid SRS DOCX package: {error}") from error

    document_text = " ".join(
        node.text or "" for node in root.iter() if node.tag.endswith("}t")
    )
    missing = [identifier for identifier in REQUIRED if identifier not in document_text]
    if missing:
        raise ValueError("SRS is missing expected content: " + ", ".join(missing))


def main() -> None:
    try:
        validate_document()
    except ValueError as error:
        raise SystemExit(str(error)) from error
    print("PASS: SRS DOCX integrity and required IDs")


if __name__ == "__main__":
    main()
