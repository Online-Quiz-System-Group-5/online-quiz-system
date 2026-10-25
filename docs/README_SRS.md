# Group 5 SRS files

The SRS for the Group 5 Online Quiz System is maintained in this project
repository alongside the implementation so that requirement changes can be
reviewed with the code they govern.

- `SRS_Group5_Online_Quiz_System.docx` — working requirements draft for review.
- `../scripts/check_docs.py` — checks the DOCX package and required requirement
  identifiers.
- `../tests/test_check_docs.py` — tests valid, incomplete, corrupt, and missing
  document cases for the validator.
- `../.github/workflows/docs-check.yml` — runs that check on pushes and pull
  requests, then runs the validator unit tests.

The SRS remains a draft until the team and instructor approve it.
