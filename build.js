const { compile } = require('nexe')

buildTargets = [
    { target: 'linux-x64', output: './builds/deal-linux' },
    { target: 'macos-10.13.0', output: './builds/deal-macos' },
    { target: 'win32-x86-10.13.0', output: './builds/deal-win' },
];

Promise.all(buildTargets.map(bt => {
    return compile({
        input: './index.js',
        //build: true, //true: required to use patches
        //patches: [
        //    async (compiler, next) => {
        //        await compiler.setFileContentsAsync(
        //            'lib/new-native-module.js',
        //            'module.exports = 42'
        //        )
        //        return next()
        //    }
        //]
        target: bt.target,
        output: bt.output,
        resources: [
            './public/**/*',
            './views/**/*'
        ],
        //clean: true,
        fakeArgv: true
    });
})).then(() => {
    console.log('success')
});
