### Case NATIVE-RECORD-MUTATION-LIFECYCLE-001: 决策生命周期与前序约束

Tests:
- `test:02ea65ec9b7738420a56f41783bd4e88ce48ef31256709b246aefd94fc3ff2fb`
- `test:1a0d57f130f9bb25037314e40f466de53af2d996aa9cfaf79dd75f17a8d6e38b`
- `test:22fb5685f16e5d9858271c4316a8cf93e184bcad2e00b8106b0a035e0b41d56c`
- `test:72e9c778eb5248b2bf2c30f439d15f13c00bc2ea23fc890c32e1d2df3d665502`
- `test:95bf44e736844bdc0b26d309ebf10e45f124e5b41d2776e0b33a3997bbd0572d`
- `test:aa180a29c4d0b0a0d08f310b12732145147f70ad90d820ff5e23b434f6e9be54`
- `test:cc2986adc9130ac335313e8d0680d7acb3230c93e9d5ab1f3f3b9a3d5e0877e5`
- `test:efbcc27ff2b40e2778e4e54670f0304a74019d3e834f6cc19a980f1bf1f2725c`
- `test:f4640ae9b3f5765eeb73ee3eb2f4731b4cb0d1811063bc4ec5bc759a1687a349`

Tags:
- `record-rust`

Contract:
- 生命周期和演进操作须遵守状态、历史确认与选定记录范围。

Proves:
- 手写状态和私有事务验证归档、恢复、对齐、前序及 preflight/恢复事实。
