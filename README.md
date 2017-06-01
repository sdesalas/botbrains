# Bot Brain

Robot brain tools to automate your nodebot

## Interact with your brain in 3D.

You can watch signals travel across your nodebot neural network in 3D, as well as train your robot with positive and negative reinforcement.

![brain-3d.png](brain-3d.gif)

## Quick start

You need nodejs installed, version 6 or above.

```
$ mkdir my-bot && cd my-bot
$ npm install botbrain
$ npm start
```

The above will perform a quick test with a random visualization. For a full test you need to rig up a robot.

## Proper setup

You should be adding this to an existing robot project such as [johnny-five](http://johnny-five.io/).

Here is a longer example:

```
$ mkdir my-bot && cd my-bot
$ npm install johnny-five
$ npm install botbrain
```

### robot.js
```
var five = require("johnny-five");
var botbrain = require("botbrain");

var board = new five.Board({port: process.argv[2] || "" });

board.on("ready", function() {

    var network = new brainbox.NeuralNetwork(32);

    // PROXIMITY SENSOR INPUT
    var input = new five.Proximity({ pin: 10, freq: 200, controller: "HCSR04" });
    input.on("change", () => network.input(input.value, 0));

    // WHEEL OUTPUT
    var servo1 = new five.Servo.Continuous(3);
    var servo2 = new five.Servo.Continuous(5);

    // Reactions to data can be arbitrary.
    // It doesnt matter what gets mapped to what since
    // the robot will learn to coordinate itself
    // using positive and negative feedback.

    var output1 = network.output(2); // 2-bit output (0-3)
    var output2 = network.output(2); // 2-bit output (0-3)

    output1.on("data", move.bind(servo1, data));
    output2.on("data", move.bind(servo2, data));

    function move(data) {
        switch(data) {
            case 1: // Forward
                return this.ccw();
    		case 2: // Backward
                return this.cw();
 			default: // Or Nothing
                return;
    	}
    }

    // DISPLAY VIA LOCAHOST

    var display = botbrain.Toolkit.Visualise(network);

    console.log("Your brain is ready for interaction. Please open http://localhost:" + display.port);


});
```

Then run it!

```
$ node robot.js
```
