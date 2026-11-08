### Case INVESTIGATION-DEEP-RELATION-CHAIN-001: 调查图合法深链与晚期环

Tests:
- `test:c9d3f93b4ce3bcbcb8913e64fff0f63f8feb61c2d5159de6c567237f143ef1a2`

Tags:
- `investigation-report`

Contract:
- 关系图共享构建器应能处理长链，并拒绝结构循环。

Proves:
- 共享图构建器直接处理 12000 节点链；末端形成循环时拒绝并产生有界残余节点诊断。调查领域图调用此构建器；该节点不单独执行调查 CLI 或证明完整环成员。
