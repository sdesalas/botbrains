const botbrain = require('./');

const network = new botbrain.NeuralNetwork(120, { shape: 'classic' });

const output = network.output('OUTPUT', 3);
const input = network.input('INPUT', 3);

//network.join(network, 0.5, 0.5);

botbrain.Toolkit.verbose = true;
botbrain.Toolkit.visualise(network);

setInterval(() => input(Math.random()), 3000);
