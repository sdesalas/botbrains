const botbrain = require('./');

let network = new botbrain.NeuralNetwork(200, 'ring', { signalSpeed: 50 });
let network2 = new botbrain.NeuralNetwork(100, 'ball');
//let network3 = new botbrain.NeuralNetwork(100, 'ring');

network.output(2);
network2.inputSite(4);

let mesh = network2.concat(network, 0.5);

botbrain.Toolkit.verbose = true;
botbrain.Toolkit.visualise(mesh);

setInterval(() => mesh.input(Math.random()), 1000);
