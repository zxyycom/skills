### Case DECISION-BATCH-NAMES-001: 选择性同步拒绝重复输入，Stage 支持带后缀 name

Tests:
- `test:5e1ac9d0e819b43f19f0357bee8d09f38b09f59988180e4f2e8f8dc22ef9d4fd`
- `test:d72eaec4ac757fd360c0ade4dfcb5083f1e22858afb914bbaecc4380c1b029f7`

Tags:
- `selector`

Contract:
- stage 可按唯一 name 和 Markdown 后缀选择；selected sync 拒绝重复与非法选择输入。

Proves:
- 真实 Git 中 stage 接受 record.MD 并分 scope 暂存；selected sync 选择输入检查同时报告非法与重复项。
