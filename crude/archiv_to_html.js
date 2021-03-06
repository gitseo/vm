var mk_html=s=>`
<!DOCTYPE HTML>
<html><meta charset="utf-8"><head><style type="text/css">textarea{width:99%;font-family:consolas;}</style></head>
<body><center>
<form id="postform" method="post">
  <p>content of archive.txt:</p>
  <textarea spellcheck=false rows="20" name="data" id="data" onkeypress="if(event.keyCode==10||(event.ctrlKey&&event.keyCode==13))document.getElementById('postform').submit();"></textarea>
  <p><input type="checkbox" name="timediff" checked>timediff</input></p>
  <p><input type="checkbox" name="no_hr">no_hr</input></p>
  <p><input type="checkbox" name="no_colors">no_colors</input></p>
  <p><input type="checkbox" name="show_stats">show_stats</input></p>
  <p><input type="checkbox" name="contenteditable">contenteditable</input></p>
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
var to_timestamp=(s)=>{
  if(!s.length)return {err:1,type:'empty'};
  var q=s=>s.split(/[.:-]/);
  var a=s.split(" ");
  if(a.length<2)return {err:1,type:'fail'};
  if(a[0].length=="2020.10.14".length){let tmp=a[0];a[0]=a[1];a[1]=tmp;}
  if(!(["23:59:59.999","15-11-44"].map(e=>e.length).includes(a[0].length)))return {err:1,type:'t'};
  if(a[1].length!="2020-09-18".length)return {err:1,type:'d'};
  var a0=q(a[0]);var a1=q(a[1]);
  if(!([3,4].includes(a0.length)))return {err:1,type:'tl'};
  if(a1.length!=3)return {err:1,type:'dl'};
  var t=new Date(a1[0],a1[1],a1[2],a0[0],a0[1],a0[2],a0[3]|0);
  return {a0,a1,t,err:0,type:'ok'};
};
var timediff=(a,b,n)=>{
  var td=(a-b)/1e3;
  return td.toFixed(3)+" sec. // "+(td/60).toFixed(5)+" minutes. // "+(td/3600).toFixed(7)+' hours. // '+n+' symbols. // '+(n/td).toFixed(3)+' symbols/sec';
}
//
var bg=(r,g,b,str)=>'<span style="color:rgb('+r+','+g+','+b+');">'+str+'</span>';
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
  if(!n)return white;
  if(n<5)return mix(yellow,white,1,5,n);
  if(n>=255)return green;
  return mix(white,green,5,255,n);
  if(n==1)return yellow;
  if(n>2&&n<=10)return mix(yellow,white,2,10,n);
  if(n>11&&n<=100)return mix(white,green,11,100,n);
  return green;//mix(yellow,white,0,255,n);
}
var w=[];var m={};
var out="";
var end=()=>{if(!w.length)return;var q=w.join("");w.length=0;var v=to_rgb(m[q]);out+=bg(v.r,v.g,v.b,q);};
var s="\n"+POST.data.split("\r").join("");
var arr=s.split("\n---\n").map(msg=>msg.split("\n"));
var getDateTime_hmsxYMD=t=>{
  var now     = typeof t==='number'?new Date(t):new Date();
  var year    = now.getFullYear();
  var f=v=>(v.toString().length==1?'0':'')+v;
  var month   = f(now.getMonth()+1); 
  var day     = f(now.getDate());
  var hour    = f(now.getHours());
  var minute  = f(now.getMinutes());
  var second  = f(now.getSeconds());
  var ms=now.getMilliseconds()+"";var ttt=[0,"00","0",""];ms=ttt[ms.length]+ms;
  var dateTime = hour+':'+minute+':'+second+'.'+ms+' '+year+'.'+month+'.'+day;
  return dateTime;
}
var parse_ts=s=>{
  var t=s.split(" ");
  if(t.length<=2)return [parse_datetime(s)*1,""];
  return [parse_datetime(t.slice(0,2).join(" "))*1," "+t.slice(2).join(" ")];
}
var fix_ts=s=>{pt=parse_ts(s);return getDateTime_hmsxYMD(pt[0])+pt[1];}
var update_timestamps=arr=>{
  var t=arr.map(e=>to_timestamp(e[0]));
  if('timediff' in qp)for(var i=0;i<t.length-1;i++){
    var bef=t[i+0];if(bef.err)continue;
    var cur=t[i+1];
    try{arr[i][0]=fix_ts(arr[i][0]);}catch(e){html_utf8("<pre>"+inspect(arr[i]));}
    arr[i][0]+=" // "+timediff(cur.t,bef.t,arr[i].slice(1).join("\n").length);//+" // "+json(cur)+" - "+json(bef);
  }
  return arr.map(e=>e.join("\n"));
}
s=update_timestamps(arr).join("\n---\n");
//
var parr="\n\r`+-*/\\(){}[]@^%$=,.:;'|&#!?<>\"1234567890_".split("");
var f=str=>{
  parr.map(e=>str=str.split(e).join(" "));
  return str.split(" ").map(e=>e.trim()).filter(e=>e);
}
f(s).map(e=>inc(m,escapeHtml(e)));
if('show_stats' in qp)return html_utf8("<pre>"+escapeHtml(inspect(mapsort(m))));
//
if(!('no_colors' in qp)){
  var ts_line=false;
  for(var i=0;i<s.length;i++){
    var c=s[i];
    if(c=='\n'){
      if(ts_line){ts_line=false;end();out+="</span>"+escapeHtml(c);continue;}
      if(s.substr(i-4,4)==="\n---"){ts_line=true;end();out+=escapeHtml(c)+'<span style="background-color:#303030">';continue;}
    }
    if(parr.includes(c)||c==" "){end();out+=escapeHtml(c);continue;}
    w.push(escapeHtml(c));
  }
  end();
}else{
  out=escapeHtml(s);
}
var pre=('no_hr' in qp)?out:out.split("\n---\n").join("<hr>");
return html_utf8('<body style="background-color:black; color:white;"><pre contenteditable='+('contenteditable' in qp)+'>'+pre+'</pre></body>');
