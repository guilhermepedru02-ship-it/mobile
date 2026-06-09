import { env, pipeline } from '@xenova/transformers';

env.backends.onnx.wasm.numThreads = 1;
env.backends.onnx.wasm.wasmPaths = '/storage/emulated/0/Workspace/Scripts/core/node_modules/onnxruntime-web/dist/';

async function test() {
    try {
        console.log("Loading pipeline...");
        const embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', { quantized: true });
        console.log("Pipeline loaded!");
        const out = await embedder("Test");
        console.log("Success:", out);
    } catch (e) {
        console.error("Error:", e);
    }
}
test();
