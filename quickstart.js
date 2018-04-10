const botbrain = require('./');

const network = new botbrain.NeuralNetwork(120, { 
    // Modifiable Defaults
    shape: 'drum',              // shaper function name in NetworkShaper.js, try 'ball', 'ring', 'sausage', 'tube' etc.
    connectionsPerNeuron: 16,   // average synapses per neuron
    signalFireThreshold: 0.3,   // potential needed to trigger onward neuron
    signalSpeed: 20,            // neurons per second
    neuronRecovery: 1/5,        // neuron recovery as fraction of signal speed
    learningPeriod: 20 * 1000,  // milliseconds in the past on which learning applies
    learningRate: 0.05,         // max % increase/decrease to synapse strength when learning
    retentionRate: 0.95         // % retention of long term memory during learning
});

const output = network.output('OUTPUT', 3);
const input = network.input('INPUT', 3);

//network.join(network, 0.5, 0.5);

botbrain.Toolkit.verbose = true;
botbrain.Toolkit.visualise(network);

setInterval(() => input(Math.random()), 400);
