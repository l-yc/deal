const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const url = require('url');
const app = express();

global.appRoot = __dirname;
app.use(express.static(path.join(__dirname, '/public')));
app.set('view engine', 'pug');

app.use('/slides', require('./controllers/slides.js')(express));

app.get('/', (req, res) => {
    //res.render('index');
    res.redirect('/browse/view');
});

app.get('/browse/view', (req, res) => {
    res.render('slide-selector');

    //let filePath = path.join(appRoot, "/tests");
    //let filePath = path.join(appRoot, query.path || "");
});

app.get('/browse/data', (req, res) => {
    let query = url.parse(req.url,true).query;

    let filePath = path.join(appRoot, query.path || "");
    fs.readdir(filePath, { withFileTypes: true })
        .then(files => {
            console.log(files);
            files = files
                .filter(f => { return f.isDirectory() || (f.isFile() && path.extname(f.name) === '.pug') })
                .map(f => { f.isDirectory = f.isDirectory(); return f });
            res.json(files);
        })
        .catch(err => {
            console.log(err);
            res.status(500).json({ error: true, message: err });
        });
});

app.use(function(req, res, next) {
    res.status = 404;
    res.render('404');
});

app.listen(3000, () => {
  console.log('server started');
});
