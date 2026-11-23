export const INSURERS = {
  ingos:{name:'Ингосстрах',legal:'СПАО «Ингосстрах»',tone:'blue',caption:'Акт по поступившим счетам',orientation:'А4 · альбомный',fields:['claim','insured','vehicle','vin','registration','calculation','total','payable','deduction']},
  alfa:{name:'АльфаСтрахование',legal:'АО «АльфаСтрахование»',tone:'red',caption:'Заключение о проверке заказ-наряда',orientation:'А4 · книжный',fields:['calculation','claim','insured','vehicle','registration','total','deduction','payable']},
  reso:{name:'РЕСО-Гарантия',legal:'СПАО «РЕСО-Гарантия»',tone:'green',caption:'Акт разногласий по счёту',orientation:'А4 · книжный',fields:['registration','claim','calculation','total','deduction','payable']}
};
export const LABELS={claim:'Номер претензии',insured:'Страхователь',vehicle:'Марка и модель',vin:'VIN',registration:'Госрегистрационный знак',calculation:'Номер калькуляции',invoice:'Сумма по счёту',total:'Итого',payable:'К оплате',deduction:'Отказ',date:'Дата документа'};
export const MONEY=['invoice','total','payable','deduction'];
export function label(key,insurer){
  return ({alfa:{claim:'Номер убытка',calculation:'Номер заказ-наряда',total:'Стоимость восстановительного ремонта',deduction:'Стоимость вычета'},reso:{claim:'Номер дела',calculation:'ПЗН или счёт №',total:'Всего по счёту (верхнее поле)',deduction:'Общая сумма вычета'}}[insurer]||{})[key]||LABELS[key];
}
export function today(now=new Date()){return [now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');}
export function formatDate(value){const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(value||'');return m?`${m[3]}.${m[2]}.${m[1]}`:'';}
export function validDate(s){if(!/^\d{4}-\d{2}-\d{2}$/.test(s||''))return false;const d=new Date(s+'T12:00:00');return !isNaN(d)&&today(d)===s&&Number(s.slice(0,4))>=1900&&Number(s.slice(0,4))<=2199;}
export function parseMoney(raw){
  const s=String(raw??'').trim().replace(/[\s\u00a0\u202f]/g,'');
  if(!s)return null;
  if(!/^\d{1,9}(?:[.,]\d{1,2})?$/.test(s))throw new Error('Введите сумму от 0 до 999 999 999,99 — не более двух знаков после запятой.');
  const [a,b='']=s.split(/[.,]/);return Number(a)*100+Number(b.padEnd(2,'0'));
}
export function money(cents){if(cents===null||cents===undefined)return '';if(!Number.isSafeInteger(cents)||cents<0)throw new Error('Некорректная сумма');return new Intl.NumberFormat('ru-RU',{minimumFractionDigits:2,maximumFractionDigits:2}).format(cents/100);}
export function initialData(insurer='ingos'){return {insurer,calculated:'payable',date:today(),claim:'',insured:'',vehicle:'',vin:'',registration:'',calculation:'',invoice:'',total:'',payable:'',deduction:''};}
export const AMOUNTS=['total','deduction','payable'];
export function calculateAmounts(data){
  const target=data.calculated||'payable';if(!AMOUNTS.includes(target))throw new Error('Выберите рассчитываемую сумму.');
  const parsed=Object.fromEntries(AMOUNTS.map(k=>[k,k===target?null:parseMoney(data[k])]));
  const inputs=AMOUNTS.filter(k=>k!==target);if(inputs.some(k=>parsed[k]===null))return parsed;
  parsed[target]=target==='total'?parsed.payable+parsed.deduction:target==='deduction'?parsed.total-parsed.payable:parsed.total-parsed.deduction;
  if(parsed[target]<0)throw new Error(target==='deduction'?'Сумма к оплате не может превышать сумму по счёту.':'Вычет не может превышать сумму по счёту.');
  if(parsed[target]>99999999999)throw new Error('Рассчитанная сумма превышает 999 999 999,99.');
  return parsed;
}
export function validate(data){
  const errors={};const selected=INSURERS[data.insurer];if(!selected)return {insurer:'Выберите страховую компанию.'};
  if(!validDate(data.date))errors.date='Укажите корректную дату.';
  for(const key of selected.fields){if(key===(data.calculated||'payable'))continue;const value=String(data[key]??'').trim();if(MONEY.includes(key)){try{parseMoney(value);}catch(e){errors[key]=e.message;}}else if(value.length>160)errors[key]='Сократите значение до 160 символов.';else if(/[\u0000-\u001f\u007f]/.test(value))errors[key]='Уберите переносы строк и управляющие символы.';}
  if(!AMOUNTS.some(k=>errors[k]))try{calculateAmounts(data);}catch(e){errors[data.calculated==='deduction'?'payable':'deduction']=e.message;}
  return errors;
}
export function values(data){
  const errors=validate(data);if(Object.keys(errors).length)throw Object.assign(new Error(Object.values(errors)[0]),{fields:errors});
  const result={...data};result.invoice=money(parseMoney(data.invoice));for(const [k,v]of Object.entries(calculateAmounts(data)))result[k]=money(v);
  if(data.insurer==='alfa')result.invoice=result.total; result.date=formatDate(data.date);return result;
}
export function sumWarning(){return '';}
export function filename(data){const id=String(data.claim||data.calculation||'без номера').replace(/[<>:"/\\|?*\u0000-\u001f]/g,'-').trim().slice(0,70);return `Акт разногласий — ${INSURERS[data.insurer].name} — ${id} — ${formatDate(data.date)}.pdf`;}
export function escapeXML(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));}

