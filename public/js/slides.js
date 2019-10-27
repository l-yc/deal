let slideNumber,
    slide,
    animationList,
    totalAnimations,
    numberOfSlides,
    stack,
    presentation = null;

/** Hook up the listeners **/
//window.onload = function() {
//    document.getElementById('slide-control-prev').onclick = prevClick;
//    document.getElementById('slide-control-next').onclick = nextClick;
//    document.getElementById('slide-control-fullscreen').onclick = presentFullscreen;
//}

$(document).ready(function() {
    $(document).on('click', '.slide', nextClick);
    $(document).on('click', '#slide-control-prev', prevClick);
    $(document).on('click', '#slide-control-next', nextClick);
    $(document).on('click', '#slide-control-fullscreen', presentFullscreen);

    let urlParams = new URLSearchParams(window.location.search);
    slideNumber = urlParams.get('slide') || 0;

    loadSlide(slideNumber);
});

/** Load data **/
async function loadPresentation() {
    let target = window.location.href.split("?")[0].split("#")[0] + '/data';
    console.log('querying ' + target);
    return new Promise((resolve, reject) => {
        $.get(target, function(data, status){
            if (data.error) {
                reject(data.message);
                return;
            } else {
                //console.log("Data: " + JSON.stringify(data) + "\nStatus: " + status);
                presentation = data;
                numberOfSlides = presentation.slides.length;

                let link = document.createElement('link');
                link.rel = 'stylesheet';
                link.type = 'text/css';
                link.href = '/themes/' + presentation.meta.theme + '.css';
                link.media = 'all';
                document.head.appendChild(link);

                resolve();
            }
        });
    });
}

async function loadSlide(newSlideNumber) {
    if (presentation == null) await loadPresentation();

    if (newSlideNumber < 0 || newSlideNumber > numberOfSlides)
        return;

    window.history.replaceState({slide: newSlideNumber}, "Slide "+newSlideNumber, "?slide="+newSlideNumber);
    if (newSlideNumber === numberOfSlides) {
        // Invalid slide number, we'll just assume it's the end of presentation
        slide = null;
        slideBody  = '<p-slide><h1> End of Presentation </h1></p-slide>';
        slideNumber = numberOfSlides;
        animationList = [];
        totalAnimations = 0;

        document.querySelector('.slide').innerHTML = slideBody;
        document.querySelector('#slide-progress-indicator').innerHTML = 'End';
    } else {
        slide = presentation.slides[newSlideNumber];
        slideBody = unescape(slide.slideBody);
        slideNumber = parseInt(slide.slideNumber);
        animationList = slide.animationList;
        totalAnimations = animationList.length;

        document.querySelector('.slide').innerHTML = slideBody;
        document.querySelector('#slide-progress-indicator').innerHTML = `${slideNumber+1} / ${numberOfSlides}`;
    }
    console.log('refreshing');
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

document.onfullscreenchange = function ( event ) {
    let sidebar = document.querySelector('.sidebar');
    let slideControls = document.querySelector('.slide-controls');

    if (document.fullscreen) {
        // hide all the unnecessary stuff
        sidebar.style.display = 'none';
        slideControls.style.display = 'none';

        let maxWidth = screen.availWidth,
            maxHeight = screen.availHeight;
        resizeSlide(maxWidth, maxHeight);

    } else {
        sidebar.style.display = 'initial';
        slideControls.style.display = 'initial';
        updateSlide();
    }
};

/** Slide Geometry Manipulators */
function updateSlide() {
    let maxWidth  = 0.8 * (window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth),
        maxHeight = 0.8 * (window.innerHeight|| document.documentElement.clientHeight|| document.body.clientHeight);

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