# Bot Brain

BotBrain is a set of artificial learning tools to automate an [Arduino](http://arduino.org)-based robot.

Its been built as part of an educational workshop on artificial learning specifically for [International Nodebots Day](https://www.eventbrite.com.au/e/international-nodebots-day-melbourne-2017-tickets-34845310261).

This material here is very basic and aimed more at communicating the core concept of a neural network through practice than dealing with all the theoretical stuff that is available out there.

## Interact with your robot's brain in 3D.

The key aspect of BotBrain is the ability to watch signals travel across your robot's neural network in 3D, and train it with positive and negative reinforcement.

![brain-3d.png](brain-3d.gif)

## Quick start

You need [NodeJS](https://nodejs.org/en/download/) installed, version 6 or above.

```sh
$ mkdir my-bot && cd my-bot
$ npm install botbrain
$ npm start
```

The above will perform a quick test with a random visualization. For a full test you need to rig up a robot.

## Proper setup

You should be adding this to an existing robot project such as [johnny-five](http://johnny-five.io/).

Here is a longer example:

```sh
$ mkdir my-bot && cd my-bot
$ npm install johnny-five
$ npm install botbrain
```

### robot.js
```js
var five = require("johnny-five");
var botbrain = require("botbrain");

var board = new five.Board({port: process.argv[2] || "" });

board.on("ready", function() {

    var network = new botbrain.NeuralNetwork(32);

    // PROXIMITY SENSOR INPUT
    var proximity = new five.Sensor({ pin: "A6", freq: 200 });
    proximity.on("change", () => network.input(proximity.value));

    // MOTOR OUTPUT
    var motor_l = new five.Motor({ pins: { pwm: 6, dir: 7, }, invertPWM: true, });
    var motor_r = new five.Motor({ pins: { pwm: 9, dir: 8, }, invertPWM: true, });

    // Reactions to data can be arbitrary.
    // It doesnt matter what gets mapped to what since
    // the robot will learn to coordinate itself
    // using positive and negative feedback.

    var output1 = network.output(2); // 2-bit output (0-3)
    var output2 = network.output(2); // 2-bit output (0-3)

    output1.on("data", move.bind(motor_l));
    output2.on("data", move.bind(motor_r));

    function move(data) {
    	switch(data) {
            case 1: // Forward
                return this.forward();
            case 2: // Backward
                return this.reverse();
            case 3: // Or Stop
                return this.stop();
    	}
    }

    // DISPLAY VIA LOCAHOST (http.Server)
    var server = botbrain.Toolkit.visualise(network);
    var address = server.address();

    console.log('Bot brain ready for interaction. Please open http://localhost:' + address.port);

});
```

Then run it!

```sh
$ node robot.js
```
## API :: NeuralNetwork

NeuralNetwork is a class in the botbrain module and can be loaded in the following ways:

```
import { NeuralNetwork } from 'botbrain'; // ES6  

const NeuralNetwork = require('botbrain').NeuralNetwork; // Node, CommonJS

const NeuralNetwork = (window || this).botbrain.NeuralNetwork; // Browser, in global context
```

### new NeuralNetwork(size, opts)

Generates a neural network.

- **`size`**: The number of neurons in the neural network
- **`opts`**: A map of settings for the network
    - `.shape`: Choice of 'tube', 'ring', 'ball', 'sausage', 'snake', or any other in [NetworkShaper.js](src/NetworkShaper.js). Defaults to 'tube'.
    - `.connectionsPerNeuron`: Average synapses per neuron. Defaults to 4.
    - `.signalSpeed`: Neurons per second. Defaults to 20.
    - `.signalFireThreshold`: Potential needed to trigger a chain reaction. Defaults to 0.3.
    - `.learningRate`: Max increase/decrease to connection strength when learning.
    - `.learningPeriod`: Milliseconds in the past on which learning applies. Defaults to 60,000 (60 seconds).
    - `.messageSize`: Number of neurons involved in each input/output channel. Defaults to 10 bits (ie 2^10 = 0-1024).

For example, to create a network of 100 neurons using all default options:

```
let network = new NeuralNetwork(100);
```

To create a ring-shaped network of 100 neurons with double the speed and learning rate.

```
let network = new NeuralNetwork(1000, { shape: 'ring', signalSpeed: 40, learningRate: 0.3 });
```
