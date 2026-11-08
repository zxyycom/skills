### Case INVESTIGATION-LAZY-TRACE-001: 追溯排序责任与预算边界

Tests:
- `test:19e6feaeb3a2bbd0b45dfe37e7a215dda6e42fc624fae2ca41f36b0a7fed63d0`
- `test:8ad09f135902ceb10e7afd2f94bbfbd10c422906f74101b2e94a7e79c44bd1b0`

Tags:
- `investigation-report`

Contract:
- 调查 trace 在事件与 frontier 排序中使用与 UTF-16 兼容的文本顺序，并保留预算边界。

Proves:
- 共用 comparator 单元测试区分非 BMP 与 BMP 私用区的 UTF-16 顺序；调查 trace 投影节点返回确定的拆分 blockedEvent 与 frontier。
- IR 投影按源码使用共用 trace selector 与 comparator；本组合不声称对原有全部方向、深度和预算排列做了等价枚举。
