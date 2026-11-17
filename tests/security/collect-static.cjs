const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync, execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const output = path.resolve(process.env.SECURITY_EVIDENCE_DIR || path.join(root,'dist/security/latest'));
fs.mkdirSync(output,{recursive:true});
const gitArgs=['-c',`safe.directory=${root.replaceAll('\\','/')}`];
const git=(...args)=>execFileSync('git',[...gitArgs,...args],{cwd:root,encoding:'utf8'}).trim();
const hash=data=>crypto.createHash('sha256').update(data).digest('hex');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));
const workflow=fs.readFileSync(path.join(root,'.github/workflows/test.yml'),'utf8');
const tests=spawnSync(process.execPath,['--test','tests/content.test.cjs','tests/popup.test.cjs','tests/security/static.test.cjs'],{cwd:root,encoding:'utf8'});
fs.writeFileSync(path.join(output,'unit-security.tap'),tests.stdout+(tests.stderr||''));
const rules={
  githubToken:/\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})\b/,
  privateKey:/-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/,
  awsKey:/\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/,
  embeddedCredential:/https?:\/\/[^\s/:]+:[^\s/@]+@/
};
const commits=git('rev-list','--all').split(/\r?\n/).filter(Boolean);
const hits=[];let fileVersions=0;let binaryVersionsSkipped=0;
for(const commit of commits) for(const file of git('ls-tree','-r','--name-only',commit).split(/\r?\n/).filter(Boolean)) {
  const bytes=execFileSync('git',[...gitArgs,'show',`${commit}:${file}`],{cwd:root,maxBuffer:32*1024*1024});
  fileVersions++;
  if(bytes.includes(0)) {binaryVersionsSkipped++;continue;}
  const data=bytes.toString('utf8');
  for(const [rule,pattern] of Object.entries(rules)) if(pattern.test(data)) hits.push({commit,file,rule});
}
const actions=[...workflow.matchAll(/uses:\s*(\S+)/g)].map(match=>({reference:match[1],pinnedToCommit:/@[0-9a-f]{40}$/.test(match[1])}));
const report={
  collectedAtUtc:new Date().toISOString(),assessedCommit:git('rev-parse','HEAD'),extensionVersion:manifest.version,
  collectorSha256:hash(fs.readFileSync(__filename)),
  staticTestSha256:hash(fs.readFileSync(path.join(__dirname,'static.test.cjs'))),
  dependencyLockSha256:hash(fs.readFileSync(path.join(root,'package-lock.json'))),
  workflowSha256:hash(Buffer.from(workflow)),
  workflowInventory:fs.readdirSync(path.join(root,'.github/workflows')).filter(f=>/\.ya?ml$/.test(f)).map(file=>{
    const data=fs.readFileSync(path.join(root,'.github/workflows',file),'utf8');
    return {file,sha256:hash(Buffer.from(data)),contentsReadOnly:/permissions:\s*\n\s+contents: read/.test(data),
      actions:[...data.matchAll(/uses:\s*(\S+)/g)].map(match=>({reference:match[1],pinnedToCommit:/@[0-9a-f]{40}$/.test(match[1])}))};
  }),
  unitTests:{exitCode:tests.status,passed:Number(/# pass (\d+)/.exec(tests.stdout)?.[1]),failed:Number(/# fail (\d+)/.exec(tests.stdout)?.[1])},
  manifest,ci:{actions,contentsReadOnly:/permissions:\s*\n\s+contents: read/.test(workflow),
    persistCredentialsFalseExplicit:/persist-credentials:\s*false/.test(workflow)},
  historySecretPatternScan:{commits:commits.length,fileVersions,binaryVersionsSkipped,hits,limitation:'Text pattern matching only; skips NUL-containing binary files. Does not prove absence of secrets or inspect local browser/CLI credentials.'}
};
fs.writeFileSync(path.join(output,'static-report.json'),JSON.stringify(report,null,2)+'\n');
const files=fs.readdirSync(output).filter(f=>f!=='SHA256SUMS.json'&&fs.statSync(path.join(output,f)).isFile());
fs.writeFileSync(path.join(output,'SHA256SUMS.json'),JSON.stringify(Object.fromEntries(files.map(f=>[f,hash(fs.readFileSync(path.join(output,f)))])),null,2)+'\n');
console.log(JSON.stringify({tests:report.unitTests,history:report.historySecretPatternScan,actions:report.ci.actions},null,2));
if(tests.status!==0||hits.length) process.exitCode=1;
