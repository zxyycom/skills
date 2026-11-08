### Case NATIVE-CI-SOURCE-CONSISTENCY-001: 双平台冻结来源一致

Tests:
- `test:77e434ab72865c9552ad88a526d5226fe884fa5a2ee8c1746f20b9631164862a`

Tags:
- `repository-tooling`

Contract:
- 不同平台必须分别证明同一 revision 的每个私有候选版本具有一致的源码摘要与文件清单。

Proves:
- revision、对应版本摘要或文件清单不匹配及无效格式均被拒绝；两个候选版本允许不同源码摘要。
