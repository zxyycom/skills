### Case LIGHTWEIGHT-JUDGMENT-ADAPTER-011: 独立 Node 原生协议传输

Tests:
- `test:08b45cc5e0ed339411e2db3ab0d6761a57cc82fef4c6bc4508213c679c3d170f`

Tags:
- `lightweight-judgment`

Contract:
- 分发 TS 在已有兼容依赖的独立 Node 进程中执行一次 native Decisions HTTP，保留 raw 与 normalized 双结果。

Proves:
- 临时复制完整 TS 闭包、私有配置和有效合成 PNG 请求通过真实回环 HTTP 服务；接收端核对 Bearer、无 TypeSafe 头、有序 predicate 与图文 wire，子进程退出 0 且只发送一次；不证明远端服务可用。
