var c=g_conf_info;
resp_off();
//var code=POST.data;
var code=(
  (()=>{
    var trash=[];
    var check=(fn)=>{
      try{var data=fs.readFileSync(fn)+'';
        if(!data.length)return trash.push(fn);
        if(data[0]!='{')return trash.push(fn);
        //JSON.parse(data);
      }catch(e){trash.push(fn);}
    }
    fs.readdirSync('wmlogs').map(fn=>'wmlogs/'+fn).map(check);
    fs.writeFileSync('trash.txt',json(trash));
    exec_with_stream('cat wmlogs/*.*>wmlogs.all.txt;tar -czvf wmlogs.all.txt.tgz wmlogs.all.txt;ls -l',response);
    return resp_off();
    return txt(inspect(trash)+get_ms()+'');
  }).toString().split("\n").slice(1,-1).join("\n")
);
var path="/eval?&nolog";
var out_func=jstable;
if('json' in qp)out_func=arr=>txt(json(arr));
var isObject=a=>!!a&&a.constructor===Object;
safe_promise_all(
  mapkeys(c.vh2host).map(e=>{
    var url="http://"+c.vh2host[e]+path;
    var obj={unixtime:unixtime(),code:code};
    var ud={vhost:e,host:c.vh2host[e],bef_ms:get_ms()};
    return new Promise((ok,err)=>xhr_post(url,obj,
      s=>ok({url:url,obj:obj,ud:ud,data:s,err:false}),
      s=>ok({url:url,obj:obj,ud:ud,data:s,err:true})
    )).then(e=>mapaddfront(e,{ms:get_ms()-e.ud.bef_ms}));
  })
).then(arr=>out_func(arr.map(e=>{
  return {vhost:e.ud.vhost,host:e.ud.host,ms:e.ms.toFixed(3),data:e.data,error:e.err}
})));