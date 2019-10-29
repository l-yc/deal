const fs = require('fs').promises;
const path = require('path');
const url = require('url');

const log = {
    debug: require('debug')('deal:slide-selector:debug'),
    error: require('debug')('deal:slide-selector:error')
};

module.exports = function(express) {
    let router = express.Router();

    router.get('/view', (req, res) => {
        res.render('slide-selector');
    });

    router.get('/data', (req, res) => {
        let query = url.parse(req.url,true).query;

        query.path = query.path || path.sep;
        let filePath = path.join(appRoot, query.path);
        fs.readdir(filePath, { withFileTypes: true })
            .then(files => {
                log.debug(files);
                files = files
                    .filter(f => { return f.isDirectory() || (f.isFile() && path.extname(f.name) === '.pug') })
                    .map(f => { f.isDirectory = f.isDirectory(); return f });
                res.json({
                    meta: { sep: path.sep, path: query.path },
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
