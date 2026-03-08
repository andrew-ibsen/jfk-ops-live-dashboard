const fs=require('fs');
const x=require('xlsx');
const wb=x.readFile('C:/Users/Andrew/.openclaw/media/inbound/Report_42_User_Details_1634---acbaab62-aaf3-45f2-9625-3d866ff5af26.xlsx');
const ws=wb.Sheets[wb.SheetNames[0]];
const rows=x.utils.sheet_to_json(ws,{defval:''});
const map={};
for(const r of rows){
 const name=String(r.Name||'').replace(/\s+/g,' ').trim();
 const base=String(r.Base||'').trim().toUpperCase();
 if(!name||!base) continue;
 if(!map[base]) map[base]=new Set();
 map[base].add(name);
}
const out={};
for(const base of Object.keys(map).sort()){
 const arr=[...map[base]].sort((a,b)=>a.localeCompare(b));
 out[base]={mechanics:arr,certifiers:arr};
}
const content = `export const STAFF_BY_STATION: Record<string, { mechanics: string[]; certifiers: string[] }> = ${JSON.stringify(out,null,2)}\n`;
fs.writeFileSync('src/stationStaff.ts',content);
console.log('wrote src/stationStaff.ts with',Object.keys(out).length,'stations');