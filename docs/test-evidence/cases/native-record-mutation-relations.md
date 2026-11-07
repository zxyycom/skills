### Case NATIVE-RECORD-MUTATION-RELATIONS-001: 两域关系替换与校验

Tests:
- `test:0eb416053745392aa788afdaf7afae9ca3f98c37557502cfd1b5e4cf62c6e2e3`
- `test:1aea3633b419ada40c82157c5b1d44c848a2f71d8f28f23850b4a273502ea581`
- `test:21d1f64cb6816931b2e974d1f3ed6444e046debaf0e820f9790141bddc78cfd6`
- `test:5ac44eb2743574d01a69da791f47b948d5f2a4bbfe3a66ae70894f888b571f88`
- `test:613021a8a7a61804b915021fdd2031f9810aeb11ec799b0c99449c15cb65c631`
- `test:a6a718cc4bb91121cee4c2b9e4ef4d22fa90bd0921650ea6ce9299c9581723f0`
- `test:b2ebc9fc2ef4fa777f53ae6d7308f93a2b09f1ebfc082ed42d7f3b06374c9ecb`
- `test:bbbef6bec221c129065217e6601a26d96036fadc60e22c685e8ae6c4796d4e9f`
- `test:bfeb56dfc2efab1323f5d832e4d5c213155437c4bdfd7b2334f716c55a48e279`
- `test:e0132c48a7193772184f4813640e1d7be9d9d8c64434a938713d858eadb0f79e`
- `test:f8264139cd816e115baaf81969b5f1e6098c8a23af887c6c0057554b428f4799`
- `test:f92111b2396839c984f7972b88beab3d7386960a8292ca418ba33c2e7f31403f`

Tags:
- `record-rust`

Contract:
- 关系替换须区分保留、清空与完整替换，并校验领域图。

Proves:
- 独立关系输入验证重复、未知项、摘要、图校验和未选范围不变。
- 调查关系准备核对 selector 先于图校验失败，以及摘要的 JS 空白、原始换行与长度边界。
