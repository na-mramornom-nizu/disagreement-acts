import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {PDFDocument} from 'pdf-lib';
import {createEngine} from '../src/document.mjs';
import {initialData,values,calculateAmounts} from '../src/model.mjs';
const engine=await createEngine({regular:await fs.readFile('assets/regular.ttf'),bold:await fs.readFile('assets/bold.ttf'),layouts:JSON.parse(await fs.readFile('assets/layouts.json','utf8')),alfaPdf:await fs.readFile('assets/alfa-template.pdf'),alfaPreview:''});
await fs.mkdir('output/print-matrix',{recursive:true});
const cases=[['blank',{}],['zero',{total:'0',deduction:'0'}],['kopecks',{total:'0.30',deduction:'0,10'}],['normal',{total:'174206,66',deduction:'54578,66'}],['large',{total:'999999999,99',deduction:'123456789,12'}],['full-deduction',{total:'100000',deduction:'100000'}],['calc-deduction',{calculated:'deduction',total:'174206,66',payable:'119628'}],['calc-total',{calculated:'total',payable:'119628',deduction:'54578,66'}],['long',{insured:'Тестовая организация по техническому обслуживанию автомобилей',vehicle:'Mercedes-Benz GLC 300 4MATIC',claim:'000000-000-123456789/2026-001',calculation:'0000123456789/2026',total:'1234567.89',deduction:'4567.89'}],['leap-date',{date:'2024-02-29',total:'100',deduction:'0.01'}]];
const results=[];
for(const insurer of ['ingos','alfa','reso'])for(const [name,input]of cases){
 const data={...initialData(insurer),date:'2026-11-23',...(name==='blank'?{}:{claim:'ТЕСТ-002/26',insured:'Тестовый страхователь',vehicle:'Volkswagen Tiguan',vin:'WVWZZZ1KZ6W000001',registration:'А000АА000',calculation:'КС-001'}),...input};
 try{const commands=engine.compose(data).commands;const bytes=await engine.pdf(data);const pdf=await PDFDocument.load(bytes);assert.equal(pdf.getPageCount(),1);const output=values(data);const fields=Object.fromEntries(Object.keys(output).map(k=>[k,commands.filter(c=>c.key===k).map(c=>c.text).join(' ')]));await fs.writeFile(`output/print-matrix/${insurer}-${name}.pdf`,bytes);results.push({insurer,name,status:'passed',amounts:calculateAmounts(data),fields,expected:output,bytes:bytes.length});}catch(e){results.push({insurer,name,status:'failed',error:e.message});}
}
await fs.writeFile('output/print-matrix/results.json',JSON.stringify(results,null,2));console.log(JSON.stringify({passed:results.filter(r=>r.status==='passed').length,failed:results.filter(r=>r.status==='failed')},null,2));if(results.some(r=>r.status==='failed'))process.exitCode=1;
