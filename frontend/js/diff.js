/** So sánh bài chép với đáp án: đối chiếu theo từ (LCS) và chấm điểm theo ký tự (bỏ dấu câu, khoảng trắng). */
const norm = (s) => s.normalize('NFC').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);

function lcsTable(a, b) {
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
  return dp;
}

export function compare(ref, user) {
  const a = norm(ref), b = norm(user), dp = lcsTable(a, b);
  const okA = new Set(), okB = new Set();
  let i = a.length, j = b.length;
  while (i && j) {
    if (a[i - 1] === b[j - 1]) { okA.add(i - 1); okB.add(j - 1); i--; j--; }
    else if (dp[i - 1][j] >= dp[i][j - 1]) i--; else j--;
  }
  const ca = [...a.join('')], cb = [...b.join('')];
  const len = Math.max(ca.length, cb.length);
  const score = len ? Math.round((100 * lcsTable(ca, cb)[ca.length][cb.length]) / len) : 0;
  return { score, ref: a.map((w, k) => ({ w, ok: okA.has(k) })), user: b.map((w, k) => ({ w, ok: okB.has(k) })) };
}
