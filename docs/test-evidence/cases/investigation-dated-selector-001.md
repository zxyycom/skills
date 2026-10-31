### Case INVESTIGATION-DATED-SELECTOR-001: 普通 Investigation selector 先解析日期 ID 再查询名称

Tests:
- `test:11420a0ddba3c451d083ae7940e8862e6154dca316c3ec2faefe37d60f47c6f4`
- `test:4fb6fca59e03fcef103dba631f03dd41dd1314bdae2b3afa1b53aef5ff6eb434`
- `test:7790448290703dd61a37ebed46687a82236e12c14ca9d567573c87c05a28bed9`
- `test:c684bbf9574dfc6f0b7d1c0ca27f030fbb4eafe1878ae38b056e6e92caec0a6b`
- `test:fa7228aea0cd214547a3d8e724f2b735ae4ba383c8a462bc1984c5bc46728283`

Tags:
- `investigation-report`

Contract:
- `show` 等普通 Investigation selector 只去除一个大小写不敏感 `.md`，随后精确识别 calendar-valid `YYMMDD-name`；仅失败时使用索引中的 exact name key。

Proves:
- 语义 name、标准 ID 和 `.md` 输入均收敛到完整 ID，且读取不依赖语义 sourcePath basename。
- 重复 name 的候选以二进制 ID 顺序返回，非法日期前缀按 name 成功解析，不存在的标准 ID 不回退。
- stage 的纯准备与 resolver 组合将一个 Markdown 后缀及唯一 name 解析为标准 ID，歧义时给出排序后的完整候选，精确 ID 缺失返回 selected-id-missing 诊断。
- workspace-only name 的纯 resolver 与生产索引投影接纳新增 entry；真实 Git 集成承接 baseline-only name 删除。
