const util = require('util');
const vm = require('vm');

var child_process=require('child_process');var execSync=child_process.execSync;var exec=child_process.exec;

var http = require("http"),
    https = require("https"),
    url = require("url"),
    path = require("path"),
    fs = require("fs"),
    os = require("os"),
    crypto = require('crypto');

var port = process.env.PORT || process.env.OPENSHIFT_NODEJS_PORT || 8080,
    ip   = process.env.IP   || process.env.OPENSHIFT_NODEJS_IP || '0.0.0.0',
    mongoURL = process.env.OPENSHIFT_MONGODB_DB_URL || process.env.MONGO_URL,
    mongoURLLabel = "";

var get_tick_count=()=>new Date().getTime();

var qs = require('querystring');
var g_interval=false;var g_ping_base=get_tick_count();
var g_obj={};

var qaperr_to_str=err=>err.stack.toString();

process.on('uncaughtException',err=>qap_log(qaperr_to_str(err)));

var rand=()=>(Math.random()*1024*64|0);
var qap_log=s=>console.log("["+getDateTime()+"] "+s);

var json=JSON.stringify;
var mapkeys=Object.keys;var mapvals=(m)=>mapkeys(m).map(k=>m[k]);
var inc=(m,k)=>{if(!(k in m))m[k]=0;m[k]++;return m[k];};

var FToS=n=>(n+0).toFixed(2);
var qapavg=(arr,cb)=>{if(typeof cb=='undefined')cb=e=>e;return arr.length?arr.reduce((pv,ex)=>pv+cb(ex),0)/arr.length:0;}
var qapsum=(arr,cb)=>{if(typeof cb=='undefined')cb=e=>e;return arr.reduce((pv,ex)=>pv+cb(ex),0);}
var qapmin=(arr,cb)=>{if(typeof cb=='undefined')cb=e=>e;var out;var i=0;for(var k in arr){var v=cb(arr[k]);if(!i){out=v;}i++;out=Math.min(out,v);}return out;}
var qapmax=(arr,cb)=>{if(typeof cb=='undefined')cb=e=>e;var out;var i=0;for(var k in arr){var v=cb(arr[k]);if(!i){out=v;}i++;out=Math.max(out,v);}return out;}
var qapsort=(arr,cb)=>{if(typeof cb=='undefined')cb=e=>e;return arr.sort((a,b)=>cb(b)-cb(a));}
var mapdrop=(e,arr,n)=>{var out=n||{};Object.keys(e).map(k=>arr.indexOf(k)<0?out[k]=e[k]:0);return out;}
var mapsort=(arr,cb)=>{if(typeof cb=='undefined')cb=(k,v)=>v;var out={};var tmp=qapsort(mapkeys(arr),k=>cb(k,arr[k]));for(var k in tmp)out[tmp[k]]=arr[tmp[k]];return out;}

var qap_unique=arr=>{var tmp={};arr.map(e=>tmp[e]=1);return mapkeys(tmp);};var unique_arr=qap_unique;

var mapaddfront=(obj,n)=>{for(var k in obj)n[k]=obj[k];return n;}
var mapclone=obj=>mapaddfront(obj,{});

var getarr=(m,k)=>{if(!(k in m))m[k]=[];return m[k];};
var getmap=(m,k)=>{if(!(k in m))m[k]={};return m[k];};

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

var cl_and_exec_cpp=(code)=>{
  var rnd=rand()+"";rnd="00000".substr(rnd.length)+rnd;
  var fn="main["+getDateTime().split(":").join("-").split(" ").join("_")+"]_"+rnd+".cpp";
  var out="./"+fn+".out";
  //fn=json(fn);out=json(out);
  fs.writeFileSync(fn,code);return ""+execSync("g++ -std=c++11 "+fn+" -o "+out+"\nls -l\n"+out);
}

var get_backup=()=>{
  var tmp=JSON.parse(json(g_obj));var data=json(mapdrop(mapclone(g_obj),'g_obj.json'));
  getarr(tmp,'g_obj.json').push({
    time:getDateTime(),
    hostname:os.hostname(),
    size:Buffer.byteLength(data),
    sha1:crypto.createHash('sha1').update(data).digest('hex')
  });
  return tmp;
}

var send_backup=()=>{
  var nope=()=>{};
  var fn=crypto.createHash('sha1').update(os.hostname()).digest('hex')+".json";
  var backup_servers=mapkeys(hosts).filter(e=>hosts[e]==('backup'));
  backup_servers.map(e=>
    xhr_post('http://'+e+'/vm/backup/?write&from='+os.hostname(),{fn:fn,data:json(get_backup())},nope,nope)
  );
}

