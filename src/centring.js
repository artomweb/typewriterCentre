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
  const words = title.trim().split(/\s+/).filter(Boolean);
  const N = words.length;
  if (N === 0) return [];

  // A single word longer than maxTitleWidth can never be placed
  if (words.some((w) => w.length > maxTitleWidth)) return null;

  const parity = pageWidth % 2; // 0 = even page, 1 = odd page
  const ps = buildPrefixSums(words);

  // --- DP table ---
  // dp[i] = best node reachable from word index i to the end.
  //   cost : total demerits from this point onward (Infinity if unreachable)
  //   next : index of the first word on the *next* line (i.e. this line is
  //          words[i .. next-1])
  const dp = new Array(N + 1).fill(null).map(() => ({
    cost: Infinity,
    next: -1,
  }));

  // Base case: having placed all words, cost is 0.
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

      if (totalCost < dp[start].cost) {
        dp[start].cost = totalCost;
        dp[start].next = end;
      }
    }
  }

  // No valid split found.
  if (dp[0].cost === Infinity) return null;

  // Reconstruct lines by following the `next` chain from index 0.
  const lines = [];
  let pos = 0;
  while (pos < N) {
    const next = dp[pos].next;
    lines.push(words.slice(pos, next).join(" "));
    pos = next;
  }

  console.log({
  pageWidth,
  maxTitleWidth,
  title,
  lines,
  spacesPerLine: lines.map(l => (pageWidth - l.length) / 2),
  totalDemerits: dp[0].cost,
});


  return lines;
}

function canBeCentered(title, pageWidth, maxTitleWidth) {
  return findBestSplit(title, pageWidth, maxTitleWidth) !== null;
}

function otherMarginWouldWork(title, pageWidth, maxTitleWidth) {
  for (let m = 1; m <= pageWidth; m++) {
    if (m === maxTitleWidth) continue;
    if (findBestSplit(title, pageWidth, m) !== null) return true;
  }
  return false;
}

function diagnoseFailure(title, pageWidth, maxTitleWidth) {
  const words = title.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;

  const tooLongWord = words.find((w) => w.length > maxTitleWidth);
  if (tooLongWord) {
    return otherMarginWouldWork(title, pageWidth, maxTitleWidth)
      ? { reason: "word-too-long-fixable", message: "Cannot be centred due to margin" }
      : { reason: "word-too-long", message: "Cannot be centred" };
  }

  return otherMarginWouldWork(title, pageWidth, maxTitleWidth)
    ? { reason: "no-parity-split-fixable", message: "Cannot be centred due to margin" }
    : { reason: "no-parity-split", message: "Cannot be centred" };
}

export { findBestSplit, diagnoseFailure };