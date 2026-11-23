import fs from 'node:fs/promises';
import {build} from 'esbuild';
const b64=async path=>(await fs.readFile(path)).toString('base64');
const assets={regular:await b64('assets/regular.ttf'),bold:await b64('assets/bold.ttf'),layouts:JSON.parse(await fs.readFile('assets/layouts.json','utf8')),alfaPdf:await b64('assets/alfa-template.pdf'),alfaPreview:await b64('assets/alfa-preview.png')};
const result=await build({entryPoints:['src/app.mjs'],bundle:true,write:false,minify:true,format:'iife',target:['chrome110','edge110','firefox115','safari16'],define:{__ASSETS__:JSON.stringify(assets)},legalComments:'none'});
let css=await fs.readFile('src/style.css','utf8');css+=`\n@font-face{font-family:DocumentFont;src:url(data:font/ttf;base64,${assets.regular}) format('truetype');font-weight:400}@font-face{font-family:DocumentFont;src:url(data:font/ttf;base64,${assets.bold}) format('truetype');font-weight:700}.print-note{background:#edf4ff;color:#34557f;font-size:13px}`;
const notices=await fs.readFile('THIRD_PARTY_NOTICES.txt','utf8');
const html='<!-- Third-party notices\n'+notices.replaceAll('--','—')+'\n-->\n'+(await fs.readFile('src/index.html','utf8')).replace('/* STYLES */',css).replace('/* APP */',()=>result.outputFiles[0].text.replace(/<\/script/gi,'<\\/script'));
await fs.mkdir('dist',{recursive:true});await fs.writeFile('dist/index.html',html);console.log(`Built dist/index.html (${Buffer.byteLength(html)} bytes)`);
