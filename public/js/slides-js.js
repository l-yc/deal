let slideNumber, animationList, numberOfSlides, stack;

window.onload = function() {
    document.getElementById('slide-control-prev').onclick = prevClick;
    document.getElementById('slide-control-next').onclick = nextClick;
    document.getElementById('slide-control-fullscreen').onclick = presentFullscreen;
}

/** Load data **/
function loadSlide(newSlideNumber) {
    let target = `${getLoc}/${newSlideNumber}`;
    console.log(target);
    $.get(target, function(data, status){
        if (data.err) {
            return;
        } else {
            console.log("Data: " + JSON.stringify(data) + "\nStatus: " + status);
            //aspectRatio = eval(data.aspectRatio);
            //slideHead = unescape(data.slideHead);
            //slideTitle = data.slideTitle;
            slideBody = unescape(data.slideBody);
            slideNumber = parseInt(data.slideNumber);
            numberOfSlides = data.numberOfSlides;
            animationList = data.animationList;

            document.querySelector('.slide').innerHTML = slideBody;
            document.querySelector('#slide-progress-indicator').innerHTML = `${slideNumber} / ${numberOfSlides}`;

            resizeSlide();
            initAnimations();
        }
    });
}

/** Slide Playback Controls **/
//console.log(slideNumber);
//console.log(animationList);

function unanimate(item) {
    $(item.target).removeClass('animated').addClass('hidden').addClass(item.type);
}

function animate(item) {
    if (item.trigger == 'afterPrevious') {
        setTimeout(function () {
            $(item.target).removeClass('hidden').addClass('animated').addClass(item.type)
        }, 1000);
    }
    else {
        $(item.target).removeClass('hidden').addClass('animated').addClass(item.type);
    }
}

function initAnimations() {
    stack = [];
    while (animationList.length > 0 && animationList[0].trigger != 'onClick') {
        let item = animationList.shift();
        animate(item);
    }
}

function prevClick(event) {
    if (stack.length == 0) {
        // move on to previous slide
        loadSlide(slideNumber-1);
        //window.location.href=`${getLoc}/${slideNumber-1}`;
    }
    else {  // we only undo 1 animation at a time
        let item = stack.pop();
        unanimate(item);
        animationList.unshift(item);   // push back into animation deque to be replayed
    }
}

function nextClick(event) {
    if (animationList.length == 0) {
        // move on to next slide
        loadSlide(slideNumber+1);
        //window.location.href=`${getLoc}/${slideNumber+1}`;
    }
    else do {
        let item = animationList.shift();
        animate(item);
        stack.push(item);   // add to history stack
    } while (animationList.length > 0 && animationList[0].trigger != 'onClick');
}

$(document).ready(function() {
    loadSlide(0);
});

$(document).on('click', '.slide', nextClick);

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

function resizeSlide() {
    let slide = document.querySelector('.slide');

    let maxWidth  = 0.8 * (window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth),
        maxHeight = 0.8 * (window.innerHeight|| document.documentElement.clientHeight|| document.body.clientHeight);
    if (maxWidth > maxHeight) slide.style.height = maxHeight, slide.style.width  = maxHeight * aspectRatio;
    else                      slide.style.width  = maxWidth , slide.style.height = maxWidth  / aspectRatio;

    console.log(slide);
    console.log(aspectRatio);
    console.log(maxWidth + " x " + maxHeight);
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
        if (maxWidth > maxHeight) slide.style.height = maxHeight, slide.style.width  = maxHeight * aspectRatio;
        else                      slide.style.width  = maxWidth , slide.style.height = maxWidth  / aspectRatio;
        console.log(maxWidth, maxHeight);

    } else {
        sidebar.style.display = 'initial';
        slideControls.style.display = 'initial';
        resizeSlide();
        console.log(maxWidth, maxHeight);
    }
};