var g_intervals=[];

var start_auto_backup=()=>{
  g_intervals.push(setInterval(send_backup,10*60*1000));
}
//return cl_and_exec_cpp(POST);

var xhr_get=(url,ok,err)=>{
  var req=(url.substr(0,"https".length)=="https"?https:http).get(url,(res)=>{
    var statusCode=res.statusCode;var contentType=res.headers['content-type'];var error;
    if(statusCode!==200){error=new Error('Request Failed.\nStatus Code: '+statusCode);}
    if(error){err(error.message);res.resume();return;}
    //res.setEncoding('utf8');
    var rawData='';res.on('data',(chunk)=>rawData+=chunk);
    res.on('end',()=>{try{ok(rawData);}catch(e){err(e.message);}});
  }).on('error',(e)=>{err('Got error: '+e.message);});
  return req;
}

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

var xhr_add_timeout=(req,ms)=>req.on('socket',sock=>sock.on('timeout',()=>req.abort()).setTimeout(ms));

var xhr_post=(url,obj,ok,err)=>xhr('post',url,qs.stringify(obj),ok,err);
var xhr_post_with_to=(url,obj,ok,err,ms)=>xhr_add_timeout(xhr('post',url,qs.stringify(obj),ok,err),ms);

var hosts={};var hosts_err_msg='';var need_coop_init=true;

var hosts_sync=(cb)=>{
  if(typeof cb=='undefined')cb=()=>{};
  xhr_get('https://raw.githubusercontent.com/adler3d/qap_vm/gh-pages/trash/test2017/hosts.json?t='+rand(),
    s=>{try{hosts=JSON.parse(s);}catch(e){cb('JSON.parse error:\n'+e+'\n\n'+s);}cb(s);},
    s=>{hosts_err_msg=s;cb(s);}
  );
};

hosts_sync();

var is_public=host=>hosts[host]=='public';
var is_shadow=host=>hosts[host]=='shadow';

var request_to_log_object=request=>{
  var h=request.headers;
  return {
    time:getDateTime(),
    ip:h['x-forwarded-for']||request.connection.remoteAddress,
    request_uri:request.url,
    user_agent:h["user-agent"],
    method:request.method,
    referer:h.referer,
    host:request.headers.host,
    hostname:os.hostname()
  }
};

