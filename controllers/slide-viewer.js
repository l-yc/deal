const fs = require('fs').promises;
const url = require('url');
const path = require('path');

const parse = require('pug-parser');
const lex = require('pug-lexer');
const wrap = require('pug-runtime/wrap');
const generateCode = require('pug-code-gen');

module.exports = function(express) {
    let router = express.Router();

    router.get('/view', (req, res, next) => {
        res.render('slide-viewer');
    });

    router.get('/data', (req, res) => {
        let query = url.parse(req.url,true).query;

        let filePath = decodeURIComponent(query.name);

        getPresentation(filePath)
            .then(presentation => {
                console.log(presentation);
                res.json(presentation);
            })
            .catch(err => {
                console.log(err);
                res.status(500).json({ error: true, message: "couldn't retrieve presentation" });
            })
    });

    return router;
};

function getPresentation(relFilePath) {
    let filePath = path.join(appRoot, relFilePath);

    return new Promise((resolve, reject) => {
        fs.readFile(filePath, {encoding: 'utf-8'})
            .then(src => {
                let presentation = {};

                // Parse the file into a json object
                let tokens = lex(src, {filePath});
                let ast = parse(tokens, {filePath, src});

                // Parse the head
                let head = ast.nodes.find((e) => e.name == 'head');
                // Record down the mixins listed. We'll need to load this with each slide
                let mixins = head.block.nodes.find((e) => e.type == 'Mixin');
                // Obtain the setting options
                let settings = head.block.nodes.find((e) => e.name == 'slideSettings').attrs;
                let aspectRatio = (frac => { 
                    return parseFloat(frac[0])/parseFloat(frac[1]);
                })(eval(settings.find((e) => e.name=='aspectRatio').val).split(':'));
                //let theme = '<link rel="stylesheet" type="text/css" href="/css/' + eval(settings.find((e) => e.name=='theme').val) + '.css">';
                let theme = eval(settings.find((e) => e.name=='theme').val);
                let name = eval(settings.find((e) => e.name=='name').val);

                presentation.meta = {   // set all the meta information of the presentation
                    theme: theme,
                    aspectRatio: aspectRatio,
                    name: name,
                }

                // Parse the body
                let body = ast.nodes.find((e) => e.name == 'body').block.nodes;
                let slides = body.map((slideAst, slideNumber) => {      // loop through all the slide
                    slideAst.block.nodes.unshift(mixins);               // add mixins to this slide ast
                    //console.log(JSON.stringify(slideAst, null, '  '))

                    // Find and parse all animations
                    let parsedAnimationList = null;
                    let animationListBlock = slideAst.block.nodes.find(e => e.name == 'animation-list');
                    console.log("animationListBlock: " + animationListBlock);
                    if (animationListBlock === undefined) parsedAnimationList = [];
                    else {
                        // Find and remove item from slide content
                        let idx = slideAst.block.nodes.indexOf(animationListBlock);
                        if (idx == -1) throw "Animation found but not found?";
                        slideAst.block.nodes.splice(idx, 1);

                        let animationList = animationListBlock.block.nodes;
                        const triggers = ["onClick", "withPrevious", "afterPrevious", "fromPrevious"];

                        parsedAnimationList = animationList.map(item => {
                            let animationItem = { trigger: "onClick", type: undefined, target: undefined }

                            item.attrs.forEach(attr => {    // parse the attributes
                                attr.val = eval(attr.val);
                                if (attr.name == "target")
                                    animationItem.target = '.slide ' + attr.val;
                                else if (triggers.includes(attr.val))
                                    animationItem.trigger = attr.val;
                                else if (attr.name == "class") {
                                    animationItem.name = attr.val;
                                    animationItem.type = animationItem.name.includes('In') ? 'ENTRANCE' : (animationItem.name.includes('Out') ? 'EXIT' : 'EFFECT');
                                }
                                else if (attr.name == "delay")
                                    animationItem.delay = attr.val; // must be a fromPrevious attribute
                            });

                            return animationItem;
                        });
                        console.log("parsedAnimationList: " + parsedAnimationList);
                    }
                    
                    // Generate the slide html
                    var funcStr = generateCode(slideAst, {
                        compileDebug: false,
                        pretty: true,
                        inlineRuntimeFunctions: false,
                        templateName: 'helloWorld'  // a bit lost here but it works
                    });
                    var func = wrap(funcStr, 'helloWorld');
                    slideBodyHtml = func();
                    
                    // Hide all the entrance animated elements
                    if (parsedAnimationList && parsedAnimationList.length > 0) {
                        const jsdom = require("jsdom");
                        const { JSDOM } = jsdom;
                        let dom = new JSDOM(slideBodyHtml);
                        let doc = dom.window.document;
                        let div = doc.createElement('div');
                        div.classList.add('slide');
                        div.innerHTML = slideBodyHtml;
                        for (let i = 0; i < parsedAnimationList.length; ++i) {
                            let item = parsedAnimationList[i];
                            let target = div.querySelector(item.target);
                            if (item.type == 'ENTRANCE' && target) target.classList.add('hidden');
                        }
                        slideBodyHtml = div.innerHTML;   // replace with the updated html
                    }

                    let slide = {
                        slideBody: slideBodyHtml,
                        slideNumber: slideNumber,
                        animationList: parsedAnimationList
                    };
                    return slide;
                });

                // Return the slideBody object
                presentation.slides = slides;
                resolve(presentation);
            })
            .catch(err => {
                console.log(err);
                reject(err);
            });
    });
}
