//return parseFloat('1.2')+"";
var r=response;
resp_off();
//---
  var dir2wms_orig=JSON.parse(fs.readFileSync('dir2wms.json')+'');
  var dir2wms=JSON.parse(fs.readFileSync('dir2wms.json')+'');
  var qap_foreach_key=(obj,cb)=>{for(var k in obj)cb(obj,k,obj[k]);return obj;}

  var mid2info={};//money_id_to_info
  qap_foreach_key(dir2wms,(obj,k,v)=>getdef(mid2info,v[0],{mid:v[0],outmid2dir:{}}).outmid2dir[v[1]]=k);
  
  var dir_from_to=(from,to)=>{
    if(!(from in mid2info))txt(qap_err("field 'from' - not found",new Error(inspect({from:from,to:to,mid2info}))));
    return mid2info[from].outmid2dir[to];
  }
  var reverse_dir=dir=>{var wms=dir2wms[dir];return mid2info[wms[1]].outmid2dir[wms[0]]};

  var wms_path_to_buydirs=arr=>{
    var out=[];
    for(var i=1;i<arr.length;i++){
      var prev=arr[i-1];
      var cur=arr[i-0];
      out.push(dir_from_to(cur,prev));// reverse direction because we need buydirs
    }
    return out;
  };
  var wms_filter=(e)=>!'WMU,WMH,WMB,WMV,LTC,VND'.split(',').includes(e);
  var dir_filter=(e)=>{var t=dir2wms_orig[e];return !t.map(e=>wms_filter(e)?"":"1").length;}
  var gen_paths=(from,to,levels)=>{
    var clone=w=>w.slice();
    var wm_arr=mapkeys(mid2info).filter(wms_filter);
    var out=[];
    var arr=wm_arr.filter(e=>e!=from);
    var way=[from];
    var func=(way,arr,LVL)=>{
      if(!LVL)return out.push(way);
      arr.map(mid=>{
        var next=clone(way);next.push(mid);
        func(next,wm_arr.filter(e=>e!=mid),LVL-1);
      });
    };
    for(var i=1;i<=levels;i++)func([from],arr,i);
    out.filter(e=>e[e.length-1]!=to).map(e=>e.push(to));
    return out.map(e=>e.join("->"));
  };
  //return txt(inspect(paths));
  //return inspect(paths);
