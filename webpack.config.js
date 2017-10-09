var path = require('path');

module.exports = {
    entry: "./dist/index",
    output: {
        path: path.resolve(__dirname, "dist/bundles/"),
        filename: "reactive-state.umd.js",
        library: "ReactiveState",
        libraryTarget: "umd"
    },
    resolve: {
        modules: [
            "node_modules"
        ],
        extensions: [".ts", ".js"],
    },
    module: {
        loaders: [
        ]
    },
    plugins: [
    ],
    node: {
        Buffer: false
    },
    context: __dirname,
    target: "web"
}
