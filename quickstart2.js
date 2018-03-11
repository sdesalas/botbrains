const botbrain = require('./');

const network = new botbrain.NeuralNetwork(120, 'sausage', { signalSpeed: 20 });
const network2 = new botbrain.NeuralNetwork(140, 'ring');
const network3 = new botbrain.NeuralNetwork(160, 'sausage');

network.name = 'NUMBER 1';
network2.name = 'NUMBER 2';

const output1 = network.output('Wheel (L)', 2);
const output2 = network3.output('Wheel (R)', 6);

const input1 = network3.input('Photoresistor (R)');
const input2 = network.input('Photoresistor (L)', 4);

const mesh1 = network2.join(network, 0.5);
const mesh2 = network3.join(mesh1, 0.76);
mesh2.join(mesh2);

mesh1.learn();

//botbrain.Toolkit.verbose = true;
botbrain.Toolkit.visualise(mesh2);

output1.on('data', data => console.log('output1', data));
output2.on('data', data => console.log('output2', data));

setInterval(() => input1(Math.random()), 810);
setInterval(() => input2(Math.random()), 700);
