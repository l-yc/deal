const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const url = require('url');
const process = require('process');
const app = express();

const log = {
    debug: require('debug')('deal:index:debug'),
    error: require('debug')('deal:index:error')
};

global.appRoot = process.cwd();
app.use(express.static(path.join(__dirname, '/public')));
app.use(express.static('/'));
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use('/slides', require('./controllers/slide-viewer.js')(express));
app.use('/browse', require('./controllers/slide-selector.js')(express));

app.get('/', (req, res) => {
    //res.render('index');
    res.redirect('/browse/view');
});

app.use(function(req, res, next) {
    res.status = 404;
    res.render('404');
});

// Fetch the port from command line
const port = 3000 || parseInt(process.arvg[1]);

app
    .listen(port, () => {
        log.debug('Server listening on port %d', port);
    })
    .on('error', function (err) {
        if(err.errno === 'EADDRINUSE') {
            log.error('Port %d is busy, terminating.', port);
        } else {
            log('Error encountered when launching server: %o', err);
        }
    });
