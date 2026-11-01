import {execFileSync} from 'node:child_process';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),out=path.join(root,'qa/baseline-v0127'),revision='04a493e';
const git=args=>execFileSync('git',['-c',`safe.directory=${root.replaceAll('\\','/')}`,...args],{cwd:root});
const files=git(['ls-tree','-r','--name-only',revision,'src']).toString().trim().split(/\r?\n/);
for(const file of files){const target=path.join(out,file);await mkdir(path.dirname(target),{recursive:true});await writeFile(target,git(['show',`${revision}:${file}`]));}
const config=JSON.parse(git(['show',`${revision}:tsconfig.test.json`]));config.extends='../../tsconfig.json';config.compilerOptions.outDir='build';
await writeFile(path.join(out,'tsconfig.json'),JSON.stringify(config,null,2));
execFileSync(process.execPath,[path.join(root,'node_modules/typescript/bin/tsc'),'-p',path.join(out,'tsconfig.json')],{cwd:root,stdio:'inherit'});
console.log('Prepared immutable comparison baseline',revision);
