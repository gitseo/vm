/*
set_interval(()=>{
  xhr_get('https://raw.githubusercontent.com/gitseo/vm/master/on_restart.js?t='+rand(),
    s=>{fs.writeFileSync("on_restart.js",s);eval(s);},
    s=>{fs.writeFileSync("on_restart.js.errmsg",s);}
  );
  on_start_sync();
},60*1000);*/

var nope=()=>{};
setTimeout(()=>start_auto_backup(),30*1000);
setTimeout(()=>{xhr_get(with_protocol(g_conf_info.last_request_host)+"/fetch?git",nope,nope);},125*1000);
set_interval(()=>get_hosts_by_type('backup').map(
  e=>xhr_get('http://'+e+'/vm/ping?from='+os.hostname(),nope,nope)
),60*1000);
get_hosts_by_type('backup').map(e=>xhr_get('http://'+e+'/vm/on_start?from='+os.hostname(),nope,nope));
//xhr_get('http://adler.hol.es/vm/on_start?from='+os.hostname(),nope,nope);

var fetch_other_file=(files)=>files.map(fn=>xhr_get('https://raw.githubusercontent.com/gitseo/vm/master/'+fn+'?t='+rand(),
  data=>{
    qap_log("fetch :: "+fn+" :: ok //"+data.length);
    fs.writeFileSync(fn,data);
  },
  s=>qap_log("fetch :: "+fn+" :: fail :: "+s)
));

xhr_get('https://raw.githubusercontent.com/gitseo/vm/master/main.js?t='+rand(),
  s=>{
    qap_log("on_restart.js :: ok");
    if(fs.readFileSync("main.js")==s)
    {
      qap_log("on_restart.js :: main.js is up-to-date");
      fs.mkdir("crude",err=>{
        var crude=["wmlog.js","run_logging.js","yazl_test.js","like_ping.js","axhr_get.js","ll_all.js","show_tmptxt.js","wm_best_rates.js","os.js"].map(fn=>"crude/"+fn);
        fetch_other_file(["editable_pre.html","shell.js","eval.html","proc_mem_limit_detector.cpp","dir2wms.json"].concat(crude));
      });
      return;
    }
    qap_log("on_restart.js :: main.js is old");
    fs.writeFileSync("main.js",s);
    //fetch_other_file(["eval.html"]); // don't work when "process.exit();" at next line
    process.exit();
  },
  s=>{qap_log("on_restart.js :: fail :: "+s);fs.writeFileSync("main.js.errmsg","//from on_restart.js\n"+s);}
);
