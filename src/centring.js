/**
 * Split a title into words, ignoring leading, trailing and repeated whitespace.
 */
function splitWords(title) {
  return title.trim().split(/\s+/).filter(Boolean);
}

/**
 * Build prefix sums of word character lengths.
 * prefixSums[i] = sum of lengths of words[0..i-1].
 * Allows O(1) computation of the length of any word range.
 */
function buildPrefixSums(words) {
  const ps = [0];
  for (let i = 0; i < words.length; i++) {
    ps[i + 1] = ps[i] + words[i].length;
  }
  return ps;
}

/**
 * Character length of a line containing words[start..end-1], joined by
 * single spaces: sum_of_word_lengths + (number_of_spaces_between_words).
 */
function lineLen(ps, start, end) {
  return ps[end] - ps[start] + (end - start - 1);
}

/**
 * Knuth-Plass line-breaking
 *
 * Returns an array of line strings representing the optimal valid split, or
 * null if no valid split exists (i.e. the title cannot be centred with integer
 * spaces under the given constraints).
 *
 * @param {string} title         - The title text to lay out.
 * @param {number} pageWidth     - Page width in characters.
 * @param {number} maxTitleWidth - Maximum characters allowed on any single line.
 * @returns {string[] | null}
 */
function findBestSplit(title, pageWidth, maxTitleWidth) {
  const words = splitWords(title);
  const N = words.length;
  if (N === 0) return [];

  // A single word longer than maxTitleWidth can never be placed
  if (words.some((w) => w.length > maxTitleWidth)) return null;

  const parity = pageWidth % 2; // 0 = even page, 1 = odd page
  const ps = buildPrefixSums(words);

  // Never break the title more than it needs to be: a typist would rather put
  // a short title on one line half a space off-centre than split it to fix
  // parity. Greedy wrapping gives the minimum number of lines.
  const minLines = greedyWrap(title, maxTitleWidth).length;

  // --- DP table ---
  // dp[i] = best node reachable from word index i to the end.
  //   lines : number of lines from this point onward
  //   cost  : total demerits from this point onward (Infinity if unreachable)
  //   next  : index of the first word on the *next* line (i.e. this line is
  //           words[i .. next-1])
  // Layouts are compared by fewest lines first, then lowest cost.
  const dp = new Array(N + 1).fill(null).map(() => ({
    lines: Infinity,
    cost: Infinity,
    next: -1,
  }));

  // Base case: having placed all words, cost is 0.
  dp[N].lines = 0;
  dp[N].cost = 0;

  // Fill right-to-left (suffix DP), so dp[start] can reference dp[end].
  for (let start = N - 1; start >= 0; start--) {
    for (let end = start + 1; end <= N; end++) {
      const len = lineLen(ps, start, end);

      // Lines only get longer as we add words — prune early.
      if (len > maxTitleWidth) break;

      // Parity gate: this line is infeasible if it cannot be centred with an
      // integer number of leading spaces.
      if (len % 2 !== parity) continue;

      // No valid continuation from here.
      if (dp[end].cost === Infinity) continue;

      // Cost for this line.
      // Squared deviation from page width.
      const lineCost = (pageWidth - len) ** 2;
      const totalCost = lineCost + dp[end].cost;
      const totalLines = 1 + dp[end].lines;

      if (totalLines < dp[start].lines || (totalLines === dp[start].lines && totalCost < dp[start].cost)) {
        dp[start].lines = totalLines;
        dp[start].cost = totalCost;
        dp[start].next = end;
      }
    }
  }

  // No valid split found, or the only ones break the title more than needed.
  if (dp[0].cost === Infinity || dp[0].lines > minLines) return null;

  // Reconstruct lines by following the `next` chain from index 0.
  const lines = [];
  let pos = 0;
  while (pos < N) {
    const next = dp[pos].next;
    lines.push(words.slice(pos, next).join(" "));
    pos = next;
  }

  return lines;
}

/**
 * Greedy line wrapping: pack as many words as fit on each line. Used to show
 * the title when no split can be centred. Ignores parity, and a word longer
 * than maxWidth gets a line to itself.
 */
function greedyWrap(title, maxWidth) {
  const lines = [];
  let current = [];

  for (const word of splitWords(title)) {
    const lineIfAdded = [...current, word].join(" ");
    if (lineIfAdded.length <= maxWidth) {
      current.push(word);
    } else {
      if (current.length) lines.push(current.join(" "));
      current = [word];
    }
  }
  if (current.length) lines.push(current.join(" "));
  return lines;
}

/**
 * The max title width closest to the current one that allows the title to be
 * centred, or null if no width between 1 and pageWidth works. On a tie the
 * wider margin wins.
 */
function nearestWorkingMaxTitleWidth(title, pageWidth, maxTitleWidth) {
  for (let d = 1; d < pageWidth; d++) {
    for (const m of [maxTitleWidth + d, maxTitleWidth - d]) {
      if (m < 1 || m > pageWidth) continue;
      if (findBestSplit(title, pageWidth, m) !== null) return m;
    }
  }
  return null;
}

function diagnoseFailure(title, pageWidth, maxTitleWidth) {
  const words = splitWords(title);
  if (words.length === 0) return null;

  const suggestedMaxTitleWidth = nearestWorkingMaxTitleWidth(title, pageWidth, maxTitleWidth);
  const cause = words.some((w) => w.length > maxTitleWidth) ? "word-too-long" : "no-parity-split";

  return suggestedMaxTitleWidth === null
    ? { reason: cause, message: "Cannot be centred", suggestedMaxTitleWidth }
    : { reason: `${cause}-fixable`, message: "Cannot be centred due to margin", suggestedMaxTitleWidth };
}

export { findBestSplit, greedyWrap, diagnoseFailure };