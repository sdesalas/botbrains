const botbrain = require('./');

const network = new botbrain.NeuralNetwork(200, 'sausage');

network.output([90,92]);
//network.output(2);
network.inputSite([3,5,7,9]);
//network.inputSite(4);

botbrain.Toolkit.verbose = true;
botbrain.Toolkit.visualise(network);

setInterval(() => network.input(Math.random()), 1000);
