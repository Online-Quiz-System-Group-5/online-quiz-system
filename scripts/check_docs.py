"""Check that the Group 5 SRS document is a readable DOCX with key IDs."""

from pathlib import Path
from zipfile import ZipFile
import xml.etree.ElementTree as ET


DOC = Path("docs/SRS_Group5_Online_Quiz_System.docx")
REQUIRED = (
    "Software Requirements Specification",
    "OQS-F-018",
    "OQS-NF-005",
    "OQS-SO-002",
    "OQS-SR-005",
)


if not DOC.is_file():
    raise SystemExit(f"Missing required SRS: {DOC}")

try:
    with ZipFile(DOC) as package:
        corrupt_member = package.testzip()
        if corrupt_member:
            raise SystemExit(f"Corrupt DOCX package member: {corrupt_member}")
        root = ET.fromstring(package.read("word/document.xml"))
except (OSError, KeyError, ET.ParseError) as error:
    raise SystemExit(f"Invalid SRS DOCX package: {error}") from error

document_text = " ".join(
    node.text or "" for node in root.iter() if node.tag.endswith("}t")
)
missing = [identifier for identifier in REQUIRED if identifier not in document_text]
if missing:
    raise SystemExit("SRS is missing expected content: " + ", ".join(missing))

print("PASS: SRS DOCX integrity and required IDs")
