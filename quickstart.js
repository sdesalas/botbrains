const botbrain = require('./');

const network = new botbrain.NeuralNetwork(100, 'tube');

const output = network.output('OUTPUT', 3);
const input = network.input('INPUT', [3,5,7,9]);

//network.join(network, 0.5, 0.5);

botbrain.Toolkit.verbose = true;
botbrain.Toolkit.visualise(network);

setInterval(() => input(Math.random()), 200);
