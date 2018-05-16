const path = require('path');
const rxPaths = require('rxjs/_esm5/path-mapping');
const webpack = require('webpack');
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
        alias: rxPaths(),
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
        new webpack.optimize.ModuleConcatenationPlugin(),
        new UglifyJSPlugin()
    ],
    context: __dirname,
    target: "web"
}
