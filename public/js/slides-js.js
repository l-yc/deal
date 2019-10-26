window.onload = function() {

    document.getElementById('slide-control-prev').onclick = prevClick;
    document.getElementById('slide-control-next').onclick = nextClick;
}

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
