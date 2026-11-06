### Case NATIVE-RECORD-GIT-READ-001: 真实 Git 历史与选定 pending 读取

Tests:
- `test:027fd8bef94fc0895ada14464b6216b75694b73715b77ccf5a9d1097fe260b06`
- `test:2fbe89e6f5ed90b7e4ec69190bb45a419312d47de71bb5517c459f13df72c42a`
- `test:3b001110b59165420f1f39026a3fc7ee2fdce321145b6ec95406af3ae97d6379`
- `test:8a5ce4ac05f54437c0fcb2245935e6dde14026286717e4af63b5955f00432fe9`
- `test:8c14dab201ab2e7687b94baef85bb4d70543f4b71ad2c7ebeca2d3f007a66e61`
- `test:a8a01d74ccda60a4211658ba6bff6631b9f8753004bf488807e6c405fc1363c5`
- `test:b62f2170eeb9d5374ea5d18f3677032e7a429cfb44be0933d4fb109d619d8afb`
- `test:c980cb35ebfa7db4c63e4b7d0c4421a8b3388c8aa3208411e1ab185aea49171a`
- `test:cfebf68b8612b35f09b3d3f1da6cdb0c2c2c555783a05fc799e0f51d4823d732`
- `test:dcfc3ff854c499b6f7a661028d1b96a086dcaa2a0cd6e1e8074068791321dd38`
- `test:e40cb17c8aa6459de2e32a8d15e73925b481d877b9a95644f1d7cf42e3cdcf07`

Tags:
- `record-rust`

Contract:
- Git 读取须区分固定历史、工作树和 index，不能隐藏冲突或读取无关对象。

Proves:
- 私有 Git 仓库验证 HEAD、pending、路径、unmerged、缺失对象及 Git 不可用的观察。
