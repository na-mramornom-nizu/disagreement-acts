import {PDFDocument,rgb} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import {values,label,escapeXML} from './model.mjs';

const A=(x,y,w,h)=>[x*.56,y*.56,w*.56,h*.56];
const alfaFields={claim:A(783,61,180,28),calculation:A(511,96,193,23),date:A(749,95,233,24),insured:A(285,173,695,26),vehicle:A(285,216,297,23),registration:A(708,216,272,23),invoice:A(708,256,232,22),total:A(746,1151,192,22),deduction:A(746,1179,192,21),payable:A(746,1207,192,21)};

export async function createEngine({regular,bold,layouts,alfaPdf,alfaPreview}){
  const metrics=await PDFDocument.create();metrics.registerFontkit(fontkit);
  const fonts={regular:await metrics.embedFont(regular),bold:await metrics.embedFont(bold)};
  const supported=new Set(fonts.regular.getCharacterSet());
  function fit(text,box,bold=false,size=10,min=6.5){
    const font=bold?fonts.bold:fonts.regular,w=Math.max(1,box[2]-5),h=Math.max(1,box[3]-.4);
    for(let fs=size;fs>=min-.01;fs-=.25){const lines=[];let line='';for(const token of String(text).split(/(\s+)/)){if(!token)continue;let candidate=line+token;if(font.widthOfTextAtSize(candidate,fs)<=w){line=candidate;continue;}if(line.trim()){lines.push(line.trim());line='';}if(font.widthOfTextAtSize(token.trim(),fs)<=w){line=token.trim();continue;}for(const ch of token.trim()){if(font.widthOfTextAtSize(line+ch,fs)>w){lines.push(line);line='';}line+=ch;}}if(line.trim())lines.push(line.trim());if(lines.length*fs*1.08<=h)return {lines,size:fs,font};}
    throw new Error('Значение не помещается в поле бланка. Сократите текст.');
  }
  function compose(data){
    const val=values(data);const base=data.insurer==='alfa'?{width:594.72,height:840.24,commands:[],fields:alfaFields}:layouts[data.insurer];
    const commands=base.commands.map(c=>({...c}));
    for(const [key,box]of Object.entries(base.fields)){
      let value=val[key]||'';if(key==='date'&&data.insurer==='ingos')value='Отправлено '+value;
      if([...value].some(c=>!supported.has(c.codePointAt(0))))throw Object.assign(new Error(`${label(key,data.insurer)}: уберите символы, которые не поддерживает шрифт бланка.`),{fields:{[key]:'Уберите эмодзи или другие символы, которых нет в шрифте бланка.'}});
      if(value)commands.push({kind:'text',x:box[0],y:box[1],w:box[2],h:box[3],text:value,size:data.insurer==='ingos'?9:11,bold:['invoice','total','deduction','payable'].includes(key),align:['invoice','total','deduction','payable'].includes(key)?'right':'left',key});
    }
    if(data.insurer==='alfa'){
      for(const [key,box]of [['deduction',A(853,803,126,18)],['date',A(743,1357,198,22)]])if(val[key])commands.push({kind:'text',x:box[0],y:box[1],w:box[2],h:box[3],text:val[key],size:10,bold:key==='deduction',align:key==='deduction'?'right':'center',key});
    }
    const prepared=[];
    for(const c of commands){if(c.kind!=='text'){prepared.push(c);continue;}try{const f=fit(c.text,[c.x,c.y,c.w,c.h],c.bold,c.size,c.key?6.5:5.5);const leading=f.size*1.08;const top=c.y+(c.h-f.lines.length*leading)/2;for(let i=0;i<f.lines.length;i++){const width=f.font.widthOfTextAtSize(f.lines[i],f.size);let x=c.x+2.5;if(c.align==='right')x=c.x+c.w-2.5-width;if(c.align==='center')x=c.x+(c.w-width)/2;prepared.push({kind:'lineText',text:f.lines[i],x,y:top+(i+1)*leading-f.size*.15,size:f.size,bold:c.bold,key:c.key});}}catch(e){if(c.key)throw Object.assign(new Error(`${label(c.key,data.insurer)}: ${e.message}`),{fields:{[c.key]:e.message}});throw new Error(`Не помещается заголовок бланка: ${c.text}`);}}
    return {...base,commands:prepared};
  }
  function svg(data){const doc=compose(data);let out=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${doc.width} ${doc.height}" role="img" aria-label="Предпросмотр акта разногласий"><rect width="100%" height="100%" fill="white"/>`;if(data.insurer==='alfa')out+=`<image href="${alfaPreview}" width="${doc.width}" height="${doc.height}"/>`;for(const c of doc.commands){if(c.kind==='rect')out+=`<rect x="${c.x}" y="${c.y}" width="${c.w}" height="${c.h}" fill="none" stroke="black" stroke-width="0.5"/>`;else if(c.kind==='lineText')out+=`<text x="${c.x}" y="${c.y}" font-family="DocumentFont,Arial,sans-serif" font-size="${c.size}" font-weight="${c.bold?700:400}" fill="black">${escapeXML(c.text)}</text>`;}return out+'</svg>';}
  async function pdf(data){const doc=compose(data);const pdf=data.insurer==='alfa'?await PDFDocument.load(alfaPdf):await PDFDocument.create();pdf.registerFontkit(fontkit);const f={regular:await pdf.embedFont(regular,{subset:true}),bold:await pdf.embedFont(bold,{subset:true})};const page=data.insurer==='alfa'?pdf.getPage(0):pdf.addPage([doc.width,doc.height]);for(const c of doc.commands){if(c.kind==='rect')page.drawRectangle({x:c.x,y:doc.height-c.y-c.h,width:c.w,height:c.h,borderWidth:.5,borderColor:rgb(0,0,0)});else if(c.kind==='lineText')page.drawText(c.text,{x:c.x,y:doc.height-c.y,size:c.size,font:c.bold?f.bold:f.regular,color:rgb(0,0,0)});}pdf.setTitle('Акт разногласий');pdf.setAuthor('');pdf.setSubject('');pdf.setKeywords([]);pdf.setCreator('Сервис актов разногласий');return pdf.save();}
  return {svg,pdf,compose};
}

