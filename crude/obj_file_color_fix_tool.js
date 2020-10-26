var mk_html=s=>`
<html><style type="text/css">textarea{width:99%;font-family:consolas;}</style>
<body><center>
<form id="postform" method="post">
  <p>content of *.obj file(with colored vertices):</p>
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
var target="# Exported from 3D Builder";
if(!obj_str.includes(target))return "work only for *.obj that have "+json(target);
var arr=obj_str.split("\r").join("").split("\n");
var A=arr.map(e=>e.trim()).filter(e=>e.length).map(e=>e.split(" "));
var f=p=>A.filter(e=>e[0]==p).map(e=>e.slice(1));
var f2=(F,O)=>A.filter(e=>e[0]==F||e[0]==O&&e[0]!='vt').map(e=>({t:e[0],arr:e.slice(1)}));
var q={
  L1:arr.length,
  L2:arr.filter(e=>e.trim()!="").length,
  V:f("v"),
  F:f("f"),
  O:f("o"),
  mtllib:f("mtllib"),
  usemtl:f("usemtl")
};
//return json(q,0,2);
var out=["# 3D Builder -> vm"];var emit=s=>out.push(s);
var ms={};
var VA=[];var mVA={};
var getdef=(m,k,def)=>{if(!(k in m))m[k]=def;return m[k];};
var emit_v=s=>{
  var r=getdef(mVA,s,{id:-1,ok:false});
  if(!r.ok){r.id=VA.length;VA.push(s);r.ok=true;}
  return (r.id+1)+"";
}; // VA.map(e=>"v "+e.join(" "));//.join("\n");
var set_color=c=>{var m="c_"+c.join("_");ms[m]=1;emit("usemtl "+m);};
var get_color=v=>v.slice(3);
var defcolor=["255","255","255"];
var prev_cc="defcolor";var cc=prev_cc;
f2('f','o').map(e=>{
  if(e.t!='f')return emit(e.t+" "+e.arr.join(" "));
  var v=e.arr.map(e=>q.V[(e.split("/")[0]|0)-1]);//response.end(json(e,0,2));
  var c=v.map(get_color);
  var ok=true;c.map(e=>{if(json(e)!=json(c[0]))ok=false;});
  if(!ok){txt("fail at "+inspect({e,v,c}));throw new Error("obj conv error...");}
  if(!c[0].length){cc=defcolor;}else{cc=c[0];}
  if(json(cc)!=prev_cc){
    set_color(cc);prev_cc=json(cc);
  }
  emit("f "+v.map(e=>emit_v(e.slice(0,3).join(" "))).join(" "));
});
var mtlout=[];
mapkeys(ms).map(e=>{
  mtlout.push("newmtl "+e);
  mtlout.push("Kd "+e.split("c_")[1].split("_").map(e=>(e|0)/255.0).join(" "));
  mtlout.push("");
});
//return inspect(mVA)+"\n"+json(mapkeys(ms))+"\n"+mapkeys(mVA).length+"\n";
return mtlout.join("\n")+"\n"+[out[0],...VA.map(e=>"v "+e),...out.slice(1)].join("\n");
return json(q);
