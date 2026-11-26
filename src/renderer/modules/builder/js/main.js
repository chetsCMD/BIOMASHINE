import { bm } from 'bm://app/sdk/bm.js';
import { BuilderApp } from './BuilderApp.js';

bm.ready.then(() => new BuilderApp(bm, document).start());
