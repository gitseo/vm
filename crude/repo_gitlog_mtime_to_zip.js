var h_gitlog=hack_require("gitlog");
var gitlog=h_gitlog.default;
var vm_repo="https://github.com/gitseo/vm";
var repo_https='repo' in qp?qp.repo:vm_repo;
var repo=repo_https.split("/").pop();
if(!fs.existsSync(repo)){
  var cmd="git clone "+repo_https;
  execSync(cmd);
  if(!fs.existsSync(repo))return "hm... can not "+inspect(cmd);
}
var orepo="./"+repo;
var options={
  repo: orepo,
  number: 4096,
  execOptions: { maxBuffer: 1000 * 1024*16 },
};
resp_off();
gitlog(options,(err,commits)=>{
  var m={};
  commits.reverse().map(e=>{delete e.status;delete e.hash;e.authorDate=e.authorDate.split(" +0300")[0];
    e.files.map(fn=>m[fn]=(new Date(e.authorDate)));
  })
  mapkeys(m).map(fn=>{
    try{fs.accessSync(orepo+"/"+fn,fs.constants.F_OK);}catch(err){return;};
    var t=m[fn];
    fs.utimesSync(orepo+"/"+fn,t,t);// (fn,atime,mtime)
  });
  execSync("zip -r "+repo+".zip "+repo)
  html("<pre>"+"\n\n"+execSync("ls -lht *.zip")+"\n\n"+execSync("ls -lht "+repo)+"\n\n"+inspect(m));//maps2table(commits));
});
