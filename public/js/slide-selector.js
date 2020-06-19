let currentPath = "";

/** Hook up the listeners **/
(async function() {
    window.onpopstate = function(event) {
        console.log("location: " + document.location + ", state: " + JSON.stringify(event.state));
        let urlParams = new URLSearchParams(window.location.search);
        let targetPath = (urlParams.has('path') ? decodeURIComponent(urlParams.get('path')) : '');

        loadDirectory(targetPath)
    };

    let urlParams = new URLSearchParams(window.location.search);
    console.log(window.location.search);
    console.log(urlParams.get('path'));
    let targetPath = (urlParams.has('path') ? decodeURIComponent(urlParams.get('path')) : '');

    loadDirectory(targetPath)
})();

/** Load data **/
async function loadDirectory(targetPath) {
    let target = window.location.origin + '/browse/data';
    let urlParams = new URLSearchParams({ path: targetPath });
    let url = target + '?' + urlParams.toString();
    console.log('querying ' + target + ' with ' + targetPath);
    fetch(url, { method: 'GET' })
        .then(response => response.json())
        .then(data => {
            if (data.error) throw(data.message);
            console.log("Data: " + JSON.stringify(data) + "\nStatus: " + status);
            console.log('success');
            populateDirectoryViewer(data);
        })
        .catch(err => {
            console.log('failed');
        });
}

async function loadFile(targetPath) {
    window.location = window.location.origin + '/slides/view?name=' + encodeURIComponent(targetPath);
}

/** Update UI **/
async function populateDirectoryViewer(data) {
    let directoryViewer = document.querySelector('#directoryViewer');
    let directoryPath = document.querySelector('#directoryPath');
    let directoryListing = document.querySelector('#directoryListing');

    if (currentPath == '')
        window.history.replaceState({path: currentPath}, 'navigate', "?path=" + encodeURIComponent(data.meta.path));
    else
        window.history.pushState({path: currentPath}, 'navigate', "?path=" + encodeURIComponent(data.meta.path));
    currentPath = data.meta.path;   // use the resolved path
    directoryPath.value = currentPath;  // update the ui

    while (directoryListing.firstChild) {
        directoryListing.removeChild(directoryListing.firstChild);
    }

    data.files.unshift({
        name: '..',
        isDirectory: true
    });

    data.files.forEach(item => {
        let li = document.createElement('li');
        let a = document.createElement('a');
        if (item.isDirectory)
            a.onclick = event => loadDirectory(currentPath + data.meta.sep + item.name);
        else
            a.onclick = event => loadFile(currentPath + data.meta.sep + item.name);
        a.innerText = item.name;
        li.appendChild(a);
        directoryListing.appendChild(li);
    });
};
