var multiparty=hack_require('multiparty');
return html('<center style="font-size:300%;"><form action="/upload" enctype="multipart/form-data" method="post">'+
    '<input type="text" name="title"><br>'+
    '<input type="file" name="upload" multiple="multiple"><br>'+
    '<input type="submit" value="Upload">'+
    '</form></center>'
);
