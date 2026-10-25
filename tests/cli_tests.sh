#!/usr/bin/env bash
set -euo pipefail

output=$(printf '1\n1\n1\n1\n1\n1\n1\n1\n2\n2\n2\n1\n2\n' | ./online_quiz)

result_count=$(grep -c '^Quiz results$' <<<"$output")
[[ "$result_count" -eq 2 ]] || {
  echo "FAIL: TC-RESULT-02 expected two completed quiz results, got $result_count" >&2
  exit 1
}
grep -q '^Correct answers: 2$' <<<"$output" || {
  echo "FAIL: TC-RESULT-03 first session score was not 2" >&2
  exit 1
}
grep -q '^Correct answers: 5$' <<<"$output" || {
  echo "FAIL: TC-RESULT-03 replay did not start with a fresh score" >&2
  exit 1
}

echo "PASS: TC-RESULT-02 replay starts a second quiz"
echo "PASS: TC-RESULT-03 replay resets the score"
