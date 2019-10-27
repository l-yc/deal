let currentPath = "";

/** Hook up the listeners **/
$(document).ready(function() {
    //$(document).on('click', '.slide', nextClick);
    //$(document).on('click', '#slide-control-prev', prevClick);
    //$(document).on('click', '#slide-control-next', nextClick);
    //$(document).on('click', '#slide-control-fullscreen', presentFullscreen);
    //$(document).keydown(function(event) {
    //    event = event || window.event;
    //    switch (event.keyCode) {
    //        case 37:    // left
    //        case 38:    // up
    //            prevClick();
    //            break;

    //        case 39:    // right
    //        case 40:    // down
    //        case 32:    // space
    //        case 13:    // enter
    //            nextClick();
    //            break;
    //    }
    //});

    let urlParams = new URLSearchParams(window.location.search);
    let targetPath = parseInt(urlParams.get('path')) || '/';

    loadDirectory(targetPath)
});

/** Load data **/
async function loadDirectory(targetPath) {
    let target = window.location.href.split("?")[0].split("#")[0] + '/data';
    console.log('querying ' + target);
    let request = new Promise((resolve, reject) => {
        $.get(target, { path: targetPath }, function(data, status){
            if (data.error) {
                reject(data.message);
                return;
            } else {
                currentPath = targetPath;
                console.log("Data: " + JSON.stringify(data) + "\nStatus: " + status);
                //presentation = data;
                //Object.freeze(presentation);    // we don't want to ever modify the original object
                //numberOfSlides = presentation.slides.length;
                //document.querySelector('#slide-title').innerHTML = presentation.meta.name;

                //let link = document.createElement('link');
                //link.rel = 'stylesheet';
                //link.type = 'text/css';
                //link.href = '/themes/' + presentation.meta.theme + '.css';
                //link.media = 'all';
                //document.head.appendChild(link);

                resolve(data);
            }
        });
    });

    request
        .then(data => {
            console.log('success');
            populateDirectoryViewer(data);
        })
        .catch(err => {
            console.log('failed');
        });
}

async function loadFile(targetPath) {
    window.location = window.location.origin + '/slide-viewer/view?name=' + encodeURIComponent(targetPath);
}

/** Update UI **/
async function populateDirectoryViewer(data) {
    let directoryViewer = document.querySelector('#directoryViewer');
    let directoryPath = document.querySelector('#directoryPath');
    let directoryListing = document.querySelector('#directoryListing');

    directoryPath.value = currentPath;

    while (directoryListing.firstChild) {
        directoryListing.removeChild(directoryListing.firstChild);
    }
    data.forEach(item => {
        let li = document.createElement('li');
        let a = document.createElement('a');
        if (item.isDirectory)
            a.onclick = event => loadDirectory(currentPath + item.name + '/');
        else
            a.onclick = event => loadFile(currentPath + item.name);
        a.innerText = item.name;
        li.appendChild(a);
        directoryListing.appendChild(li);
    });
};
