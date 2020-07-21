const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const url = require('url');
const process = require('process');
const yargs = require('yargs');
const app = express();

const log = {
    debug: require('debug')('deal:index:debug'),
    error: require('debug')('deal:index:error')
};

global.config = yargs
    .option('dir', {
        alias: 'd',
        description: 'Sets the working directory',
        type: 'string',
        default: process.cwd()
    })
    .option('port', {
        alias: 'l',
        description: 'Port to listen on (default ',
        type: 'integer',
        default: 3000
    })
    .option('safeMode', {
        alias: 's',
        description: 'Disables access beyond working directory',
        type: 'boolean',
        default: false
    })
    .help()
    .alias('help', 'h')
    .argv;
log.debug(global.config);

let workingDir = global.config._[0] || global.config.dir;
try {
    process.chdir(workingDir);
} catch (e) {
    log.error(`Error encountered while attempting to load directory ${workingDir}:`, e);
    process.exit(1);
}

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
const port = global.config.port;

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
