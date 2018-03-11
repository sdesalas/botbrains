const botbrain = require('./');

const network = new botbrain.NeuralNetwork(160, { connectionsPerNeuron: 8, shape: 'tube' });

console.log(network.export());

const output = network.output('OUTPUT', 3);
const input = network.input('INPUT', 3);

//network.join(network, 0.5, 0.5);

botbrain.Toolkit.verbose = true;
botbrain.Toolkit.visualise(network);

//console.log(network.synapses.length);

//setTimeout(() => input(Math.random()), 5000);
setInterval(() => input(Math.random()), 5000);
