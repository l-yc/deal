let name,
    slideNumber,
    slide,
    animationList,
    totalAnimations,
    numberOfSlides,
    stack,
    presentation = null,
    mathJaxLoader;

/** Hook up the listeners **/
$(document).ready(function() {
    mathJaxLoader = new Promise((resolve, reject) => {
        window.MathJax = {
            chtml: {
                scale: 1,                      // global scaling factor for all expressions
                minScale: .5,                  // smallest scaling factor to use
                matchFontHeight: true,         // true to match ex-height of surrounding font
                mtextInheritFont: false,       // true to make mtext elements use surrounding font
                merrorInheritFont: true,       // true to make merror text use surrounding font
                mathmlSpacing: false,          // true for MathML spacing rules, false for TeX rules
                skipAttributes: {},            // RFDa and other attributes NOT to copy to the output
                exFactor: .5,                  // default size of ex in em units
                displayAlign: 'center',        // default for indentalign when set to 'auto'
                displayIndent: '0',            // default for indentshift when set to 'auto'
                //fontURL: '[mathjax]/components/output/chtml/fonts/woff-v2',   // The URL where the fonts are found
                adaptiveCSS: true              // true means only produce CSS that is used in the processed equations
            },
            startup: {
                ready: () => {
                    MathJax.startup.defaultReady();
                    MathJax.startup.promise.then(() => {
                        console.log('MathJax initial typesetting complete');
                        resolve();
                    });
                }
            }
        };
        let script = document.createElement('script');
        script.src = '/mathjax/es5/tex-chtml.js';
        script.async = true;
        document.head.appendChild(script);
    });

    initSlideControls();
    initSlideHeader();
    initSidebar();

    let urlParams = new URLSearchParams(window.location.search);
    name = decodeURIComponent(urlParams.get('name')) || 0;
    slideNumber = parseInt(urlParams.get('slide')) || 0;

    loadSlide(slideNumber);
});

async function initSlideControls() {
    $(document).on('click', '.slide', nextClick);
    $(document).on('click', '#slide-control-prev', prevClick);
    $(document).on('click', '#slide-control-next', nextClick);
    $(document).on('click', '#slide-control-fullscreen', presentFullscreen);
    $(document).keydown(function(event) {
        event = event || window.event;
        switch (event.keyCode) {
            case 37:    // left
            case 38:    // up
                prevClick();
                break;

            case 39:    // right
            case 40:    // down
            case 32:    // space
            case 13:    // enter
                nextClick();
                break;
        }
    });
}

async function initSlideHeader() {
    $('#slide-header-sidebar-button').click(function() {
        let sidebar = document.querySelector('#sidebar');
        if (sidebar.style.opacity == 1) {
            sidebar.ontransitionend = () => { 
                sidebar.ontransitionend = null;
                sidebar.style.opacity = 0;
            }

            sidebar.style.marginLeft = -sidebar.offsetWidth;
        } else {
            sidebar.style.opacity = 1;
            sidebar.style.marginLeft = 0;
		}
    });
}

// this function might take sometime once we implement slide list
async function initSidebar() { 
    $('#sidebar a').click(function() {
        let contents = $(this).siblings('ul');
        if(contents.css('display') == 'none') {
            contents.slideDown();
            $(this).children('i').removeClass('fa-plus').addClass('fa-minus');
        } else {
            contents.slideUp();
            $(this).children('i').removeClass('fa-minus').addClass('fa-plus');
        }
    });
}

/** Load data **/
async function loadPresentation() {
    let target = window.location.origin + '/slides/data';
    console.log('querying ' + target);
    return new Promise((resolve, reject) => {
        $.get(target, { name: name })
            .done(function(data, status){
                //console.log("Data: " + JSON.stringify(data) + "\nStatus: " + status);
                presentation = data.presentation;
                Object.freeze(presentation);    // we don't want to ever modify the original object
                numberOfSlides = presentation.slides.length;
                document.querySelector('#slide-title').innerHTML = presentation.meta.name;

                let link = document.createElement('link');
                link.rel = 'stylesheet';
                link.type = 'text/css';
                link.href = '/themes/' + presentation.meta.theme + '.css';
                link.media = 'all';
                document.head.appendChild(link);

                resolve();
            })
            .fail(function(err) {
                console.log(err);
                reject(err);
            });
    });
}

