const util = require('util');
const vm = require('vm');
const assert=require('assert');

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

var port = process.env.PORT || process.env.OPENSHIFT_NODEJS_PORT || 8080,
    ip   = process.env.IP   || process.env.OPENSHIFT_NODEJS_IP || '0.0.0.0',
    mongoURL = process.env.OPENSHIFT_MONGODB_DB_URL || process.env.MONGO_URL,
    mongoURLLabel = "";

var get_tick_count=()=>new Date().getTime();
var get_ms=()=>{var a=process.hrtime();return a[0]*1e3+a[1]/1e6;}
var unixtime=()=>(new Date()/1000);

var g_interval=false;var g_ping_base=get_tick_count();
var g_obj={};

var QapNoWay=()=>{qap_log("QapNoWay :: no impl");qap_log("no way");}

var call_cb_on_err=(emitter,cb,...args)=>{
  emitter.on('error',err=>{
    cb("'inspect({args,err}) // stack': "+inspect({args:args,err:err})+" // "+err.stack.toString());
  });
}

var qap_err=(context,err)=>context+" :: err = "+inspect(err)+" //"+err.stack.toString();
var log_err=(context,err)=>qap_log(qap_err(context,err));

process.on('uncaughtException',err=>log_err('uncaughtException',err));

var rand=()=>(Math.random()*1024*64|0);
var qap_add_time=s=>"["+getDateTime()+"] "+s;
var qap_log=s=>console.log(qap_add_time(s));

var json=JSON.stringify;
var mapkeys=Object.keys;var mapvals=(m)=>mapkeys(m).map(k=>m[k]);
var inc=(m,k)=>{if(!(k in m))m[k]=0;m[k]++;return m[k];};

var FToS=n=>(n+0).toFixed(2);
var mapswap=(k2v)=>{var v2k={};for(var k in k2v){v2k[k2v[k]]=k;}return v2k;}
var qapavg=(arr,cb)=>{if(typeof cb=='undefined')cb=e=>e;return arr.length?arr.reduce((pv,ex)=>pv+cb(ex),0)/arr.length:0;}
var qapsum=(arr,cb)=>{if(typeof cb=='undefined')cb=e=>e;return arr.reduce((pv,ex)=>pv+cb(ex),0);}
var qapmin=(arr,cb)=>{if(typeof cb=='undefined')cb=e=>e;var out;var i=0;for(var k in arr){var v=cb(arr[k]);if(!i){out=v;}i++;out=Math.min(out,v);}return out;}
var qapmax=(arr,cb)=>{if(typeof cb=='undefined')cb=e=>e;var out;var i=0;for(var k in arr){var v=cb(arr[k]);if(!i){out=v;}i++;out=Math.max(out,v);}return out;}
var qapsort=(arr,cb)=>{if(typeof cb=='undefined')cb=e=>e;return arr.sort((a,b)=>cb(b)-cb(a));}
var mapdrop=(e,arr,n)=>{var out=n||{};Object.keys(e).map(k=>arr.indexOf(k)<0?out[k]=e[k]:0);return out;}
var mapsort=(arr,cb)=>{if(typeof cb=='undefined')cb=(k,v)=>v;var out={};var tmp=qapsort(mapkeys(arr),k=>cb(k,arr[k]));for(var k in tmp)out[tmp[k]]=arr[tmp[k]];return out;}
var table_fix_fields=arr=>{var n2keys=[];arr.map(e=>n2keys[mapkeys(e).length]=mapkeys(e));var order=n2keys.pop();return arr.map(e=>{var m={};order.map(k=>m[k]=k in e?e[k]:0);return m;});};

var qap_unique=arr=>{var tmp={};arr.map(e=>tmp[e]=1);return mapkeys(tmp);};var unique_arr=qap_unique;

var mapaddfront=(obj,n)=>{for(var k in obj)n[k]=obj[k];return n;}
var mapclone=obj=>mapaddfront(obj,{});

var getarr=(m,k)=>{if(!(k in m))m[k]=[];return m[k];};
var getmap=(m,k)=>{if(!(k in m))m[k]={};return m[k];};
var getdef=(m,k,def)=>{if(!(k in m))m[k]=def;return m[k];};
var clone_map_but_add_prefix_to_keys=(m,prefix)=>{var out={};for(var k in m)out[prefix+k]=m[k];return out;}
var keys_with_prefix=clone_map_but_add_prefix_to_keys;

var qap_foreach_key=(obj,cb)=>{for(var k in obj)cb(obj,k,obj[k]);return obj;}

var arrmapdrop=(arr,keys)=>arr.map(e=>mapdrop(e,keys));
var mapgetdef=(m,k,def)=>((k in m)?m[k]:def);
var qapclone=obj=>JSON.parse(JSON.stringify(obj));

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

var escapeHtml=s=>{
  if("string"!==(typeof s)){return s;}
  return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
}
var maps2table_impl=(table)=>{
  function skip_field(field){
    var ignore=[];//["user_agent","request_uri","referrer"];
    for(var key in ignore)if(ignore[key]==field){return true;}
    return false;
  };
  //var def_table=[{'id':1,'nick':'Owen'},{'id':2,'nick':'Kyle'}];
  if(!table.length){return 'table is empty';}
  var km={};for(var i=0;i<table.length;i++){var ex=table[i];for(var k in ex){inc(km,k);}}
  var arr=Object.keys(km);
  if(!arr.length){return 'table look like empty: '+json({"table.keys.length":arr.length,"table.length":table.length});}
  var out="";var head="";
  for(var i in arr)
  {
    if(skip_field(arr[i]))continue;
    out+='<td>'+escapeHtml(arr[i])+'</td>';
  }
  var head='<thead><tr>'+out+'</tr></thead>';
  out="";
  for(var i=0;i<table.length;i++)
  {
    var tmp="";
    //var tmp_arr=table[table.length-i-1];
    var tmp_arr=table[i];
    for(var j=0;j<arr.length;j++){
      //if(skip_field(key))continue;
      var k=arr[j];var v="<b>0</b>";var bg="";
      if(k in tmp_arr){v=escapeHtml(tmp_arr[k]);}else{/*bg='class="bgw"';*/}
      tmp+='<td>'+v+'</td>';
    }
    out+='<tr>'+tmp+'</tr>';
  }
  out='<table>'+head+'<tbody>'+out+'</tbody></table>';
  return out;
}
var gen_maps2table_style=dtm=>`<style>
  @dtm tr:nth-child(2n){background:#FEFEFE;}
  @dtm table{border-collapse:collapse;font-size:10pt;text-align:right}
  @dtm td,th,thead{border:1px solid #bbb;padding:4px;}
  @dtm th,thead{text-align:center;font-weight:bold;background:#ccc;}
</style>`.split("@dtm").join('undefined'===typeof dtm?"div.table_main":dtm);

