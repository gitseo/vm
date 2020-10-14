var util = require('util');
var assert=require('assert');
var child_process=require('child_process');
var execSync=child_process.execSync;var exec=child_process.exec;
var spawnSync=child_process.spawnSync;var spawn=child_process.spawn;
var qs = require('querystring');
var http = require("http"),
    https = require("https"),
    url = require("url"),
    path = require("path"),
    fs = require("fs"),
    os = require("os"),
    process = require('process'),
    crypto = require('crypto');

var json=JSON.stringify;
var json_once=(obj,replacer,indent,limit)=>{
  var objs=[];var keys=[];if(typeof(limit)=='undefined')limit=2048;
  return json(obj,(key,v)=>{
    if(objs.length>limit)return 'object too long';
    var id=-1;objs.forEach((e,i)=>{if(e===v){id=i;}});
    if(key==''){objs.push(obj);keys.push("root");return v;}
    if(id>=0){
      return keys[id]=="root"?"(pointer to root)":
        ("\1(see "+((!!v&&!!v.constructor)?v.constructor.name.toLowerCase():typeof(v))+" with key "+json(keys[id])+")");
    }else{
      if(v!==null&&typeof(v)==="object"){var qk=key||"(empty key)";objs.push(v);keys.push(qk);}
      return replacer?replacer(key,v):v;
    }
  },indent);
};
var json_once_v2=(e,v,lim)=>json_once(e,v,2,lim);
var inspect=json_once_v2;

var getDateTime=t=>{
  var now     = typeof t==='number'?new Date(t):new Date();
  var year    = now.getFullYear();
  var f=v=>(v.toString().length==1?'0':'')+v;
  var month   = f(now.getMonth()+1); 
  var day     = f(now.getDate());
  var hour    = f(now.getHours());
  var minute  = f(now.getMinutes());
  var second  = f(now.getSeconds());
  var ms=now.getMilliseconds()+"";var ttt=[0,"00","0",""];ms=ttt[ms.length]+ms;
  var dateTime = year+'.'+month+'.'+day+' '+hour+':'+minute+':'+second+'.'+ms;
  return dateTime;
}

var qap_add_time=s=>"["+getDateTime()+"] "+s;
var qap_log=s=>console.log(qap_add_time(s));
var qap_err=(context,err)=>context+" :: err = "+inspect(err)+" //"+err.stack.toString();
var call_cb_on_err=(emitter,cb,...args)=>{
  emitter.on('error',err=>{
    cb("'inspect({args,err}) // stack': "+inspect({args:args,err:err})+" // "+err.stack.toString());
  });
}
var xhr=(method,URL,data,ok,err)=>{
  if((typeof ok)!="function")ok=()=>{};
  if((typeof err)!="function")err=()=>{};
  var up=url.parse(URL);var secure=['https:','https'].includes(up.protocol);
  var options={
    hostname:up.hostname,port:up.port?up.port:(secure?443:80),path:up.path,method:method.toUpperCase(),
    headers:{'Content-Type':'application/x-www-form-urlencoded','Content-Length':Buffer.byteLength(data)}
  };
  var req=(secure?https:http).request(options,(res)=>{
    var cb=ok;
    if(res.statusCode!==200){cb=(s,res)=>err('Request Failed.\nStatus Code: '+res.statusCode+'\n'+s);}
    //res.setEncoding('utf8');
    var rawData='';res.on('data',(chunk)=>rawData+=chunk.toString("binary"));
    res.on('end',()=>{try{cb(rawData,res);}catch(e){err(qap_err('xhr.mega_huge_error',e),res);}});
  });
  call_cb_on_err(req,qap_log,'xhr');
  req.end(data);
  return req;
}
var rand=()=>(Math.random()*1024*64|0);
var rand_full=()=>{var rnd=rand()+"";return "00000".substr(rnd.length)+rnd;}

var say=msg=>(s)=>{qap_log(msg+"::"+s);};
var xhr_post=(url,obj,ok,err)=>xhr('post',url,qs.stringify(obj),ok,err);
var argc=process.argv.length;
if([3,4].includes(argc)){
  var fn=argc==4?"vm/"+process.argv[3]:"vm/Z"+rand_full()+"_"+rand_full()+".txt";
  var data=""+fs.readFileSync(process.argv[2],"binary");
  xhr_post('http://qap.atwebpages.com/deploy.php',{fn,data,from_js:'querystring<utf8>(data)'},say("xhr_post_done"),say("xhr_post_fail"));
  qap_log("xhr_post: runned with "+json({fn}));
}else{
  qap_log("xhr_post: error 'process.argv.length!=2' - need local filename");
}
