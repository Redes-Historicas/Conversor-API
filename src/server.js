const express = require('express')
const cors = require('cors')
const multer = require('multer');
const fetch = require('node-fetch');
const ObjectsToCsv = require('objects-to-csv');
const fs = require('fs');
const archiver = require('archiver');
const { response } = require('express');
const rimraf = require('rimraf')
const serveIndex = require('serve-index');
const path = require('path')
const app = express()
const findRemoveSync = require('find-remove');
const port = 3591


const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, __dirname+'/temp/Raw')
    },
    filename: function (req, file, cb) {
      cb(null, Date.now() + "_" + file.originalname)
    }
  })
const fileFilter = (req, file, cb) => {
   // if (file.mimetype == 'image/jpeg' || file.mimetype == 'image/png') {
        cb(null, true);
   // } else {
      //  cb(null, false);
   // }
}
const upload = multer({ storage: storage, fileFilter: fileFilter });



app.use(cors())
app.use(express.json())

app.post('/generate/GEPHI',upload.none(), async (req, res) => {
    var response_s = true;
    console.log("Cli Req")
      const url = 'http://tc13.huygens.knaw.nl/glp-ckcc/'+req.body.type+'/'+req.body.query+'?maxNodes=0'
        fetch(url).then(response => response.json())
        .then(async data => {
          var in_array_obj_links = await data['links'].map((single,index) => {
            var obj = {
                'Source': single.source,
                'Target': single.target,
                'Type': 'Undirected',
                'Id': index,
                'Label':'',
                'timeset':'',
                'Weight':req.body.w == "true" ? single.w : '1'
            }
            return obj;
        })

        var in_array_obj_nodes = await data['nodes'].map((single,index) => {
          var obj = {
              'Id': index,
              'Label':(single.name.split(',').length == 1 ? single.name.split(',')[0] : single.name.split(',')[1]).slice(1),
              'timeset':'',
          }
          return obj;
      })
      var fileTemp_link = new Date().getTime()+'_'+req.body.query+'_link.csv'
      var fileTempName_link = await __dirname + '/temp/Raw/'+fileTemp_link;
      const csv_link = await new ObjectsToCsv(await in_array_obj_links).toDisk(await fileTempName_link);

      var fileTemp_node = new Date().getTime()+'_'+req.body.query+'_node.csv'
      var fileTempName_node = await __dirname + '/temp/Raw/'+fileTemp_node;
      const csv_node = await new ObjectsToCsv(await in_array_obj_nodes).toDisk(await fileTempName_node);
      
      var json_name = new Date().getTime()+'_'+req.body.query+'_raw.json';
      var json_path_name = __dirname + '/temp/Raw/'+json_name
      fs.writeFileSync(json_path_name, JSON.stringify(await data));



      var zip_name = new Date().getTime()+'_'+req.body.query+'.zip'
      var zip_final = __dirname + '/temp/Results/'+zip_name;
      const output = fs.createWriteStream(zip_final);
      const archive = archiver('zip', {
        zlib: { level: 9 } // Sets the compression level.
      });
      archive.pipe(output);

      output.on('close', function() {
        console.log(archive.pointer() + ' total bytes');
        console.log('archiver has been finalized and the output file descriptor has closed.');
      });

      // This event is fired when the data source is drained no matter what was the data source.
      // It is not part of this library but rather from the NodeJS Stream API.
      // @see: https://nodejs.org/api/stream.html#stream_event_end
      output.on('end', function() {
        console.log('Data has been drained');
      });

      // good practice to catch warnings (ie stat failures and other non-blocking errors)
      archive.on('warning', function(err) {
        if (err.code === 'ENOENT') {
          // log warning
        } else {
          // throw error
          throw err;
        }
      });

      // good practice to catch this error explicitly
      archive.on('error', function(err) {
        throw err;
      });
      if(req.body.d == null){
      archive.append(await fs.createReadStream(await fileTempName_link), { name: fileTemp_link });
      archive.append(await fs.createReadStream(await fileTempName_node), { name: fileTemp_node });
      archive.append(await fs.createReadStream(await json_path_name), { name: json_name });
      }else if(req.body.d == 'json'){
        archive.append(await fs.createReadStream(await json_path_name), { name: json_name });
      }else if(req.body.d == 'csv'){
        archive.append(await fs.createReadStream(await fileTempName_link), { name: fileTemp_link });
        archive.append(await fs.createReadStream(await fileTempName_node), { name: fileTemp_node });
      }else{
      archive.append(await fs.createReadStream(await fileTempName_link), { name: fileTemp_link });
      archive.append(await fs.createReadStream(await fileTempName_node), { name: fileTemp_node });
      archive.append(await fs.createReadStream(await json_path_name), { name: json_name });
      }



      
      await archive.finalize();

      await res.send({data_response:'http://filhodeenton.duckbox.com.br:3591/view/'+zip_name,worked:response_s})
      await fs.unlinkSync(await fileTempName_link);
      await fs.unlinkSync(await fileTempName_node);
      await fs.unlinkSync(await json_path_name);
        })
        .catch(er => {
          response_s = false;
          res.send({data_response:"Error: The Server Was Not Able To Complete this query.Reason:"+er.message,worked:response_s});
        })

    
})


app.post('/generate/VOS',upload.none(), async (req, res) => {
  var response_s = false
  res.send({data_response:"Error: Wait For A Version With VOSVIEWER Support!!",worked:response_s});
})

app.use('/search/advanced',express.static(__dirname+'/UI/Advanced'))

app.get('/view/:file',upload.none(), async (req, res) => {
  var response_s = false
  res.download(__dirname+'/temp/Results/'+req.params.file);
})

app.get('/delete/:file',upload.none(), async (req, res) => {
  var response_s = true;
  try{
    var query_ = await fs.unlinkSync(__dirname+'/temp/Results/'+req.params.file);
    res.send({
      data_response:query_,
      worked:response_s
    });
  }catch(e){
    var response_s = false;
    res.send({
      data_response:"Error: ENOENT: no such file or directory",
      worked:response_s
    });
    }
})

removeFiles_oldthan = () => {
  var uploadsDir = __dirname + '/temp/Results';

fs.readdir(uploadsDir, function(err, files) {
  files.forEach(function(file, index) {
    fs.stat(path.join(uploadsDir, file), function(err, stat) {
      var endTime, now;
      if (err) {
        return console.error(err);
      }
      now = new Date().getTime();
      endTime = new Date(stat.ctime).getTime() + 3600000;
      if (now > endTime) {
        return rimraf(path.join(uploadsDir, file), function(err) {
          if (err) {
            return console.error(err);
          }
          console.log('successfully deleted');
        });
      }
    });
  });
});
}

setInterval(removeFiles_oldthan, 60000);


app.listen(port, () => console.log(`Example app listening at http://filhodeenton.duckbox.com.br:${port}`))