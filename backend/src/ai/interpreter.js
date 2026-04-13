class AIInterpreter {
  async interpretSignal(s) {
    const signal = s.signal_type || s.signalType;
    const rsi = s.rsi;
    const macdCross = s.macd_crossover || s.macdCrossover;
    const adx = s.adx;
    const volRatio = s.volume_ratio || s.volumeRatio;
    const trend1h = s.trend_1h || s.trend1h;
    const trend4h = s.trend_4h || s.trend4h;
    const confidence = s.confidence;
    const sym = s.symbol;

    const lines = [`Sinyal: ${signal} | Guven: %${confidence}\n`];

    if (rsi <= 30) lines.push(`RSI ${rsi} - Asiri satim, toparlanma potansiyeli`);
    else if (rsi >= 70) lines.push(`RSI ${rsi} - Asiri alim, duzeltme riski`);
    else lines.push(`RSI ${rsi} - Notr bolge`);

    if (macdCross === 'BULLISH') lines.push(`MACD yukari kesisim - momentum yukari`);
    else if (macdCross === 'BEARISH') lines.push(`MACD asagi kesisim - momentum asagi`);

    if (adx >= 25) lines.push(`ADX ${adx} - Guclu trend`);
    else lines.push(`ADX ${adx} - Zayif trend`);

    if (volRatio >= 1.5) lines.push(`Hacim ${volRatio}x ortalama ustu`);

    lines.push(`1H Trend: ${trend1h} | 4H Trend: ${trend4h}`);
    lines.push(`\nHer zaman stop loss kullan!`);

    return lines.join('\n');
  }
}

module.exports = new AIInterpreter();