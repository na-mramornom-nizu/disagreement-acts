import http from 'node:http';
import fs from 'node:fs';
http.createServer((req,res)=>{if(['/','/disagreement-acts/','/disagreement-acts/index.html'].includes(req.url?.split('?')[0])){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(fs.readFileSync('dist/index.html'));}else{res.writeHead(404);res.end('Not found');}}).listen(4194,'127.0.0.1',()=>console.log('http://127.0.0.1:4194/disagreement-acts/'));
