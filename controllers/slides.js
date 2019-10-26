var fs = require('fs');
var path = require('path');

var parse = require('pug-parser');
var lex = require('pug-lexer');
var wrap = require('pug-runtime/wrap');
var generateCode = require('pug-code-gen');

module.exports = function(express) {
    var router = express.Router();

    router.get('/:filename/', (req, res) => {
        var filename = req.params.filename + '.pug';
        var filePath = path.join(appRoot + "/tests", filename);

        fs.readFile(filePath, {encoding: 'utf-8'}, function(err, data) {
            if (!err) {
                let slideHead = getSlideHead(data, filename, {slideTitle: req.params.filename});

                // displaying to the user
                slideHead.getLoc ='/slides/' + req.params.filename;
                res.render('slide-viewer', slideHead);
            } else {
                console.log(err);
            }
        });        
    });

    router.get('/:filename/:slideNumber', (req, res) => {
        var filename = req.params.filename + '.pug';
        var filePath = path.join(appRoot + "/tests", filename);
        var slideNumber = parseInt(req.params.slideNumber);

        if (slideNumber < 0) {
            res.json({ err: true });
            return;    // can't go back!
        }
        else {
            fs.readFile(filePath, {encoding: 'utf-8'}, function(err, data) {
                if (!err) {
                    let slideBody = getSlideBody(data, filename, {slideTitle: req.params.filename, slideNumber: slideNumber});

                    res.json(slideBody);
                } else {
                    console.log(err);
                }
            });        
        }
    });

    return router;
};

function getSlideHead(src, filename, slideMeta) {
    // parsing the file into a json object?
    var tokens = lex(src, {filename});
    var ast = parse(tokens, {filename, src});

    // Parse the head    
    var head = ast.nodes.find((e) => e.name == 'head');
    //console.log(JSON.stringify(head, null, '  '));

    // We'll obtain the settings and then add in the variables respectively
    var settings = head.block.nodes.find((e) => e.name == 'slideSettings').attrs;
    var headHtml = "";
    var aspectRatio = eval(settings.find((e) => e.name=='aspectRatio').val).replace(':', '/');
    console.log(aspectRatio);
    var theme = '<link rel="stylesheet" type="text/css" href="/css/' + eval(settings.find((e) => e.name=='theme').val) + '.css">';
    headHtml += theme;

    let slideHead = {
        aspectRatio: aspectRatio,
        slideHead: headHtml,
        slideTitle: slideMeta.slideTitle
    };
    return slideHead;
}

function getSlideBody(src, filename, slideMeta) {
    // parsing the file into a json object?
    var tokens = lex(src, {filename});
    var ast = parse(tokens, {filename, src});

    // Parse the head    
    var head = ast.nodes.find((e) => e.name == 'head');
    // Record down the mixins listed. We'll need to load this with each slide
    var mixins = head.block.nodes.find((e) => e.type == 'Mixin');

    // Parse the body
    var body = ast.nodes.find((e) => e.name == 'body').block.nodes;
    var bodyHtml;
    var parsedAnimationList;
    var numberOfSlides = body.length;
    if (slideMeta.slideNumber < 0 || slideMeta.slideNumber >= body.length) {
        // Invalid slide number, we'll just assume it's the end of presentation
        bodyHtml = '<p-slide><h1> End of Presentation </h1></p-slide>';
    }
    else {
        var selectedSlideAst = body[slideMeta.slideNumber]; // select the slide
        selectedSlideAst.block.nodes.unshift(mixins);       // enable mixins
        console.log(JSON.stringify(selectedSlideAst, null, '  '))

        // Find animations, if any, and append to head
        var animationListBlock = selectedSlideAst.block.nodes.find(e => e.name == 'animation-list');
        if (animationListBlock != undefined) {
            // Find and remove item from an array
            var i = selectedSlideAst.block.nodes.indexOf(animationListBlock);
            if (i != -1) {
                selectedSlideAst.block.nodes.splice(i, 1);
            }

            parsedAnimationList = [];

            animationList = animationListBlock.block.nodes;
            for (let i = 0; i < animationList.length; ++i) {
                item = animationList[i].attrs;
                var animationItem = { trigger: "onClick", type: undefined, target: undefined }
                for (let j = 0; j < item.length; ++j) {
                    item[j].val = eval(item[j].val);
                    if (item[j].name == "target") animationItem.target = '.slide ' + item[j].val;
                    else {
                        if (["onClick", "withPrevious", "afterPrevious", "fromPrevious"].includes(item[j].val))
                            animationItem.trigger = item[j].val;
                        else if (item[j].name == "class") {
                            animationItem.name = item[j].val;
                            animationItem.type = animationItem.name.includes('In') ? 'ENTRANCE' : (animationItem.name.includes('Out') ? 'EXIT' : 'EFFECT');
                        }
                        else if (item[j].name == "delay") animationItem.delay = item[j].val; // must be a fromPrevious attribute
                    }
                }

                parsedAnimationList.push(animationItem);
            }
            console.log(parsedAnimationList);
        }

        // Generate the slide html
        var funcStr = generateCode(selectedSlideAst, {
            compileDebug: false,
            pretty: true,
            inlineRuntimeFunctions: false,
            templateName: 'helloWorld'  // a bit lost here but it works
        });
        var func = wrap(funcStr, 'helloWorld');
        bodyHtml = func();
    }

    // hide all the animated elements
    if (parsedAnimationList && parsedAnimationList.length > 0) {
        const jsdom = require("jsdom");
        const { JSDOM } = jsdom;
        let dom = new JSDOM(bodyHtml);
        let doc = dom.window.document;
        let div = doc.createElement('div');
        div.classList.add('slide');
        div.innerHTML = bodyHtml;
        for (let i = 0; i < parsedAnimationList.length; ++i) {
            let item = parsedAnimationList[i];
            let target = div.querySelector(item.target);
            if (item.type == 'ENTRANCE' && target) target.classList.add('hidden');
        }
        bodyHtml = div.innerHTML;   // replace with the updated html
    }

    console.log(bodyHtml);

    // Return the slideBody object
    let slideBody = {
        slideBody: bodyHtml,
        slideNumber: slideMeta.slideNumber,
        numberOfSlides: numberOfSlides,
        animationList: parsedAnimationList
    };
    return slideBody;
}
