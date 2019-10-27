var fs = require('fs').promises;
const url = require('url');
var path = require('path');

var parse = require('pug-parser');
var lex = require('pug-lexer');
var wrap = require('pug-runtime/wrap');
var generateCode = require('pug-code-gen');

module.exports = function(express) {
    var router = express.Router();

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

    //router.get('/:filename/', (req, res) => {
    //    var filename = req.params.filename + '.pug';
    //    var filePath = path.join(appRoot + "/tests", filename);

    //    fs.readFile(filePath, {encoding: 'utf-8'}, function(err, data) {
    //        if (!err) {
    //            let slideHead = getSlideHead(data, filename, {slideTitle: req.params.filename});

    //            // displaying to the user
    //            slideHead.getLoc ='/slides/' + req.params.filename;
    //            res.render('slide-viewer', slideHead);
    //        } else {
    //            console.log(err);
    //        }
    //    });        
    //});

    //router.get('/:filename/:slideNumber', (req, res) => {
    //    var filename = req.params.filename + '.pug';
    //    var filePath = path.join(appRoot + "/tests", filename);
    //    var slideNumber = parseInt(req.params.slideNumber);

    //    if (slideNumber < 0) {
    //        res.json({ err: true });
    //        return;    // can't go back!
    //    }
    //    else {
    //        fs.readFile(filePath, {encoding: 'utf-8'}, function(err, data) {
    //            if (!err) {
    //                let slideBody = getSlideBody(data, filename, {slideTitle: req.params.filename, slideNumber: slideNumber});

    //                res.json(slideBody);
    //            } else {
    //                console.log(err);
    //            }
    //        });        
    //    }
    //});

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

//function getSlideHead(src, filename, slideMeta) {
//    // parsing the file into a json object?
//    var tokens = lex(src, {filename});
//    var ast = parse(tokens, {filename, src});
//
//    // Parse the head    
//    var head = ast.nodes.find((e) => e.name == 'head');
//    //console.log(JSON.stringify(head, null, '  '));
//
//    // We'll obtain the settings and then add in the variables respectively
//    var settings = head.block.nodes.find((e) => e.name == 'slideSettings').attrs;
//    var headHtml = "";
//    var aspectRatio = eval(settings.find((e) => e.name=='aspectRatio').val).replace(':', '/');
//    console.log(aspectRatio);
//    var theme = '<link rel="stylesheet" type="text/css" href="/css/' + eval(settings.find((e) => e.name=='theme').val) + '.css">';
//    headHtml += theme;
//
//    let slideHead = {
//        aspectRatio: aspectRatio,
//        slideHead: headHtml,
//        slideTitle: slideMeta.slideTitle
//    };
//    return slideHead;
//}
//
//function getSlideBody(src, filename, slideMeta) {
//    // parsing the file into a json object?
//    var tokens = lex(src, {filename});
//    var ast = parse(tokens, {filename, src});
//
//    // Parse the head    
//    var head = ast.nodes.find((e) => e.name == 'head');
//    // Record down the mixins listed. We'll need to load this with each slide
//    var mixins = head.block.nodes.find((e) => e.type == 'Mixin');
//
//    // Parse the body
//    var body = ast.nodes.find((e) => e.name == 'body').block.nodes;
//    var bodyHtml;
//    var parsedAnimationList;
//    var numberOfSlides = body.length;
//    if (slideMeta.slideNumber < 0 || slideMeta.slideNumber >= body.length) {
//        // Invalid slide number, we'll just assume it's the end of presentation
//        bodyHtml = '<p-slide><h1> End of Presentation </h1></p-slide>';
//    }
//    else {
//        var selectedSlideAst = body[slideMeta.slideNumber]; // select the slide
//        selectedSlideAst.block.nodes.unshift(mixins);       // enable mixins
//        console.log(JSON.stringify(selectedSlideAst, null, '  '))
//
//        // Find animations, if any, and append to head
//        var animationListBlock = selectedSlideAst.block.nodes.find(e => e.name == 'animation-list');
//        if (animationListBlock != undefined) {
//            // Find and remove item from an array
//            var i = selectedSlideAst.block.nodes.indexOf(animationListBlock);
//            if (i != -1) {
//                selectedSlideAst.block.nodes.splice(i, 1);
//            }
//
//            parsedAnimationList = [];
//
//            animationList = animationListBlock.block.nodes;
//            for (let i = 0; i < animationList.length; ++i) {
//                item = animationList[i].attrs;
//                var animationItem = { trigger: "onClick", type: undefined, target: undefined }
//                for (let j = 0; j < item.length; ++j) {
//                    item[j].val = eval(item[j].val);
//                    if (item[j].name == "target") animationItem.target = '.slide ' + item[j].val;
//                    else {
//                        if (["onClick", "withPrevious", "afterPrevious", "fromPrevious"].includes(item[j].val))
//                            animationItem.trigger = item[j].val;
//                        else if (item[j].name == "class") {
//                            animationItem.name = item[j].val;
//                            animationItem.type = animationItem.name.includes('In') ? 'ENTRANCE' : (animationItem.name.includes('Out') ? 'EXIT' : 'EFFECT');
//                        }
//                        else if (item[j].name == "delay") animationItem.delay = item[j].val; // must be a fromPrevious attribute
//                    }
//                }
//
//                parsedAnimationList.push(animationItem);
//            }
//            console.log(parsedAnimationList);
//        }
//
//        // Generate the slide html
//        var funcStr = generateCode(selectedSlideAst, {
//            compileDebug: false,
//            pretty: true,
//            inlineRuntimeFunctions: false,
//            templateName: 'helloWorld'  // a bit lost here but it works
//        });
//        var func = wrap(funcStr, 'helloWorld');
//        bodyHtml = func();
//    }
//
//    // hide all the animated elements
//    if (parsedAnimationList && parsedAnimationList.length > 0) {
//        const jsdom = require("jsdom");
//        const { JSDOM } = jsdom;
//        let dom = new JSDOM(bodyHtml);
//        let doc = dom.window.document;
//        let div = doc.createElement('div');
//        div.classList.add('slide');
//        div.innerHTML = bodyHtml;
//        for (let i = 0; i < parsedAnimationList.length; ++i) {
//            let item = parsedAnimationList[i];
//            let target = div.querySelector(item.target);
//            if (item.type == 'ENTRANCE' && target) target.classList.add('hidden');
//        }
//        bodyHtml = div.innerHTML;   // replace with the updated html
//    }
//
//    console.log(bodyHtml);
//
//    // Return the slideBody object
//    let slideBody = {
//        slideBody: bodyHtml,
//        slideNumber: slideMeta.slideNumber,
//        numberOfSlides: numberOfSlides,
//        animationList: parsedAnimationList
//    };
//    return slideBody;
//}
