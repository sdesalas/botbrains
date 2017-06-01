import commonJs from 'rollup-plugin-commonjs';
import resolve from 'rollup-plugin-node-resolve';

export default {
    entry: 'src/NeuralNetwork.js',
    dest: 'static/NeuralNetwork.js',
    moduleName: 'botbrain.NeuralNetwork',
    format: 'umd',
    plugins: [
        commonJs(),
        resolve({
            preferBuiltins: false,
            main: true
        })
    ]
};
