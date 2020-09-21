var mk_html=s=>`
<!DOCTYPE HTML>
<html><meta charset="utf-8"><head><style type="text/css">textarea{width:99%;font-family:consolas;}</style></head>
<body><center>
<form id="postform" method="post">
  <p>content of archive.txt:</p>
  <textarea spellcheck=false rows="20" name="data" id="data" onkeypress="if(event.keyCode==10||(event.ctrlKey&&event.keyCode==13))document.getElementById('postform').submit();"></textarea>
  <p><input type="checkbox" name="timediff" checked="false">timediff</input></p>
  <p><input type="checkbox" name="no_hr" checked="false">no_hr</input></p>
  <p><input type="checkbox" name="no_colors" checked="false">no_colors</input></p>
  <p><input type="checkbox" name="show_stats">no_colors</input></p>
  <p><input type="submit" value="send"></p>
</form>
</center></body></html>
`;
var obj_str=POST.data;//return "ok";
if('show_code' in qp)return txt(POST.code);
if('main' in qp)if(!('data' in qp))return html(mk_html());
if(!('data' in qp)){
  var arr="menu,show_code,main,timediff".split(",");
  var cfn="./"+fn.slice("./crude/".length);
  return html(links2table(
    arr.map(e=>cfn+'?&'+e))
  );
}
//
var to_timestamp=s=>{
  if(!s.length)return {err:1,type:'empty'};
  var q=s=>s.split(/[.:-]/);
  var a=s.split(" ");
  if(a.length<2)return {err:1,type:'fail'};
  if(!(["23:59:59.999","15-11-44"].map(e=>e.length).includes(a[0].length)))return {err:1,type:'t'};
  if(a[1].length!="2020-09-18".length)return {err:1,type:'d'};
  var a0=q(a[0]);var a1=q(a[1]);
  if(!([3,4].includes(a0.length)))return {err:1,type:'tl'};
  if(a1.length!=3)return {err:1,type:'dl'};
  var t=new Date(a1[0],a1[1],a1[2],a0[0],a0[1],a0[2],a0[3]|0);
  return {a0,a1,t,err:0,type:'ok'};
};
var timediff=(a,b)=>{var td=(a-b)/1e3;return td+" sec. // "+(td/60).toFixed(5)+" minutes";}
var timediff_main=()=>{
  var s="\n"+POST.data.split("\r").join("");
  var arr=s.split("\n---\n");
  var out=[];
  for(var i=0;i<arr.length;i++){
    var e=arr[i];
    let a=e.split("\n");
    let t=to_timestamp(a[0]);
    if(t.err)continue;
    out.push(t);
  }
  //return inspect({s,arr,pd:POST.data,out});
  var td=timediff(out[1].t,out[0].t);
  return inspect({td,out});
}
if('timediff' in qp)return timediff_main();
//
var parr="\n\r`+-*/\\(){}[]@^%$=,.:;'|&#!?<>\"1234567890_".split("");
var f=str=>{
  parr.map(e=>str=str.split(e).join(" "));
  return str.split(" ").map(e=>e.trim()).filter(e=>e);
}
var m={};
f(POST.data).map(e=>inc(m,escapeHtml(e)));
m=mapsort(m);
if('show_stats' in qp)return html_utf8("<pre>"+escapeHtml(inspect(m)));
var bg=(r,g,b,str)=>'<span style="color:rgb('+r+','+g+','+b+');">'+str+'</span>';
var w=[];var out="";
var inv=v=>255-v;
var rgb=(r,g,b)=>({r:r|0,g:g|0,b:b|0});
var white=rgb(255,255,255);
var yellow=rgb(255,255,0);
var green=rgb(0,255,0);
var mix=(bef,aft,a,b,n)=>{
  var k=(n-a)/(b-a);
  var d=1-k;
  return rgb(
    bef.r*d+aft.r*k,
    bef.g*d+aft.g*k,
    bef.b*d+aft.b*k
  );
}
var to_rgb=n=>{
  if(n<5)return mix(yellow,white,1,5,n);
  return mix(white,green,5,255,n);
  if(n==1)return yellow;
  if(n>2&&n<=10)return mix(yellow,white,2,10,n);
  if(n>11&&n<=100)return mix(white,green,11,100,n);
  return green;//mix(yellow,white,0,255,n);
}
var end=()=>{if(!w.length)return;var q=w.join("");w.length=0;var v=to_rgb(m[q]);out+=bg(v.r,v.g,v.b,q);};
var s=POST.data.split("\r").join("");
if(!('no_colors' in qp)){
  for(var i=0;i<s.length;i++){
    var c=s[i];
    if(parr.includes(c)||c==" "){end();out+=escapeHtml(c);continue;}
    w.push(escapeHtml(c));
  }
  end();
}else{
  out=s;
}
var update_timestamps=arr=>{
  var t=arr.map(e=>to_timestamp(e[0]));
  for(var i=1;i<t.length;i++){
    var bef=t[i-1];if(bef.err)continue;
    var cur=t[i-0];
    arr[i][0]+=" // "+timediff(cur.t,bef.t);//+" // "+json(cur)+" - "+json(bef);
  }
  return arr.map(e=>e.join("\n"));
}
var arr=out.split("\n---\n").map(msg=>msg.split("\n"));
var pre=update_timestamps(arr).join('no_hr' in qp?"\n---\n":"<hr>");
return html_utf8('<body style="background-color:black; color:white;"><pre>'+pre+'</pre></body>');
