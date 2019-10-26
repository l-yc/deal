window.onload = function() {
    document.getElementById('slide-control-prev').onclick = prevClick;
    document.getElementById('slide-control-next').onclick = nextClick;
    document.getElementById('slide-control-fullscreen').onclick = presentFullscreen;
}

/** Slide Playback Controls **/
let stack = [];
console.log(slideNumber);
console.log(animationList);

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

function prevClick() {
    if (stack.length == 0) {
        // move on to previous slide
        window.location.href=`${getLoc}/${slideNumber-1}`;
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
        window.location.href=`${getLoc}/${slideNumber+1}`;
    }
    else do {
        let item = animationList.shift();
        animate(item);
        stack.push(item);   // add to history stack
    } while (animationList.length > 0 && animationList[0].trigger != 'onClick');
}

$(document).ready(function() {
    while (animationList.length > 0 && animationList[0].trigger != 'onClick') {
        let item = animationList.shift();
        animate(item);
    }
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

document.onfullscreenchange = function ( event ) {
    let sidebar = document.querySelector('.sidebar');
    let slideControls = document.querySelector('.slide-controls');

    let slide = document.querySelector('.slide');

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

        let maxWidth  = 0.8 * (window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth),
            maxHeight = 0.8 * (window.innerHeight|| document.documentElement.clientHeight|| document.body.clientHeight);
        if (maxWidth > maxHeight) slide.style.height = maxHeight, slide.style.width  = maxHeight * aspectRatio;
        else                      slide.style.width  = maxWidth , slide.style.height = maxWidth  / aspectRatio;

        console.log(maxWidth, maxHeight);
    }
};