var with_style_for_center_pre_div_table=(str,dc)=>{
  dc='undefined'===typeof dc?'table_main':dc;
  var s=gen_maps2table_style("div."+dc);
  return s+'<center><pre><div class="'+dc+'">'+str+'</div></pre></center>';
}

var maps2table=(table,dc)=>{return with_style_for_center_pre_div_table(maps2table_impl(table),dc);};
var maps2csv=arr=>{var h=mapkeys(arr[0]);return h.join(",")+"\n"+arr.map(e=>h.map(k=>e[k]).join(",")).join("\n");}
var parse_csv=(s,sep)=>{var t=s.split("\r").join("").split("\n").map(e=>e.split('undefined'===typeof sep?",":sep));return t;}
var parse_csv_with_head=(s,sep)=>{
  var t=parse_csv(s,sep);
  var pcsv={head:t[0],arr:t.slice(1)};
  pcsv.get=(y,key)=>pcsv.arr[y][pcsv.head.indexOf(key)];
  return pcsv;
}
var parsed_csv2maps=csv=>csv.arr.map(e=>{var out={};csv.head.map((k,id)=>out[k]=e[id]);return out;});
var pcsv2table_impl=(pcsv,cb)=>{
  cb="undefined"!==typeof cb?cb:(str,pos,pcsv,arr)=>escapeHtml(str);
  var h=pcsv.head;
  var out=h.map((e,id)=>"<td>"+cb(e,{t:'h',y:0,x:id},pcsv,h)+"</td>").join("");
  var head='<thead><tr>'+out+'</tr></thead>';
  out=pcsv.arr.map((arr,y)=>{
    return h.map((key,id)=>id<arr.length?cb(arr[id],{t:'b',y:y,x:id,key:key},pcsv,arr):"<b>0</b>").map(e=>"<td>"+e+"</td>").join("");
  });
  out=out.map(e=>"<tr>"+e+"</tr>").join("");
  return '<table>'+head+'<tbody>'+out+'</tbody></table>';
}
var pcsv2table=(pcsv,cb)=>{
  //var cb=(str,pos,pcsv,arr)=>{if(0)escapeHtml(str);return "<b>"+escapeHtml(json(pos))+"</b>";};
  return with_style_for_center_pre_div_table(pcsv2table_impl(pcsv,cb));
}
var csv2table=(str,sep,cb)=>{
  //var cb=(str,pos,pcsv,arr)=>{if(0)escapeHtml(str);return "<b>"+escapeHtml(json(pos))+"</b>";};
  var pcsv=parse_csv_with_head(str,sep);
  return pcsv2table(pcsv,cb);
}
var pcsv2csv=(pcsv,sep)=>{
  sep='undefined'===typeof sep?",":sep;
  return pcsv.head.join(sep)+"\n"+pcsv.arr.map(e=>e.join(sep)).join("\n");
}
var pcsv2table_impl_v2=(pcsv,cb)=>{
  cb=("undefined"!==typeof cb)&&cb?cb:(str,pos,pcsv,arr,td,tag,bg,rg)=>td(escapeHtml(str));
  var tag=(t,s)=>'<'+t+'>'+s+'</'+t.split(" ")[0]+'>';var td=s=>tag('td',s);
  var bg=(r,g,b,str)=>'<td style="background-color:rgb('+r+','+g+','+b+');">'+str+'</td>';
  var wr=(c,str)=>bg(0xff,c,c,str);var wg=(c,str)=>bg(c,0xff,c,str);
  var rg=(v,str,max,base)=>{max=max?max:12.8;base=base?base:128;return (v<0?wr:wg)((Math.max(0.0,1.0-Math.abs(v)/max)*(0xff-base)+base)|0,str);}
  var h=pcsv.head;
  var head=h.map((e,id)=>cb(e,{t:'h',y:0,x:id,key:e},pcsv,h,td,tag,bg,rg)).join("");
  var out=pcsv.arr.map((arr,y)=>{
    return h.map((key,id)=>id<arr.length?cb(arr[id],{t:'b',y:y,x:id,key:key},pcsv,arr,td,tag,bg,rg):"<b>0</b>").join("");
  });
  out=out.map(e=>"<tr>"+e+"</tr>").join("");
  return tag('table',tag('thead',tag('tr',head))+tag('tbody',out));
}
var pcsv2table_v2=(pcsv,cb)=>{
  pcsv.get=(y,key)=>pcsv.arr[y][pcsv.head.indexOf(key)];
  return with_style_for_center_pre_div_table(pcsv2table_impl_v2(pcsv,cb));
}

