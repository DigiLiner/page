const path = require('path');

module.exports = (env, argv) => {
    const isProduction = argv.mode === 'production';

    return {
        mode: argv.mode || 'development',
        entry: './renderer.ts',
        target: 'web',
        devtool: isProduction ? 'source-map' : 'eval-source-map',

        module: {
            rules: [
                {
                    test: /\.ts$/,
                    use: 'ts-loader',
                    exclude: /node_modules/,
                },
                {
                    test: /\.scss$/,
                    use: ['style-loader', 'css-loader', 'sass-loader'],
                },
                {
                    test: /\.css$/,
                    use: ['style-loader', 'css-loader'],
                },
            ],
        },

        resolve: {
            extensions: ['.ts', '.js'],
        },

        output: {
            filename: 'bundle.js',
            path: path.resolve(__dirname, 'dist'),
            publicPath: '/',
        },

        devServer: {
            static: {
                directory: path.join(__dirname, './'),
                watch: true,
            },
            compress: true,
            port: 8080,
            hot: true,
            open: true,
            historyApiFallback: {
                index: 'index.html'
            },
            client: {
                logging: 'info',
                overlay: true,
            },
        },

        watch: argv.mode === 'development',
    };
};
