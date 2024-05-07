import * as sn from "./smallneuron";
import * as sng from "./smallneuron-graph";
import { DirectedGraph } from "graphology";


describe('GraphMetadata Tests', () => {
    test('Test Metadata Creation', () => {
        const metadata: sng.ModelMetadata = new sng.ModelMetadata(3, 4, 0.03, "relu", "meanSquaredError", 250, 3);

        expect(metadata.inputWidth).toBe(3);
        expect(metadata.outputWidth).toBe(4);
        expect(metadata.epochCount).toBe(250);
        expect(metadata.learningRate).toBeCloseTo(0.03);
        expect(metadata.lossFunction).toBe("meanSquaredError");
        expect(metadata.activationType).toBe('relu');
    });

});

describe('Graph Integration Tests', () => {
    test('Test Single Neuron to GraphModel', () => {
        const metadata: sng.ModelMetadata = new sng.ModelMetadata(1, 1, 0.03, "relu", "meanSquaredError", 5, 5);

        const graph = new DirectedGraph();

        // initialize input
        graph.addNode('in1', {
            type: "Input",
            output_ids: ['n1'],
            input_index: 0
        });


        // initialize neuron
        graph.addNode('n1', {
            type: "Neuron",
            input_width: 1,
            input_ids: ['in1'],
            output_ids: [],
            component: undefined
        });
        
        // connect neuron
        graph.addDirectedEdge('in1', 'n1');
        
        // create model
        const model: sng.GraphModel = new sng.GraphModel(metadata, graph);


        const input: sn.Tensor = sn.tensor(2);

        const expected: number = model.parameters[0].data * input.data + model.parameters[1].data;
        const result: sn.Tensor = model.forward([input])[0];

        expect(result.data).toBeCloseTo(expected > 0 ? expected : 0);

        result.backward();
        
        expect(model.parameters[0].grad).toBeCloseTo(expected > 0 ? input.data : 0);
        expect(model.parameters[1].grad).toBeCloseTo(expected > 0 ? 1 : 0);

    });

    test('Test Neuron Graph to GraphModel', () => {
        const metadata: sng.ModelMetadata = new sng.ModelMetadata(3, 4, 0.03, "relu", "meanSquaredError", 250, 3);

        const graph = new DirectedGraph();

        // initialize inputs
        for(let i = 1; i < 4; i++) {
            graph.addNode(`in${i}`, {
                type: "Input",
                input_width: 0,
                output_width: 1,
                input_ids: [],
                output_ids: ["n1", "n2"],
                input_index: i-1
            });
        }

        // initialize layer 1
        graph.addNode('n1', {
            type: "Neuron",
            input_width: 3,
            output_width: 1,
            input_ids: ['in1', 'in2', 'in3'],
            output_ids: ["n3", "n4"],
            component: undefined
        });
        graph.addNode('n2', {
            type: "Neuron",
            input_width: 3,
            output_width: 1,
            input_ids: ['in1', 'in2', 'in3'],
            output_ids: ["n3", "n4"],
            component: undefined
        });
        // connect layer 1
        for(let i = 1; i < 4; i++) {
            graph.addDirectedEdge(`in${i}`, 'n1');
            graph.addDirectedEdge(`in${i}`, 'n2');
        }
        
        // create layer 2
        graph.addNode('n3', {
            type: "Neuron",
            input_width: 2,
            output_width: 1,
            input_ids: ['n1', 'n2'],
            output_ids: [],
            component: undefined
        });
        graph.addNode('n4', {
            type: "Neuron",
            input_width: 2,
            output_width: 1,
            input_ids: ['n1', 'n2'],
            output_ids: [],
            component: undefined
        });
        // connect layer 2
        for(let i = 1; i < 3; i++) {
            graph.addDirectedEdge(`n${i}`, 'n3');
            graph.addDirectedEdge(`n${i}`, 'n4');
        }


        // create model
        const model: sng.GraphModel = new sng.GraphModel(metadata, graph);

        const outputs = model.forward([sn.tensor(1), sn.tensor(2), sn.tensor(3)]);

        expect(outputs instanceof Array).toBe(true);
        expect(outputs.length).toBe(2);
        expect(outputs[0].operation).toBe('relu');
        expect(outputs[1].operation).toBe('relu');

    });

    test('Test Layer Graph to GraphModel', () => {
        const metadata: sng.ModelMetadata = new sng.ModelMetadata(3, 2, 0.03, "relu", "meanSquaredError", 250, 3);

        const graph = new DirectedGraph();

        // initialize inputs
        for(let i = 1; i < 4; i++) {
            graph.addNode(`in${i}`, {
                type: "Input",
                input_width: 0,
                output_width: 1,
                input_ids: [],
                output_ids: ["l1"],
                input_index: i-1
            });
        }

        // initialize layer 1
        graph.addNode('l1', {
            type: "Layer",
            input_width: 3,
            output_width: 4,
            input_ids: ['in1', 'in2', 'in3'],
            output_ids: ["l2"],
            component: undefined
        });
        
        // connect layer 1
        for(let i = 1; i < 4; i++) {
            graph.addDirectedEdge(`in${i}`, 'l1');
        }
        
        // create layer 2
        graph.addNode('l2', {
            type: "Layer",
            input_width: 4,
            output_width: 3,
            input_ids: ['l1'],
            output_ids: ['l3'],
            component: undefined
        });
        
        // connect layer 2
        graph.addDirectedEdge('l1', 'l2');

        // create layer 3 (output layer)
        graph.addNode('l3', {
            type: "Layer",
            input_width: 3,
            output_width: 2,
            input_ids: ['l2'],
            output_ids: [],
            component: undefined
        });
        
        // connect layer 2
        graph.addDirectedEdge('l2', 'l3');


        // create model
        const model: sng.GraphModel = new sng.GraphModel(metadata, graph);

        const outputs = model.forward([sn.tensor(1), sn.tensor(2), sn.tensor(3)]);

        expect(outputs instanceof Array).toBe(true);
        expect(outputs.length).toBe(2);
        expect(outputs[0].operation).toBe('relu');
        expect(outputs[1].operation).toBe('relu');

    });

    test('Simple GraphModel Training Pass', () => {
        const metadata: sng.ModelMetadata = new sng.ModelMetadata(1, 1, 0.003, "relu", "meanSquaredError", 50, 50);

        const graph = new DirectedGraph();

        // initialize input
        graph.addNode('in1', {
            type: "Input",
            output_ids: ['n1'],
            input_index: 0
        });


        // initialize neuron
        graph.addNode('n1', {
            type: "Neuron",
            input_width: 1,
            input_ids: ['in1'],
            output_ids: [],
            component: undefined
        });
        
        // connect neuron
        graph.addDirectedEdge('in1', 'n1');
        
        // create model
        const model: sng.GraphModel = new sng.GraphModel(metadata, graph);

        // force parameter initialzations to be positive to avoid dead neuron
        model.parameters[0].data = 1;
        model.parameters[1].data = 1;

        // create training data y = 2x + 1
        const inputs: number[][] = [];
        for(let i = 0; i < 100; i++) {
            inputs.push([Math.floor(Math.random() * 30)]);
        }

        const outputs: number[][] = [];
        inputs.forEach(input => {
            outputs.push([input[0] * 2 + 1]);
        })


        const data: sng.TrainingData = {
            inputs: inputs,
            outputs: outputs
        }

        // train model to fit data
        model.train(data);

        // evaluate model and see if output value is as expected
        const result: sn.Tensor[] = model.forward([6]);
        expect(Math.round(result[0].data - (6*2 + 1)) ).toBeCloseTo(0);

    });

    test('Complex GraphModel Training Pass', () => {
        const metadata: sng.ModelMetadata = new sng.ModelMetadata(2, 1, 0.03, "relu", "meanSquaredError", 15, 200);

        const graph = new DirectedGraph();

        // initialize inputs
        for(let i = 1; i < 3; i++) {
            graph.addNode(`in${i}`, {
                type: "Input",
                input_width: 0,
                output_width: 1,
                input_ids: [],
                output_ids: ["l1"],
                input_index: i-1
            });
        }

        // initialize layer 1
        graph.addNode('l1', {
            type: "Layer",
            input_width: 2,
            output_width: 4,
            input_ids: ['in1', 'in2'],
            output_ids: ["l2"],
            component: undefined
        });
        
        // connect layer 1
        for(let i = 1; i < 3; i++) {
            graph.addDirectedEdge(`in${i}`, 'l1');
        }
        
        // create layer 2
        graph.addNode('l2', {
            type: "Layer",
            input_width: 4,
            output_width: 3,
            input_ids: ['l1'],
            output_ids: ['l3'],
            component: undefined
        });
        
        // connect layer 2
        graph.addDirectedEdge('l1', 'l2');

        // create layer 3 (output layer)
        graph.addNode('l3', {
            type: "Layer",
            input_width: 3,
            output_width: 1,
            input_ids: ['l2'],
            output_ids: [],
            component: undefined
        });
        
        // connect layer 2
        graph.addDirectedEdge('l2', 'l3');


        // create model
        const model: sng.GraphModel = new sng.GraphModel(metadata, graph);

        // create training data y = 2a + b
        const inputs: number[][] = [];
        for(let i = 0; i < 1000; i++) {
            const accuminputs: number[] = [];
            for(let j = 0; j < 2; j++) {
                accuminputs.push(Math.floor(Math.random() * 30));
            }
            inputs.push(accuminputs);
        }

        const outputs: number[][] = [];
        inputs.forEach(input => {
            outputs.push([input[0] * 2 + input[1]]);
        })


        const data: sng.TrainingData = {
            inputs: inputs,
            outputs: outputs
        }

        //model.train(data);


    });

});