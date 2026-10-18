import {createHash} from 'node:crypto';
import {lstat,readdir,readFile,readlink} from 'node:fs/promises';
import {isAbsolute,join,relative,resolve,sep} from 'node:path';

export const digest = bytes => createHash('sha256').update(bytes).digest('hex');
export async function inventory(root, dir=root) {
  const files={};
  for(const name of (await readdir(dir)).sort()) {
    const path=join(dir,name), rel=relative(root,path).split(sep).join('/');
    if(rel==='receipt.json') continue;
    const stat=await lstat(path);
    if(stat.isSymbolicLink()) {
      const target=await readlink(path), resolved=relative(root,resolve(dir,target));
      if(isAbsolute(target)||resolved==='..'||resolved.startsWith('../')) throw Error('Bundle link escapes runtime');
      files[rel]={link:target};
    } else if(stat.isDirectory()) Object.assign(files,await inventory(root,path));
    else if(stat.isFile()) files[rel]={sha256:digest(await readFile(path)),executable:!!(stat.mode&0o111)};
    else throw Error('Unsupported runtime file');
  }
  return files;
}
export async function verifyBundle(root) {
  const receipt=JSON.parse(await readFile(join(root,'receipt.json'),'utf8'));
  if(receipt.schemaVersion!==1||receipt.platform!=='darwin'||receipt.arch!=='arm64') throw Error('Unsupported runtime receipt');
  if(JSON.stringify(await inventory(root))!==JSON.stringify(receipt.files)) throw Error('Runtime file integrity mismatch');
  for(const file of ['python/bin/python3','bin/wechat-cli','bin/wxkey','lib/libWCDB.dylib','mcp/src/wechat_cli_mcp/server.py']) {
    if(!receipt.files[file]) throw Error('Incomplete runtime');
  }
  return receipt;
}
