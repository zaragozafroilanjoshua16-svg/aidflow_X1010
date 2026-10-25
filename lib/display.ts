export function xlm(stroops: string) {
  const value = BigInt(stroops),
    whole = value / 10000000n,
    fraction = (value % 10000000n)
      .toString()
      .padStart(7, "0")
      .replace(/0+$/, "");
  return `${whole.toLocaleString("en-US")}${fraction ? `.${fraction}` : ""}`;
}
export function progress(raised: string, goal: string) {
  if (BigInt(goal) <= 0n) return 0;
  return (
    Number(
      (BigInt(raised) * 10000n) / BigInt(goal) > 10000n
        ? 10000n
        : (BigInt(raised) * 10000n) / BigInt(goal),
    ) / 100
  );
}
