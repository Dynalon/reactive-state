const path = require('path');
const UglifyJSPlugin = require('uglifyjs-webpack-plugin');

module.exports = {
    entry: "./src/index",
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
        extensions: [".js"],
    },
    module: {
        loaders: [
        ]
    },
    plugins: [
        new UglifyJSPlugin()
    ],
    context: __dirname,
    target: "web"
}