var getDateTime=t=>{
  var now     = typeof t==='number'?new Date(t):new Date();
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

var toHHHMMSS=s=>[s/3600,s/60,s].map(x=>x|0).map((x,i)=>i?x%60:x).map(v=>v<10?"0"+v:v).filter((v,i)=>v!=="00"||i>0).join(":");

var func_to_var_decl=func=>"var "+func+"="+eval("("+func+").toString()")+";\n";

var parse_datetime=s=>{
  var t=s.split(' ');var ymd=t[0].split('.');var hms=t[1].split(':');
  return new Date(ymd[0],ymd[1],ymd[2],hms[0],hms[1],hms[2]);
}
//parse_datetime("20.03.01 13:08:20");

var parse_wmdatetime=s=>{
  var t=s.split(' ');var ymd=t[0].split('.').reverse();var hms=t[1].split(':');
  return new Date(ymd[0],ymd[1],ymd[2],hms[0],hms[1],hms[2]);
}
//parse_wmdatetime("28.02.2018 18:42:43");

var emitter_on_data_decoder=(emitter,cb)=>{
  var rd=Buffer.from([]);
  var err=qap_log;
  emitter.on('data',data=>{
    rd=Buffer.concat([rd,data]);
    var e=rd.indexOf("\0");
    if(e<0)return;
    var en=e+1;
    var zpos=rd.indexOf('\0',en);
    if(zpos<0)return;
    var zn=zpos+1;
    var blen=rd.slice(0,e);
    var len=blen.toString("binary")|0;
    if(!Buffer.from((len+"").toString("binary")).equals(blen)){
      err("error chunk.len is not number: "+json({as_buff:blen,as_str:blen.toString("binary")}));
    }
    if(rd.length<zn+len)return;
    var bz=rd.slice(en,en+zpos-en);var z=bz.toString("binary");
    var bmsg=rd.slice(zn,zn+len);var msg=bmsg.toString("binary");
    rd=rd.slice(zn+len);
    cb(z,msg,bz,bmsg);
  });
}

var stream_write_encoder=(stream,z)=>data=>{
  var sep=Buffer.from([0]);
  stream.write(Buffer.concat([
    Buffer.from(!data?"0":(data.length+""),"binary"),sep,
    Buffer.from(z,"binary"),sep,
    Buffer.from(data?data:"","binary")
  ]));
};

var cl_and_exec_cpp=(code,async_cb,flags)=>{
  var rnd=rand()+"";rnd="00000".substr(rnd.length)+rnd;
  var fn="main["+getDateTime().split(":").join("-").split(" ").join("_")+"]_"+rnd+".cpp";
  var out="./"+fn+".out";
  //fn=json(fn);out=json(out);
  fs.writeFileSync(fn,code);
  var cmdline="g++ "+(flags?flags:"")+"-Wmultichar -fpermissive -DQAP_DEBUG -std=c++11 "+fn+" -O2 -o "+out+"\n"+out;
  if(async_cb){
    if((typeof async_cb)!="function")async_cb=()=>{};
    var proc=exec(cmdline,async_cb);
    return "async...";
  }
  return ""+execSync(cmdline);
}

var get_backup=()=>{
  var tmp=JSON.parse(json(g_obj));var data=json(mapdrop(mapclone(g_obj),'g_obj.json'));
  getarr(tmp,'g_obj.json').push({
    time:getDateTime(),
    hostname:os.hostname(),
    host:g_conf_info.last_request_host,
    size:Buffer.byteLength(data),
    sha1:crypto.createHash('sha1').update(data).digest('hex')
  });
  return tmp;
}

var get_hosts_by_type=type=>mapkeys(hosts).filter(e=>hosts[e]==type);

var send_backup=(force)=>{
  if('inp' in g_conf){
    if(!force&&g_conf.inp.without_backup.split("|").includes(g_conf.vhost))return;
  }
  var nope=()=>{};
  var fn=crypto.createHash('sha1').update(os.hostname()).digest('hex')+".json";
  var backup_servers=get_hosts_by_type('backup');
  backup_servers.map(e=>
    xhr_post('http://'+e+'/vm/backup/?write&from='+os.hostname(),{fn:fn,data:json(get_backup())},nope,nope)
  );
}

var chmodx=fn=>{var fd=fs.openSync(fn,"r");fs.fchmodSync(fd,33216);fs.close(fd);};

var g_intervals=[];

var set_interval=(func,ms)=>{
  g_intervals.push({data:getDateTime(),func:func,ref:setInterval(func,ms)});
  return g_intervals.slice(-1)[0];
}

var clear_interval=(ref)=>{
  clearInterval(ref.ref);g_intervals.splice(g_intervals.indexOf(ref),1);
}

var start_auto_backup=()=>{
  set_interval(send_backup,10*60*1000);
}
//return cl_and_exec_cpp(POST);

var ee_logger=(emitter,name,events)=>{
  events.split(',').map(event=>emitter.on(event,e=>qap_log(name+' :: Got '+event)));
}

var ee_logger_v2=(emitter,name,cb,events)=>{
  events.split(',').map(event=>emitter.on(event,e=>cb(name+' :: Got '+event)));
  call_cb_on_err(emitter,cb,name);
}

var xhr_get=(URL,ok,err)=>{
  if((typeof ok)!="function")ok=()=>{};
  if((typeof err)!="function")err=()=>{};
  var secure=['https:','https'].includes(url.parse(URL).protocol);
  var req=(secure?https:http).get(URL,(res)=>{
    var cb=ok;
    if(res.statusCode!==200){cb=(s,res)=>err('Request Failed.\nStatus Code: '+res.statusCode+'\n'+s);}
    //res.setEncoding('utf8');
    var rawData='';res.on('data',(chunk)=>rawData+=chunk.toString("binary"));
    res.on('end',()=>{try{cb(rawData,res);}catch(e){err(qap_err('xhr_get.mega_huge_error',e),res);}});
  });
  call_cb_on_err(req,qap_log,'xhr_get');
  return req;
}

var xhr_get_gzip=(URL,ok,err)=>{
  if((typeof ok)!="function")ok=()=>{};
  if((typeof err)!="function")err=()=>{};
  var headers={'accept-encoding':'gzip,deflate'};
  var up=mapaddfront(url.parse(URL),{headers:headers});
  var secure=['https:','https'].includes(up.protocol);
  var req=(secure?https:http).get(up,(res)=>{
    var cb=ok;
    var rawData='';
    if(res.statusCode!==200){cb=(s,res)=>{err('Request Failed.\nStatus Code: '+res.statusCode+'\n'+s+'\n\n'+inspect(res.headers));}}
    var ce=res.headers['content-encoding'];
    var stream=res;
    if(ce=='gzip'){stream=res.pipe(require('zlib').createGunzip());}
    if(ce=='deflate'){stream=res.pipe(require('zlib').createInflate());}
    stream.on('data',(chunk)=>rawData+=chunk.toString("utf8"));
    stream.on('end',()=>{try{cb(rawData,res);}catch(e){err(qap_err('xhr_get.mega_huge_error',e),res);}});
  });
  call_cb_on_err(req,qap_log,'xhr_get');
  return req;
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

var xhr_add_timeout=(req,ms)=>req.on('socket',sock=>sock.on('timeout',()=>req.abort()).setTimeout(ms));

var xhr_post=(url,obj,ok,err)=>xhr('post',url,qs.stringify(obj),ok,err);
var xhr_post_with_to=(url,obj,ok,err,ms)=>xhr_add_timeout(xhr('post',url,qs.stringify(obj),ok,err),ms);

var axhr_get=(url,ud)=>{
  return new Promise((ok,err)=>xhr_get(url,
    s=>ok((typeof ud)==="undefined"?s:{ud:ud,data:s}),
    s=>err(new Error('axhr_get::'+inspect({url:url,userdata:ud,response_body:s})))
  ));
}

var axhr_post=(url,obj,ud)=>{
  return new Promise((ok,err)=>xhr_post(url,obj,
    s=>ok((typeof ud)==="undefined"?s:{obj:obj,ud:ud,data:s}),
    s=>err(new Error('axhr_post::'+inspect({obj:obj,url:url,userdata:ud,response_body:s})))
  ));
}

var split_stream=(stream,sep,cb,end)=>{
  if((typeof sep)!=typeof '')sep="\n";
  if((typeof cb)!='function')throw Error('no way. // wrong callback');
  if((typeof end)!='function')end=()=>{};
  var buff='';
  stream.on('data',s=>{
    var arr=(buff+s).split(sep);buff=arr.pop();arr.map(cb);
  }).on('end',s=>{if(buff.length)cb(buff);end();})
}

var split_reader=(fn,sep,cb,end)=>split_stream(fs.createReadStream(fn,'binary'),sep,cb,end);

var hosts={};var hosts_err_msg='';var need_coop_init=true;

var hosts_update=hosts=>{
  var conv=x=>{
    var out={power:{},host2vh:{},public:[]};
    for(var host in x.host2str){var a=x.host2str[host].split("|");out.host2vh[host]=a[0];out.power[a[0]]=a[1];}
    out.public=x.public.split("|").map(e=>mapswap(out.host2vh)[e]);
    mapkeys(x.host2str).map(k=>{if(out.public.includes(k))return;out.public.push(k);});
    return out;
  };
  hosts.main_out=conv(hosts.main);
  var src=hosts.main_out;
  src.inp=hosts.main;
  mapkeys(src).map(key=>g_conf[key]=src[key]);
  g_conf.vh2host=mapswap(src.host2vh);
  update_g_conf();
  qap_log("mapkeys(g_conf.power) = "+mapkeys(g_conf.power).join(","));
  return hosts;
};

var hosts_sync=(cb)=>{
  if((typeof cb)!="function")cb=()=>{};
  xhr_get('https://raw.githubusercontent.com/adler3d/qap_vm/gh-pages/trash/test2017/hosts.json?t='+rand(),
    s=>{try{hosts=JSON.parse(s);hosts=hosts_update(hosts);}catch(e){cb(qap_err('hosts_sync',e)+'\n\n'+s);}cb(s);},
    s=>{hosts_err_msg=s;cb(s);}
  );
};

hosts_sync();

var on_start_sync=()=>{
  if((typeof cb)!="function")cb=()=>{};
  xhr_get('https://raw.githubusercontent.com/gitseo/vm/master/on_restart.js?t='+rand(),
    s=>{fs.writeFileSync("on_restart.js",s);eval(s);},
    s=>{fs.writeFileSync("on_restart.js.errmsg",s);}
  );
};

if(!process.argv.includes("no_sync"))on_start_sync();

var update_g_conf=()=>
{
  var c=g_conf;
  c.arr=mapkeys(c.host2vh).map(e=>{var vh=c.host2vh[e];return {host:e,vh:vh,p:c.power[vh]};});
  c.update_pos();
};

var g_conf_info={vhost:null,need_init:true,power:{},host2vh:{},vh2host:{},last_request_host:"empty",wm_ids_src:{}};
var g_conf=g_conf_info;

g_conf_info.set_vhost_from_host=host=>{
  var c=g_conf_info;
  if(!(host in c.host2vh)){
    qap_log("hm... unk host = "+host);
  }
  c.vhost=c.host2vh[host];
  qap_log("vhost = "+c.vhost);
  c.on_set_vhost();
}

g_conf_info.update_pos=()=>{
  var c=g_conf_info;
  var tot=0;for(var vh in c.power)tot+=c.power[vh]|0;
  var vh2pos={};
  var pos=0;
  for(var vh in c.power){vh2pos[vh]=pos;pos+=c.power[vh]/tot;}
  c.tot=tot;
  c.vh2pos=vh2pos;
  c.arr.map(e=>e.pos=vh2pos[e.vh]);
}

g_conf_info.on_set_vhost=()=>{
  var mask_id_pos=0;var c=g_conf_info;
  var is_worker=(c.vhost in c.power)&&(c.power[c.vhost]>0);
  var pub=get_hosts_by_type('public')[0];
  xhr_get(with_protocol(pub)+'/put?fn=/vhosts/'+c.vhost+'&data='+os.hostname(),()=>{},()=>{});
  if(c.last_request_host!==pub){
    var pub_lost=true;
    var connect_to_pub=()=>{
      qap_log('connect_to_pub');
      pub_lost=false;
      exec("node shell.js api=duplex host="+get_hosts_by_type('public')[0]+" task=nope",()=>{pub_lost=true;});
    }
    //set_interval(()=>{if(!pub_lost)return;connect_to_pub();},10*1000);
  }
  if(c.vhost in c.wm_ids_src){
    setTimeout(
      ()=>xhr_get(with_protocol(c.last_request_host)+'/c/run_logging.js?sure&json&ids='+c.wm_ids_src[c.vhost],()=>{},qap_log),
      5*1000
    );
  }
  fs.writeFileSync("vhost.txt",c.vhost);
  fs.writeFileSync("mask_id_pos.txt",is_worker?c.vh2pos[c.vhost]:0);
  if(is_worker)
  {
    fs.writeFileSync("WORKER.txt","");
    fs.writeFileSync("WORKER_"+c.vhost+".txt","");
    return;
    var cmd=[
      "curl "+c.vh2host.us+"/mask_basepix_log.txt>mask_basepix_log.txt",
      "curl "+c.vh2host.us+"/app.cpp>app.cpp",
      "curl "+c.vh2host.us+"/app.cpp.out>app.cpp.out",
      "chmod +x ./app.cpp.out",
      "curl "+c.vh2host.us+"/app.zip>app.zip",
      "unzip app.zip",
      "nohup nice -n15 ./app.cpp.out|tee app.log",
      "echo exit status = $?"
    ].join("\n");
    fs.writeFileSync("worker.sh",cmd);

    exec("chmod +x worker.sh\n./worker.sh|tee worker.log");
  }else{
    fs.writeFileSync("NOT_WORKER.txt","");
    fs.writeFileSync("NOT_WORKER_"+c.vhost+".txt","");
  }
};

var do_rollback_workers=()=>{
  var c=g_conf_info;
  c.arr.map((e,i)=>{
    if(!e.p)return;
    setTimeout(()=>xhr_get(with_protocol(e.host)+'/rollback',qap_log,qap_log),i*2000);
  });
};

var dyn_host=()=>{
  /*
  //run it on up
  var arr=get_def_list_of_host();
  arr.map
  e is t_host
  xhr_get("http://"+e.host+""
  now u need to pass over 
  */
}

var about_links=()=>{
/*
links:
  cpp_app -> w.js::w_to_us_serv // without protocol. just stream
  w.js -> us.js // http+rt_sh. w.js::w_to_us_serv.on_client_data=s=>us.toR('from_cpp')(s); // toR('cpp_app_up')();toR('cpp_app_down')();
  us.js::z2func.from_cpp=msg=>check_decode_store_and_maybe_send_to_human(msg,worker_vhost);
*/
};

var run_cpp_app=()=>{
  
};

var run_app_server=()=>{
  
};

var is_public=host=>hosts[host]=='public';
var is_shadow=host=>hosts[host]=='shadow';

var with_protocol=host=>{
  assert(!url.parse(host).protocol);
  var c=g_conf;
  if(!(host in c.host2vh))return host;
  var vh=c.host2vh[host];
  var a=['http://','https://'];
  return a[c.inp.without_https.includes(vh)?0:1]+host;
}; 

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
// TODO: think about bad story when: server got request, but hosts.json in loading stage...
var http_server=http.createServer((a,b)=>requestListener(a,b)).listen(port,ip);
var g_http_server_debug=true;var g_err_socks={};var g_err_socks_func=(err,socket)=>{
  if(inspect(socket.address())=="{}")return;
  var info={};(
    "bufferSize,bytesRead,bytesWritten,connecting,"+
    "destroyed,localAddress,localPort,remoteAddress,remotePort"
  ).split(",").map(e=>info[e]=socket[e]);
  var all={err:err,socket:info,incoming_headers:socket.parser.incoming.headers};
  getarr(g_err_socks,json(err)).push(all);
  var short_info={
    ip:all.incoming_headers["x-forwarded-for"],
    err:err,bytesRead:info.bytesRead,bytesWritten:info.bytesWritten
  };
  qap_log("http_server::on_clientError : "+json(short_info));
};
http_server.on('clientError',(err,socket)=>{
  socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
  if(!g_http_server_debug)return;
  g_err_socks_func(err,socket);
});

var g_mp_upload_cb=(err,fields,files,request,response,txt)=>{txt(inspect({t:getDateTime(),fields:fields,files:files,err:err}));}
var g_links={};
var gen_link_id=()=>{return rand()+" "+getDateTime();}
var new_link=()=>{var out={id:gen_link_id()};g_links[out.id]=out;return out;}

var requestListener=(request,response)=>{
  var purl=url.parse(request.url);var uri=purl.pathname;var qp=qs.parse(purl.query);
  var filename = path.join(process.cwd(), uri);

  qap_log("url = "+purl.path);
  
  if("/rt_sh"==uri)
  {
    if(!('no_head' in qp)){
      response.writeHead(200,{
        "Content-Type":"text/plain",
        'Transfer-Encoding':'chunked',
        'X-Content-Type-Options':'nosniff',
        'Cache-Control':'no-transform'
      });
    }
    var toR=z=>stream_write_encoder(response,z);
    var ping=toR("ping");var iter=0;var ping_interval=set_interval(()=>ping(""+(iter++)),500);
    //toR("log")("["+getDateTime()+"] :: hi");
    var on_exit_funcs=[];
    var on_exit=()=>{
      if(!ping_interval)return;
      clear_interval(ping_interval);ping_interval=false;
      on_exit_funcs.map(f=>f());
      request.destroy();
      response.destroy();
    }
    var fromR=(z,msg,bz,bmsg)=>{if(z in z2func)z2func[z](msg,bmsg);};
    var mem={};
    var z2func={
      eval:msg=>{
        try{
          var system_tmp=eval("()=>{"+msg+"\n;return;}");
          system_tmp();
          return;
        }catch(err){
          QapNoWay();
          response.writeHead(500,{"Content-Type":"text/plain"});
          qap_log(qap_err("rt_sh.eval.msg",err));
          response.end(qap_err("rt_sh.eval.msg",err));
          on_exit();
          return;
        }
      }
    };
    emitter_on_data_decoder(request,fromR);
    ee_logger_v2(request,'rt_sh.request',qap_log,'end,abort,aborted,connect,continue,response,upgrade');
    ee_logger_v2(response,'rt_sh.response',qap_log,'end,abort,aborted,connect,continue,response,upgrade');
    request.on('aborted',on_exit);
    response.on('aborted',on_exit);
    return;
  }
  var contentTypesByExtension={
    '.html': "text/html", // "/eval.html" "/eval_hljs.html"
    '.css':  "text/css",
    '.js':   "text/javascript",
    '.txt':  "text/plain",
    '.php':  "text/plain",
    '.json':  "text/plain",
    '.log':  "text/plain", // "/mainloop.log"
    '.mem':  "application/octet-stream",
    '.bin':  "application/octet-stream",
    '.png':  "image/png",
    '.svg':  "image/svg+xml",
    '.ico':  "image/x-icon",
    '.zip':  "application/zip",
    '.tar':  "application/x-tar",
    '.tgz':  "application/octet-stream",
    '.gz':  "application/gzip"
  };
  var on_request_end=(cb)=>{
    var body=[];
    call_cb_on_err(request,qap_log,'http_server.requestListener.on_request_end');
    request.on('data',chunk=>body.push(chunk));
    request.on('end',()=>cb(Buffer.concat(body).toString()));
  };
  call_cb_on_err(response,qap_log,'http_server.requestListener');
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
  var check_upload=()=>{
    var ct="content-type";
    if(!(ct in request.headers))return false;
    var ctv=request.headers[ct];
    //qap_log(inspect({ctv:ctv,uri:uri,method:request.method}));
    if(!ctv.toLowerCase().startsWith("multipart/form-data;"))return false;
    if("/upload"!==uri)return false;
    if("POST"!==request.method.toUpperCase())return false;
    return true;
  }
  if(check_upload())
  {
    // upload script: curl -F "field=value" -F "file=@file_name.mp4" http://localhost:8080/upload
    g_logger_func(request);
    var multiparty=require('multiparty');
    var uploadDir="dir" in qp?qp.dir:"./";
    var form=new multiparty.Form({uploadDir:uploadDir});
    var txt=((res)=>{var r=res;return s=>{r.writeHead(200,{"Content-Type":"text/plain"});r.end(s);}})(response);
    form.parse(request,(err,fields,files)=>{
      g_mp_upload_cb(err,fields,files,request,response,txt);
    });
    return;
  }
  on_request_end((POST_BODY)=>{
    g_conf_info.last_request_host=request.headers.host;
    var POST=POST_BODY.length?qs.parse(POST_BODY):{};
    mapkeys(POST).map(k=>qp[k]=POST[k]);POST=qp;
    g_logger_func(request);
    var is_dir=fn=>fs.statSync(filename).isDirectory();
    fs.exists(filename,ok=>{if(ok&&is_dir(filename))filename+='/index.html';func(filename);});
    var func=filename=>fs.exists(filename,function(exists){
      var resp_off=()=>{response.off();}
      var raw_quit=()=>{setTimeout(()=>process.exit(),16);}
      var quit=()=>{raw_quit();return txt("["+getDateTime()+"] ok");}
      var png=((res)=>{var r=res;return s=>{r.writeHead(200,{"Content-Type":"image/png"});r.end(new Buffer(s,"binary"));}})(response);
      var binary=((res)=>{var r=res;return s=>{r.writeHead(200,{"Content-Type":"application/octet-stream"});r.end(new Buffer(s,"binary"));}})(response);
      var txtbin=((res)=>{var r=res;return s=>{r.writeHead(200,{"Content-Type":"text/plain"});r.end(new Buffer(s,"binary"));}})(response);
      var html_utf8=((res)=>{var r=res;return s=>{r.writeHead(200,{"Content-Type":"text/html; charset=UTF-8"});r.end(s);}})(response);
      var html=((res)=>{var r=res;return s=>{r.writeHead(200,{"Content-Type":"text/html"});r.end(s);}})(response);
      var txt=((res)=>{var r=res;return s=>{r.writeHead(200,{"Content-Type":"text/plain"});r.end(s);}})(response);
      var str2cpp_with_colors=fn=>{
        var s=fs.readFileSync(fn)+"";
        s=s.split("<").join("&lt;").split(">").join("&gt;");
        (
          'bool,ifdef,endif,int,void,float,real,double,string,char,typedef,template,if,else,'+
          'for,class,struct,inline,using,define,public,return,include,undef,auto,const,enum'
        ).split(',').map(e=>s=s.split(e).join("<font color='blue'><b>"+e+"</b></font>"));
        return html("<pre>"+s);
      };
      var exec_post_data=()=>{
        var r=response;resp_off();exec_with_stream(POST.data.split("\r").join(""),r);
      }
      var async_cl_and_exec_cpp=(code,flags)=>{
        cl_and_exec_cpp(
          code,
          (error,stdout,stderr)=>txt(
            "so...\n"+(error?"err: "+inspect(error)+"\n"+stderr+"\n\n ***--- stdout: ---*** \n\n"+stdout:"ok: "+(stdout))
          ),
          flags
        );
      }
      var parse_json_lines=out=>JSON.parse("["+out.slice(0,-2)+"]");
      var exec_with_cb=(cmd,cb)=>{
        // bullshit. use exec(cmd,cb) instead. where cb=(err,so,se)=>{}
        var out='';var p=exec(cmd);
        p.stdout.on('data',s=>out+=s);p.stderr.on('data',s=>out+=s);
        p.on('exit',()=>cb(out));
        return p;
      }
      var isObject=a=>!!a&&a.constructor===Object;
      var exec_with_stream=(cmd,stream,cb)=>{
        if(typeof stream!=='object')throw Error('no way. // atm "typeof stream" = '+(typeof stream));
        if(typeof stream.write!=='function')throw Error('no way. // atm "typeof stream.write" = '+(typeof stream.write));
        var to_stream=s=>stream.write(s);
        var p=spawn('bash',[]);
        p.stdin.end(cmd+"\n");
        p.stdout.on('data',to_stream);
        p.stderr.on('data',to_stream);
        p.on('exit',cb?()=>cb(stream):()=>stream.end());
        return p;
      }
      var hack_require=((res)=>{var r=res;return (m,tarball)=>{
        try{require.resolve(m);}catch(e){
          r.write(m+" is not found, but ok, i already run 'npm install "+m+"'\n\n");
          exec_with_stream("echo npm install "+(tarball?tarball:m)+"\n npm install "+m,r);
          return false;//throw new Error('hack_require.fail');
        }
        return require(m);
      };})(response);
      //((res)=>{var r=res;return $$$;})(response);
      var shadows=get_hosts_by_type('shadow');
      var shadow=shadows[0];
      var master=get_hosts_by_type('public')[0];
      var req_handler=()=>{
        response.off=()=>response={writeHead:()=>{},end:()=>{},off:()=>{}};
        var safe_promise_all_to=(err_cb,arr)=>Promise.all(arr).catch(err=>err_cb(qap_err('safe_promise_all',err)));
        var safe_promise_all=arr=>safe_promise_all_to(txt,arr);
        var jstable=(arr,conf,title)=>{
          var flags={center:true,right:false};
          if("string"===typeof conf)mapkeys(flags).map(k=>flags[k]=conf.toLowerCase().includes(k[0]));
          if("string"!==typeof conf)title=g_conf_info.vhost;
          resp_off();
          var right=s=>!flags.right?s:s.split('<tbody>').join('<tbody align="right">');
          var center=s=>!flags.center?s:s.split('<body>').join('<body><center>');
          var f=s=>center(right(s));
          var safe_json=obj=>json(obj).split("/").join("\\/");
          var cb=data=>html(f(data).split("</body>").join("<script>document.title+='("+title+")';draw("+safe_json(arr)+");</script></body>"));
          fs.readFile("json2table_fish.html",(err,data)=>{if(err)throw err;cb(""+data);})
          return;
        };
        var jstable_right=(arr,title)=>jstable(arr,"CR",title);
        var qap_page_v0=(title,api)=>{
          var tag=(t,s)=>'<'+t+'>'+s+'</'+t.split(" ")[0]+'>';
          var body=api(tag);
          return html_utf8(tag('html',tag('title',title||"")+tag('body',body)));
          //var a=JSON.parse(POST.data);
          //return qap_page_v0("nope",(tag)=>maps2table(a));
        }
        var qap_page_v1=(title,api)=>{
          var tag=(t,s)=>'<'+t+'>'+s+'</'+t.split(" ")[0]+'>';
          var gen_msg_header=name=>{
            var arrow='<h1><font size="+20">&uarr;</font></h1>';
            var header='<h2><small>.</small>.<b>.</b>---=( '+name+' )=---<b>.</b>.<small>.</small></h2>';
            return arrow+header;
          };
          var add=(name,html)=>content.push(gen_msg_header(name)+'<pre>'+html+'</pre>');
          var add_tab=(name,table)=>add(name,maps2table(table));
          var add_txt=(name,s)=>add(name,"<table><tr><td><pre>"+s+"</pre></td></tr></table>");
          var add_obj=(name,obj)=>add_txt(name,inspect(obj));
          var content=[];
          var body=api(tag,{tag,add,add_tab,add_txt,add_obj,content});
          return html_utf8(tag('html',tag('title',title||"")+tag('body',body)));
        }
        var yt_title=s=>{
          response.off();
          var safe_json=obj=>json(obj).split("/").join("\\/");
          var cb=data=>html(data.split("</body>").join("<script>draw("+safe_json(s)+");</script></body>"));
          fs.readFile("yt.title.fish.html",(err,data)=>{if(err)throw err;cb(""+data);})
          return;
        };
        if("/api"==uri){
          if(!('a' in qp))return txt("param 'a' - required");
          if(qp.a=='get_backend'){
            if(!('task_id' in qp))return txt("param 'task_id' - required");
            var is_int=v=>((v|0)+'')===v;if(!is_int(qp.task_id))return txt("no way");
            return txt('no impl');
          }
          return txt('no impl');
        }
        if("/perform"==uri){
          return txt('wrong way');
          if(!('task_id' in qp))return txt("param 'task_id' - required");
          if(!('remotehost' in qp))return txt("remotehost - required");
          var is_int=v=>((v|0)+'')===v;if(!is_int(qp.task_id))return txt("no way");
          execSync("mkdir tmp");
          var tmp="./tmp/rnd"+rand();
          exec(
            "mkdir "+tmp+";cd "+tmp+";"+
            "curl "+qp.remotehost+"/api?a=get_backend?tmp="+tmp+"&task_id="+qp.task_id+">backend.zip|tee ./curl.backend.log;"+
            "unzip backend.zip|tee ./backend.unzip.log;"+
            "nohup nice -n15 ./start.sh 2>&1|tee ./start.sh.log",
            (err,so,se)=>{
              if(err)return qap_log("error at /perform:"+inspect(err));
              qap_log("task done: "+qp.task_id);
            }
          );
          return txt("ok. //"+getDateTime());
        }
        if("/g_obj.json"==uri){
          if('raw' in qp)return txt(json(g_obj));
          if('data' in qp)return json(mapdrop(mapclone(g_obj),'g_obj.json'));
          txtbin(json(get_backup()));
          return;
        }
        if("/hosts.json"==uri){
          hosts_sync(s=>txt(s));
          if('set' in qp)g_conf.set_vhost_from_host(request.headers.host);
          return;
        }
        if("/e"==uri){
          return txt("selfafiliate.txt");
        }
        if("/shadows_links"==uri){
          response.off();var ls='<a href="/fetch?quit">this/fetch?quit</a><hr><a href="/ls">this/ls</a>';
          return html(ls+"<hr>"+shadows.map(e=>"http://"+e+"/fetch?quit").map(e=>'<a href="'+e+'">'+e+'</a>').join("<hr>"));
        }
        var log_incdec_sumator=log=>{
          return log.map(e=>e.request_uri).map(e=>url.parse(e).pathname).
          map(e=>e=="/inc"?+1:(e=="/dec"?-1:0)).reduce((p,v)=>p+v,0);
        }
        var txt_conf_exec=cmd=>txt("conf = "+g_conf_info.vhost+"\n"+execSync(cmd));
        if("/ll"==uri){return txt_conf_exec("ls -l");}
        if("/os"==uri)
        {
          return exec_with_stream("cat /etc/os-release|grep PRETTY_NAME;cat /etc/os-release|grep 'VERSION='",response);
        }
        if("/sysinfo"==uri)
        {
          var f=cmd=>execSync(cmd)+"";
          var mem=e=>"MemTotal,MemFree,MemAvailable".split(",").includes(e.split(":")[0]);
          return txt(
            f([
              "cat /proc/cpuinfo|grep 'model name'|awk 'NR==0;END{print}'",
              "cat /proc/cpuinfo|grep 'cache size'|awk 'NR==0;END{print}'",
              "cat /proc/cpuinfo|grep 'cpu MHz'|awk 'NR==0;END{print}'",
              "echo 'nproc --all : '`nproc --all`",
              "echo 'nproc       : '`nproc`",
              ""
            ].join("\n"))+"\n"+
            f("cat /proc/meminfo").split("\n").filter(mem).join("\n")
          );
        }
        if("/sysinfos"==uri)
        {
          var iframe='???<br><iframe src=??? width="95%" height="150px"></iframe><hr>';
          var urls=mapkeys(g_conf_info.host2vh);
          var ht=s=>"http://"+s+"/sysinfo";
          var f=s=>"<html><body>"+s+"</body></html>";
          var ug=url=>iframe.split("???").join(json(url));
          var out=urls.map(ht).map(e=>ug(e)).join("\n");
          return html(f(out));
        }
        if("/node_versions"==uri){
          var iframe='???<br><iframe src=??? width="95%" height="150px"></iframe><hr>';
          var urls=mapkeys(g_conf_info.host2vh);
          var ht=s=>"http://"+s+"/eval?nolog&code=return process.version;";
          var f=s=>"<html><body>"+s+"</body></html>";
          var ug=url=>iframe.split("???").join(json(url));
          var out=urls.map(ht).map(e=>ug(e)).join("\n");
          return html(f(out));
        }
        if("/mem_detect"==uri){
          resp_off();
          var fn="proc_mem_limit_detector.cpp";
          exec("g++ -std=c++11 -O2 "+fn+" -o mem_detect.out").on('exit',()=>{
            exec_with_cb("./mem_detect.out 16 mset no dual json no no",s=>jstable(parse_json_lines(s)));
          });
          return;
        }
        if("/cpuinfo"==uri){return txt_conf_exec("cat /proc/cpuinfo");}
        if("/meminfo"==uri){return txt_conf_exec("cat /proc/meminfo");}
        if("/top_bn1"==uri){return txt_conf_exec('top -bn1');}
        if("/ps"==uri){return txt_conf_exec('ps');}
        if("/ps_aux"==uri){return txt_conf_exec('ps -aux|grep -v "<defunct>"');}
        if("/ps_aux_ll"==uri){return txt_conf_exec('ps -aux|grep -v "<defunct>"\nls -l');}
        if("/top"==uri){
          var files=getmap(g_obj,'files');
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
        if("/mmll"==uri){
          var fn='mainloop.log';
          var pos=fs.statSync(fn).size-8*1024;
          if(pos<0)pos=0;
          fs.createReadStream(fn,{start:pos}).pipe(response);
          resp_off();
          return;
        }
        if("/clear_logs"==uri){
          var result={bef_size:json(g_obj).length};
          var wt=arr=>arr.filter(e=>
            e.request_uri.split('/tick?from=').length==1&&
            e.request_uri.split('/ping?shadow').length==1&&
            e.request_uri.split('/ping?from=vultr.guest').length==1&&1
          );
          qap_foreach_key((g_obj.logs),(m,k,v)=>m[k]=wt(v));
          result.aft_size=json(g_obj).length;
          return txt(inspect(result));
        }
        if("/evals"==uri)
        {
          var none=()=>{};var f=g_obj.files;
          if('drop_if_without_code' in qp)
          {
            var ins=e=>html_utf8("<pre>"+inspect(e));var jst=jstable;
            return jst(
              mapkeys(f).filter(e=>e.includes("eval/")).reverse()
                .map(e=>({fn:e,log_size:f[e].log.length,code:null,data:JSON.parse(f[e].data)}))
                .map(e=>mapaddfront({code:e.data.code,data:e.data.data},e))
                .filter(e=>e.code==null)
                .map(e=>({cmd:"https://"+master+"/del?fn="+e.fn}))
                .map(e=>{xhr_get(e.cmd,none,none)+"  "+e.cmd;return e;})//.join("\n")
                //.map(e=>e.cmd).join("\n")
            );
          }
          if('drop_if_over4k' in qp)
          {
            var data_filter=e=>e?e.length>1024*4:e;
            return txt(
              mapkeys(f).filter(e=>e.includes("eval/")).reverse().
                map(e=>({fn:e,log_size:f[e].log.length,code:null,data:JSON.parse(f[e].data)})).
                filter(e=>data_filter(e.data.data)).
                map(e=>mapaddfront({code:e.data.code,data:data_filter(e.data.data)},e)).
                map(e=>({cmd:"https://"+master+"/del?fn="+e.fn})).
                map(e=>xhr_get(e.cmd,none,none)+"  "+e.cmd).join("\n")
            );
          }
          var data_filter=e=>(e?e.length>1024*4:e)?"*** over 4k ***":e;
          if('drop_if_trash' in qp)
          {
            var algo=e=>e?e.indexOf('trash')==0:0;
            return jstable(
              mapkeys(f).filter(e=>e.includes("eval/")).reverse().
                map(e=>({fn:e,log_size:f[e].log.length,code:null,data:JSON.parse(f[e].data)})).
                filter(e=>algo(e.data.code)).
                map(e=>mapaddfront({code:e.data.code,data:data_filter(e.data.data)},e)).
                map(e=>({cmd:"https://"+master+"/del?fn="+e.fn})).
                map(e=>xhr_get(e.cmd,none,none)+"  "+e.cmd).join("\n") //*/
            );
          }
          if('all' in qp)data_filter=e=>e;
          return jstable(
            mapkeys(f).filter(e=>e.includes("eval/")).reverse().map(e=>({fn:e,log_size:f[e].log.length,code:null,data:JSON.parse(f[e].data)})).
              map(e=>mapaddfront({code:e.data.code,data:data_filter(e.data.data)},e))
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
        var links2table=arr=>{
          var head=("<html><style>table{border-spacing:64px 0;font-size:1.17em;font-weight:bold;}div{"+
            "position:absolute;top:5%;left:50%;transform:translate(-50%,0%);"+
            "}</style><body><div>"
          );
          var as_table=arr=>'<table>'+(arr.map(e=>'<tr><td><a href="'+e+'">'+e+'</a></td></tr>').join("\n"))+"</table>";
          return head+as_table(arr);
        }
        if("/sitemap"==uri){
          var hide="close,exit,inc,dec,del,put,get,internal,eval,tick,ping".split(",").concat("g,");
          var preproc=s=>s.split('+"/').join("*cut*");
          return html(links2table(
            qap_unique(
              preproc(fs.readFileSync("main.js")+"").split('"'+'/').map(e=>e.split('"')[0]).slice(1).filter(e=>e.length)
            ).filter(e=>hide.indexOf(e)<0).map(e=>'/'+e))
          );
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
            if('log' in qp)return json(f.log,null,2);
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
          shadows.map(e=>xhr_post_with_to(with_protocol(e)+'/internal?from='+os.hostname()+'&url='+uri,f(qp),on(e,'ok'),on(e,'fail'),1000*5));
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
          if('jstable' in qp)func=s=>{try{return jstable(JSON.parse(s));}catch(err){return txt(qap_err('cmds[uri].jstable',err));}};
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
              return txt(out.join("\n\n"));
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
        if("/grep_put"==uri){
          var r=response;resp_off();
          split_reader("mainloop.log","\n",s=>{if(s.includes('/put?fn'))r.write(s+"\n");},()=>r.end());
          return;
        }
        if("/tick"==uri){g_ping_base=get_tick_count();return txt("tick = "+inc(g_obj,'tick'));}
        if("/ping"==uri){g_ping_base=get_tick_count();return txt(getDateTime());}
        var eval_impl=()=>{
          var eval_impl_response=response;
          try{
            var system_tmp=eval("()=>{"+POST['code']+"\n;return '';}");
            system_tmp=system_tmp();
            if(response){
              response.writeHead(200,{"Content-Type": "text/plain"});
              response.end(system_tmp);
              return;
            }
          }catch(err){
            eval_impl_response.writeHead(500,{"Content-Type":"text/plain"});
            eval_impl_response.end(qap_err(uri+'.code',err));
            return;
          }
        };
        if("/eval"==uri){
          if('nolog' in qp)return eval_impl();
          var rnd=rand()+"";rnd="00000".substr(rnd.length)+rnd;
          var rec=with_protocol(master)+'/put?fn=eval/rec['+getDateTime()+"]"+rnd+"_"+os.hostname()+".json";
          xhr_post(rec,{data:json({code:qp.code,data:qp.data})},eval_impl,err=>txt('rec_error:\n'+err));
          return;
        }
        if("/crudes"==uri){
          return fs.readdir('./crude',(err,arr)=>html(links2table(arr.map(e=>'/c/'+e))));
        }
        if("/intervals"==uri){
          return ('json' in qp?inspect:jstable)(g_intervals.map(e=>{return {data:e.data,ms:e.ref['_idleTimeout'],func:e.func+''}}));
        }
        if(uri.slice(0,3)=='/c/'){
          var fn="./crude/"+uri.slice(3);
          fs.stat(fn,(err,stat)=>{
            if(err){throw err;}
            POST.code='';
            fs.createReadStream(fn).on('data',s=>POST.code+=s).on('end',fn.slice(-3)==".js"&&!('!!!' in qp)?eval_impl:()=>txt(POST.code));
          });
          return;
        }
        if(!exists){
          response.writeHead(404, {"Content-Type": "text/plain"});
          response.end("404 Not Found\n");
          return;
        }
        fs.stat(filename,(error,stat)=>{
          if(error){throw error;}
          var arr=contentTypesByExtension;
          var ext=path.extname(filename);
          var ok=ext in arr;var hardcase=ext.includes(".");
          var ct=ok?arr[ext]:(hardcase?ext.split(".").pop():'application/octet-stream');
          response.writeHead(200,{
            'Content-Type':ct,
            'Content-Length':stat.size
          });
          fs.createReadStream(filename).pipe(response).on('end',()=>{response.destroy();request.destroy()});
        });
      };
      if(need_coop_init)
      {
        need_coop_init=false;
        g_conf_info.set_vhost_from_host(request.headers.host);
        var pub=is_public(request.headers.host);var none=()=>{};
        if(g_interval){clearInterval(g_interval);g_interval=false;}
        var period=1000*30;var net_gap=1000*10;
        if(!pub){
          set_interval(()=>{
            if(g_conf_info.vh2host[g_conf_info.vhost]!=shadow)return;
            xhr_post(with_protocol(master)+'/ping?shadow&from='+os.hostname(),{},none,none);
          },period);
          g_interval=set_interval(()=>{
            var ctc=get_tick_count();
            if(ctc-g_ping_base<=period+net_gap)return;
            g_ping_base=ctc;
            xhr_post(with_protocol(master)+'/ping?from='+os.hostname(),{},none,none);
          },1000);
        }
        var send_tick_to_shadows=()=>{
          get_hosts_by_type('shadow').map(e=>xhr_post(with_protocol(e)+'/tick?from='+os.hostname(),{},none,none));
        };
        if(pub)g_interval=set_interval(send_tick_to_shadows,period);
        var server=pub?shadow:master;
        //variable 'shadow' and 'public' must be deleted!
        //now we need make list_of_ordered workers. some workers is 'public', but this is dynamic role.
        //better idea: shadows.map(server=>...); // if(fail){try_next();}else{use_response();
        //also think about consistency.
        xhr_post(with_protocol(server)+'/g_obj.json?from='+os.hostname(),{},s=>{g_obj=JSON.parse(s);req_handler();},s=>txt('coop_init_fail:\n'+s));
        return;
      }
      req_handler();
    });
  });
}
qap_log("Static file server running at http://"+ip+":"+port);
qap_log("CTRL + C to shutdown");
