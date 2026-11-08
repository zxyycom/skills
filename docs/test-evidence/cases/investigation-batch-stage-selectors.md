### Case INVESTIGATION-BATCH-STAGE-SELECTORS-001: 整批暂存选择保留身份解析义务

Tests:
- `test:31264316906f2dd22939b5f1f81b75fb4ad55c79f7ef3fe06d41dfcb134f5fbb`
- `test:cd7ba3529a572030fbc9d4e6d7208bd3106a82bca48ef30b916a1b7272d92686`

Tags:
- `investigation-report`

Contract:
- 调查暂存可按名称定位 pending-only 日期身份；日期 ID 与名称歧义遵循共享 selector 规则。

Proves:
- 真实 Git 的 all scope 以名称选择并撤销 pending-only canonical 报告，结果返回其日期 ID。
- 共享 resolver 的纯测试验证日期 ID 的大小写不敏感 .md 后缀、同名歧义和缺失日期 ID；stage index 的索引匹配使用该 resolver。本组合不声称真实 Git 覆盖全部 selector 变体。
