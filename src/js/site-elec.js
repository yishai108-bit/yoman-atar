// מבנה החשמל של האתר: תחנות (סקידים), ICB (כניסות LV לתחנה), ממירים ומספר הסטרינגים לכל ממיר.
// מקור עין תמר: E_10 Color Map rev03 (15.7.26), טבלאות ICB 1.1/1.2/2.1/2.2. 27 פאנלים לסטרינג.
// הממירים לא ממוקמים על שורות המפה (החצאים במפה לא חופפים בדיוק לתחנות), לכן הכרטיס נפרד מהמפה.
export const SITE_ELEC={
  "עין תמר":{src:"E_10 Color Map rev03 · 15.7.26",stringPanels:27,
    stations:[
      {id:"S1",name:"תחנה 1",side:"מערב",icbs:[
        {id:"1.1",inv:[["1.1",19],["1.2",18],["1.3",18],["1.4",18],["1.5",18],["1.6",18],["1.7",19],["1.8",19],["1.9",19]]},
        {id:"1.2",inv:[["1.10",19],["1.11",19],["1.12",19],["1.13",19],["1.14",18],["1.15",19],["1.16",19],["1.17",20],["1.18",18]]}]},
      {id:"S2",name:"תחנה 2",side:"מזרח",icbs:[
        {id:"2.1",inv:[["2.1",18],["2.2",19],["2.3",19],["2.4",18],["2.5",18],["2.6",18],["2.7",18],["2.8",18],["2.9",18],["2.10",18]]},
        {id:"2.2",inv:[["2.11",19],["2.12",20],["2.13",19],["2.14",19],["2.15",19],["2.16",20],["2.17",18],["2.18",19],["2.19",19]]}]}
    ]}
};
// המבנה של האתר הנוכחי לפי חלק משם האתר. null = אין.
export function siteElecFor(name){ const n=String(name||""); for(const k in SITE_ELEC) if(n.includes(k)) return SITE_ELEC[k]; return null; }
// מבנה ממספרים: תחנות × ממירים לתחנה × סטרינגים לממיר (ICB אחד לתחנה)
export function genElec(g){
  const st=Math.max(1,Math.min(12,Math.round(Number(g&&g.stations)||0))), inv=Math.max(1,Math.min(40,Math.round(Number(g&&g.inv)||0))), s=Math.max(1,Math.min(40,Math.round(Number(g&&g.strings)||0)));
  if(!st||!inv||!s) return null;
  const stations=[]; for(let i=1;i<=st;i++){ const list=[]; for(let j=1;j<=inv;j++) list.push([i+"."+j,s]); stations.push({id:"S"+i,name:"תחנה "+i,side:"",icbs:[{id:String(i),inv:list}]}); }
  return {src:"gen",stringPanels:Number(g.stringPanels)||27,stations};
}
