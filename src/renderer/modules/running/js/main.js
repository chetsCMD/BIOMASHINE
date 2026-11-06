import { bm } from 'bm://app/sdk/bm.js';
import { RunningModule } from './RunningModule.js';

bm.ready.then(() => new RunningModule(bm, document, window.Chart).start());