
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

bad_bank=$(mktemp)
startup_output=$(mktemp)
startup_error=$(mktemp)
menu_eof_output=$(mktemp)
menu_eof_error=$(mktemp)
quiz_eof_output=$(mktemp)
quiz_eof_error=$(mktemp)

trap 'rm -f "$bad_bank" "$startup_output" "$startup_error" "$menu_eof_output" "$menu_eof_error" "$quiz_eof_output" "$quiz_eof_error"' EXIT

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

# EOF at the menu should exit gracefully.
if ./online_quiz </dev/null >"$menu_eof_output" 2>"$menu_eof_error"; then
  menu_eof_status=0
else
  menu_eof_status=$?
fi

[[ "$menu_eof_status" -eq 0 ]] || {
  echo "FAIL: TC-INPUT-04 EOF at menu did not exit successfully" >&2
  exit 1
}
grep -q '^Online Quiz System$' "$menu_eof_output" || {
  echo "FAIL: TC-INPUT-04 EOF at menu did not display the welcome title" >&2
  exit 1
}
echo "PASS: TC-INPUT-04 EOF at menu exits gracefully"

# EOF during a quiz should report the incomplete input safely.
if printf '1\n' | ./online_quiz >"$quiz_eof_output" 2>"$quiz_eof_error"; then
  quiz_eof_status=0
else
  quiz_eof_status=$?
fi

[[ "$quiz_eof_status" -ne 0 ]] || {
  echo "FAIL: TC-INPUT-05 incomplete quiz unexpectedly succeeded" >&2
  exit 1
}

if ! grep -q 'Quiz session ended: input ended before the quiz was complete' "$quiz_eof_output" &&
   ! grep -q 'Quiz session ended: input ended before the quiz was complete' "$quiz_eof_error"; then
  echo "FAIL: TC-INPUT-05 incomplete quiz did not explain the EOF error" >&2
  exit 1
fi
echo "PASS: TC-INPUT-05 EOF during quiz is handled safely"