async function loadSlide(newSlideNumber) {
    if (presentation == null) {
        try {
            await loadPresentation();
        } catch (err) {
            alert(decodeURIComponent(JSON.stringify(err.responseJSON,null,4)));
            return;
        }
    }

    if (newSlideNumber < 0 || newSlideNumber > numberOfSlides)
        return;

    console.log('load slide ' + newSlideNumber);
    window.history.replaceState({name: name, slide: newSlideNumber}, "Slide "+newSlideNumber, "?name=" + encodeURIComponent(name) + "&slide="+newSlideNumber);
    if (newSlideNumber === numberOfSlides) {
        // Invalid slide number, we'll just assume it's the end of presentation
        slide = null;
        slideBody  = '<p-slide><h1> End of Presentation </h1></p-slide>';
        slideNumber = numberOfSlides;
        animationList = [];
        totalAnimations = 0;

        document.querySelector('.slide').innerHTML = slideBody;
        document.querySelector('#slide-progress-indicator').innerHTML = `${slideNumber} / ${numberOfSlides}`;
    } else {
        slide = JSON.parse(JSON.stringify(presentation.slides[newSlideNumber]));    // deep copy for manipulation
        slideBody = decodeURIComponent(slide.slideBody);
        slideNumber = parseInt(slide.slideNumber);
        animationList = slide.animationList;
        totalAnimations = animationList.length;

        document.querySelector('.slide').innerHTML = slideBody;
        document.querySelector('#slide-progress-indicator').innerHTML = `${slideNumber} / ${numberOfSlides}`;
    }

    mathJaxLoader = mathJaxLoader
        .then(() => {
            return MathJax.typesetPromise();
        })
        .catch(err => {
            console.log('Typeset failed: ' + err.message);
        });

    updateSlide();
    initAnimations();
}

/** Slide Playback Controls **/
function unanimate(item) {
    const node = document.querySelector(item.target);

    if (item.type == 'ENTRANCE') node.classList.add('hidden');
    if (item.type == 'EXIT') node.classList.remove('hidden');
}

function animate(item) {
    const node = document.querySelector(item.target);

    if (item.type == 'ENTRANCE') node.classList.remove('hidden');
    if (item.trigger == 'fromPrevious') {
        setTimeout(function() {
            node.classList.add('animated', item.name);
        }, item.delay * 1000);
    } else node.classList.add('animated', item.name);

    return new Promise((resolve, reject) => {
        function handleAnimationEnd() {
            if (item.type == 'EXIT') node.classList.add('hidden');

            node.classList.remove('animated', item.name)
            node.removeEventListener('animationend', handleAnimationEnd)
            resolve();
        }
        node.addEventListener('animationend', handleAnimationEnd);
    });
}

async function initAnimations() {
    stack = [];
    let prvAnimationComplete = null;
    while (animationList.length > 0 && animationList[0].trigger != 'onClick') {
        let item = animationList.shift();
        if (item.trigger == 'afterPrevious' && prvAnimationComplete)
            await prvAnimationComplete;
        prvAnimationComplete = animate(item);
        stack.push(item);   // add to history stack
    }
    document.querySelector('#animation-progress-indicator').innerHTML = `${stack.length} / ${totalAnimations}`;
}

async function prevClick(event) {
    if (stack.length == 0) {
        // move on to previous slide
        loadSlide(slideNumber-1);
    }
    else {  // we only undo 1 animation at a time
        let item = stack.pop();
        unanimate(item);
        animationList.unshift(item);   // push back into animation deque to be replayed
    }
    document.querySelector('#animation-progress-indicator').innerHTML = `${stack.length} / ${totalAnimations}`;
}

