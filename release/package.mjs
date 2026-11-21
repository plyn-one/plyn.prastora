#!/usr/bin/env node
import {existsSync,mkdirSync,copyFileSync,cpSync,rmSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {createHash} from 'node:crypto';
// CI candidate only. No tag or release is created.
const root='prastora-release-v0.2.0-rc1';
const core=['core.css','core.min.css','core-cobalt.min.css','core-crimson.min.css','core-crimson-deep.min.css','core-paper.min.css','MANIFEST.md','LICENSE','check.mjs','theme.js'];
const modules=['header.css','header.js','forms.css','news.css','languages.css','languages.js','video.css','video.js','map.css','map.js','map-style.json','map-preview.svg','video-poster.svg','news-illustration.svg','README.md','video.md','map.md'];
if(!readFileSync('check.mjs','utf8').includes('site-seo')||!existsSync('modules/modules.test.mjs'))throw Error('site checker or module tests absent');
for(const f of [...core,...modules.map(x=>'modules/'+x)])if(!existsSync(f))throw Error('missing asset '+f);
rmSync(root,{recursive:true,force:true});
for(const f of core){mkdirSync(dirname(join(root,f)),{recursive:true});copyFileSync(f,join(root,f));}
for(const f of modules){mkdirSync(join(root,'modules'),{recursive:true});copyFileSync('modules/'+f,join(root,'modules',f));}
cpSync('manifest',join(root,'manifest'),{recursive:true});
const sha=process.env.GITHUB_SHA||'unverified-local';
writeFileSync(join(root,'RELEASE-CANDIDATE.md'),['# Prastora v0.2.0-rc1','','CI candidate only, NOT a released/tagged version.','Source commit: '+sha,'Pin exact commit until the release tag is verified.','Link one core stylesheet, selected module CSS and optional JS, then site CSS.','No third-party MapLibre runtime or production tile provider is bundled.','Site owns SEO, backend forms, content and translations.','Deployed site browser acceptance is owned by its frame.',''].join('\n'));
function walk(d,p=''){return readdirSync(d,{withFileTypes:true}).flatMap(e=>{const f=p?p+'/'+e.name:e.name;return e.isDirectory()?walk(join(d,e.name),f):[f];}).sort();}
const lines=walk(root).filter(x=>x!=='SHA256SUMS').map(f=>createHash('sha256').update(readFileSync(join(root,f))).digest('hex')+'  '+f);
writeFileSync(join(root,'SHA256SUMS'),lines.join('\n')+'\n');console.log(root+': '+lines.length+' files, '+sha);