var http_server=http.createServer((a,b)=>requestListener(a,b)).listen(port,ip);
var requestListener=(request, response)=>{
  var purl=url.parse(request.url);var uri=purl.pathname;var qp=qs.parse(purl.query);
  var filename = path.join(process.cwd(), uri);

  qap_log("url = "+purl.path);
  var contentTypesByExtension = {
    '.html': "text/html", // "/eval.html" "/eval_hljs.html"
    '.css':  "text/css",
    '.js':   "text/javascript",
    '.txt':  "text/plain",
    '.log':  "text/plain", // "/mainloop.log"
    '.mem':  "application/octet-stream",
    '.png':  "image/png"
  };
  
  var on_request_end=(cb)=>{
    var body=[];
    request.on('error',err=>console.error(err));
    request.on('data',chunk=>body.push(chunk));
    request.on('end',()=>cb(Buffer.concat(body).toString()));
  };
  response.on('error',err=>console.error(err));
  var g_logger_func=request=>{
    var f=request=>{
      var h=request.headers;
      return {
        time:getDateTime(),
        ip:h['x-forwarded-for']||request.connection.remoteAddress,
        request_uri:request.url,
        user_agent:h["user-agent"],
        method:request.method,
        referer:h.referer
      }
    };
    var arr=getarr(getmap(g_obj,'logs'),os.hostname()).push(f(request));
  };
  on_request_end((POST_BODY)=>{
    var POST=POST_BODY.length?qs.parse(POST_BODY):{};
    mapkeys(POST).map(k=>qp[k]=POST[k]);POST=qp;
    g_logger_func(request);
    var is_dir=fn=>fs.statSync(filename).isDirectory();
    fs.exists(filename,ok=>{if(ok&&is_dir(filename))filename+='/index.html';func(filename);});
    var func=filename=>fs.exists(filename,function(exists) {
      var raw_quit=()=>{setTimeout(()=>process.exit(),16);}
      var quit=()=>{raw_quit();return txt("["+getDateTime()+"] ok");}
      var png=((res)=>{var r=res;return s=>{r.writeHead(200,{"Content-Type":"image/png"});r.end(new Buffer(s,"binary"));}})(response);
      var binary=((res)=>{var r=res;return s=>{r.writeHead(200,{"Content-Type":"application/octet-stream"});r.end(new Buffer(s,"binary"));}})(response);
      var txtbin=((res)=>{var r=res;return s=>{r.writeHead(200,{"Content-Type":"text/plain"});r.end(new Buffer(s,"binary"));}})(response);
      var html=((res)=>{var r=res;return s=>{r.writeHead(200,{"Content-Type":"text/html"});r.end(s);}})(response);
      var txt=((res)=>{var r=res;return s=>{r.writeHead(200,{"Content-Type":"text/plain"});r.end(s);}})(response);
      var shadow=mapkeys(hosts)[mapvals(hosts).indexOf('shadow')];
      var shadows=mapkeys(hosts).filter(e=>hosts[e]==('shadow'));
      var master=mapkeys(hosts)[mapvals(hosts).indexOf('public')];
      var req_handler=()=>{
        response.off=()=>response={writeHead:()=>{},end:()=>{}};
        var resp_off=()=>{response.off();}
        var jstable=arr=>{
          response.off();
          //  safe_json=obj=>json(obj).split("</script>").join("<\\/script>");
          var safe_json=obj=>json(obj).split("/").join("\\/");
          var cb=data=>html(data.split("</body>").join("<script>draw("+safe_json(arr)+");</script></body>"));
          fs.readFile("json2table_fish.html",(err,data)=>{if(err)throw err;cb(""+data);})
          return;
        }; 
        var yt_title=s=>{
          response.off();
          var safe_json=obj=>json(obj).split("/").join("\\/");
          var cb=data=>html(data.split("</body>").join("<script>draw("+safe_json(s)+");</script></body>"));
          fs.readFile("yt.title.fish.html",(err,data)=>{if(err)throw err;cb(""+data);})
          return;
        }; 
        if("/g_obj.json"==uri){
          if('raw' in qp)return txt(json(g_obj));
          if('data' in qp)return json(mapdrop(mapclone(g_obj),'g_obj.json'));
          txtbin(json(get_backup()));
          return;
        }
        if("/hosts.json"==uri){
          hosts_sync(s=>txt(s));
          return;
        }
        if("/shadows_links"==uri){
          response.off();var ls='<a href="/fetch?quit">this/fetch?quit</a><hr><a href="/ls">this/ls</a>';
          return html(ls+"<hr>"+shadows.map(e=>"http://"+e+"/fetch?quit").map(e=>'<a href="'+e+'">'+e+'</a>').join("<hr>"));
        }
        var log_incdec_sumator=log=>{
          return log.map(e=>e.request_uri).map(e=>url.parse(e).pathname).
          map(e=>e=="/inc"?+1:(e=="/dec"?-1:0)).reduce((p,v)=>p+v,0);
        }
        if("/top"==uri){
          var files=g_obj.files;
          var cb=arr=>jstable(arr);
          var filter=fn=>fn.indexOf("eval/rec[")<0;
          if('all' in qp)filter=any=>any;
          if('evalrecs' in qp)filter=fn=>fn.indexOf("eval/rec[")>=0;
          if('raw' in qp)cb=arr=>txt(inspect(arr));
          if('json' in qp)cb=arr=>txt(json(arr));
          return cb(qapsort(mapkeys(files).filter(filter).map(fn=>(
            {fn:fn,mass:log_incdec_sumator(files[fn].log)}
          )),e=>e.mass));
        }
        if("/evals"==uri){
          var f=g_obj.files;
          return jstable(
            mapkeys(f).filter(e=>e.includes("eval/")).reverse().map(e=>({fn:e,log_size:f[e].log.length,code:null,data:JSON.parse(f[e].data)})).
              map(e=>mapaddfront({code:e.data.code,data:e.data.data},e))
          );
        }
        if("/hops"==uri){
          return jstable(g_obj['g_obj.json'].map(e=>e).reverse());
        }
        if("/logs"==uri){
          var m=getmap(g_obj,'logs');
          var func=e=>txt(inspect(e));
          if('json' in qp)func=e=>txt(json(e));
          if('all' in qp)return func(m);
          var func=jstable;
          if('json' in qp)func=e=>txt(json(e));
          var arr=m['hostname' in qp?qp.hostname:os.hostname()];
          return func(arr);
        }
        if("/sitemap"==uri){
          var hide="close,exit,inc,dec,del,put,get,internal,eval,tick,ping".split(",");
          var head=("<html><style>div{"+
            "position:absolute;top:10%;left:50%;margin-top:-50px;margin-left:-50px;width:100px;height:100px;"+
            "}</style><body><div><h3>"
          );
          return html(head+qap_unique(
            (fs.readFileSync("main.js")+"").split('"'+'/').map(e=>e.split('"')[0]).slice(1).filter(e=>e.length)
          ).filter(e=>hide.indexOf(e)<0).map(e=>'/'+e).map(e=>'<a href="'+e+'">'+e+'</a><br>').join("\n"));
        }
        var cmds={
          "/del":(qp,log_object)=>{
            var files=getmap(g_obj,'files');
            delete files[qp.fn];
            return json(get_tick_count());
          },
          "/put":(qp,log_object)=>{
            var f=getmap(getmap(g_obj,'files'),qp.fn);
            f.data=qp.data;
            getarr(f,'log').push(log_object);
            return json(get_tick_count());
          },
          "/get":(qp,log_object)=>{
            var files=getmap(g_obj,'files');
            if(!(qp.fn in files))return json(['not found',qp.fn]);
            var f=files[qp.fn];
            getarr(f,'log').push(log_object);
            if('raw' in qp)return ('safe' in qp?"found:\n":"")+f.data;
            if(!('full' in qp)){
              var ignore="host,hostname,method".split(",");
              f=mapclone(f);f.log=f.log.map(e=>mapdrop(e,ignore));
            }
            return json(f,null,2);
            //return json(['found at '+os.hostname(),f],null,2);
          },
          "/ls":(qp,log_object)=>{
            return mapkeys(getmap(g_obj,'files')).join("\n");
          }
        };
        ["/inc","/dec"].map(e=>(cmds[e]=(qp,log_object)=>{
          var files=getmap(g_obj,'files');
          if(!(qp.fn in files))return json(['not found',qp.fn]);
          var f=files[qp.fn];
          getarr(f,'log').push(log_object);
          return ""+log_incdec_sumator(f.log);
        }));
        var collaboration=cb=>{
          var pub=is_public(request.headers.host);var server=pub?shadow:master;
          if(!pub)return txt("coop error: request denied, because conf = not public");
          var tmp=request_to_log_object(request);
          var f=qp=>({qp:json(qp),tmp:json(tmp)});
          /*
            wrong design lead to:
            request order problem
            waiting response from all shadows problem
            any shadow crash lead to OOS
            then more shadow then more OOS
          */
          var tasks=[];var tasks_n=shadows.length;
          var on=(host,mode)=>(s=>{
            tasks.push({mode:mode,host:host,s:s});if(tasks_n!=tasks.length)return;
            if(tasks.filter(e=>e.mode=='ok').length==tasks_n){
              cb(tasks,tmp);
            }else txt('coop_fail:\n'+inspect(tasks));// but on some shadows server requests performed...
          });
          if(!tasks_n)cb(tasks,tmp);
          shadows.map(e=>xhr_post_with_to('http://'+e+'/internal?from='+os.hostname()+'&url='+uri,f(qp),on(e,'ok'),on(e,'fail'),1000*5));
          return;
        };
        var coop=collaboration;
        if("/internal"==uri)((params)=>{
          var qp=JSON.parse(params.qp);
          var tmp=JSON.parse(params.tmp);var log_object=tmp;
          var uri=url.parse(tmp.request_uri).pathname;
          if(uri in cmds){return txt(cmds[uri](qp,log_object));}
          return txt("error: unknow cmd - '"+uri+"'");
        })(qp);
        var arrjoin=(a,b)=>a[0];
        if(uri in cmds){
          var need_png=false;if('fn' in qp)if('raw' in qp)if(!('safe' in qp))need_png=qp.fn.split('.').slice(-1)[0]=='png';
          var func=need_png?png:txt;
          if('binary' in qp)func=binary;
          if('bin' in qp)func=binary;
          if('html' in qp)func=html;
          if('txtbin' in qp)func=txtbin;
          return coop(
            (arr,log_object)=>func(
              //arrjoin(
              //  [
                  cmds[uri](qp,log_object)
              //  ],
              //  arr
              //)
            )
          );
        }
        if("/hostname"==uri){return txt(os.hostname());}
        if("/fetch"==uri){
          (()=>{
            var repo="https://raw.githubusercontent.com/gitseo/vm/master/";
            if('git' in qp)
            {
              var run=cmd=>execSync(cmd)+"";
              var f=cmd=>run(cmd).split("\n").map(e=>e.substr("vm/".length)).filter(e=>e.length);
              var out=[
                run(`rm -rf vm`),
                run(`git clone https://github.com/gitseo/vm.git`),
                f("find vm/* -type d").map(e=>"mkdir -p "+e).map(run).join("\n"),
                f("find vm/* -type f").map(e=>"cp vm/"+e+" "+e).map(run).join("\n"),
                run(`rm -rf vm`),
                execSync("ls -lh"),
                ""
              ];
              if('quit' in qp)raw_quit();
              return out.join("\n\n");
            }
            var fn=('fn' in qp)?qp.fn:"main.js";
            xhr_get(repo+fn+'?t='+rand(),s=>{
              fs.writeFileSync(fn,s);
              txt("["+getDateTime()+"] fetch done //length = "+Buffer.byteLength(s));
              if('quit' in qp)raw_quit();
            },txt);
          })();
          return;
        }
        if("/rollback"==uri){fs.unlinkSync("fast_unsafe_auto_restart_enabled.txt");quit();}
        if("/close"==uri||"/quit"==uri||"/exit"==uri)quit();
        if("/"==uri)return txt("count = "+inc(g_obj,'counter'));
        if("/yt.title"==uri){
          response.off();response.off=()=>{};
          xhr("GET","https://www.youtube.com/get_video_info?video_id="+qp.v,"",
            yt_title,s=>txt("yt.title('failed')\n"+s)
          );
          return;
        }
        if("/tick"==uri){g_ping_base=get_tick_count();return txt("tick = "+inc(g_obj,'tick'));}
        if("/ping"==uri){g_ping_base=get_tick_count();return txt(getDateTime());}
        if("/eval"==uri){
          var impl=()=>{
            try{
              var system_tmp=eval("()=>{"+POST['code']+"\n;return '';}");
              system_tmp=system_tmp();
              if(response){
                response.writeHead(200, {"Content-Type": "text/plain"});
                response.end(system_tmp);
                return;
              }
            }catch(err){
              response.writeHead(500, {"Content-Type": "text/plain"});
              response.end("Internal Server Error:\n"+qaperr_to_str(err));
              console.error(err);
              return;
            }
          };
          if('nolog' in qp)return impl();
          var rnd=rand()+"";rnd="00000".substr(rnd.length)+rnd;
          var rec="http://"+master+'/put?fn=eval/rec['+getDateTime()+"]"+rnd+"_"+os.hostname()+".json";
          xhr_post(rec,{data:json({code:qp.code,data:qp.data})},impl,err=>txt('rec_error:\n'+err));
          return;
        }
        if(!exists) {
          response.writeHead(404, {"Content-Type": "text/plain"});
          response.end("404 Not Found\n");
          return;
        }
        fs.readFile(filename, "binary", function(err, file) {
          if(err) {
            response.writeHead(500, {"Content-Type": "text/plain"});
            response.end(err + "\n");
            return;
          }
          var headers = {};
          var contentType = contentTypesByExtension[path.extname(filename)];
          if (contentType) headers["Content-Type"] = contentType;
          response.writeHead(200, headers);
          response.write(file, "binary");
          response.end();
        });
      };
      if(need_coop_init){
        need_coop_init=false;
        var pub=is_public(request.headers.host);var none=()=>{};
        if(g_interval){clearInterval(g_interval);g_interval=false;}
        var period=1000*30;var net_gap=1000*10;
        if(!pub){
          g_interval=setInterval(()=>{
            var ctc=get_tick_count();
            if(ctc-g_ping_base<=period+net_gap)return;
            g_ping_base=ctc;
            xhr_post('http://'+master+'/ping?from='+os.hostname(),{},none,none);
          },1000);
        }
        var send_tick_to_shadows=()=>{
          shadows.map(e=>xhr_post('http://'+e+'/tick?from='+os.hostname(),{},none,none));
        };
        if(pub)g_interval=setInterval(send_tick_to_shadows,period);
        var server=pub?shadow:master;
        xhr_post('http://'+server+'/g_obj.json?from='+os.hostname(),{},s=>{g_obj=JSON.parse(s);req_handler();},s=>txt('coop_init_fail:\n'+s));
        return;
      }
      req_handler();
    });
  });
}
qap_log("Static file server running at http://localhost:"+port);
qap_log("CTRL + C to shutdown");
