### Case INVESTIGATION-DATED-SELECTOR-001: 普通 Investigation selector 先解析日期 ID 再查询名称

Tests:
- `test:1ad25085fe757dfbe53d468cabd096a6ad8183d6745fb280d2c71f3e6a4a328f`
- `test:248d4cb117d4b798fb3b6f7bf943db121475ff72bbd88aa5aa772dbebd41f396`
- `test:25eac528d496adc307d3ebecaa532c501a4ab4c85e910d488749aa843f10bec3`
- `test:4a6e9856533ef43e66521ebf37159aa5bfa8555ba77a97d45f93467e5ce1ab9e`
- `test:722d9e892b735056fbab75c9fb157fce14f4a236a9f07af178d0493db5e06ebd`
- `test:9797d019cf792c6caebfd0d903de3e62843c40ac00a93d3314616629e09a5e00`

Tags:
- `investigation-report`

Contract:
- `show` 等普通 Investigation selector 只去除一个大小写不敏感 `.md`，随后精确识别 calendar-valid `YYMMDD-name`；仅失败时使用索引中的 exact name key。

Proves:
- 语义 name、标准 ID 和 `.md` 输入均收敛到完整 ID，且读取不依赖语义 sourcePath basename。
- 重复 name 的候选以二进制 ID 顺序返回，非法日期前缀按 name 成功解析，不存在的标准 ID 不回退。
- `stage-index` 在同一严格 HEAD/工作区索引事务且集合契约一致后，用两侧 state.name 并集解析 selector；它支持单侧删除和单侧新增，并在歧义或精确 ID 缺失时不写 pending。
