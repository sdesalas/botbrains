const botbrain = require('./');

let network = new botbrain.NeuralNetwork(200, 'sausage', { signalSpeed: 50 });
let network2 = new botbrain.NeuralNetwork(100, 'ring');
let network3 = new botbrain.NeuralNetwork(200, 'ball');

network.output(2);
network3.inputSite(4);

let mesh = network3.concat(network2.concat(network, 0.5));

botbrain.Toolkit.verbose = true;
botbrain.Toolkit.visualise(mesh);

setInterval(() => mesh.input(Math.random()), 100);
