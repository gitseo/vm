var child_process=require('child_process');
var fs=require('fs');
var execSync=child_process.execSync;
var qs = require('querystring');
var http = require("http"),
    https = require("https"),
    url = require("url"),
    path = require("path"),
    fs = require("fs"),
    os = require("os"),
crypto = require('crypto');

var qap_log=s=>console.log("["+getDateTime()+"] "+s);
function getDateTime() {
  var now     = new Date(); 
  var year    = now.getFullYear();
  var f=v=>(v.toString().length==1?'0':'')+v;
  var month   = f(now.getMonth()+1); 
  var day     = f(now.getDate());
  var hour    = f(now.getHours());
  var minute  = f(now.getMinutes());
  var second  = f(now.getSeconds()); 
  var dateTime = year+'.'+month+'.'+day+' '+hour+':'+minute+':'+second;   
  return dateTime;
}

var file_exist=fn=>{try{fs.accessSync(fn);return true;}catch(e){return false;}}
var rand=()=>(Math.random()*1024*64|0);

var xhr=(method,URL,data,ok,err)=>{
  var up=url.parse(URL);var secure=up.protocol=='https';
  var options={
    hostname:up.hostname,port:up.port?up.port:(secure?443:80),path:up.path,method:method.toUpperCase(),
    headers:{'Content-Type':'application/x-www-form-urlencoded','Content-Length':Buffer.byteLength(data)}
  };
  var req=(secure?https:http).request(options,(res)=>{
    var statusCode=res.statusCode;var contentType=res.headers['content-type'];var error;
    if(statusCode!==200){error=new Error('Request Failed.\nStatus Code: '+statusCode);}
    if(error){err(error.message,res);res.resume();return;}
    //res.setEncoding('utf8');
    var rawData='';res.on('data',(chunk)=>rawData+=chunk.toString("binary"));
    res.on('end',()=>{try{ok(rawData,res);}catch(e){err(e.message,res);}});
  }).on('error',e=>{err('Got error: '+e.message,null);});
  req.end(data);
  return req;
}

var hosts=[
  "http://vm-vm.1d35.starter-us-east-1.openshiftapps.com",
  "http://agile-eyrie-44522.herokuapp.com",
  "http://vm-vm.193b.starter-ca-central-1.openshiftapps.com"
];

var xhr_shell=(method,URL)=>{
  var up=url.parse(URL);var secure=up.protocol=='https';
  var options={
    hostname:up.hostname,port:up.port?up.port:(secure?443:80),path:up.path,method:method.toUpperCase(),
    headers:{'qap_type':'rt_sh','Transfer-Encoding':'chunked'}
    //headers:{'Content-Type':'application/x-www-form-urlencoded','Content-Length':Buffer.byteLength(data)}
  };
  var once=false;
  var req=(secure?https:http).request(options,(res)=>{
    var statusCode=res.statusCode;var contentType=res.headers['content-type'];var error;
    if(statusCode!==200){error=new Error('Request Failed.\nStatus Code: '+statusCode);}
    if(error){err(error.message,res);res.resume();return;}
    if(!once)
    {
      var rawData='';
      res.on('data',data=>{
        rawData+=data.toString("binary");
        var e=rawData.indexOf("\0");
        if(e<0)return;
        var t=rawData.split("\0");
        if(t.length<3)return;
        var len=t[0]|0;
        var out=t.slice(2).join("\0");
        if(out.length<len)return;
        var z=t[1];
        var msg=out.substr(0,len);
        rawData=out.substr(len);
        if(z==="out")process.stdout.write(msg);
        if(z==="err")process.stderr.write(msg);
        if(z==="qap_log")qap_log(msg);
      });
      var u=event=>res.on(event,e=>qap_log('xhr_shell::res :: Got '+event));
      'end,abort,aborted,connect,continue,response,upgrade'.split(',').map(u);
      res.on('error',e=>qap_log('Got error: '+e.message));
      once=true;
    }
  });

  var u=event=>req.on(event,e=>qap_log('xhr_shell::req :: Got '+event));
  'end,abort,aborted,connect,continue,response,upgrade'.split(',').map(u);
  req.on('error',e=>qap_log('Got error: '+e.message));
  req.setNoDelay();
  var toR=z=>data=>req.write(data.length+"\0"+z+"\0"+data);
  toR("eval")(
    (()=>{
      var q=a=>toR("qap_log")("["+getDateTime()+"] :: "+a);
      q("before spawn");
      var sh=spawn('bash',['-i']);
      q("after spawn");
      pipe_from_to(sh.stderr,"err");
      pipe_from_to(sh.stdout,"out");
      q("after pipes");
      sh.on('close',code=>toR("qap_log")("bash exited with code "+code));
      sh.on('error',code=>toR("qap_log")("bash error "+code));
      q("after events linking");
      z2func['inp']=msg=>sh.stdin.write(msg);
      q("begin");
    }).toString().split("\n").slice(1,-1).join("\n")
  );
  var inp=toR("inp");inp("echo welcome!\n");
  var ping=toR("ping");var iter=0;setInterval(()=>ping(""+(iter++)),500);
  process.stdin.setRawMode(true);
  process.stdin.setEncoding('utf8');
  process.stdin.on('data',data=>{
    //if(data==='\u0003')process.exit();
    inp(data);
  });
  process.stdin.resume();
  var ps1=(()=>{
    //STARTCOLOR='\e[0;32m';
    //ENDCOLOR="\e[0m"
    //export PS1="$STARTCOLOR[\$(date +%k:%M:%S)] \w |\$?> $ENDCOLOR"
  }).toString().split("\n").slice(1,-1).join("\n").split("    //").join("");
  inp(ps1+"\n");
  
  return req;
}

var json=JSON.stringify;

xhr_shell("post",hosts[2]+"/rt_sh");
































































