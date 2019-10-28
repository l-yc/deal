const fs = require('fs').promises;
const path = require('path');
const url = require('url');

module.exports = function(express) {
    let router = express.Router();

    router.get('/view', (req, res) => {
        res.render('slide-selector');

        //let filePath = path.join(appRoot, "/tests");
        //let filePath = path.join(appRoot, query.path || "");
    });

    router.get('/data', (req, res) => {
        let query = url.parse(req.url,true).query;

        query.path = query.path || path.sep;
        let filePath = path.join(appRoot, query.path);
        fs.readdir(filePath, { withFileTypes: true })
            .then(files => {
                //console.log(files);
                files = files
                    .filter(f => { return f.isDirectory() || (f.isFile() && path.extname(f.name) === '.pug') })
                    .map(f => { f.isDirectory = f.isDirectory(); return f });
                res.json({
                    meta: { sep: path.sep, path: query.path },
                    files: files
                });
            })
            .catch(err => {
                console.log(err);
                res.status(500).json({ error: true, message: err });
            });
    });

    return router;
}
