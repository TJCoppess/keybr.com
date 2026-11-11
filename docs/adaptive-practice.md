# Adaptive practice

This fork adds several ways in which practice adapts to the typist, on top of
the original key unlock rules and focused-key practice of the guided lessons.

## Adaptive review

Guided lessons and common-word lessons mix in review of what the typist finds
difficult. Disable **Mix in adaptive review** in the lesson settings to use the
original word selection. Three kinds of things are reviewed:

* Two- and three-letter combinations. Individual letters are left to the
  existing per-key statistics.
* Whole words of four letters or more.
* Pairs of letters which are typed one in place of another.

Completed, valid lessons build a history of patterns made of lowercase
letters, or of letters of scripts without case. Combination timing measures
the transitions within a combination. Spaces, punctuation, capitals, skipped
characters, and pauses over two seconds break a sequence. A word is measured
only when it stands between spaces and is typed without a pause inside.

### What needs review

A pattern needs at least three observations before becoming a review target.
A pattern fails a lesson, and is reviewed in the next one, when:

* mistakes are made in more than one tenth of its occurrences in the lesson,
  so a single slip in a frequent pattern does not reset its progress, or
* it is typed slower than one and a quarter of the typist's own median time
  per transition. The configured speed target is used instead until there are
  twenty patterns with enough observations.

A pattern which did not get any faster for eight lessons is considered to be
as fast as it gets for this typist, and is no longer reviewed for speed, only
for mistakes. Any new best time makes it reviewable for speed again. This
keeps inherently slow combinations, like those typed with one finger, from
being reviewed forever.

A letter typed in place of another letter is recorded as a confusion. A pair
confused three times or more, and at least once in the last thirty lessons, is
reviewed with words that contain both letters. A letter typed too early, in
place of the one before it, is not a confusion.

### When review happens

Successful practice schedules a later check, with intervals increasing from 2
to 64 completed lessons, or 2 to 64 days, whichever comes first. Further
failures shorten the interval again. Ordinary successful encounters also count
as review. Changing or restarting a lesson does not advance the schedule.

Both clocks are kept on purpose. Practice tends to come in bursts with long
breaks in between: the lesson clock spaces the checks within a burst, where
the calendar hardly moves, and the calendar clock brings everything back
after a break, where no lessons were completed.

Every fourth word selection can target something due for review, taking the
kinds in turns, and using only unlocked letters. Other selections use the
original generator. Natural words are looked up in the word list. Generated
words are tried a bounded number of times, and missing matches fall back to
ordinary words. Word repetition and duplicate suppression still apply, so this
is a selection budget rather than an exact proportion of the final text.

The **Review** row of the practice indicators lists what the current lesson
was generated to review.

### History

History is limited to 1,000 combinations, 500 words and 200 confusions per
keyboard layout. It records intended letters, statistics and the letters typed
by mistake, not the lesson text. Guest history stays in the browser. Signed-in
history is saved to the local server after completed lessons, in
`DATA_DIR/adaptive/<layout>/user_settings/`, separately for each account. Back
up the entire data directory to preserve it along with ordinary progress and
account data. This is not a backup to keybr.com or another computer.

On opening practice, account history is restored before generating the
lesson. If the account has no history, existing browser history is imported.
Account-scoped browser caches retain pending saves when a request fails; they
retry on the next completed lesson, page reload, or via the displayed retry
button. A failed initial load pauses practice rather than overwriting server
history. Use one active practice session per account/layout; simultaneous
sessions replace snapshots rather than merge them.

History saved by earlier versions of this feature is converted when it is
loaded. Those versions kept less, so total error counts, accuracy, and speed
gain are measured from the moment of conversion.

It starts learning from newly completed lessons; existing per-key results do
not contain the sequences needed to reconstruct it. One lesson is one
completed block of generated text, regardless of the number of displayed
lines.

### Does it work

The profile page shows the speed gain of the patterns reviewed at least twice,
measured from before their first review, next to the speed gain of the
patterns never reviewed, measured from when they were first observed. Patterns
are picked for review because they are slow, and slow patterns tend to get
faster anyway, so the difference is a hint and not a proof. The scheduling
rules remain heuristics.

## Accuracy-aware key unlocking

In guided lessons a next key is unlocked only when the previous keys reached
the target speed and are also typed correctly at least nine times out of ten
in the five most recent lessons in which each key was typed. When all keys
are fast enough, the least accurate key gets the focus. Disable **Require
accurate typing to unlock keys** in the guided lesson settings to unlock keys
by speed alone.

## Symbols lesson

The **Symbols** lesson practices everything which is not a letter:
punctuation, digits, and the symbols used in source code, typed in between
common words in contexts like `word(word)`, `word = 12` and `word@word`. The
kinds of keys can be selected in the lesson settings.

Like the guided lessons, it starts with four keys, unlocks a next key when the
previous keys are typed fast and accurately, focuses on the weakest key, and
types weaker keys more often. A key is learned at six tenths of the target
speed, because these keys are harder to reach than letters. Unlocking can be
disabled to practice all selected keys at once. Results of this lesson are
stored as source code results, and share per-key statistics with all other
lessons.

## Keystroke log

Results keep only the mean time and the error count of each key, which is not
enough to compute new statistics from past practice. Every key of a completed,
valid lesson is therefore also kept in the browser database, with its timing
and whether it was a mistake, for up to 2,000 lessons. The log can be
downloaded or deleted on the profile page. It includes the text of the lessons
that were typed, including custom text, and it is never sent to the server.

Tests cover scheduling, persistence, filtering, word selection, the lesson
generators, and compatibility with the original guided progression.
