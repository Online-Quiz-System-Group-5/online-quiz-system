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

menu_output=$(printf 'x\n2\n' | ./online_quiz)
grep -q '^Online Quiz System$' <<<"$menu_output" || {
  echo "FAIL: TC-UI-01 welcome title was not displayed" >&2
  exit 1
}
grep -q 'Invalid choice\. Enter 1 or 2\.' <<<"$menu_output" || {
  echo "FAIL: TC-UI-01 invalid menu input was not explained" >&2
  exit 1
}
[[ "$(grep -c '^1\. Start quiz$' <<<"$menu_output")" -ge 2 ]] || {
  echo "FAIL: TC-UI-01 menu did not recover after invalid input" >&2
  exit 1
}
! grep -q '^Question 1:' <<<"$menu_output" || {
  echo "FAIL: TC-UI-01 exit selection unexpectedly started a quiz" >&2
  exit 1
}
echo "PASS: TC-UI-01 welcome, invalid menu recovery, and exit flow"

invalid_answer_output=$(printf '1\nx\n1\n2\n2\n2\n1\n2\n' | ./online_quiz)
grep -q 'Invalid choice\. Enter a number shown above\.' <<<"$invalid_answer_output" || {
  echo "FAIL: TC-INPUT-03 invalid quiz answer was not explained" >&2
  exit 1
}
grep -q '^Correct answers: 5$' <<<"$invalid_answer_output" || {
  echo "FAIL: TC-INPUT-03 quiz did not recover and complete after an invalid answer" >&2
  exit 1
}
echo "PASS: TC-INPUT-03 invalid quiz answer is rejected and the session recovers"

bad_bank=$(mktemp)
startup_output=$(mktemp)
startup_error=$(mktemp)
midquiz_output=$(mktemp)
midquiz_error=$(mktemp)
trap 'rm -f "$bad_bank" "$startup_output" "$startup_error" "$midquiz_output" "$midquiz_error"' EXIT

if printf '1\n' | ./online_quiz >"$midquiz_output" 2>"$midquiz_error"; then
  echo "FAIL: TC-REL-01 incomplete mid-quiz input unexpectedly completed successfully" >&2
  exit 1
fi
grep -q '^Quiz session ended: input ended before the quiz was complete$' "$midquiz_error" || {
  echo "FAIL: TC-REL-01 mid-quiz end-of-input did not produce a controlled diagnostic" >&2
  exit 1
}
! grep -q '^Quiz results$' "$midquiz_output" || {
  echo "FAIL: TC-REL-01 incomplete mid-quiz input displayed a result summary" >&2
  exit 1
}
echo "PASS: TC-REL-01 end-of-input during a quiz terminates with a clear diagnostic"

printf 'Incomplete record|Only one option|1\n' >"$bad_bank"
if ./online_quiz "$bad_bank" >"$startup_output" 2>"$startup_error"; then
  echo "FAIL: TC-LOAD-04 invalid bank unexpectedly started" >&2
  exit 1
fi
grep -q '^Unable to start quiz: line 1:' "$startup_error" || {
  echo "FAIL: TC-LOAD-04 malformed bank did not produce a useful diagnostic" >&2
  exit 1
}
[[ ! -s "$startup_output" ]] || {
  echo "FAIL: TC-LOAD-04 malformed bank printed the quiz menu" >&2
  exit 1
}
echo "PASS: TC-LOAD-04 malformed bank fails safely with a startup diagnostic"
