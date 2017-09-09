const botbrain = require('./');

const network = new botbrain.NeuralNetwork(160, 'ring');

network.output('OUTPUT', [155,156]);
//network.output(2);
var input = network.input('INPUT', [3,5,7,9]);
//network.inputSite(4);

botbrain.Toolkit.verbose = true;
botbrain.Toolkit.visualise(network);

setInterval(() => input(Math.random()), 200);
