import { useIntlNumbers } from "@keybr/intl";
import { type Layout } from "@keybr/keyboard";
import { adaptiveSpeedGain, isAdaptivePatternDue } from "@keybr/lesson";
import { useFormatter } from "@keybr/lesson-ui";
import { timeToSpeed } from "@keybr/result";
import {
  Button,
  Explainer,
  Field,
  FieldList,
  Figure,
  OptionList,
  Para,
} from "@keybr/widget";
import { type ReactNode, useMemo, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import * as styles from "./KeyCombosSection.module.less";
import { useAdaptivePatterns } from "./use-adaptive-patterns.ts";

export function KeyCombosSection({ layout }: { readonly layout: Layout }) {
  const { formatMessage } = useIntl();
  const { formatNumber, formatPercents } = useIntlNumbers();
  const { formatSpeed } = useFormatter();

  const { combinationPatterns, wordPatterns, confusions, currentLesson } =
    useAdaptivePatterns(layout);

  const [filterLength, setFilterLength] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("slowest");
  const [limit, setLimit] = useState<number>(15);

  const now = Date.now();

  const filteredPatterns = useMemo(() => {
    let list = combinationPatterns;
    if (filterLength === "words") {
      list = wordPatterns;
    } else if (filterLength === "2") {
      list = list.filter((p) => [...p.text].length === 2);
    } else if (filterLength === "3") {
      list = list.filter((p) => [...p.text].length === 3);
    }

    return [...list].sort((a, b) => {
      switch (sortBy) {
        case "slowest":
          // Slower speed means higher transition time
          return b.time - a.time || b.errorRate - a.errorRate;
        case "fastest":
          return a.time - b.time;
        case "errors":
          return b.errors - a.errors || b.time - a.time;
        case "samples":
          return b.samples - a.samples;
        case "due":
          return a.due - b.due || a.dueAt - b.dueAt;
        default:
          return 0;
      }
    });
  }, [combinationPatterns, wordPatterns, filterLength, sortBy]);

  const topConfusions = useMemo(
    () => [...confusions].sort((a, b) => b.count - a.count).slice(0, 12),
    [confusions],
  );

  const formatGain = (gain: number) =>
    `${gain < 0 ? "\u2212" : "+"}${formatPercents(Math.abs(gain))}`;

  const summary = useMemo(() => {
    if (combinationPatterns.length === 0) {
      return null;
    }
    const count = combinationPatterns.length;
    const mastered = combinationPatterns.filter((p) => p.streak >= 6).length;
    const needsReview = combinationPatterns.filter(
      (p) => p.streak === 0 || isAdaptivePatternDue(p, currentLesson, now),
    ).length;
    const totalTime = combinationPatterns.reduce((sum, p) => sum + p.time, 0);
    const avgSpeed = totalTime > 0 ? timeToSpeed(totalTime / count) : 0;

    // Both numbers accumulate over all lessons.
    const totalSamples = combinationPatterns.reduce(
      (sum, p) => sum + p.samples,
      0,
    );
    const totalErrors = combinationPatterns.reduce(
      (sum, p) => sum + p.errors,
      0,
    );
    const accuracy =
      totalSamples > 0 ? Math.max(0, 1 - totalErrors / totalSamples) : 1;

    return {
      count,
      mastered,
      needsReview,
      avgSpeed,
      accuracy,
      speedGain: adaptiveSpeedGain([...combinationPatterns, ...wordPatterns]),
    };
  }, [combinationPatterns, wordPatterns, currentLesson, now]);

  return (
    <Figure>
      <Figure.Caption>
        <FormattedMessage
          id="profile.chart.keyCombos.caption"
          defaultMessage="Key Combinations"
        />
      </Figure.Caption>

      <Explainer>
        <Figure.Description>
          <FormattedMessage
            id="profile.chart.keyCombos.description"
            defaultMessage="This section shows performance statistics and review status of the letter combinations and words tracked during practice, and the letters which you type in place of other letters. Speed gain compares the current speed of the patterns reviewed at least twice with their speed before the first review, and of the patterns never reviewed with their speed when first measured. Slow patterns tend to get faster anyway, so take the difference as a hint."
          />
        </Figure.Description>
      </Explainer>

      {summary != null ? (
        <>
          <div className={styles.statisticList}>
            <div className={styles.statisticListItem}>
              <span className={styles.itemName}>
                <FormattedMessage
                  id="profile.chart.keyCombos.total"
                  defaultMessage="Combinations"
                />
              </span>
              <span className={styles.itemValue}>
                {formatNumber(summary.count)}
              </span>
            </div>

            <div className={styles.statisticListItem}>
              <span className={styles.itemName}>
                <FormattedMessage
                  id="profile.chart.keyCombos.avgSpeed"
                  defaultMessage="Average Speed"
                />
              </span>
              <span className={styles.itemValue}>
                {formatSpeed(summary.avgSpeed)}
              </span>
            </div>

            <div className={styles.statisticListItem}>
              <span className={styles.itemName}>
                <FormattedMessage
                  id="profile.chart.keyCombos.accuracy"
                  defaultMessage="Accuracy"
                />
              </span>
              <span className={styles.itemValue}>
                {formatPercents(summary.accuracy)}
              </span>
            </div>

            <div className={styles.statisticListItem}>
              <span className={styles.itemName}>
                <FormattedMessage
                  id="profile.chart.keyCombos.mastered"
                  defaultMessage="Mastered"
                />
              </span>
              <span className={styles.itemValue}>
                {formatNumber(summary.mastered)}
              </span>
            </div>

            <div className={styles.statisticListItem}>
              <span className={styles.itemName}>
                <FormattedMessage
                  id="profile.chart.keyCombos.needsReview"
                  defaultMessage="Needs Review"
                />
              </span>
              <span className={styles.itemValue}>
                {formatNumber(summary.needsReview)}
              </span>
            </div>

            <div className={styles.statisticListItem}>
              <span className={styles.itemName}>
                <FormattedMessage
                  id="profile.chart.keyCombos.gainReviewed"
                  defaultMessage="Speed Gain, Reviewed"
                />
              </span>
              <span className={styles.itemValue}>
                {summary.speedGain.reviewed != null
                  ? formatGain(summary.speedGain.reviewed.gain)
                  : "\u2013"}
              </span>
            </div>

            <div className={styles.statisticListItem}>
              <span className={styles.itemName}>
                <FormattedMessage
                  id="profile.chart.keyCombos.gainOther"
                  defaultMessage="Speed Gain, Others"
                />
              </span>
              <span className={styles.itemValue}>
                {summary.speedGain.other != null
                  ? formatGain(summary.speedGain.other.gain)
                  : "\u2013"}
              </span>
            </div>
          </div>

          <div className={styles.controls}>
            <FieldList>
              <Field>
                <FormattedMessage
                  id="profile.chart.keyCombos.filterLabel"
                  defaultMessage="Pattern length:"
                />
              </Field>
              <Field>
                <OptionList
                  options={[
                    {
                      name: formatMessage({
                        id: "profile.chart.keyCombos.filterAll",
                        defaultMessage: "All (2 & 3-letter)",
                      }),
                      value: "all",
                    },
                    {
                      name: formatMessage({
                        id: "profile.chart.keyCombos.filter2",
                        defaultMessage: "2-Letter (Bigrams)",
                      }),
                      value: "2",
                    },
                    {
                      name: formatMessage({
                        id: "profile.chart.keyCombos.filter3",
                        defaultMessage: "3-Letter (Trigrams)",
                      }),
                      value: "3",
                    },
                    {
                      name: formatMessage({
                        id: "profile.chart.keyCombos.filterWords",
                        defaultMessage: "Whole Words",
                      }),
                      value: "words",
                    },
                  ]}
                  value={filterLength}
                  onSelect={(v) => {
                    setFilterLength(v);
                    setLimit(15);
                  }}
                />
              </Field>

              <Field>
                <FormattedMessage
                  id="profile.chart.keyCombos.sortLabel"
                  defaultMessage="Sort by:"
                />
              </Field>
              <Field>
                <OptionList
                  options={[
                    {
                      name: formatMessage({
                        id: "profile.chart.keyCombos.sortSlowest",
                        defaultMessage: "Slowest (Needs practice)",
                      }),
                      value: "slowest",
                    },
                    {
                      name: formatMessage({
                        id: "profile.chart.keyCombos.sortFastest",
                        defaultMessage: "Fastest",
                      }),
                      value: "fastest",
                    },
                    {
                      name: formatMessage({
                        id: "profile.chart.keyCombos.sortErrors",
                        defaultMessage: "Most Errors",
                      }),
                      value: "errors",
                    },
                    {
                      name: formatMessage({
                        id: "profile.chart.keyCombos.sortSamples",
                        defaultMessage: "Most Practiced",
                      }),
                      value: "samples",
                    },
                    {
                      name: formatMessage({
                        id: "profile.chart.keyCombos.sortDue",
                        defaultMessage: "Due Soonest",
                      }),
                      value: "due",
                    },
                  ]}
                  value={sortBy}
                  onSelect={setSortBy}
                />
              </Field>
            </FieldList>
          </div>

          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.patternCol}>
                  <FormattedMessage
                    id="profile.chart.keyCombos.colPattern"
                    defaultMessage="Combination"
                  />
                </th>
                <th className={styles.speedCol}>
                  <FormattedMessage
                    id="profile.chart.keyCombos.colSpeed"
                    defaultMessage="Speed"
                  />
                </th>
                <th className={styles.errorsCol}>
                  <FormattedMessage
                    id="profile.chart.keyCombos.colErrors"
                    defaultMessage="Errors"
                  />
                </th>
                <th className={styles.samplesCol}>
                  <FormattedMessage
                    id="profile.chart.keyCombos.colSamples"
                    defaultMessage="Practiced"
                  />
                </th>
                <th className={styles.streakCol}>
                  <FormattedMessage
                    id="profile.chart.keyCombos.colStreak"
                    defaultMessage="Mastery"
                  />
                </th>
                <th className={styles.dueCol}>
                  <FormattedMessage
                    id="profile.chart.keyCombos.colSchedule"
                    defaultMessage="Schedule"
                  />
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredPatterns.slice(0, limit).map((pattern) => {
                const speed = pattern.time > 0 ? timeToSpeed(pattern.time) : 0;
                const isDue = isAdaptivePatternDue(pattern, currentLesson, now);
                return (
                  <tr key={pattern.text}>
                    <td className={styles.patternCol}>
                      <span className={styles.comboBadge}>{pattern.text}</span>
                    </td>
                    <td className={styles.speedCol}>{formatSpeed(speed)}</td>
                    <td className={styles.errorsCol}>
                      {pattern.errors > 0 ? (
                        <span className={styles.badgeDue}>
                          {formatNumber(pattern.errors)}
                        </span>
                      ) : (
                        formatNumber(0)
                      )}
                    </td>
                    <td className={styles.samplesCol}>
                      {formatNumber(pattern.samples)}
                    </td>
                    <td className={styles.streakCol}>
                      <MasteryIndicator streak={pattern.streak} />
                    </td>
                    <td className={styles.dueCol}>
                      {isDue ? (
                        <span className={styles.badgeDue}>
                          <FormattedMessage
                            id="profile.chart.keyCombos.dueNow"
                            defaultMessage="Due now"
                          />
                        </span>
                      ) : (
                        <FormattedMessage
                          id="profile.chart.keyCombos.inLessons"
                          defaultMessage="In {count} lessons"
                          values={{
                            count: Math.max(1, pattern.due - currentLesson),
                          }}
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredPatterns.length > limit && (
            <div className={styles.pagination}>
              <Button onClick={() => setLimit((prev) => prev + 25)}>
                <FormattedMessage
                  id="profile.chart.keyCombos.showMore"
                  defaultMessage="Show more ({count} remaining)"
                  values={{ count: filteredPatterns.length - limit }}
                />
              </Button>
            </div>
          )}

          {topConfusions.length > 0 && (
            <>
              <Para>
                <FormattedMessage
                  id="profile.chart.keyCombos.confusions"
                  defaultMessage="Letters most often typed in place of other letters, and how many times:"
                />
              </Para>
              <div className={styles.confusionList}>
                {topConfusions.map(({ expected, typed, count }) => (
                  <span
                    key={expected + typed}
                    className={styles.comboBadge}
                    title={formatMessage(
                      {
                        id: "profile.chart.keyCombos.confusionTitle",
                        defaultMessage:
                          "Typed {typed} in place of {expected} {count, plural, one {# time} other {# times}}",
                      },
                      { expected, typed, count },
                    )}
                  >
                    {`${expected} \u2192 ${typed} \u00d7${formatNumber(count)}`}
                  </span>
                ))}
              </div>
            </>
          )}
        </>
      ) : (
        <Para align="center">
          <FormattedMessage
            id="profile.chart.keyCombos.noData"
            defaultMessage="No letter combination data recorded yet for this layout. Complete guided lessons with “Mix in adaptive review” enabled to begin tracking combination speeds and review schedules."
          />
        </Para>
      )}
    </Figure>
  );
}

function MasteryIndicator({ streak }: { readonly streak: number }): ReactNode {
  const { formatMessage } = useIntl();
  return (
    <div
      className={styles.streakDots}
      title={formatMessage(
        {
          id: "profile.chart.keyCombos.streakTitle",
          defaultMessage: "Mastery streak: {streak} of {total}",
        },
        { streak, total: 6 },
      )}
    >
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={`${styles.dot} ${i < streak ? styles.dotActive : ""}`}
        />
      ))}
      <span style={{ marginInlineStart: "0.5rem" }}>
        {streak >= 6 ? (
          <span className={styles.badgeMastered}>
            <FormattedMessage
              id="profile.chart.keyCombos.masteredLabel"
              defaultMessage="Mastered"
            />
          </span>
        ) : streak === 0 ? (
          <span className={styles.badgeDue}>
            <FormattedMessage
              id="profile.chart.keyCombos.reviewLabel"
              defaultMessage="Review"
            />
          </span>
        ) : (
          <span className={styles.badgeLearning}>{`${streak}/6`}</span>
        )}
      </span>
    </div>
  );
}
