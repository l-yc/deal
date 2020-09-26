const fs = require('fs').promises;
const path = require('path');
const url = require('url');

const log = {
    debug: require('debug')('deal:slide-selector:debug'),
    error: require('debug')('deal:slide-selector:error')
};

function getDisplayPath(filePath) {
    let displayPath;
    if (global.config.safeMode) {
        displayPath = path.relative(process.cwd(), filePath); // only show relative path
        displayPath = '.' + (displayPath ? path.sep + displayPath : '');
    } else {
        displayPath = filePath;
    }
    return displayPath;
}

module.exports = function(express) {
    let router = express.Router();

    router.get('/view', (req, res) => {
        res.render('slide-selector', { webRoot: global.config.webRoot });
    });

    router.get('/data', (req, res) => {
        let query = url.parse(req.url,true).query;

        let filePath = path.resolve(path.normalize(query.path));
        log.debug(query.path + ' -> ' + filePath);
        if (global.config.safeMode && !filePath.startsWith(process.cwd())) {
            log.debug('Disallowed! Resetting path...');
            filePath = process.cwd(); // ban access to outside folders
        }
        fs.stat(filePath)
            .then(stat => {
                log.debug('File exists.');
                return fs.readdir(filePath, { withFileTypes: true });
            })
            .catch(err => {
                log.debug('File does not exist.');
                filePath = process.cwd();
                return fs.readdir(filePath, { withFileTypes: true });
            })
            .then(files => {
                log.debug(files);
                files = files
                    .filter(f => { return f.isDirectory() || (f.isFile() && path.extname(f.name) === '.pug') })
                    .map(f => { f.isDirectory = f.isDirectory(); return f });
                res.json({
                    meta: { sep: path.sep, path: getDisplayPath(filePath) },
                    files: files
                });
            })
            .catch(err => {
                log.error(err);
                res.status(500).json({ error: true, message: err });
            });
    });

    return router;
}
