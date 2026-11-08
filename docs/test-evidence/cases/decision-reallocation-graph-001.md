### Case DECISION-REALLOCATION-GRAPH-001: 稀疏重划分量与角色

Tests:
- `test:025374744dd94acec46a154e4f4e555d828f0be04637abab0c1e17172d65924b`
- `test:f0cf375cd2958a20e91d5962ba51cb0ac8a945a0890248239213e105381bdefb`

Tags:
- `decision-records`

Contract:
- 稀疏重划按前序和后继角色确定事件；历史事件可共享记录但不得因角色跨代而混为同一事件。

Proves:
- 稀疏事件的预算阻断返回完整成员，后继与前序按直接边区分 trace/context；另一个索引图测试接受先后两个完整重划事件并检查中间节点的前后代边。第二节点未直接断言 trace 事件投影。
