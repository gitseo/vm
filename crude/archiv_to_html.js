var mk_html=s=>`
<!DOCTYPE HTML>
<html><meta charset="utf-8"><head><style type="text/css">textarea{width:99%;font-family:consolas;}</style></head>
<body><center>
<form id="postform" method="post">
  <p>content of archive.txt:</p>
  <textarea spellcheck=false rows="20" name="data" id="data" onkeypress="if(event.keyCode==10||(event.ctrlKey&&event.keyCode==13))document.getElementById('postform').submit();"></textarea>
  <p><input type="submit" value="send"></p>
</form>
</center></body></html>
`;
var obj_str=POST.data;//return "ok";
if('show_code' in qp)return txt(POST.code);
if('main' in qp)if(!('data' in qp))return html(mk_html());
if(!('data' in qp)){
  var arr="menu,show_code,main".split(",");
  var cfn="./"+fn.slice("./crude/".length);
  return html(links2table(
    arr.map(e=>cfn+'?&'+e))
  );
}
//
var parr="\n\r`+-*/\\(){}[]@^%$=,.:;'|&#!?<>\"1234567890_".split("");
var f=str=>{
  parr.map(e=>str=str.split(e).join(" "));
  return str.split(" ").map(e=>e.trim()).filter(e=>e);
}
var m={};
f(POST.data).map(e=>inc(m,escapeHtml(e)));
m=mapsort(m);
var bg=(r,g,b,str)=>'<span style="color:rgb('+r+','+g+','+b+');">'+str+'</span>';
var w=[];var out="";
var inv=v=>255-v;
var rgb=(r,g,b)=>({r,g,b});
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
for(var i=0;i<s.length;i++){
  var c=s[i];
  if(parr.includes(c)||c==" "){end();out+=escapeHtml(c);continue;}
  w.push(escapeHtml(c));
}
end();
return html_utf8('<body style="background-color:black; color:white;"><pre>'+out.split("\n---\n").join("<hr>"));
//return html_utf8("<pre>"+inspect(m));
//return html_utf8("<pre>"+f(POST.data).map(e=>escapeHtml(e)).join("\n")+"");
