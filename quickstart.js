let botbrain = require('./');

let network = new botbrain.NeuralNetwork(120, 'tube');

network.output(2);
network.channel(0);

botbrain.Toolkit.verbose = true;
botbrain.Toolkit.visualise(network);

setInterval(() => network.input(Math.floor(Math.random() * network.size)), 1000);
