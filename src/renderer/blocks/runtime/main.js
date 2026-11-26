import { bm } from 'bm://app/sdk/bm.js';
import { BlockLoader } from './BlockLoader.js';
import { BlockRuntime } from './BlockRuntime.js';
import { BlockStore } from './BlockStore.js';

bm.ready.then(async () => {
    const spec = JSON.parse(document.getElementById('bmb-spec').textContent);
    const settings = await bm.config('builder');
    const loader = new BlockLoader({
        doc: document,
        manifests: await bm.invoke('blocks:list'),
        systemBase: settings.systemBlocksBase,
        userBase: new URL('blocks/', document.baseURI).href
    });
    const runtime = new BlockRuntime({ bm, doc: document, root: document.getElementById('bmb-root'), store: new BlockStore(bm), loader });
    await runtime.start(spec);
});
