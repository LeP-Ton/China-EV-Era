# China-EV-Era · 项目规范

## 定位与技术栈

项目名 `China-EV-Era`，游戏名 `China EV Era`，中文名《中国新能源时代》，是一款单机企业经营模拟游戏。React + TypeScript + Vite，首版为 2026 年开始的 12 季度经营。经营模拟在浏览器内执行，不需要业务后端、真实大模型或付费 API。所有新增文档、注释和交互文案使用简体中文。

- 在线地址：<https://lep-ton.github.io/China-EV-Era/>。
- 公开仓库：<https://github.com/LeP-Ton/China-EV-Era>；npm 包名使用小写 `china-ev-era`。

## 架构与目录

- `src/engine/`：与 React 解耦的数据模型、种子随机数、市场、研发、生产质量、财务、NPC、指令与时间推进。金额统一为百万元，售价亦为百万元；界面转换为万元或亿元。
- `src/ui/`：六个业务模块及共用图表、车辆视觉等组件。状态变更一律通过引擎指令。
- `src/assets/vehicles/`：车辆产品渲染素材，通过 Vite 导入生成带版本指纹的资源路径。
- `src/persistence.ts`：版本化本地存档与输入校验。
- `scripts/balance.ts`：多种子、多策略的完整经营模拟与对比。
- `.github/workflows/pages.yml`：GitHub Pages 的测试、构建和静态发布；构建时从 Pages 元数据设置 `VITE_BASE_PATH`，本地默认根路径。
- `.agentdocs/`：需求索引与阶段记录。先读索引，再读对应需求 README，避免全量扫描历史。

## 运行与验证

- `npm install`，`npm run dev`：启动本地开发。
- `npm test`：核心计算与真实经营情景测试。
- `npm run build`：TypeScript 检查与生产构建。
- `npm run simulate`：策略平衡观测。
- `main` 的代码或配置推送自动触发 Pages 发布；仅修改 Markdown 时跳过重复发布，也可手动触发工作流。

## 长期约束

- 保持随机数入口唯一，模拟不得读取真实时间或使用 `Math.random()`。
- 相同初始状态、随机种子和指令序列必须完全可复现。财务区分利润、现金、库存、融资与资本支出。
- 质量风险关联历史批次和决策；舆论热度、证据和实际严重性分别存储，营销不得消除实际缺陷。
- MVP 只实现单车型、三条技术路线、三名核心高管。后续能力先进入 TODO。
- 修改前核实分支和现有差异，保留用户改动。实际代码变更需归入需求阶段记录；不自动提交或覆盖存档。
- 日期与需求 ID 使用 Asia/Shanghai 时区。
- 车辆主视觉使用高分辨率、真实透明通道的产品渲染；替换时检查深浅背景、整车边界以及桌面和小屏布局。

## 项目检索方法

按 `AGENTS.md` → `.agentdocs/index.md` → 当前任务相关的 workflow 文档 → 源码的顺序检索，不全量扫描历史阶段记录。实际代码变更在 `.agentdocs/workflow/` 新建带 `YYYYMMDDHHmmss` 时间前缀的 Markdown 文档，同一任务合并记录，并更新根索引；时间使用 Asia/Shanghai。