async function nextClick(event) {
    if (animationList.length == 0) {
        // move on to next slide
        loadSlide(slideNumber+1);
    }
    else do {
        let item = animationList.shift();
        if (item.trigger == 'afterPrevious' && prvAnimationComplete)
            await prvAnimationComplete;
        prvAnimationComplete = animate(item);
        stack.push(item);   // add to history stack
    } while (animationList.length > 0 && animationList[0].trigger != 'onClick');
    document.querySelector('#animation-progress-indicator').innerHTML = `${stack.length} / ${totalAnimations}`;
}

/** Other Slide Controls **/
function requestFullScreen(element) {
    // Supports most browsers and their versions.
    var requestMethod = element.requestFullScreen || element.webkitRequestFullScreen || element.mozRequestFullScreen || element.msRequestFullScreen;

    if (requestMethod) { // Native full screen.
        requestMethod.call(element);
    } else if (typeof window.ActiveXObject !== "undefined") { // Older IE.
        var wscript = new ActiveXObject("WScript.Shell");
        if (wscript !== null) {
            wscript.SendKeys("{F11}");
        }
    }
}

function presentFullscreen() {
    //var elem = document.querySelector('.slide'); // Make the slide go full screen.
    var elem = document.body;
    requestFullScreen(elem);
}

let resizeTimer; // Set resizeTimer to empty so it resets on page load
window.onresize = function(event) {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(updateSlide, 100)
}

//document.onfullscreenchange = function ( event ) {
//    updateSlide();
//};

/** Slide Geometry Manipulators */
function updateSlide() {
    let slideHeader = document.querySelector('#slide-header');
    let sidebar = document.querySelector('#sidebar');
    let slideControls = document.querySelector('#slide-controls');

    let maxWidth, maxHeight;
    if (document.fullscreenElement) {
        // hide all the unnecessary stuff
        slideHeader.style.display = 'none';
        sidebar.style.display = 'none';
        slideControls.style.display = 'none';

        maxWidth = screen.availWidth,
        maxHeight = screen.availHeight;
    } else {
        slideHeader.style.display = 'flex';
        sidebar.style.display = 'initial';
        slideControls.style.display = 'initial';

        maxWidth  = 0.8 * (window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth),
        maxHeight = 0.8 * (window.innerHeight|| document.documentElement.clientHeight|| document.body.clientHeight);
    }


    resizeSlide(maxWidth, maxHeight);
    scaleSlideText();
}

function resizeSlide(maxWidth, maxHeight) {
    let slide = document.querySelector('.slide');

    if (maxWidth > maxHeight) slide.style.height = maxHeight, slide.style.width  = maxHeight * presentation.meta.aspectRatio;
    else                      slide.style.width  = maxWidth , slide.style.height = maxWidth  / presentation.meta.aspectRatio;
}

function scaleSlideText() {
    let slide = document.querySelector('.slide');
    let width = parseInt(slide.style.width),
        height = parseInt(slide.style.height);

    // we'll only need to fit height, since width is wrapped
    let lo = 0, hi = parseInt(height);
    //console.log('seed: ' + lo + ' - ' + hi);
    while (hi - lo > 1) {
        let mid = (lo + hi)/2;

        slide.style.fontSize = mid; // since all text are based on em
        let contentHeight = slide.scrollHeight;
        if (contentHeight <= height) lo = mid;
        else hi = mid;

        //console.log(`lo ${lo} hi ${hi} :: mid ${mid} cur: ${contentHeight} vs tgt: ${height}`);
    }
    let scaledEm = lo;

    // sanity check, make sure the unit isn't greater than 1/25 of the slide
    let maxEm = (height/25.0) / 1.17;
    //console.log('max ' + maxEm);
    scaledEm = Math.min(scaledEm, maxEm);

    slide.style.fontSize = scaledEm + 'px'; // since all text are based on em
    console.log('setting font size to ' + scaledEm + ' = ' + slide.style.fontSize);
}
