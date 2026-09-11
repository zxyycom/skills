### Case GATE-DEFINITION-CATALOG-001: Gate 完整 Definition 声明原生选择与资源调度

Tests:
- `test:3a02dd3344b6548493b95e9cd08ddf801d580d86b7c64ab0dd8cd5fa82d38a60`
- `test:ac78e6545b501f8c286147702d2a23ffe0c03ca1015e15f3e0db2d36bece3526`
- `test:c5a44c669639a6f2b7c665b191f1559d2bad8b529dbc3906c607183ed70c4eb8`
- `test:c8ae74a0d55cbd30418647a7e3f56bb6bd8b3094665ab73c0e833d3f812f837e`
- `test:d3f9bdf3206b1880bbfb797a872f61f42df54089daa55d13b32a2d538170bc1e`

Tags:
- `repository-tooling`

Contract:
- 每次 Gate Definition 都必须包含同一完整稳定 Check ID 集合；59 个 base impact Check 与三个 release 交付 Check 以 `enabledByFlags` 声明选择和依赖传播，scheduler 使用原生 learned strategy 和四槽上限；base 使用三个外部进程容量，release 另以四个 `cpu-work` units 约束测试批次与普通工作竞争。

Proves:
- Change Plan、Decision Records、Investigation Report、Task Graph 与 Test Evidence 分别展开为 `3/5/5/8/5` 个语义 Check；75 个语义测试文件各出现一次，只有 native-store 使用 Node，多文件 Bun Check 通过单一窄 runner 顺序导入所属测试文件。
- base/release/增量 Definition Check ID 完全相同，七项 Vibe 原生 Check、26 个语义 Check 与普通 package Check 的内部 activation 条件和固定命令精确匹配独立期望；release prepare、version 和 pack 保持原 DAG，带依赖的 Check 传播传递前置，非 base ID 不能进入日常 activation。
- Definition 使用 learned custom admission 与 `maxParallel: 4`；base 声明三个外部进程和两个仓库扫描容量，release 保持这两个容量并增加四个 `cpu-work` units。Release 批次 leader 声明全部四个 CPU unit 和一个外部 unit，投影 Check 不再伪称启动进程，其他实际工作 Check 声明一个 CPU unit 并保留原资源 claim。
- 批次 catalog 精确覆盖无前置依赖的 Bun semantic Check 和已登记 Bun package test，并与 `package.json` 的显式文件参数一致；有生成前置或使用 Node runner 的 Check 保持独立执行。
