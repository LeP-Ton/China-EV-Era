import { mkdirSync, writeFileSync } from 'node:fs';
import { advanceWeeks, createGame, STRATEGIES, type Strategy } from '../src/engine/index';

const rows = (Object.keys(STRATEGIES) as Strategy[]).map((strategy) => {
  const runs = Array.from({ length: 10 }, (_, i) =>
    advanceWeeks(
      createGame({
        name: '策略观测企业',
        brand: '观测',
        model: 'ONE',
        strategy,
        seed: `BALANCE-${i + 1}`,
      }),
      156,
      { stopOnEvent: false },
    ),
  );
  const avg = (fn: (s: (typeof runs)[number]) => number) =>
    Number((runs.reduce((sum, s) => sum + fn(s), 0) / runs.length).toFixed(2));
  return {
    战略: STRATEGIES[strategy].name,
    样本: runs.length,
    完成局数: runs.filter((s) => s.status === 'completed').length,
    平均利润_亿元: avg((s) => s.company.totalProfit / 100),
    平均交付_辆: avg((s) => s.product.totalDelivered),
    平均声誉: avg((s) => s.company.reputation),
    平均技术等级: avg((s) => Object.values(s.tech).reduce((sum, t) => sum + t.level, 0)),
    平均质量事件: avg((s) => s.cases.length),
    平均最高估值_亿元: avg((s) => s.company.peakValuation / 100),
  };
});
console.table(rows);
mkdirSync('.local/qa', { recursive: true });
writeFileSync(
  '.local/qa/balance.json',
  JSON.stringify(
    {
      seeds: 'BALANCE-1 … BALANCE-10',
      method:
        '各战略使用默认预算、无 CEO 干预，运行 156 周；用于发现明显失衡，不证明不存在最优策略。',
      rows,
    },
    null,
    2,
  ),
);
