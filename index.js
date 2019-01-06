const express = require('express');

const app = express();

global.appRoot = __dirname;
app.use(express.static(__dirname + '/public'));
app.set('view engine', 'pug');

app.use('/slides', require('./controllers/slides.js')(express));

app.get('/', (req, res) => {
  res.render('index');
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