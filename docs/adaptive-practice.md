# Adaptive guided practice

Guided lessons now mix in review of two- and three-letter combinations.
Individual letters are left to the existing per-key statistics. The existing key unlock rules and focused-key practice remain in
place. Disable **Mix in adaptive review** in the guided lesson settings to use
the original word selection.

Completed, valid guided lessons build a small history of patterns made of
lowercase letters, or of letters of scripts without case.
Patterns need at least three observations before becoming review targets.
Combination timing measures the transitions within a combination. Spaces,
punctuation, skipped characters, and pauses over two seconds break a sequence.
The history records intended letters and error flags, not the incorrect text.

Patterns typed slower than the configured speed target, or with mistakes in
more than one tenth of their occurrences in a lesson, become eligible in the
next lesson. A single slip in a frequent pattern does not reset its progress. Successful practice schedules a later check, with
intervals increasing from 2 to 64 completed lessons (or 2 to 64 days away).
Further mistakes shorten the interval again. Ordinary successful encounters also
count as review. Changing or restarting a lesson does not advance the schedule.

Every fourth word selection can target a due pattern, using only unlocked
letters. Other selections use the original focused-key generator. Natural
words with the pattern are looked up in the word list. Generated words are
tried a bounded number of times, and missing matches fall back to ordinary
words. Word repetition and duplicate suppression
still apply, so this is a selection budget rather than an exact proportion of
the final text.

History is limited to 1,000 patterns per keyboard layout. Guest history stays in
the browser. Signed-in history is saved to the local server after completed
lessons, in `DATA_DIR/adaptive/<layout>/user_settings/`, separately for each
account. Back up the entire data directory to preserve it along with ordinary
progress and account data. This is not a backup to keybr.com or another computer.

On opening guided practice, account history is restored before generating the
lesson. If the account has no history, existing browser history is imported.
Account-scoped browser caches retain pending saves when a request fails; they
retry on the next completed lesson, page reload, or via the displayed retry
button. A failed initial load pauses practice rather than overwriting server
history. Use one active practice session per account/layout; simultaneous
sessions replace snapshots rather than merge them.

History saved by the first version of this feature is converted when it is
loaded. That version kept only the error count of the last lesson, so the
total error counts, and the accuracy on the profile page, start from there.

It starts learning from newly completed lessons; existing per-key results do not
contain the sequences needed to reconstruct it. One lesson is one completed
block of generated text, regardless of the number of displayed lines.

These scheduling rules are initial heuristics, not a demonstrated guarantee of
faster learning. Tests cover scheduling, persistence, filtering, bounded word
selection, and compatibility with the original guided progression.
