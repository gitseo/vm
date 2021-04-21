var C=[919000,0,1900,0,-5000,0,-5000,0,0,+50000,0,0,0,0,0,-5000,0,0,0,0,0,+5000,0,-2000,0,0,0,0,10000,0,0,-1000000];//[0,0,0,0,0,0,0,0,0,0,0,0,10,60,20,70,2000,70,0,0,0,0,0,0];
var step=(C)=>{
  var N="L,US,R,X,456,0,0,0,0,0".split(",");
  var dC=C.map(e=>[]);
  C.map((v,i)=>{
    var nb=[];
    if(i)nb.push(i-1);
    if(i+1<C.length)nb.push(i+1);
    var arr=[v,...(nb.map(id=>C[id]))];
    var avg=qapavg(arr);
    [i,...nb].map(id=>dC[id].push(avg-C[id]));
    return {i,v,nb,avg,arr};
  });
  var out=dC.map((e,i)=>({dc:e,dv:qapsum(e),result:qapavg(e)*0.1*10+C[i],name:N[i]}));
  //return out.map(e=>json(e)).join("\n");
  return out.map(e=>e.result);
}
var out=[];var end=[];var init=C;
for(var i=0;i<400;i++){
  out.push(C);
  var a=step(C);
  out.push(a);
  var b=step(a);
  var view=C.map((e,i)=>0.5*(a[i]+b[i]));
  //if(i%300==299)
  end.push(view);
  C=b;
}
//out=[/*...out,*/init,...end];
var csv=C.map((e,i)=>i).join(",")+"\n"+out.map(e=>e.map(e=>e.toFixed(2))).join("\n");
//cb(arr[id],{t:'b',y:y,x:id,key:key},pcsv,arr,td,tag,bg,rg)
var cb=(str,pos,pcsv,arr,td,tag,bg,rg)=>{
  return td?rg(1*str,escapeHtml(str),888*3,1):escapeHtml(str)+"?"+json(pcsv|0);
}
return html(csv2table_v2(csv,",",cb));
