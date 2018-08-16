const path = require('path');
const rxPaths = require('rxjs/_esm5/path-mapping');
const webpack = require('webpack');
const UglifyJSPlugin = require('uglifyjs-webpack-plugin');

/**
 * TODO
 * This is just a stub, the resulting output bundle is far from being optimal. We must either use ES2015 modules for
 * typescript compilation or use awesome-typescript-plugin for tree shaking to work. Right now ALL of rxjs gets
 * bundled.
 */
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
    },
    plugins: [
        new webpack.optimize.ModuleConcatenationPlugin(),
        new UglifyJSPlugin()
    ],
    context: __dirname,
    target: "web",
    mode: "production"
}
