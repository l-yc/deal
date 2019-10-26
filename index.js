const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

global.appRoot = __dirname;
app.use(express.static(path.join(__dirname, '/public')));
app.set('view engine', 'pug');

app.use('/slides', require('./controllers/slides.js')(express));

app.get('/', (req, res) => {
  res.render('index');
});

app.get('/slide-selector', (req, res) => {
    var filePath = path.join(appRoot + "/tests");
    fs.readdir(filePath, (err, files) => {
        console.log(files);
        res.render('slide-selector', { slides : files });
    });
});

app.use(function(req, res, next) {
    //var err = new Error('Not Found');
    //err.status = 404;
    //next(err);

    res.status = 404;
    res.render('404');
});

app.listen(3000, () => {
  console.log('server started');
});
