const fs=require('fs');
const p='C:/Users/Andrew/.openclaw/media/inbound/Report_43_Line_Customer_Rates_1634---43382987-c108-437b-885a-322f6882fe50.csv';
const txt=fs.readFileSync(p,'utf8');
const lines=txt.split(/\r?\n/).filter(Boolean);
const out={};
for(let i=1;i<lines.length;i++){
  const [icao,status,station]=lines[i].split(',');
  const ic=(icao||'').trim().toUpperCase();
  const st=(station||'').trim().toUpperCase();
  const s=(status||'').trim().toLowerCase();
  if(!st||!ic||s!=='active') continue;
  if(!out[st]) out[st]=new Set();
  out[st].add(ic);
}
for(const st of Object.keys(out)) out[st].add('BAW');
const obj={};
Object.keys(out).sort().forEach(st=>obj[st]=[...out[st]].sort());
const content='export const STATION_AIRLINES: Record<string,string[]> = '+JSON.stringify(obj,null,2)+'\n';
fs.writeFileSync('src/stationAirlines.ts',content);
console.log('wrote',Object.keys(obj).length,'stations');