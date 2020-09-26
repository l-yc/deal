const fs = require('fs').promises;
const url = require('url');
const path = require('path');

const parse = require('pug-parser');
const lex = require('pug-lexer');
const wrap = require('pug-runtime/wrap');
const generateCode = require('pug-code-gen');

const log = {
    debug: require('debug')('deal:slide-viewer:debug'),
    error: require('debug')('deal:slide-viewer:error')
};

module.exports = function(express) {
    let router = express.Router();

    router.get('/view', (req, res, next) => {
        res.render('slide-viewer', { webRoot: global.config.webRoot });
    });

    router.get('/data', (req, res) => {
        let query = url.parse(req.url,true).query;

        let filePath = decodeURIComponent(query.name);

        getPresentation(filePath)
            .then(presentation => {
                log.debug("Fetched presentation %s", query.name);
                res.json({ success: true, message: "Fetched presentation", presentation: presentation });
            })
            .catch(err => {
                log.error("Failed to fetch presentation: %o", err);
                res.status(400).json({ success: false, message: "Failed to fetch presentation", error: err });
            })
    });

    return router;
};

function getPresentation(filePath) {
    return new Promise((resolve, reject) => {
        fs.readFile(filePath, {encoding: 'utf-8'})
            .then(src => {
                let presentation = {};

                // Parse the file into a json object
                let tokens = lex(src, {filePath});
                let ast = parse(tokens, {filePath, src});

                // Parse the head
                let head = ast.nodes.find(e => e.name == 'head');
                if (!head) reject({ code: 'ERRNOHEAD', message: 'Presentation head was not specified' });
                // Record down the mixins listed. We'll need to load this with each slide
                let mixins = head.block.nodes.find(e => e.type == 'Mixin');
                // Obtain the setting options
                let settings = (head.block.nodes.find(e => e.name == 'slide-settings') || { attrs: undefined }).attrs;
                if (settings) {
                    let name = eval((settings.find(e => e.name=='name') || { val: '"(Unspecified)"' }).val);
                    let theme = eval((settings.find(e => e.name=='theme') || { val: '"default"' }).val);
                    let aspectRatio = (frac => { 
                        return parseFloat(frac[0])/parseFloat(frac[1]);
                    })(eval((settings.find(e => e.name=='aspectRatio') || { val: '"4:3"' }).val).split(':'));

                    presentation.meta = {   // set all the meta information of the presentation
                        name: name,
                        theme: theme,
                        aspectRatio: aspectRatio,
                    };
                } else {
                    presentation.meta = {
                        name: '(Unspecified)',
                        theme: 'default',
                        aspectRatio: 4.0/3.0
                    };
                }
                // Parse any other global options:
                // #1: Global slide transitions
                let globalSlideTransition = (head.block.nodes.find(e => e.name == 'slide-transitions') || { attrs: undefined }).attrs;
                if (globalSlideTransition) {
                    let entrance = eval((globalSlideTransition.find(e => e.name=='entrance') || { val: undefined }).val);
                    let exit = eval((globalSlideTransition.find(e => e.name=='exit') || { val: undefined }).val);
                    let durationEach = eval((globalSlideTransition.find(e => e.name=='durationEach') || { val: undefined }).val);
                    if (entrance && exit && durationEach) {
                        globalSlideTransition = {
                            entrance: entrance,
                            exit: exit,
                            durationEach: durationEach
                        };
                    } else globalSlideTransition = undefined;
                }
                log.debug(globalSlideTransition)

                // Parse the body
                let body = ast.nodes.find((e) => e.name == 'body');
                body = resolvePaths(body, filePath);
                let slides = body.block.nodes.map((slideAst, slideNumber) => {      // loop through all the slide
                    if (mixins != undefined) slideAst.block.nodes.unshift(mixins);               // add mixins to this slide ast
                    log.debug('Parsing slide %d', slideNumber);

                    // Parse specific slide options
                    let slideTransition = slideAst.attrs;
                    if (slideTransition) {  // override global
                        let entrance = eval((slideTransition.find(e => e.name=='entrance') || { val: undefined }).val);
                        let exit = eval((slideTransition.find(e => e.name=='exit') || { val: undefined }).val);
                        let durationEach = eval((slideTransition.find(e => e.name=='durationEach') || { val: undefined }).val);
                        if (entrance && exit && durationEach) {
                            slideTransition = {
                                entrance: entrance,
                                exit: exit,
                                durationEach: durationEach
                            };
                        } else slideTransition = globalSlideTransition;
                    } else {
                        slideTransition = globalSlideTransition;    // fallback
                    }
                    log.debug(slideTransition);

                    // Find and parse all animations
                    let parsedAnimationList = null;
                    let animationListBlock = slideAst.block.nodes.find(e => e.name == 'animation-list');
                    if (animationListBlock === undefined) {
                        log.debug("No animations found.");
                        parsedAnimationList = [];
                    }
                    else {
                        // Find and remove item from slide content
                        let idx = slideAst.block.nodes.indexOf(animationListBlock);
                        if (idx == -1) throw "Animation found but not found?";
                        slideAst.block.nodes.splice(idx, 1);

                        let animationList = animationListBlock.block.nodes;
                        const triggers = ["onClick", "withPrevious", "afterPrevious", "fromPrevious"];

                        parsedAnimationList = animationList.map(item => {
                            let animationItem = {
                                name: undefined,
                                type: undefined,
                                target: undefined,
                                trigger: "onClick",
                                delay: "0s",
                                duration: "1s"
                            }

                            item.attrs.forEach(attr => {    // parse the attributes
                                attr.val = eval(attr.val);
                                if (attr.name == "target")
                                    animationItem.target = '.slide ' + attr.val;
                                else if (triggers.includes(attr.val))
                                    animationItem.trigger = attr.val;
                                else if (attr.name == "delay")
                                    animationItem.delay = attr.val; // must be a fromPrevious attribute
                                else if (attr.name == "duration")
                                    animationItem.duration = attr.val;
                                else if (attr.name == "class") {
                                    animationItem.name = attr.val;
                                    animationItem.type = animationItem.name.includes('In') ? 'ENTRANCE' : (animationItem.name.includes('Out') ? 'EXIT' : 'EFFECT');
                                }
                            });

                            return animationItem;
                        });
                        log.debug("Parsed animations.");
                    }
                    
                    // Generate the slide html
                    log.debug("Generating slide html...");
                    var funcStr = generateCode(slideAst, {
                        compileDebug: false,
                        pretty: true,
                        inlineRuntimeFunctions: false,
                        templateName: 'helloWorld'  // a bit lost here but it works
                    });
                    var func = wrap(funcStr, 'helloWorld');
                    slideBodyHtml = func();
                    log.debug("Generated slide html");
                    
                    let slide = {
                        slideBody: slideBodyHtml,
                        slideNumber: slideNumber,
                        slideTransition: slideTransition,
                        animationList: parsedAnimationList
                    };
                    return slide;
                });
                log.debug("Parsed all slides");

                // Return the slideBody object
                presentation.slides = slides;
                log.debug("Saved all slides");
                resolve(presentation);
            })
            .catch(err => {
                log.error('Error parsing presentation %s: ', filePath, err);
                reject(err);
            });
    });
}

// parse the AST
function resolvePaths(node, srcFilePath) {
    if (node === undefined) return undefined;
    //log.debug(node);
    if (node.type === 'Tag') {
        node.block.nodes = node.block.nodes.map(child => {
            return resolvePaths(child, srcFilePath);
        });
    }

    if (node.name === 'img') {
        let idx = node.attrs.findIndex(a => { return a.name === 'src' });
        log.debug(idx);
        if (idx == -1); // TODO: throw an exception
        let tmp = node.attrs[idx].val;
        node.attrs[idx].val = '"' + path.join(path.dirname(srcFilePath), eval(node.attrs[idx].val)) + '"';
        log.debug(tmp + ' -> ' + node.attrs[idx].val);
    }

    return node;
}

