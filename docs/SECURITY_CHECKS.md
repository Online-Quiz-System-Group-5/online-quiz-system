
# Group 5 Online Quiz System – Security Checks

## Purpose

This document records the security checks performed for the Sprint 1 prototype of the Online Quiz System. The checks are based on the security requirements in the Software Requirements Specification (SRS).

## Security Requirements and Verification

| Requirement ID | Security Requirement | Verification Method | Status |
|---|---|---|---|
| OQS-SR-001 | The system must not request or store credentials or personal identifiers. | Preliminary source-code inspection. | Appears satisfied by inspection; not independently tested. |
| OQS-SR-002 | Player input must be treated as answer/menu data and must not execute shell commands or be directly used as a filesystem path. | Source-code inspection of input handling and shell execution functions. | Appears satisfied by inspection; CLI path is supplied separately as an argument. |
| OQS-SR-003 | Question-bank fields and option indices must be validated. Malformed records must be safely rejected. | Automated malformed-record, empty-option, and invalid-answer-key tests. | Partially verified; oversized-field limits are not yet enforced. |
| OQS-SR-004 | The correct-answer key must not be revealed before answer submission. | Automated test TC-SEC-04 in `tests/quiz_tests.cpp`. | Automated test passed. |
| OQS-SR-005 | Player answers and results must not be stored persistently. | Preliminary source-code inspection for file-writing operations. | Appears satisfied by inspection; no persistent result storage found. |

## Automated Test Evidence

The following checks were executed successfully:

- `./quiz_tests`
- `bash tests/cli_tests.sh`
- `python scripts/check_docs.py`
- `python -m unittest tests/test_check_docs.py`

The automated quiz tests include malformed question-bank records, invalid answer keys, invalid player input, and prevention of early answer disclosure.

## Limitations and Follow-up Work

1. OQS-SR-003 needs further work to define and enforce maximum question-bank, prompt, and option sizes.
2. OQS-SR-001, OQS-SR-002, and OQS-SR-005 have preliminary source-code inspection evidence, not dedicated automated security tests.
3. These checks do not constitute a formal security audit.

## Conclusion

The Sprint 1 prototype has automated checks for several input-validation and answer-disclosure cases. Other security requirements have preliminary source-code inspection evidence and require further verification. The security review should be updated as the implementation and SRS evolve.
