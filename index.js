const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const url = require('url');
const app = express();

global.appRoot = __dirname;
app.use(express.static(path.join(__dirname, '/public')));
app.set('view engine', 'pug');

app.use('/slides', require('./controllers/slides.js')(express));
app.use('/browse', require('./controllers/slide-selector.js')(express));

app.get('/', (req, res) => {
    //res.render('index');
    res.redirect('/browse/view');
});

app.use(function(req, res, next) {
    res.status = 404;
    res.render('404');
});

app.listen(3000, () => {
  console.log('server started');
});
