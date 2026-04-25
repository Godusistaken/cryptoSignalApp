class RiskManager {
  static calculateLevels(price, atr, direction, adx = 25, volRatio = 1) {
    if (!atr || !price || direction === 'NEUTRAL') {
      return { stopLoss: null, takeProfit1: null, takeProfit2: null, takeProfit3: null, riskRewardRatio: null };
    }
    let slMult = 1.5;
    if (adx >= 40) slMult = 1.2;
    else if (adx >= 30) slMult = 1.5;
    else if (adx >= 25) slMult = 1.8;
    else if (adx >= 20) slMult = 2.0;
    else slMult = 2.5;

    let tp1 = 1.5, tp2 = 2.5, tp3 = 4.0;
    if (volRatio >= 2) { tp1 = 2; tp2 = 3.5; tp3 = 5; }
    else if (volRatio >= 1.5) { tp1 = 1.8; tp2 = 3; tp3 = 4.5; }
    if (adx >= 40) { tp1 += 0.3; tp2 += 0.5; tp3 += 0.8; }
    else if (adx >= 30) { tp1 += 0.2; tp2 += 0.3; tp3 += 0.5; }

    let sl, t1, t2, t3;
    if (direction === 'BUY') {
      sl = price - atr * slMult; t1 = price + atr * tp1; t2 = price + atr * tp2; t3 = price + atr * tp3;
    } else {
      sl = price + atr * slMult; t1 = price - atr * tp1; t2 = price - atr * tp2; t3 = price - atr * tp3;
    }
    const risk = Math.abs(price - sl), reward = Math.abs(t1 - price);
    const r = v => Math.round(v * 1e8) / 1e8;
    return { stopLoss: r(sl), takeProfit1: r(t1), takeProfit2: r(t2), takeProfit3: r(t3), riskRewardRatio: risk ? Math.round(reward / risk * 100) / 100 : null };
  }
}
module.exports = RiskManager;
