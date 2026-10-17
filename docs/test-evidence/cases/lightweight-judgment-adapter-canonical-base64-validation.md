### Case LIGHTWEIGHT-JUDGMENT-ADAPTER-014: Base64 字母表与规范 padding

Tests:
- `test:0e1deb9d332f9d5e12983188a45ab66014ebbd36124b9b3b7921f4971271b93b`

Tags:
- `lightweight-judgment`

Contract:
- 内联图片只接受非空、标准字母表且完整 canonical padding 的 Base64；不得通过宽松解码接纳缺 padding、内部 padding 或非零填充位。

Proves:
- 三种合法尾部 padding 情况均通过；空串、额外或缺失 padding、内部等号、换行、URL-safe 字符及非零 pad bits 均返回 input/2、attempts=0，离线 fetch 替身不被调用。
