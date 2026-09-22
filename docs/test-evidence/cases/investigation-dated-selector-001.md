### Case INVESTIGATION-DATED-SELECTOR-001: 普通 Investigation selector 先解析日期 ID 再查询名称

Tests:
- `test:3aa746ed9b9e7a36ef91ffc5b3520160a6a72c030819d6f40f6f9a810fb2df24`
- `test:4a6e9856533ef43e66521ebf37159aa5bfa8555ba77a97d45f93467e5ce1ab9e`
- `test:5f8dd8c1795294e36b1382b439da729888f388cd14e1ff5ab9cf2a98abbfe132`
- `test:80f4943358fdb5890ba19fe5fce575a664ee6942db327973485cb743af09739f`
- `test:9f7cd102c213861b58af8c36403aac95adffe8171f096fb1c0f57d475810292d`
- `test:b654920214610af84173c7f0bd29be576be9f99cc5e44188ea8c1752f7250b1a`

Tags:
- `investigation-report`

Contract:
- `show` 等普通 Investigation selector 只去除一个大小写不敏感 `.md`，随后精确识别 calendar-valid `YYMMDD-name`；仅失败时使用索引中的 exact name key。

Proves:
- 语义 name、标准 ID 和 `.md` 输入均收敛到完整 ID，且读取不依赖语义 sourcePath basename。
- 重复 name 的候选以二进制 ID 顺序返回，非法日期前缀按 name 成功解析，不存在的标准 ID 不回退。
- `stage --scope index` 在同一严格 HEAD/工作区索引事务且集合契约一致后，用两侧 state.name 并集解析 selector；它支持单侧删除和单侧新增，并在歧义或精确 ID 缺失时不写 pending。