//---
var xml2js=hack_require('xml2js');if(!xml2js)return;
var d=s=>parseFloat(s.split(",").join("."));
var div=(a,b)=>d(a)/d(b);
var out_in=(out,e)=>{out['out/in']=div(e.amountout,e.amountin).toFixed(3)};
var in_out=(out,e)=>{out['in/out']=div(e.amountin,e.amountout).toFixed(3)};
//qp.json=1;qp.profit=1;
//if(uri==='/eval')qp.profit=1;
var dir2str=qap_foreach_key(dir2wms,(obj,k,v)=>{obj[k]=v.join('->');});//return txt(inspect(dir2str));
var ids=('profit' in qp)?mapkeys(dir2str).join(','):'1,2';
if('ids' in qp){ids=qp.ids;if(ids==='all')ids=mapkeys(dir2str).join(',');}
var ids_arr=ids.split(",");
//ids_arr=ids_arr.filter(dir_filter);
var type2dir=t=>{return "33,34,37,38".split(",").includes(t)?0:1};
var fee_koef='fee' in qp?parseFloat(qp.fee):0.0025;
var pay_fee=x=>x-x*fee_koef;
var tables={};
var bef_ms=get_ms();
var unique_paths=arr=>{
  var out={};
  arr.map(e=>out[e.join("->")]=true);
  return mapkeys(out).map(e=>e.split("->"));
};
var check_done=()=>{
  if(mapkeys(tables).length!=ids_arr.length)return;
  //return txt(inspect([mapkeys(tables).length,ids_arr.length,ids_arr,tables]));
  var load_time=get_ms()-bef_ms;
  if('profit' in qp)
  {
    var pf=parseFloat;
    var div_with_dir=(dir,a,b)=>!dir?a/b:b/a;
    var g=(e,dir)=>div_with_dir(dir,pf(e.amountout),pf(e.amountin));
    var t=tables;
    fs.writeFileSync("wm_tables.txt",json(tables));
    var bullshits=[];
    for(var k in t){
      if(!t[k].length)bullshits.push(k);
    }
    //if(bullshits.length)txt(inspect({bullshits:bullshits}));
    var WM='wm' in qp?qp.wm:'100';var WM=pf(WM.split(",").join("."));
    var paths=[];
    if('any' in qp){
      WM='100';
      mapkeys(mid2info)
        .filter(e=>wms_filter(e))
        .map(mid=>paths=paths.concat(gen_paths(mid,mid,4).map(e=>e.split('->'))));
    }else{
      var from='from' in qp?qp.from:'WMZ';
      var to='to' in qp?qp.to:'WMZ';
      paths=gen_paths(from,to,5).map(e=>e.split('->'));
    }
    paths=unique_paths(paths);
    var out={datetime:getDateTime(),WM:WM,load_time:load_time,fee_koef:fee_koef,paths_info:{},paths:[],};
    //var wmout=fs.createWriteStream('wmout.txt');
    //var path_index=0;
    paths.map(path=>{//path_index++;
      var bid2info={};
      var safe_str2float=s=>"string"===typeof s?pf(s):s;
      var get_bid_info=(dir)=>{
        var bid=t[dir][0];
        if(bid.id in bid2info){
          var tmp=mapclone(bid);
          'amountin,amountout'.split(',').map(k=>tmp[k]=safe_str2float(tmp[k]));
          var rec=bid2info[bid.id];
          tmp.amountin+=rec.dinp;
          tmp.amountout=tmp.amountin*rec.rate;
          return tmp;
        }
        return bid;
      };
      var buydirs=wms_path_to_buydirs(path);
      buydirs.map(e=>{
        if(!(e in t))txt(inspect(["WTH?",path,e,buydirs,t]));
        var tmp=t[e];
        if(!(0 in tmp))txt(inspect(['hm.hm...',path]));
      });
      var rates=buydirs.map(e=>g(t[e][0],0));
      var arr=[];
      var add=inp=>{
        var cur_v=inp;
        var cur_part=1;
        var fails=0;
        var log=buydirs.map((e,i)=>{
          var rate=rates[i];
          var bid=get_bid_info(e);
          var bid_amountout_div_cur_v=bid.amountout*100/cur_v;
          var fail=bid_amountout_div_cur_v<100;
          if(fail)fails++;
          var out={
            dir:dir2str[e],
            rate:[rates[i],1.0/rate],
            bid:bid,
            "bid.amountout/cur_v":bid_amountout_div_cur_v.toFixed(3)+" %",
            status:fail?"FAIL":"OK",
            inp:cur_v,
            raw:cur_v/rate,
            out:cur_v=pay_fee(cur_v)/rate,
            out_truncated:cur_v=((cur_v*100)|0)*0.01,
            fee:0,
          };
          out.fee=((out.out-out.out_truncated)*100/out.out).toFixed(3)+"%";
          cur_part*=out.out_truncated/out.out;
          var rec=getdef(bid2info,bid.id,{rate:rate,dout:0});
          rec.dinp=-out.raw;
          return out;
        });
        arr.push({path:path.join("->"),inp:inp,out:cur_v,cur_part:FToS(cur_part*100),fails:fails,log:log});
      }
      add(WM);
      out.paths.push({path:path.join("->"),arr:arr});
      /*if(path_index%130==0){
        qapsort(out.paths,e=>e.arr[0].out);
        out.paths.length=128;
      }*/
      //var rec=json({path:path.join("->"),arr:arr})+"\n";
      //wmout.write(rec);
      //eval_impl_response.write(rec);
    });
    //wmout.end();
    //return;
    //qapsort(out.paths,e=>e.arr[0].out).slice(0,128).map(e=>out.paths_info[e.path]=e.arr[1].out+" %     // or out = "+e.arr[0].out);
    out.paths.sort((a,b)=>{
      var f=e=>e.arr[0];
      var fa=f(a);var fb=f(b);
      var fails_v=fb.fails-fa.fails;
      if(-fails_v)return -fails_v;
      var v=fb.out-fa.out;
      if(v)return v;
      return -(f(b).cur_part-f(a).cur_part);
    });
    //qapsort(out.paths,e=>e.arr[0].out);
    out.paths.slice(0,128).map(e=>out.paths_info[e.path]=e.arr[0].out);
    out.paths=out.paths.slice(0,16).map(e=>e.arr.map(e=>{
      e.log.map(e=>{e.bid=mapclone(e.bid);return e;});
      return e;
    }));
    var txtout=inspect(out);fs.writeFileSync("wm.txt",txtout);
    return txt(txtout);
  }
  if('json' in qp){return txt(json(tables));}
  //return txt("debug:\n"+json(tables));
  var t1=tables[ids_arr[0]];
  if(ids_arr.length==1)return jstable_right(t1);
  if(ids_arr.length==2)
  {
    var t2=tables[ids_arr[1]];
    var t2_keys=mapkeys(t2[0]).reverse();
    jstable_right(t1.map((e,i)=>{
      t2_keys.map(k=>e[k+'`']=t2[i][k]);
      return e;
    }));
  }
  if(ids_arr.length>2)return txt('ids_arr.length>2\nno way');
};
//var exchtype=2; // 1={in:WMZ,out:WMR}; 2={in:WMR,out:WMZ};
var run=exchtype=>{
  var insert_special_field=exchtype%2==type2dir(exchtype)?out_in:in_out;
  var ok=xml=>{
    var g=obj=>{tables[exchtype]=obj;check_done(obj);};//0?(obj=>txt(inspect(obj))):obj=>jstable(obj);
    var pretty=s=>s;
    var select=(e,arr)=>{var out={};arr.split(',').map((k,i)=>out[k]=(i==2||i==3)?pretty(d(e[k]).toFixed(2)):e[k]);insert_special_field(out,e);return out;};
    var f=obj=>{
      var wer=obj["wm.exchanger.response"];
      if(!('WMExchnagerQuerys' in wer)){return [];txt(inspect(['error in wm.exchanger.response for ',obj]));}
      var wer_weq=wer.WMExchnagerQuerys;
      if(!('0' in wer_weq)){txt(inspect(['error in wm.exchanger.response.WMExchnagerQuerys for ',obj]));}
      var ww0=wer_weq[0];
      if(!('query' in ww0)){txt(inspect(['error in wm.exchanger.response.WMExchnagerQuerys.0 for ',obj]));}
      var ww0q=ww0.query;
      if(ww0q.map(e=>('$' in e?"":"#")).join("").length>0){txt(inspect(['error in wm.exchanger.response.WMExchnagerQuerys.0.$ for ',obj]));}
      //txt(inspect(wer_weq[0].query));return;
      return ww0q.map(e=>e['$']).map(e=>select(e,'id,querydate,amountin,amountout'));
    }
    var cb=(err,obj)=>g(f(obj));
    return xml2js.parseString(xml,cb);
  }
  return xhr_get("https:/"+"/wmeng.exchanger.ru/asp/XMLWMList.asp?exchtype="+exchtype,ok,txt);
}
if(!ids_arr.length)txt("ids_arr = []");
ids_arr.map(run);//dir_filter
return;

if(0)
{  
  /*
  t_world{
    mid;
    amount;
    t_move{
      wmid;
    }
    use{
      var dir=dir_from_to(w.mid,w.mid);
      w.amount=pay_fee(w.amount)*rate[reverse_dir(dir)];
      w.mid=dir2wms[dir][1];
    }
  }*/

  return txt(inspect(m));
}
