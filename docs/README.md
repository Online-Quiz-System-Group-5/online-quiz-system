# Submission documents

The six required document categories are available here:

1. [Software Requirements Specification](SRS_Group5_Online_Quiz_System_Baseline.docx)
2. [Test Plan](Test_Plan_Group5_Online_Quiz_System.docx)
3. [Software Architecture Document](SAD_Group5_Online_Quiz_System.docx)
4. [Unit Test Report](Unit_Test_Report_Group5.docx)
5. [System Test Report](System_Test_Report_Group5.docx)
6. [Test Coverage Report](Test_Coverage_Report_Group5.docx)

The three test reports record execution on 21 November 2026 against source revision
`73bf9c9e9ea109fd71ae855b0ae26908edefc42d`. Supporting assertion output and
machine-readable execution and coverage summaries are in [test-evidence](test-evidence).

The current C++ and Node suites and eight maintained Chrome scenarios passed.
Three older standalone browser scripts failed because their fixtures do not match
the topic interface and question-count limit. The system report records these
findings and the remaining verification limits. No all-tests-pass or formal
acceptance claim is made.

Code coverage and requirements coverage have different denominators. The coverage
report records 92.27% line coverage for the C++ production source and 97.39% for
the JavaScript core under Node tests. It also maps the existing console SRS to
automated test evidence and identifies requirements not verified in this run.

The pre-existing SRS, SAD, Test Plan and Sprint 2 acceptance review remain their
original baselines; the new execution reports do not amend their approved scope.
