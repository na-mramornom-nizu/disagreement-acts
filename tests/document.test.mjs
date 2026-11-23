import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {PDFDocument} from 'pdf-lib';
import {INSURERS,initialData,parseMoney,money,values,validate,calculateAmounts,filename,today,validDate} from '../src/model.mjs';
import {createEngine} from '../src/document.mjs';
const engine=await createEngine({regular:await fs.readFile('assets/regular.ttf'),bold:await fs.readFile('assets/bold.ttf'),layouts:JSON.parse(await fs.readFile('assets/layouts.json','utf8')),alfaPdf:await fs.readFile('assets/alfa-template.pdf'),alfaPreview:'data:image/png;base64,'+(await fs.readFile('assets/alfa-preview.png')).toString('base64')});
const sample=id=>({...initialData(id),date:'2026-11-23',claim:'ТЕСТ-001/26',insured:'Тестовый страхователь',vehicle:'Volkswagen Tiguan',vin:'WVWZZZ1KZ6W000001',registration:'А000АА000',calculation:'КС-2026-001',invoice:'120000,00',total:'120000,00',deduction:'12345,67',payable:'107654,33'});
test('День по местному времени, корректность даты и високосного года',()=>{assert.equal(today(new Date(2026,10,23,0,5)),'2026-11-23');assert.equal(validDate('2024-02-29'),true);assert.equal(validDate('2026-02-29'),false);assert.equal(validDate('2026-13-01'),false);});
test('Деньги: точные копейки, пробелы, запятая, точка, пустота и ноль',()=>{for(const [s,n]of [['1 234,56',123456],['1\u202f234.56',123456],['0',0],['',null],['000.01',1],['999999999,99',99999999999]])assert.equal(parseMoney(s),n);assert.equal(money(null),'');assert.equal(money(0),'0,00');});
test('Некорректные суммы не превращаются в ноль',()=>{for(const s of ['-5','1e6','NaN','1,234','2.3.4','₽12','1000000000','abc'])assert.throws(()=>parseMoney(s));});
test('РЕСО: вычитание и нулевой результат без ошибок округления',()=>{assert.equal(values({...sample('reso'),total:'0,30',deduction:'0,10'}).payable,'0,20');assert.equal(values({...sample('reso'),total:'10',deduction:'10'}).payable,'0,00');});
test('Альфа: одна сумма счёта и ремонта, выплата рассчитывается',()=>{const v=values({...sample('alfa'),invoice:'999',total:'100',deduction:'12,34'});assert.equal(v.invoice,'100,00');assert.equal(v.payable,'87,66');});
test('Отсутствующие суммы оставляют расчёт пустым',()=>{assert.equal(values({...sample('reso'),deduction:''}).payable,'');assert.equal(values({...sample('alfa'),total:''}).payable,'');});
test('Вычет больше стоимости не допускается',()=>{assert.ok(validate({...sample('reso'),total:'1',deduction:'2'}).deduction);assert.ok(validate({...sample('alfa'),total:'1',deduction:'2'}).deduction);});
for(const id of Object.keys(INSURERS))for(const calculated of ['payable','deduction','total'])test(`${id}: любые две суммы, расчёт ${calculated}`,()=>{const d={...sample(id),calculated};d[calculated]='не использовать старое значение';const out=calculateAmounts(d);assert.equal(out.total,12000000);assert.equal(out.deduction,1234567);assert.equal(out.payable,10765433);assert.deepEqual(validate(d),{});});
test('Нельзя получить отрицательный вычет или слишком большой итог',()=>{assert.throws(()=>calculateAmounts({...sample('alfa'),calculated:'deduction',total:'10',payable:'11'}));assert.throws(()=>calculateAmounts({...sample('reso'),calculated:'total',payable:'999999999',deduction:'999999999'}));});
test('Имена файлов безопасны, номер не теряет ведущие нули',()=>{const d={...sample('alfa'),claim:'0001/02:03?'};assert.match(filename(d),/0001-02-03-/);assert.equal(values(d).claim,'0001/02:03?');});
test('VIN не проверяется по формату',()=>{assert.equal(validate({...sample('ingos'),vin:'VIN НЕ УКАЗАН'}).vin,undefined);});
test('В SVG не исполняются HTML-теги',()=>{const svg=engine.svg({...sample('alfa'),insured:'<script>x</script>'});assert.ok(!svg.includes('<script>'));assert.ok(svg.includes('&lt;script&gt;'));});
test('Слишком длинный текст не обрезается молча',()=>{assert.throws(()=>engine.compose({...sample('ingos'),vin:'Длинныйтекст'.repeat(12)}));});
test('Неподдерживаемые символы требуют исправления, а не исчезают',()=>{assert.throws(()=>engine.compose({...sample('alfa'),insured:'Тест 😀'}),/символы/);});
await fs.mkdir('output/test-pdf',{recursive:true});
for(const id of Object.keys(INSURERS)){
  test(`${id}: пустой бланк и заполненный PDF, одна страница`,async()=>{for(const mode of ['blank','filled']){const d=mode==='blank'?initialData(id):sample(id);const bytes=await engine.pdf(d);const p=await PDFDocument.load(bytes);assert.equal(p.getPageCount(),1);assert.ok(bytes.length>1000);await fs.writeFile(`output/test-pdf/${id}-${mode}.pdf`,bytes);await fs.writeFile(`output/test-pdf/${id}-${mode}.svg`,engine.svg(d));}});
}
test('Альфа: вычет повторяется ровно дважды среди новых полей',()=>{const doc=engine.compose(sample('alfa'));assert.equal(doc.commands.filter(c=>c.key==='deduction').length,2);assert.equal(doc.commands.filter(c=>c.key==='date').length,2);});
test('РЕСО: сумма к оплате в нижнем поле и очищенные таблицы',()=>{const doc=engine.compose(sample('reso'));assert.equal(doc.commands.filter(c=>c.key==='payable')[0].text,money(10765433));assert.ok(!JSON.stringify(doc).includes('Решетка бамп'));});

