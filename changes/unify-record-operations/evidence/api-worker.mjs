// 一个新进程只运行一个公开调用；计时在 import 后开始，输出序列化在计时外。
import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const [source, domain, root, scenario, commandJson, metricsPath] = process.argv.slice(2);
const counts = {};
let currentPhase = 'entry';
const phased = process.env.RECORD_PERF_COUNTS === '1' && process.env.RECORD_PERF_PHASES === '1';
if (phased) {
  globalThis.__recordPerfStage = (name) => { currentPhase = name; };
  globalThis.__recordPerfPhase = () => currentPhase;
}
globalThis.__recordPerfCount = (key) => {
  counts[key] = (counts[key] ?? 0) + 1;
  if (phased) {
    const scoped = `stage:${currentPhase}:${key}`;
    counts[scoped] = (counts[scoped] ?? 0) + 1;
  }
};
// 插桩单独采样：readFile/open 分别计边界调用，不声称等于磁盘 I/O。
if (process.env.RECORD_PERF_COUNTS === '1') {
  for (const method of ['readFile', 'open', 'realpath', 'lstat', 'stat', 'readdir']) {
    const original = fs[method];
    fs[method] = async (...args) => {
      globalThis.__recordPerfCount(`fs.${method}`);
      // 只识别本1W fixture固定来源命名；区分正式/候选读取，不保存路径或声称物理I/O。
      const namedPath = String(args[0]);
      const scope = /(?:^|\/)261001-record-\d{5}\.md$/.test(namedPath) ? 'formalSource'
        : /(?:^|\/)(?:_candidate\.)?261001-candidate-[12](?:\.md)?$/.test(namedPath) ? 'candidateSource' : null;
      if (scope !== null && method === 'readFile') globalThis.__recordPerfCount(`fs.readFile.${scope}`);
      if (method === 'open') {
        const flags = args[1];
        const kind = typeof flags === 'string' ? (flags.startsWith('r') ? (flags.includes('+') ? 'read-write' : 'read') : 'write') : ((flags & 3) === 2 ? 'read-write' : (flags & 3) === 0 ? 'read' : 'write');
        globalThis.__recordPerfCount(`fs.open.${kind}`);
        if (scope !== null && kind === 'read') globalThis.__recordPerfCount(`fs.open.read.${scope}`);
      }
      const result = await original(...args);
      if (method === 'open') {
        const handleStat = result.stat.bind(result);
        result.stat = (...statArgs) => { globalThis.__recordPerfCount('handle.stat'); return handleStat(...statArgs); };
        const read = result.readFile.bind(result);
        result.readFile = (...readArgs) => { globalThis.__recordPerfCount('handle.readFile'); return read(...readArgs); };
      }
      return result;
    };
  }
}
const entry = domain === 'dr' ? 'skills/decision-records/scripts/decision-records.ts' : 'skills/investigation-report/scripts/check-investigations.ts';
const api = await import(pathToFileURL(`${source}/${entry}`).href);
const command = JSON.parse(commandJson);
const common = { workspaceRoot: root };
const id = '261001-record-10000';
for (const key of Object.keys(counts)) delete counts[key];
currentPhase = 'entry';
const cpu = process.cpuUsage();
const start = performance.now();
let code = 0;
let output = '';
let stderr = '';
let result;
if (domain === 'dr') {
  // 该域未公开 query/sync/publish SDK；只使用真实导出的 dispatcher，不调用内部 API。
  code = await api.runDecisionRecordsCli([...command, '--root', root], {
    cwd: root, io: { stdout: (s) => { output += s; }, stderr: (s) => { stderr += s; } }
  });
} else {
  switch (scenario) {
    case 'sync-full': result = await api.synchronizeInvestigationIndex(common); break;
    case 'sync-selected': result = await api.synchronizeInvestigationIndex({ ...common, selectors: [id] }); break;
    case 'list': result = await api.queryInvestigationIndex({ ...common, limit: 5, offset: 5 }); break;
    case 'metadata': result = await api.searchInvestigationReports({ ...common, query: 'benchmark', in: 'metadata', limit: 5 }); break;
    case 'relations': result = await api.queryInvestigationIndex({ ...common, relatedTo: '261001-record-09000', direction: 'successors', limit: 5 }); break;
    case 'content': result = await api.searchInvestigationReports({ ...common, query: 'needle-perf-unique', in: 'content', tags: ['content-scope'], limit: 5 }); break;
    case 'show': result = await api.showInvestigationReport({ ...common, id }); break;
    case 'new': result = await api.createInvestigationCandidate({ ...common, id: '261001-new-candidate', title: 'benchmark candidate', formedAt: '2026-10-01T00:00:00Z', question: '固定问题', tags: ['benchmark'], relations: [] }); break;
    case 'readiness': result = await api.showInvestigationCandidate({ ...common, id: '261001-candidate-1' }); break;
    case 'publish': result = await api.publishInvestigationCandidates({ ...common, ids: ['261001-candidate-1'] }); break;
    case 'publish-batch': result = await api.publishInvestigationCandidates({ ...common, ids: ['261001-candidate-1', '261001-candidate-2'] }); break;
    case 'set-relations': result = await api.setInvestigationRelations({ ...common, replacements: [{ source: id, relations: [{ type: '补充', target: '261001-record-08999' }] }] }); break;
    case 'rename': result = await api.renameInvestigationRecord({ ...common, source: id, target: '261001-renamed-record', renameRecordedReport: true }); break;
    case 'discard': result = await api.discardInvestigationRecord({ ...common, id, deleteRecorded: true }); break;
    case 'check': result = await api.validateInvestigationReports(common); break;
    default: throw new Error(`Unknown scenario ${scenario}`);
  }
  if (result.errors?.length || result.status === 'error' || result.status === 'invalid-options') code = 1;
}
const wallMs = performance.now() - start;
const used = process.cpuUsage(cpu);
const maxRssKiB = process.resourceUsage().maxRSS;
if (result !== undefined) output = JSON.stringify(result);
await fs.writeFile(metricsPath, JSON.stringify({ wallMs, userMs: used.user / 1000, systemMs: used.system / 1000, maxRssKiB, counts }));
process.stdout.write(output);
process.stderr.write(stderr);
process.exitCode = code;
