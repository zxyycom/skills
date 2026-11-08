### Case INVESTIGATION-CLI-USAGE-001: 列表分页参数的共享边界

Tests:
- `test:374eb23f94f7ae8c430bd8dcdf9ee6859c44860d388b083d1a14d14094d997b6`
- `test:9e384b8c0a87b3e039b43a96a8b5b173bb1d056653e69f560eca9fc5aa497a96`

Tags:
- `investigation-report`

Contract:
- list 的 limit 为 1..1000、offset 非负，单值参数不可重复。

Proves:
- Decision 真实 CLI 测试拒绝 limit=0、limit=1001、负 offset 和重复 limit；IR 真实 CLI 独立验证 list 接线。
- 两域源码在 list 构造前共用同一 number 与单值验证；本组合不声称实际执行了 IR 的每个边界参数。
