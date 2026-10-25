"""Unit tests for the SRS DOCX integrity validator."""

from pathlib import Path
import sys
import tempfile
import unittest
from zipfile import ZipFile

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from scripts.check_docs import REQUIRED, validate_document  # noqa: E402

REPOSITORY_ROOT = Path(__file__).resolve().parents[1]


def make_docx(path: Path, document_xml: str) -> None:
    with ZipFile(path, "w") as package:
        package.writestr("word/document.xml", document_xml)


def word_document(text: str) -> str:
    return (
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        f"<w:body><w:p><w:r><w:t>{text}</w:t></w:r></w:p></w:body></w:document>"
    )


class ValidateDocumentTests(unittest.TestCase):
    def test_accepts_valid_docx_with_all_required_identifiers(self) -> None:
        text = " ".join(REQUIRED)
        document = word_document(text)
        with tempfile.TemporaryDirectory(dir=REPOSITORY_ROOT) as directory:
            path = Path(directory) / "valid.docx"
            make_docx(path, document)

            validate_document(path)

    def test_rejects_missing_required_identifier(self) -> None:
        document = word_document("Software Requirements Specification")
        with tempfile.TemporaryDirectory(dir=REPOSITORY_ROOT) as directory:
            path = Path(directory) / "incomplete.docx"
            make_docx(path, document)

            with self.assertRaisesRegex(ValueError, "missing expected content"):
                validate_document(path)

    def test_rejects_non_zip_file(self) -> None:
        with tempfile.TemporaryDirectory(dir=REPOSITORY_ROOT) as directory:
            path = Path(directory) / "not-a-docx.docx"
            path.write_text("not a zip archive", encoding="utf-8")

            with self.assertRaisesRegex(ValueError, "Invalid SRS DOCX package"):
                validate_document(path)

    def test_rejects_package_without_document_xml(self) -> None:
        with tempfile.TemporaryDirectory(dir=REPOSITORY_ROOT) as directory:
            path = Path(directory) / "missing-document.docx"
            with ZipFile(path, "w") as package:
                package.writestr("word/styles.xml", "<styles />")

            with self.assertRaisesRegex(ValueError, "Invalid SRS DOCX package"):
                validate_document(path)

    def test_rejects_missing_file(self) -> None:
        path = Path("missing-srs-for-test.docx")

        with self.assertRaisesRegex(ValueError, "Missing required SRS"):
            validate_document(path)


if __name__ == "__main__":
    unittest.main()
