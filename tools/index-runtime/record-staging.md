# 记录领域的内部暂存协调

`src/staging/record-staging.ts` 是 Index Runtime 内部协调器，不从公共 `src/index.ts` 导出。其当前实现与隔离测试保留在本工具内，不再作为 Decision Records 或 Investigation Report 的运行时接点；两域正式行为和顺序本地事务边界由[原生记录协议](../record-cli/protocol.md#文件与事务边界)定义。

通用按 ID staging、固定 revision 和实际消费者适用的契约见 [Index Runtime](README.md#按-id-staging-到-pending)。不要将此 TypeScript 协调器的阶段、CAS 或复用保证推断为原生 CLI 的保证。
