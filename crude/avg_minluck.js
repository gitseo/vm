var r=()=>Math.random();
var g=()=>({w:r(),m:r()});
var mk=n=>{var arr=[];for(var i=0;i<n;i++){arr.push(g());};var out=qapsort(arr,e=>e.w*0.95+e.m*0.05);return out;};
var n=18000;var out=[];var m={W:0,L:0};
for(var i=0;i<1000;i++){
  var t=mk(n).slice(0,11);
  var avg_luck=qapavg(t,e=>e.m);
  var min_luck=qapmin(t,e=>e.m);
  out.push({avg_luck,min_luck,luck:t.map(e=>(e.m*100).toFixed(2))});
}
return inspect({avg_luck:qapavg(out,e=>e.avg_luck),avg_minluck:qapavg(out,e=>e.min_luck)})+"\n"+out.map(e=>json(e)).join("\n");
