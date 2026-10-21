### Case INVESTIGATION-DATED-SELECTOR-001: 普通 Investigation selector 先解析日期 ID 再查询名称

Tests:
- `test:1a2917df30caf1808b4e0a6e6c59a31b64d3279484f7172ed9fd9d97596d6765`
- `test:3aa746ed9b9e7a36ef91ffc5b3520160a6a72c030819d6f40f6f9a810fb2df24`
- `test:4a6e9856533ef43e66521ebf37159aa5bfa8555ba77a97d45f93467e5ce1ab9e`
- `test:5f8dd8c1795294e36b1382b439da729888f388cd14e1ff5ab9cf2a98abbfe132`
- `test:80f4943358fdb5890ba19fe5fce575a664ee6942db327973485cb743af09739f`
- `test:9f7cd102c213861b58af8c36403aac95adffe8171f096fb1c0f57d475810292d`

Tags:
- `investigation-report`

Contract:
- `show` 等普通 Investigation selector 只去除一个大小写不敏感 `.md`，随后精确识别 calendar-valid `YYMMDD-name`；仅失败时使用索引中的 exact name key。

Proves:
- 语义 name、标准 ID 和 `.md` 输入均收敛到完整 ID，且读取不依赖语义 sourcePath basename。
- 重复 name 的候选以二进制 ID 顺序返回，非法日期前缀按 name 成功解析，不存在的标准 ID 不回退。
- stage 的纯准备与 resolver 组合将一个 Markdown 后缀及唯一 name 解析为标准 ID，歧义时给出排序后的完整候选，精确 ID 缺失返回 selected-id-missing 诊断。
- workspace-only name 的纯 resolver 与生产索引投影接纳新增 entry；真实 Git 集成承接 baseline-only name 删除。
